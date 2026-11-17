// 貨到付款拒收停權（移植自 LUCISSI Lib/contracts/purchase-block.ts；2026-11-17 店主決定 CARE 比照）。
// 同一位 Shopify 顧客累計 refusalThreshold 筆訂單被標上 refusalTags（拒收、未取件），之後新下的訂單：
// 未付款自動取消、已付款或已出貨轉人工。標籤由客服在 Shopify 訂單上加；移除標籤即撤回該次拒收。

export interface PurchaseBlockPolicy {
  refusalThreshold: number;
  refusalTags: string[];
}

export type BlockedOrderAction = 'cancel' | 'manual_review' | 'none';

export const PURCHASE_BLOCK_POLICY: PurchaseBlockPolicy = {
  refusalThreshold: 2,
  refusalTags: ['拒收', '未取件'],
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Shopify REST webhook 的 tags 是逗號分隔的字串。 */
export function orderTags(orderValue: unknown): string[] {
  const tags = record(orderValue).tags;
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : [];
  return list.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean);
}

export function orderMarkedRefused(orderValue: unknown, policy: PurchaseBlockPolicy = PURCHASE_BLOCK_POLICY): boolean {
  const tags = new Set(orderTags(orderValue));
  return policy.refusalTags.some((tag) => tags.has(tag));
}

export function orderCustomerId(orderValue: unknown): string | null {
  const customer = record(record(orderValue).customer);
  const raw = customer.admin_graphql_api_id ?? customer.id;
  const value = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : typeof raw === 'string' ? raw : '';
  if (/^gid:\/\/shopify\/Customer\/[1-9]\d*$/.test(value)) return value;
  return /^[1-9]\d*$/.test(value) ? `gid://shopify/Customer/${value}` : null;
}

export function orderGid(orderValue: unknown): string | null {
  const order = record(orderValue);
  const raw = order.admin_graphql_api_id ?? order.id;
  const value = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : typeof raw === 'string' ? raw : '';
  if (/^gid:\/\/shopify\/Order\/[1-9]\d*$/.test(value)) return value;
  return /^[1-9]\d*$/.test(value) ? `gid://shopify/Order/${value}` : null;
}

/**
 * 只處理停權開始之後才下的訂單，不動被標拒收的那幾筆本身，也不動已取消或已出貨的訂單。
 * 不自動退款：未付款的取消，已付款的轉人工確認。
 */
export function blockedOrderAction(
  orderValue: unknown,
  blockedSince: string | null,
  policy: PurchaseBlockPolicy = PURCHASE_BLOCK_POLICY,
): BlockedOrderAction {
  const order = record(orderValue);
  if (!blockedSince || order.cancelled_at || orderMarkedRefused(order, policy)) return 'none';
  const created = Date.parse(String(order.created_at ?? ''));
  const since = Date.parse(blockedSince);
  if (!Number.isFinite(created) || !Number.isFinite(since) || created <= since) return 'none';
  const fulfillment = String(order.fulfillment_status ?? '').toLowerCase();
  if (fulfillment === 'fulfilled' || fulfillment === 'partial') return 'manual_review';
  const financial = String(order.financial_status ?? '').toLowerCase();
  return financial === 'pending' || financial === 'authorized' || financial === 'voided' ? 'cancel' : 'manual_review';
}
