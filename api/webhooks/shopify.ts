/**
 * Shopify Webhooks 接收端點 (Shopify Orders & Refunds Webhook API)
 * 依據 docs/VERCEL_MIGRATION_SPEC.md §4.1 與 docs/00_DECISION_LOG.md 規格：
 * - Raw body HMAC-SHA256 簽章驗證 (crypto.timingSafeEqual)
 * - 驗證 X-Shopify-Shop-Domain
 * - 冪等去重與 Watermark 事件防倒退
 * - 投影寫入 orders / order_items / order_fulfillments
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse } from '../_lib/security.js';
import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import {
  parseShopifyOrderWebhook,
  parseShopifyRefundWebhook,
  isAcceptedShopifyWebhookTopic,
  normalizeShopifyDomain,
} from '../../supabase/functions/shopify-orders-webhook/webhook.js';

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
  if (!isAcceptedShopifyWebhookTopic(topic)) {
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
  const rawBody = await request.text();
  const webhookSecret =
    process.env.SHOPIFY_WEBHOOK_SECRET || process.env.ShopifyWebhookSecret || '';

  if (!webhookSecret) {
    console.error('SHOPIFY_WEBHOOK_SECRET 未設定，拒絕處理 Webhook 以避免未簽章請求被接受');
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
    console.error('Supabase server secret 未設定，拒絕確認 Shopify Webhook');
    return jsonResponse({
      error: '訂單同步資料庫未設定，暫時無法處理',
      code: 'WEBHOOK_STORAGE_UNAVAILABLE',
    }, { status: 503 });
  }

  // 5. 呼叫 Supabase RPC 執行去重、防倒退與投影寫入
  try {
    if (topic === 'refunds/create') {
      const parsedRefund = parseShopifyRefundWebhook(payload, metadata);
      if (!parsedRefund) {
        return jsonResponse({ error: '無效的 Refund Webhook Payload' }, { status: 422 });
      }

      const { data, error } = await rpcWithTransientJwtRetry(
        admin as unknown as SupabaseRpcClient,
        'sync_shopify_refund_webhook',
        parsedRefund,
      );
      if (error) {
        console.error('sync_shopify_refund_webhook error', error);
        return jsonResponse({ error: '儲存退款投影失敗' }, { status: 500 });
      }

      return jsonResponse({ ok: true, result: data });
    } else {
      const parsedOrder = parseShopifyOrderWebhook(payload, metadata);
      if (!parsedOrder) {
        return jsonResponse({ error: '無效的 Order Webhook Payload' }, { status: 422 });
      }

      const { data, error } = await rpcWithTransientJwtRetry(
        admin as unknown as SupabaseRpcClient,
        'sync_shopify_order_webhook',
        parsedOrder,
      );
      if (error) {
        console.error('sync_shopify_order_webhook error', error);
        return jsonResponse({ error: '儲存訂單投影失敗' }, { status: 500 });
      }

      return jsonResponse({ ok: true, result: data });
    }
  } catch (err: any) {
    console.error('Webhook processing exception', err);
    return jsonResponse({ error: `處理異常: ${err.message}` }, { status: 500 });
  }
}
