import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { isOriginAllowed, jsonResponse } from '../_lib/security.js';
import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import { SHOPIFY_ADMIN_API_VERSION, SHOPIFY_STORE_DOMAIN } from '../_lib/shopify-config.js';
import { checkLucissiMembership } from '../_lib/partner-member.js';
import { getShopifyAdminAccessToken } from '../shopify/discounts.js';

/**
 * LUCISSI 會員在 LUCISSI CARE 的首單免運（會員互通第 1 階段）。
 *
 * 條件：已登入且 Email 已驗證、在 CARE 沒有已付款訂單、母站確認同一 Email 是 LUCISSI 會員。
 * 符合時在 Shopify 專屬折扣（LUCISSI_MEMBER_PERK_DISCOUNT_ID）下新增一組只屬於這位會員的代碼，
 * 並記錄在 public.partner_member_perks（每位會員一筆）。
 */

const PERK_DISCOUNT_ID_PATTERN = /^gid:\/\/shopify\/DiscountCodeNode\/\d+$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAID_PAYMENT_STATUSES = ['paid', 'partially_refunded'];
const PAID_ORDER_STATUSES = ['paid', 'shipped', 'completed'];

export function generatePerkCode(bytes: Buffer = randomBytes(10)): string {
  let code = 'LC';
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

function corsHeadersFor(requestOrigin: string | null): Record<string, string> {
  return { 'Access-Control-Allow-Origin': requestOrigin || '*' };
}

async function addPerkCodeToShopify(discountId: string, code: string): Promise<boolean> {
  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return false;

  const domain = SHOPIFY_STORE_DOMAIN || 'gh2xgs-zf.myshopify.com';
  const accessToken = await getShopifyAdminAccessToken(domain, clientId, clientSecret);
  if (!accessToken) return false;

  const mutation = `
    mutation AddMemberPerkCode($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
      discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) {
        bulkCreation { id }
        userErrors { field message }
      }
    }
  `;
  const response = await fetch(`https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query: mutation, variables: { discountId, codes: [{ code }] } }),
  });
  const payload = await response.json().catch(() => null) as {
    data?: { discountRedeemCodeBulkAdd?: { bulkCreation?: { id?: string } | null; userErrors?: Array<{ message?: string }> } };
    errors?: unknown;
  } | null;
  const result = payload?.data?.discountRedeemCodeBulkAdd;
  if (!response.ok || payload?.errors || !result?.bulkCreation?.id || (result.userErrors?.length ?? 0) > 0) {
    console.error('member perk code creation failed', JSON.stringify(result?.userErrors ?? payload?.errors ?? response.status));
    return false;
  }
  return true;
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
  const discountId = process.env.LUCISSI_MEMBER_PERK_DISCOUNT_ID?.trim() || '';
  if (!supabaseUrl || !publicKey || !adminClient || !PERK_DISCOUNT_ID_PATTERN.test(discountId)) {
    return jsonResponse({ success: false, code: 'PERK_UNAVAILABLE', message: '會員禮遇暫時無法領取，請稍後再試' }, { status: 503, headers });
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

  // 已領過：直接回傳原本那組代碼
  const { data: existing } = await adminClient
    .from('partner_member_perks')
    .select('coupon_code, status, claimed_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    return jsonResponse({ success: true, alreadyClaimed: true, perk: existing }, { status: 200, headers });
  }

  // 首單限定：在 CARE 已有付款完成的訂單就不符合
  const { data: paidOrders, error: ordersError } = await adminClient
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
    .or(`payment_status.in.(${PAID_PAYMENT_STATUSES.join(',')}),status.in.(${PAID_ORDER_STATUSES.join(',')})`)
    .limit(1);
  if (ordersError) {
    return jsonResponse({ success: false, code: 'PERK_UNAVAILABLE', message: '會員禮遇暫時無法領取，請稍後再試' }, { status: 503, headers });
  }
  if (paidOrders && paidOrders.length > 0) {
    return jsonResponse({ success: false, code: 'NOT_FIRST_ORDER', message: '此禮遇限首次在 LUCISSI CARE 購物使用' }, { status: 409, headers });
  }

  const membership = await checkLucissiMembership(user.email);
  if (membership === 'unavailable') {
    return jsonResponse({ success: false, code: 'PARTNER_UNAVAILABLE', message: '暫時無法確認 LUCISSI 會員資格，請稍後再試' }, { status: 503, headers });
  }
  if (membership === 'not_member') {
    return jsonResponse({
      success: false,
      code: 'NOT_LUCISSI_MEMBER',
      message: '查無以此 Email 註冊並完成驗證的 LUCISSI 會員',
    }, { status: 403, headers });
  }

  // 先寫入（user_id 為主鍵，避免同時重複領取），Shopify 建立失敗再刪除
  const couponCode = generatePerkCode();
  const { error: insertError } = await adminClient
    .from('partner_member_perks')
    .insert({ user_id: user.id, partner: 'lucissi', perk: 'first_order_free_shipping', coupon_code: couponCode });
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await adminClient
        .from('partner_member_perks')
        .select('coupon_code, status, claimed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      return jsonResponse({ success: true, alreadyClaimed: true, perk: raced }, { status: 200, headers });
    }
    return jsonResponse({ success: false, code: 'PERK_UNAVAILABLE', message: '會員禮遇暫時無法領取，請稍後再試' }, { status: 503, headers });
  }

  const created = await addPerkCodeToShopify(discountId, couponCode).catch(() => false);
  if (!created) {
    await adminClient.from('partner_member_perks').delete().eq('user_id', user.id);
    return jsonResponse({ success: false, code: 'PERK_CODE_FAILED', message: '代碼建立失敗，請稍後再試' }, { status: 502, headers });
  }

  return jsonResponse({
    success: true,
    perk: { coupon_code: couponCode, status: 'issued' },
    message: 'LUCISSI 會員首單免運已領取，結帳時在購物車輸入代碼即可使用',
  }, { status: 200, headers });
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return OPTIONS(request);
  if (request.method === 'POST') return POST(request);
  return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } });
}

export default { fetch: handler };
