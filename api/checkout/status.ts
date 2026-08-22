/**
 * 結帳狀態輪詢端點 (Checkout Status Polling API)
 * 供前端以 idempotency_key 輪詢交易進度與訂單建立狀態
 * 依據 docs/CHECKOUT_PAYMENT_SPEC.md §4 規範：前端不得直讀 transaction_logs，一律經由後端端點
 */

import { isOriginAllowed, jsonResponse, getClientIp } from '../_lib/security.js';
import { checkRateLimit } from '../_lib/ratelimit.js';
import { getTransactionLog } from '../_lib/supabase-admin.js';

export async function GET(request: Request): Promise<Response> {
  return handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

export default { fetch: handler };

export async function OPTIONS(request: Request): Promise<Response> {
  return handler(request);
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, Authorization, Origin',
      },
    });
  }

  // 1. Origin 防禦檢查
  const requestOrigin = request.headers.get('origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return jsonResponse({ error: '非法的請求來源 (Invalid Origin)' }, { status: 403 });
  }

  // 2. Rate Limit 檢查 (同 IP 每分鐘上限 20 次輪詢)
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`status:${clientIp}`, { maxRequests: 20, windowMs: 60_000 });
  if (!rateLimitResult.success) {
    return jsonResponse(
      { error: '輪詢過於頻繁，請稍候再試', code: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 }
    );
  }

  let idempotencyKey = request.headers.get('idempotency-key')?.trim() || '';

  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (!idempotencyKey) {
      idempotencyKey = (url.searchParams.get('idempotency_key') || url.searchParams.get('idempotencyKey') || '').trim();
    }
  } else if (request.method === 'POST') {
    try {
      const body = await request.json() as Record<string, unknown>;
      if (!idempotencyKey) {
        idempotencyKey = String(body.idempotency_key || body.idempotencyKey || '').trim();
      }
    } catch {
      // ignore
    }
  } else {
    return jsonResponse({ error: '不支援此 HTTP 請求方法' }, { status: 405 });
  }

  if (!idempotencyKey) {
    return jsonResponse({ error: '缺少 Idempotency-Key' }, { status: 400 });
  }

  // 3. 查詢交易日誌
  const log = await getTransactionLog(idempotencyKey);
  if (!log) {
    return jsonResponse({ error: '找不到此筆交易' }, { status: 404 });
  }

  // 4. 脫敏回傳 (不包含任何敏感卡號或完整個資)
  return jsonResponse({
    idempotencyKey: log.idempotency_key,
    status: log.status,
    orderId: log.shopify_order_id || null,
    amount: log.amount,
    currencyCode: log.currency_code || 'TWD',
    errorMessage: log.error_message || null,
    updatedAt: log.updated_at,
  });
}
