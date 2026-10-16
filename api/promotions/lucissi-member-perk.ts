import { createClient } from '@supabase/supabase-js';
import { isOriginAllowed, jsonResponse } from '../_lib/security.js';
import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import { checkLucissiMembership } from '../_lib/partner-member.js';
import { generatePerkCode } from '../_lib/member-perk-code.js';
import { createMemberPerkDiscount } from '../_lib/member-perk.js';

/**
 * LUCISSI 會員在 LUCISSI CARE 的首單免運（會員互通第 1 階段）。
 *
 * 條件：已登入且 Email 已驗證、在 CARE 沒有已付款訂單（含先認領同 Email 的訪客訂單）、
 * 母站確認同一 Email 是 LUCISSI 會員。符合時建立這位會員專屬的 Shopify 免運折扣
 * （單一代碼、總使用 1 次、綁定本人、60 天到期），紀錄在 public.partner_member_perks。
 *
 * 狀態：pending（建立中）→ issued（可使用）→ used／expired（首單未使用即停用）。
 */

const PAID_PAYMENT_STATUSES = ['paid', 'partially_refunded'];
const PAID_ORDER_STATUSES = ['paid', 'shipped', 'completed'];
const STALE_PENDING_MS = 2 * 60 * 1000;
const PUBLIC_PERK_COLUMNS = 'coupon_code, status, claimed_at, expires_at';

function corsHeadersFor(requestOrigin: string | null): Record<string, string> {
  return { 'Access-Control-Allow-Origin': requestOrigin || '*' };
}

export async function OPTIONS(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeadersFor(requestOrigin),
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
  const headers = corsHeadersFor(requestOrigin);
  const unavailable = () => jsonResponse({ success: false, code: 'PERK_UNAVAILABLE', message: '會員禮遇暫時無法領取，請稍後再試' }, { status: 503, headers });

  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') || '');
  if (!bearer) {
    return jsonResponse({ success: false, code: 'MEMBER_LOGIN_REQUIRED', message: '請先登入會員' }, { status: 401, headers });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  const adminClient = getSupabaseAdminClient();
  if (!supabaseUrl || !publicKey || !adminClient || process.env.LUCISSI_MEMBER_PERK_ENABLED !== 'true') {
    return unavailable();
  }

  const userClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer[1]}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(bearer[1]);
  const user = authData?.user;
  if (authError || !user) {
    return jsonResponse({ success: false, code: 'MEMBER_SESSION_INVALID', message: '登入狀態已逾期，請重新登入後再試' }, { status: 401, headers });
  }
  if (!user.email || !user.email_confirmed_at) {
    return jsonResponse({ success: false, code: 'EMAIL_NOT_VERIFIED', message: '請先完成 Email 驗證' }, { status: 403, headers });
  }
  const email = user.email.trim().toLowerCase();

  // 已有紀錄：可用或已結算就回傳；建立中則請稍候（逾時的建立中紀錄清掉重來）
  const { data: existing } = await adminClient
    .from('partner_member_perks')
    .select(`${PUBLIC_PERK_COLUMNS}, updated_at`)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    if (existing.status !== 'pending') {
      const { updated_at: _updatedAt, ...perk } = existing;
      return jsonResponse({ success: true, alreadyClaimed: true, perk }, { status: 200, headers });
    }
    if (Date.now() - new Date(existing.updated_at).getTime() < STALE_PENDING_MS) {
      return jsonResponse({ success: false, code: 'PERK_IN_PROGRESS', message: '正在建立代碼，請稍後再試' }, { status: 409, headers });
    }
    await adminClient.from('partner_member_perks').delete().eq('user_id', user.id).eq('status', 'pending');
  }

  // 首單限定：先同步認領同 Email 的訪客訂單，再檢查是否已有付款訂單
  const { error: claimError } = await userClient.rpc('claim_guest_orders');
  if (claimError) return unavailable();
  const { data: paidOrders, error: ordersError } = await adminClient
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
    .or(`payment_status.in.(${PAID_PAYMENT_STATUSES.join(',')}),status.in.(${PAID_ORDER_STATUSES.join(',')})`)
    .limit(1);
  if (ordersError) return unavailable();
  if (paidOrders && paidOrders.length > 0) {
    return jsonResponse({ success: false, code: 'NOT_FIRST_ORDER', message: '此禮遇限首次在 LUCISSI CARE 購物使用' }, { status: 409, headers });
  }

  const membership = await checkLucissiMembership(email);
  if (membership === 'unavailable') {
    return jsonResponse({ success: false, code: 'PARTNER_UNAVAILABLE', message: '暫時無法確認 LUCISSI 會員資格，請稍後再試' }, { status: 503, headers });
  }
  if (membership === 'not_member') {
    return jsonResponse({ success: false, code: 'NOT_LUCISSI_MEMBER', message: '查無以此 Email 註冊並完成驗證的 LUCISSI 會員' }, { status: 403, headers });
  }

  // 先寫入 pending（user_id 為主鍵，擋住同時重複領取），Shopify 建好才改為 issued
  const couponCode = generatePerkCode();
  const { error: insertError } = await adminClient
    .from('partner_member_perks')
    .insert({ user_id: user.id, email_normalized: email, coupon_code: couponCode, status: 'pending' });
  if (insertError) {
    if (insertError.code === '23505') {
      return jsonResponse({ success: false, code: 'PERK_IN_PROGRESS', message: '正在建立代碼，請稍後再試' }, { status: 409, headers });
    }
    return unavailable();
  }

  const discount = await createMemberPerkDiscount({ code: couponCode, email }).catch(() => undefined);
  if (!discount) {
    await adminClient.from('partner_member_perks').delete().eq('user_id', user.id).eq('status', 'pending');
    return jsonResponse({ success: false, code: 'PERK_CODE_FAILED', message: '代碼建立失敗，請稍後再試' }, { status: 502, headers });
  }

  const { data: issued, error: issueError } = await adminClient
    .from('partner_member_perks')
    .update({ status: 'issued', shopify_discount_id: discount.id, expires_at: discount.endsAt, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select(PUBLIC_PERK_COLUMNS)
    .single();
  if (issueError || !issued) {
    console.error('member perk could not be finalized after Shopify creation', discount.id);
    return unavailable();
  }

  return jsonResponse({
    success: true,
    perk: issued,
    message: 'LUCISSI 會員首單免運已領取，結帳時在購物車輸入代碼即可使用',
  }, { status: 200, headers });
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return OPTIONS(request);
  if (request.method === 'POST') return POST(request);
  return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } });
}

export default { fetch: handler };
