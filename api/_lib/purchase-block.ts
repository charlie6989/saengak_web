/**
 * 貨到付款拒收停權的伺服器端（移植自 LUCISSI api/_lib/purchase-block.ts；2026-11-17 店主決定比照）。
 * - 每個訂單 webhook：同步拒收標籤（依訂單 updated_at 丟掉晚到的舊快照），停權後的新訂單未付款送出取消、
 *   已付款或已出貨轉人工；看到停權後的訂單確實已取消時才記為已取消；
 * - 建立結帳前：以會員或訪客的 Email 查詢是否已停權。
 * 規則見 src/domain/purchaseBlock.ts。資料表與 RPC 見 supabase/migrations/20261117124456_order_refusal_blocks.sql。
 */
import { SHOPIFY_ADMIN_API_VERSION, SHOPIFY_STORE_DOMAIN } from './shopify-config.js';
import { getShopifyAdminAccessToken } from '../shopify/discounts.js';
import {
  PURCHASE_BLOCK_POLICY,
  blockedOrderAction,
  orderCustomerId,
  orderGid,
  orderMarkedRefused,
  orderPlacedWhileBlocked,
  orderUpdatedAt,
  type PurchaseBlockPolicy,
} from '../../src/domain/purchaseBlock.js';

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
type Standing = { refusals: number; blockedSince: string | null; stale: boolean };

export const PURCHASE_BLOCKED_MESSAGE = '此帳號的貨到付款訂單已累計 2 次拒收或逾期未取件，已暫停購買。如有疑問請聯絡客服。';

function standing(value: unknown): Standing {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const blockedSince = typeof data.blockedSince === 'string' && Number.isFinite(Date.parse(data.blockedSince)) ? data.blockedSince : null;
  if (!Number.isSafeInteger(data.refusals) || Number(data.refusals) < 0) throw new Error('Invalid purchase block standing');
  return { refusals: Number(data.refusals), blockedSince, stale: data.stale === true };
}

/**
 * 以 Admin API 送出取消未付款訂單（需要 write_orders 權限）。這裡不重試。
 * 成功只代表 Shopify 已排入背景取消工作，不代表已取消；確認要等訂單 webhook 帶 cancelled_at。
 */
export async function cancelBlockedOrder(orderId: string): Promise<void> {
  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  const domain = SHOPIFY_STORE_DOMAIN || 'gh2xgs-zf.myshopify.com';
  if (!clientId || !clientSecret) throw new Error('Admin credentials unavailable');
  const accessToken = await getShopifyAdminAccessToken(domain, clientId, clientSecret);
  if (!accessToken) throw new Error('Admin token unavailable');
  const response = await fetch(`https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({
      query: 'mutation BlockedOrderCancel($orderId:ID!,$staffNote:String){orderCancel(orderId:$orderId,reason:OTHER,restock:true,notifyCustomer:true,staffNote:$staffNote){job{id} orderCancelUserErrors{code message}}}',
      variables: { orderId, staffNote: '拒收達門檻，帳號停止購買，系統自動取消' },
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { orderCancel?: { job?: { id?: unknown }; orderCancelUserErrors?: unknown[] } }; errors?: unknown } | null;
  const result = payload?.data?.orderCancel;
  if (!response.ok || payload?.errors || !result || !Array.isArray(result.orderCancelUserErrors)
    || result.orderCancelUserErrors.length || typeof result.job?.id !== 'string') {
    throw new Error('Order cancellation unconfirmed');
  }
}

function orderEmail(order: Record<string, unknown>): string | null {
  const customer = order.customer && typeof order.customer === 'object' ? order.customer as Record<string, unknown> : {};
  const raw = typeof order.email === 'string' && order.email ? order.email : typeof customer.email === 'string' ? customer.email : '';
  const email = raw.trim().toLowerCase();
  return email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * 每個訂單 webhook 呼叫：同步拒收標籤，再處理停權後才下的訂單。取消失敗只記錄、不讓 webhook 失敗，
 * 避免 Shopify 一直重送（最後停用訂閱）；之後的訂單更新事件會再試一次。
 */
export async function enforcePurchaseBlock(
  db: RpcClient,
  order: Record<string, unknown>,
  options: { policy?: PurchaseBlockPolicy; cancel?: (orderId: string) => Promise<void> } = {},
): Promise<{ action: string } | { error: Error }> {
  const policy = options.policy ?? PURCHASE_BLOCK_POLICY;
  const customerId = orderCustomerId(order);
  const shopifyOrderId = orderGid(order);
  if (!customerId || !shopifyOrderId) return { action: 'none' };
  const sourceUpdatedAt = orderUpdatedAt(order);
  if (!sourceUpdatedAt) return { error: new Error('Order webhook has no updated_at.') };
  const synced = await db.rpc('sync_order_refusal', {
    p_order_id: shopifyOrderId,
    p_customer_id: customerId,
    p_refused: orderMarkedRefused(order, policy),
    p_threshold: policy.refusalThreshold,
    p_source_updated_at: sourceUpdatedAt,
    p_customer_email: orderEmail(order),
  });
  if (synced.error) return { error: new Error('Unable to record order refusal.') };
  let current: Standing;
  try { current = standing(synced.data); } catch (error) { return { error: error as Error }; }
  // 舊快照：已有較新的版本處理過這筆訂單，不依舊資料取消或記錄
  if (current.stale) return { action: 'stale' };
  let outcome: 'cancel_pending' | 'cancelled' | 'manual_review' | 'cancel_failed';
  let detail: string;
  if (order.cancelled_at) {
    // 停權後的訂單已確實取消（系統送出的取消完成，或客服、顧客自行取消）
    if (!orderPlacedWhileBlocked(order, current.blockedSince, policy)) return { action: 'none' };
    outcome = 'cancelled';
    detail = '停權帳號的訂單已取消';
  } else {
    const action = blockedOrderAction(order, current.blockedSince, policy);
    if (action === 'none') return { action };
    outcome = 'manual_review';
    detail = '已付款或已出貨的停權帳號訂單，需人工確認退款與處理';
    if (action === 'cancel') {
      try {
        await (options.cancel ?? cancelBlockedOrder)(shopifyOrderId);
        outcome = 'cancel_pending';
        detail = '已送出取消，等待 Shopify 完成；之後的訂單更新若仍未取消會再送一次';
      } catch {
        outcome = 'cancel_failed';
        detail = '自動取消失敗，請確認 Admin 權限 write_orders 後人工取消';
      }
    }
  }
  const recorded = await db.rpc('record_blocked_order_action', {
    p_order_id: shopifyOrderId, p_customer_id: customerId, p_action: outcome, p_detail: detail,
  });
  if (recorded.error) return { error: new Error('Unable to record blocked order action.') };
  // 已確認取消的紀錄不會被改回，回傳資料庫實際保存的狀態
  return { action: recorded.data === 'cancelled' ? 'cancelled' : outcome };
}

/** 建立結帳前查詢這個 Email 是否已停權。查詢失敗時放行（訂單 webhook 仍會取消停權帳號的新訂單）。 */
export async function emailPurchaseBlocked(db: RpcClient, email: string | null | undefined, policy = PURCHASE_BLOCK_POLICY): Promise<boolean> {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized || normalized.length > 254) return false;
  try {
    const { data, error } = await db.rpc('customer_purchase_block_by_email', { p_email: normalized, p_threshold: policy.refusalThreshold });
    if (error) return false;
    return standing(data).blockedSince !== null;
  } catch {
    return false;
  }
}
