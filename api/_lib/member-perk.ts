import type { SupabaseClient } from '@supabase/supabase-js';
import { SHOPIFY_ADMIN_API_VERSION, SHOPIFY_STORE_DOMAIN } from './shopify-config.js';
import { PERK_TITLE_PREFIX } from './member-perk-code.js';
import { getShopifyAdminAccessToken } from '../shopify/discounts.js';

/**
 * LUCISSI 會員首單免運：每位會員一個 Shopify 免運折扣。
 * - 只有一組代碼、總使用次數 1、每位顧客限用一次、60 天後到期；
 * - 預設綁定該會員 Email 的 Shopify 顧客，分享給別人也無法使用；
 * - 會員第一筆付款訂單若沒有使用這組代碼，webhook 會停用折扣（首單限定）。
 */

export const PERK_VALID_DAYS = 60;
const PAID_FINANCIAL_STATUSES = new Set(['paid', 'partially_refunded']);

type GraphqlResult<T> = { data?: T; errors?: unknown };

async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T | undefined> {
  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  const domain = SHOPIFY_STORE_DOMAIN || 'gh2xgs-zf.myshopify.com';
  const accessToken = await getShopifyAdminAccessToken(domain, clientId, clientSecret);
  if (!accessToken) return undefined;

  const response = await fetch(`https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => null) as GraphqlResult<T> | null;
  if (!response.ok || !payload || payload.errors) {
    console.error('member perk Shopify request failed', response.status, JSON.stringify(payload?.errors ?? null));
    return undefined;
  }
  return payload.data;
}

function bindToCustomer(): boolean {
  return process.env.LUCISSI_MEMBER_PERK_BIND_CUSTOMER !== 'false';
}

/** 找到或建立此 Email 的 Shopify 顧客，供折扣綁定。 */
async function resolveShopifyCustomerId(email: string): Promise<string | undefined> {
  const found = await adminGraphql<{ customers?: { nodes?: Array<{ id: string }> } }>(
    `query FindCustomer($query: String!) { customers(first: 1, query: $query) { nodes { id } } }`,
    { query: `email:"${email.replace(/"/g, '')}"` },
  );
  const existingId = found?.customers?.nodes?.[0]?.id;
  if (existingId) return existingId;

  const created = await adminGraphql<{ customerCreate?: { customer?: { id: string } | null; userErrors?: Array<{ message?: string }> } }>(
    `mutation CreateCustomer($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { message } } }`,
    { input: { email } },
  );
  return created?.customerCreate?.customer?.id ?? undefined;
}

/** 建立這位會員專屬的免運折扣，成功時回傳折扣 gid。Shopify 同步建立，回傳即可使用。 */
export async function createMemberPerkDiscount(options: { code: string; email: string; now?: Date }): Promise<{ id: string; endsAt: string } | undefined> {
  const now = options.now ?? new Date();
  const endsAt = new Date(now.getTime() + PERK_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let context: Record<string, unknown> = { all: 'ALL' };
  if (bindToCustomer()) {
    const customerId = await resolveShopifyCustomerId(options.email);
    if (!customerId) return undefined;
    context = { customers: { add: [customerId] } };
  }

  const result = await adminGraphql<{
    discountCodeFreeShippingCreate?: { codeDiscountNode?: { id: string } | null; userErrors?: Array<{ field?: string[]; message?: string }> };
  }>(
    `mutation CreateMemberPerk($input: DiscountCodeFreeShippingInput!) {
      discountCodeFreeShippingCreate(freeShippingCodeDiscount: $input) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      input: {
        title: `${PERK_TITLE_PREFIX}｜${options.code}`,
        code: options.code,
        startsAt: now.toISOString(),
        endsAt,
        usageLimit: 1,
        appliesOncePerCustomer: true,
        appliesOnOneTimePurchase: true,
        appliesOnSubscription: false,
        context,
        destination: { all: true },
        combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false },
      },
    },
  );
  const payload = result?.discountCodeFreeShippingCreate;
  if (!payload?.codeDiscountNode?.id || (payload.userErrors?.length ?? 0) > 0) {
    console.error('member perk discount creation failed', JSON.stringify(payload?.userErrors ?? null));
    return undefined;
  }
  return { id: payload.codeDiscountNode.id, endsAt };
}

export async function deactivateMemberPerkDiscount(discountId: string): Promise<boolean> {
  const result = await adminGraphql<{ discountCodeDeactivate?: { userErrors?: Array<{ message?: string }> } }>(
    `mutation DeactivateMemberPerk($id: ID!) { discountCodeDeactivate(id: $id) { codeDiscountNode { id } userErrors { message } } }`,
    { id: discountId },
  );
  return Boolean(result?.discountCodeDeactivate) && (result?.discountCodeDeactivate?.userErrors?.length ?? 0) === 0;
}

export interface PaidOrderForPerk {
  email: string;
  financialStatus: string;
  discountCodes: string[];
}

/** 從 Shopify 訂單 webhook payload 取出判斷首單權益所需的欄位。 */
export function readOrderForPerk(payload: Record<string, any>): PaidOrderForPerk | undefined {
  const email = String(payload?.email || payload?.contact_email || payload?.customer?.email || '').trim().toLowerCase();
  const financialStatus = String(payload?.financial_status || '').toLowerCase();
  if (!email) return undefined;
  const discountCodes = (Array.isArray(payload?.discount_codes) ? payload.discount_codes : [])
    .map((entry: any) => String(entry?.code || '').trim().toUpperCase())
    .filter(Boolean);
  return { email, financialStatus, discountCodes };
}

/**
 * 會員的第一筆付款訂單成立後結算權益：用了代碼 → used；沒用 → 停用 Shopify 折扣並標記 expired。
 * 失敗只記錄錯誤，不影響訂單同步。
 */
export async function settleMemberPerkAfterOrder(admin: SupabaseClient, order: PaidOrderForPerk): Promise<'used' | 'expired' | 'none'> {
  if (!PAID_FINANCIAL_STATUSES.has(order.financialStatus)) return 'none';

  const { data: perk } = await admin
    .from('partner_member_perks')
    .select('user_id, coupon_code, shopify_discount_id, status')
    .eq('email_normalized', order.email)
    .eq('status', 'issued')
    .maybeSingle();
  if (!perk) return 'none';

  if (order.discountCodes.includes(String(perk.coupon_code).toUpperCase())) {
    await admin.from('partner_member_perks').update({ status: 'used', updated_at: new Date().toISOString() }).eq('user_id', perk.user_id);
    return 'used';
  }

  if (perk.shopify_discount_id) {
    const deactivated = await deactivateMemberPerkDiscount(perk.shopify_discount_id);
    if (!deactivated) {
      console.error('member perk discount could not be deactivated after first order', perk.shopify_discount_id);
      return 'none';
    }
  }
  await admin.from('partner_member_perks').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('user_id', perk.user_id);
  return 'expired';
}
