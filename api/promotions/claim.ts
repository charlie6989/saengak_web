import { isOriginAllowed, jsonResponse } from '../_lib/security.js';
import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import { fetchShopifyPromotionByCode } from '../shopify/discounts.js';
import { createClient } from '@supabase/supabase-js';

interface ClaimRequestBody {
  code?: unknown;
}

/**
 * 正規化並驗證前端傳入的折扣代碼。
 * 僅接受 1~50 字元的字串，trim 並轉大寫，避免大小寫或前後空白造成重複領取判定失準。
 */
function normalizeCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized.length < 1 || normalized.length > 50) return undefined;
  return normalized;
}

export async function OPTIONS(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': requestOrigin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
  };

  try {
    // 1. 驗證會員 Bearer session（比照 api/create-shopify-cart.ts 的寫法）
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return jsonResponse({
        success: false,
        message: '請先登入會員以領取優惠券',
        code: 'MEMBER_LOGIN_REQUIRED',
      }, { status: 401, headers: corsHeaders });
    }

    const bearerMatch = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!bearerMatch) {
      return jsonResponse({
        success: false,
        message: '登入狀態已逾期，請重新登入後再試',
        code: 'MEMBER_SESSION_INVALID',
      }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !publicKey) {
      return jsonResponse({
        success: false,
        message: '會員系統暫時無法使用，請稍後再試',
        code: 'MEMBERSHIP_AUTH_UNAVAILABLE',
      }, { status: 503, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${bearerMatch[1]}`,
        },
      },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) {
      return jsonResponse({
        success: false,
        message: '登入狀態已逾期，請重新登入後再試',
        code: 'MEMBER_SESSION_INVALID',
      }, { status: 401, headers: corsHeaders });
    }
    const checkoutUserId = authData.user.id;

    // 2. 解析並正規化欲領取的折扣代碼
    const body = await request.json().catch(() => null) as ClaimRequestBody | null;
    const code = normalizeCode(body?.code);
    if (!code) {
      return jsonResponse({
        success: false,
        message: '折扣代碼格式錯誤，請重新確認',
        code: 'INVALID_CODE',
      }, { status: 400, headers: corsHeaders });
    }

    // 3. 一律以代碼向 Shopify 查證權威折扣資料；若 Shopify 服務暫時無法連線，則向 Supabase promotions 主表進行備援查證
    let promotion = await fetchShopifyPromotionByCode(code);
    let promotionId: string | null = null;

    if (!promotion && typeof userClient.from === 'function') {
      try {
        const { data: dbPromo } = await userClient
          .from('promotions')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .maybeSingle();

        if (dbPromo) {
          promotion = {
            id: dbPromo.id,
            code: dbPromo.code,
            title: dbPromo.title,
            subtitle: dbPromo.subtitle ?? undefined,
            description: dbPromo.description ?? undefined,
            category: dbPromo.category,
            discount_type: dbPromo.discount_type,
            discount_value: Number(dbPromo.discount_value),
            min_spend: Number(dbPromo.min_spend),
            min_quantity: null,
            starts_at: dbPromo.starts_at,
            ends_at: dbPromo.ends_at ?? undefined,
            badge_text: dbPromo.badge_text ?? undefined,
            image_url: dbPromo.image_url ?? undefined,
            is_active: dbPromo.is_active,
            applies_once_per_customer: dbPromo.applies_once_per_customer ?? true,
            usage_limit: dbPromo.usage_limit ?? null,
            async_usage_count: dbPromo.async_usage_count ?? 0,
            combines_with: dbPromo.combines_with ?? { order_discounts: false, product_discounts: false, shipping_discounts: false },
          };
          promotionId = dbPromo.id;
        }
      } catch (dbPromoErr) {
        console.warn('從 Supabase 查詢備援促銷活動失敗:', dbPromoErr);
      }
    }

    if (!promotion) {
      return jsonResponse({
        success: false,
        message: '折扣券服務暫時無法驗證，請稍後再試',
        code: 'PROMOTION_VERIFICATION_UNAVAILABLE',
      }, { status: 503, headers: corsHeaders });
    }

    // 4. 取得資料庫操作客戶端（若有 Service Role 則優先使用以支援自動 upsert 同調；若無則使用具備 RLS user_coupons_insert_own 權限之 userClient）
    const adminClient = getSupabaseAdminClient();
    const claimClient = adminClient || userClient;

    // 5. 若有 adminClient，將 Shopify 權威資料 upsert 進 public.promotions，取得穩定的 uuid 主鍵
    if (adminClient && !promotionId) {
      const { data: promotionRow, error: promotionUpsertError } = await adminClient
        .from('promotions')
        .upsert({
          code: promotion.code,
          title: promotion.title,
          subtitle: promotion.subtitle || null,
          description: promotion.description || null,
          category: promotion.category,
          discount_type: promotion.discount_type,
          discount_value: promotion.discount_value,
          min_spend: promotion.min_spend,
          starts_at: promotion.starts_at,
          ends_at: promotion.ends_at || null,
          badge_text: promotion.badge_text || null,
          image_url: promotion.image_url || null,
          is_active: true,
        }, { onConflict: 'code' })
        .select('id')
        .single();

      if (!promotionUpsertError && promotionRow?.id) {
        promotionId = promotionRow.id;
      } else if (promotionUpsertError) {
        console.warn('promotions upsert failed, falling back to query', promotionUpsertError);
      }
    }

    // 若尚未取得 promotionId，自 promotions 表查詢既有主檔 id
    if (!promotionId && typeof claimClient.from === 'function') {
      const { data: existingPromo } = await claimClient
        .from('promotions')
        .select('id')
        .eq('code', promotion.code)
        .maybeSingle();

      if (existingPromo?.id) {
        promotionId = existingPromo.id;
      }
    }

    if (!promotionId) {
      return jsonResponse({
        success: false,
        message: '促銷活動尚未啟用或主檔同步中，請稍後再試',
        code: 'PROMOTION_NOT_FOUND',
      }, { status: 404, headers: corsHeaders });
    }

    // 6. 將優惠券歸戶至會員名下（unique(user_id, promotion_id) 防重複領取）
    const { data: couponRow, error: couponInsertError } = await claimClient
      .from('user_coupons')
      .insert({
        user_id: checkoutUserId,
        promotion_id: promotionId,
        coupon_code: code,
        status: 'available',
      })
      .select('*, promotion:promotions (*)')
      .single();

    if (couponInsertError) {
      if (couponInsertError.code === '23505') {
        // 已領取過：嘗試查回既有那筆優惠券供前端顯示（非必要，查詢失敗不影響已知結果）
        let existingCoupon: unknown;
        try {
          const { data: existingRow } = await claimClient
            .from('user_coupons')
            .select('*, promotion:promotions (*)')
            .eq('user_id', checkoutUserId)
            .eq('promotion_id', promotionId)
            .maybeSingle();
          existingCoupon = existingRow ?? undefined;
        } catch (lookupErr) {
          console.warn('查詢既有優惠券失敗（不影響已領取判定）:', lookupErr);
        }

        return jsonResponse({
          success: false,
          message: '您已領取過此張優惠券',
          alreadyClaimed: true,
          coupon: existingCoupon,
        }, { status: 200, headers: corsHeaders });
      }

      console.error('user_coupons insert failed', couponInsertError);
      return jsonResponse({
        success: false,
        message: '優惠券歸戶失敗，請稍後再試',
        code: 'COUPON_CLAIM_FAILED',
      }, { status: 502, headers: corsHeaders });
    }

    return jsonResponse({
      success: true,
      message: '優惠券已成功歸戶至會員中心！',
      coupon: couponRow,
    }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('claim promotion coupon failed', error);
    return jsonResponse({ success: false, message: '領取失敗，請稍後再試' }, { status: 500, headers: corsHeaders });
  }
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return OPTIONS(request);
  if (request.method === 'POST') return POST(request);
  return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } });
}

export default { fetch: handler };
