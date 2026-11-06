import { waitUntil } from '@vercel/functions';
import { collectionEvent } from '../_lib/cod-collection-event.js';
import { nudgeCodCollection } from '../_lib/cod-collection-nudge.js';
/**
 * Shopify Webhooks 接收端點 (Shopify Orders & Refunds Webhook API)
 * 依據 docs/VERCEL_MIGRATION_SPEC.md §4.1 與 docs/00_DECISION_LOG.md 規格：
 * - Raw body HMAC-SHA256 簽章驗證 (crypto.timingSafeEqual)
 * - 驗證 X-Shopify-Shop-Domain
 * - 冪等去重與 Watermark 事件防倒退
 * - 投影寫入 orders / order_items / order_fulfillments
 */

import { readOrderForPerk, settleMemberPerkAfterOrder } from '../_lib/member-perk.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse } from '../_lib/security.js';
import { reportServerFailure, safeErrorCode } from '../_lib/server-monitoring.js';
import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import {
  readRequestBodyWithLimit,
  WebhookBodyTooLargeError,
  callOrderSyncRpc,
  parseShopifyOrderWebhook,
  parseShopifyRefundWebhook,
  isAcceptedShopifyWebhookTopic,
  normalizeShopifyDomain,
} from '../../supabase/functions/shopify-orders-webhook/webhook.js';

export const maxDuration = 60;
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * 驗證 Shopify HMAC-SHA256 簽章 (Timing-Safe)
 */
export function verifyShopifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  if (!rawBody || !hmacHeader || !secret) return false;
  try {
    const hash = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    const hashBuffer = Buffer.from(hash, 'utf8');
    const headerBuffer = Buffer.from(hmacHeader, 'utf8');
    if (hashBuffer.length !== headerBuffer.length) return false;
    return timingSafeEqual(hashBuffer, headerBuffer);
  } catch {
    return false;
  }
}

interface SupabaseRpcError {
  code?: string;
  message?: string;
}

interface SupabaseRpcClient {
  rpc: (
    functionName: string,
    params: object,
  ) => PromiseLike<{ data: unknown; error: SupabaseRpcError | null }>;
}

const isTransientFutureJwtError = (error: SupabaseRpcError | null): boolean =>
  error?.code === 'PGRST303' && /JWT issued at future/i.test(error.message || '');

export async function rpcWithTransientJwtRetry(
  client: SupabaseRpcClient,
  functionName: string,
  params: object,
  retryDelayMs = 1_250,
): Promise<{ data: unknown; error: SupabaseRpcError | null }> {
  let result = await client.rpc(functionName, params);
  if (!isTransientFutureJwtError(result.error)) return result;

  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  result = await client.rpc(functionName, params);
  return result;
}

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

export default { fetch: handler };

export async function OPTIONS(request: Request): Promise<Response> {
  return handler(request);
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: '不支援此 HTTP 方法' }, { status: 405 });
  }

  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') || '';
  const topic = request.headers.get('x-shopify-topic') || '';
  const shopDomain = normalizeShopifyDomain(request.headers.get('x-shopify-shop-domain'));
  const webhookId = request.headers.get('x-shopify-webhook-id') || '';
  const triggeredAt = request.headers.get('x-shopify-triggered-at') || new Date().toISOString();

  // 1. 驗證 Topic
  const isCollectionEvent = ['fulfillment_events/create','fulfillment_events/delete'].includes(topic);
  if (!isAcceptedShopifyWebhookTopic(topic) && !isCollectionEvent) {
    return jsonResponse({ error: `未支援的 Webhook 主題: ${topic}` }, { status: 400 });
  }

  // 2. 驗證 Shop Domain
  const expectedDomain = normalizeShopifyDomain(
    process.env.SHOPIFY_STORE_DOMAIN ||
    process.env.VITE_PUBLIC_SHOPIFY_STORE_DOMAIN ||
    'gh2xgs-zf.myshopify.com'
  );
  if (shopDomain !== expectedDomain) {
    return jsonResponse({ error: '非授權的 Shopify 商店網域' }, { status: 403 });
  }

  // 3. 讀取 Raw Body 與驗證 HMAC (Fail-Closed：未設定密鑰視為伺服器設定錯誤，一律拒絕)
  let rawBody: string;
  try { rawBody = await readRequestBodyWithLimit(request); } catch (error) {
    return jsonResponse({ error: 'INVALID_WEBHOOK_BODY' }, { status: error instanceof WebhookBodyTooLargeError ? 413 : 400 });
  }
  const webhookSecret =
    process.env.SHOPIFY_WEBHOOK_SECRET || process.env.ShopifyWebhookSecret || '';

  if (!webhookSecret) {
    await reportServerFailure({ area: 'shopify_webhook', failure: 'WEBHOOK_SECRET_MISSING', tags: { topic, webhook_id: webhookId } });
    return jsonResponse({ error: 'Webhook 簽章金鑰未設定，暫時無法處理' }, { status: 500 });
  }

  const isValid = verifyShopifyHmac(rawBody, hmacHeader, webhookSecret);
  if (!isValid) {
    return jsonResponse({ error: 'Shopify HMAC 簽章驗證失敗' }, { status: 401 });
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: '無效的 JSON 內容' }, { status: 400 });
  }

  // 4. 解析 Webhook Payload
  const metadata = {
    webhookId,
    topic,
    shopDomain,
    triggeredAt,
  };

  const admin = getSupabaseAdminClient();
  if (!admin) {
    await reportServerFailure({ area: 'shopify_webhook', failure: 'WEBHOOK_STORAGE_UNCONFIGURED', tags: { topic, webhook_id: webhookId } });
    return jsonResponse({
      error: '訂單同步資料庫未設定，暫時無法處理',
      code: 'WEBHOOK_STORAGE_UNAVAILABLE',
    }, { status: 503 });
  }

  // 5. 呼叫 Supabase RPC 執行去重、防倒退與投影寫入
  try {
    if (isCollectionEvent) {
      const event = payload && collectionEvent(payload, topic);
      if (!event || shopDomain !== 'gh2xgs-zf.myshopify.com' || !/^[a-zA-Z0-9-]{1,100}$/.test(webhookId)) {
        await reportServerFailure({ area: 'shopify_webhook', failure: 'INVALID_FULFILLMENT_EVENT', level: 'warning', tags: { topic, webhook_id: webhookId } });
        return jsonResponse({ error: 'INVALID_FULFILLMENT_EVENT' }, { status: 422 });
      }
      const saved = await admin.rpc('receive_cod_fulfillment_event', { ...event, p_webhook_id: webhookId });
      if (saved.error) {
        await reportServerFailure({ area: 'shopify_webhook', failure: 'FULFILLMENT_EVENT_NOT_SAVED', tags: { topic, webhook_id: webhookId, error_code: safeErrorCode(saved.error) } });
        return jsonResponse({ error: 'WEBHOOK_STORAGE_UNAVAILABLE' }, { status: 503 });
      }
      if (process.env.COD_COLLECTION_ENABLED === 'true') waitUntil(nudgeCodCollection(admin, event.p_order_gid));
      return jsonResponse({ ok: true, result: saved.data });
    }
    if (topic === 'refunds/create') {
      const parsedRefund = parseShopifyRefundWebhook(payload, metadata);
      if (!parsedRefund) {
        await reportServerFailure({ area: 'shopify_webhook', failure: 'INVALID_REFUND_PAYLOAD', level: 'warning', tags: { topic, webhook_id: webhookId } });
        return jsonResponse({ error: '無效的 Refund Webhook Payload' }, { status: 422 });
      }

      const { data, error } = await rpcWithTransientJwtRetry(
        admin as unknown as SupabaseRpcClient,
        'sync_shopify_refund_webhook',
        parsedRefund,
      );
      if (error) {
        await reportServerFailure({ area: 'shopify_webhook', failure: 'REFUND_SYNC_FAILED', tags: { topic, webhook_id: webhookId, error_code: safeErrorCode(error) } });
        return jsonResponse({ error: '儲存退款投影失敗' }, { status: 500 });
      }

      return jsonResponse({ ok: true, result: data });
    } else {
      const parsedOrder = parseShopifyOrderWebhook(payload, metadata);
      if (!parsedOrder) {
        await reportServerFailure({ area: 'shopify_webhook', failure: 'INVALID_ORDER_PAYLOAD', level: 'warning', tags: { topic, webhook_id: webhookId } });
        return jsonResponse({ error: '無效的 Order Webhook Payload' }, { status: 422 });
      }

      const { data, error } = await callOrderSyncRpc(parsedOrder, (params) => rpcWithTransientJwtRetry(
        admin as unknown as SupabaseRpcClient,
        'sync_shopify_order_webhook',
        params,
      ));
      if (error) {
        await reportServerFailure({ area: 'shopify_webhook', failure: 'ORDER_SYNC_FAILED', tags: { topic, webhook_id: webhookId, error_code: safeErrorCode(error) } });
        return jsonResponse({ error: '儲存訂單投影失敗' }, { status: 500 });
      }

      if (process.env.COD_COLLECTION_ENABLED === 'true') {
        waitUntil(nudgeCodCollection(admin, parsedOrder.p_shopify_order_gid));
      }

      // LUCISSI 會員首單免運：第一筆付款訂單成立後結算（用掉或停用），失敗不影響訂單同步
      const perkOrder = readOrderForPerk(payload);
      if (perkOrder) {
        try {
          await settleMemberPerkAfterOrder(admin, perkOrder);
        } catch (perkError) {
          await reportServerFailure({ area: 'shopify_webhook', failure: 'MEMBER_PERK_SETTLEMENT_FAILED', level: 'warning', tags: { topic, webhook_id: webhookId, error_code: safeErrorCode(perkError) } });
        }
      }

      return jsonResponse({ ok: true, result: data });
    }
  } catch (err: unknown) {
    await reportServerFailure({ area: 'shopify_webhook', failure: 'WEBHOOK_PROCESSING_EXCEPTION', tags: { topic, webhook_id: webhookId, error_code: safeErrorCode(err) } });
    return jsonResponse({ error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500 });
  }
}
