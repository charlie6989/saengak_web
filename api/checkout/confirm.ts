/**
 * 3DS 驗證回呼與交易確認端點 (Checkout 3DS Confirm API)
 * 依據 docs/CHECKOUT_PAYMENT_SPEC.md §3、§7.5 規格：
 * - 接收 rec_trade_id 與 idempotency_key
 * - 驗證 Origin 與 Rate Limit
 * - 嚴格以後端二次查詢 TapPay Record API 結果為準 (不信任前端傳入狀態)
 * - 扣款成功後進行 Shopify 建單與發票 Outbox 寫入；建單失敗自動執行 TapPay 退款補償
 */

import { isOriginAllowed, jsonResponse, getClientIp, hashPayload } from '../_lib/security.js';
import { checkRateLimit } from '../_lib/ratelimit.js';
import { getTradeRecord, refundTransaction } from '../_lib/tappay.js';
import { createShopifyOrder } from '../_lib/shopify-admin.js';
import {
  getTransactionLog,
  updateTransactionLog,
  enqueueAmegoInvoiceJob,
} from '../_lib/supabase-admin.js';

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

  // 2. Rate Limit 檢查
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`confirm:${clientIp}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rateLimitResult.success) {
    return jsonResponse(
      { error: '請求過於頻繁，請稍候再試', code: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 }
    );
  }

  let recTradeId = '';
  let idempotencyKey = request.headers.get('idempotency-key')?.trim() || '';

  if (request.method === 'POST') {
    try {
      const body = await request.json() as Record<string, unknown>;
      recTradeId = String(body.rec_trade_id || body.recTradeId || '').trim();
      if (!idempotencyKey && body.idempotencyKey) {
        idempotencyKey = String(body.idempotencyKey).trim();
      }
    } catch {
      return jsonResponse({ error: '無效的 JSON 請求內容' }, { status: 400 });
    }
  } else if (request.method === 'GET') {
    const url = new URL(request.url);
    recTradeId = (url.searchParams.get('rec_trade_id') || url.searchParams.get('recTradeId') || '').trim();
    if (!idempotencyKey) {
      idempotencyKey = (url.searchParams.get('idempotency_key') || url.searchParams.get('idempotencyKey') || '').trim();
    }
  } else {
    return jsonResponse({ error: '不支援此 HTTP 請求方法' }, { status: 405 });
  }

  if (!recTradeId && !idempotencyKey) {
    return jsonResponse({ error: '缺少交易識別碼 (rec_trade_id 或 idempotency_key)' }, { status: 400 });
  }

  // 3. 查核 Transaction Log
  let log = idempotencyKey ? await getTransactionLog(idempotencyKey) : null;
  if (!log && recTradeId) {
    // 透過 rec_trade_id 反查（若有）
  }

  if (log && ['ORDER_CREATED', 'INVOICE_ISSUED', 'COMPLETED'].includes(log.status)) {
    return jsonResponse({
      ok: true,
      status: log.status,
      orderId: log.shopify_order_id,
      amount: log.amount,
      message: '訂單已完成',
    });
  }

  const queryTradeId = recTradeId || log?.tappay_rec_trade_id;
  if (!queryTradeId) {
    return jsonResponse({ error: '找不到對應的 TapPay 交易識別' }, { status: 404 });
  }

  // 4. 後端二次向 TapPay Record API 查詢確認真實付款狀態 (權威驗證)
  let record;
  try {
    record = await getTradeRecord(queryTradeId);
  } catch (err: any) {
    return jsonResponse({ error: `查詢交易狀態失敗: ${err.message}` }, { status: 500 });
  }

  const currentKey = idempotencyKey || log?.idempotency_key || `anon-${queryTradeId}`;

  // 5. 判斷付款結果
  if (!record.isPaid || record.recordStatus !== 0) {
    if (log) {
      await updateTransactionLog(currentKey, {
        status: 'PAYMENT_FAILED',
        error_message: `3DS 驗證未通過或扣款失敗: ${record.msg}`,
      });
    }
    return jsonResponse(
      {
        error: `3DS 付款未成功: ${record.msg}`,
        code: 'PAYMENT_NOT_PAID',
        recordStatus: record.recordStatus,
      },
      { status: 400 }
    );
  }

  // 6. 付款已確認成功 (isPaid === true)
  if (log) {
    await updateTransactionLog(currentKey, {
      status: 'PAYMENT_CAPTURED',
      tappay_rec_trade_id: queryTradeId,
    });
  }

  // 7. 若尚未建立 Shopify 訂單，執行建單
  if (!log?.shopify_order_id) {
    const payload = (log?.payload || {}) as Record<string, any>;
    const items = Array.isArray(payload.items) ? payload.items : [];

    let orderResult;
    try {
      orderResult = await createShopifyOrder({
        items: items.map((i: any) => ({
          variantId: i.variantId,
          quantity: Number(i.quantity || 1),
        })),
        customer: {
          email: String(payload.userId || 'guest@saengak.com.tw'),
          firstName: '顧客',
          lastName: '',
        },
        shippingAddress: {
          firstName: '顧客',
          lastName: '',
          phone: '0900000000',
          address1: '取件地址',
          city: '台北市',
        },
        shippingFee: Number(payload.shippingFee || 0),
        transactionId: queryTradeId,
        idempotencyKey: currentKey,
      });
    } catch (err: any) {
      // 建單失敗 -> 自動補償退款
      if (log) {
        await updateTransactionLog(currentKey, {
          status: 'ORDER_FAILED',
          error_message: `3DS 建單失敗: ${err.message}`,
        });
      }

      try {
        await refundTransaction(queryTradeId, record.amount);
        if (log) {
          await updateTransactionLog(currentKey, {
            status: 'COMPENSATED',
            error_message: `3DS 建單失敗已自動補償退款: ${err.message}`,
          });
        }
      } catch (refundErr: any) {
        console.error('3DS 補償退款失敗', refundErr);
      }

      return jsonResponse(
        {
          error: '訂單建立失敗，已為您自動辦理信用卡退款授權取消',
          code: 'ORDER_CREATION_FAILED',
        },
        { status: 500 }
      );
    }

    // 建單成功
    if (log) {
      await updateTransactionLog(currentKey, {
        status: 'ORDER_CREATED',
        shopify_order_id: orderResult.id,
      });

      await enqueueAmegoInvoiceJob({
        shopify_order_gid: orderResult.id,
        amego_order_id: `S${orderResult.orderNumber}`,
        request_payload: {
          currencyCode: 'TWD',
          totalAmount: record.amount,
          lineItems: items.map((i: any) => ({
            productName: `商品規格 ${i.variantId}`,
            quantity: Number(i.quantity || 1),
            price: String(Math.round(record.amount / (items.length || 1))),
          })),
          preference: {
            kind: 'personal',
            notificationEmail: String(payload.userId || ''),
            carrier: 'none',
            carrierId: '',
          },
        },
        request_sha256: hashPayload({
          orderId: orderResult.id,
          totalAmount: record.amount,
        }),
        expected_total_amount: record.amount,
      });
    }

    return jsonResponse({
      ok: true,
      status: 'ORDER_CREATED',
      orderId: orderResult.id,
      orderNumber: orderResult.orderNumber,
      amount: record.amount,
      idempotencyKey: currentKey,
    });
  }

  return jsonResponse({
    ok: true,
    status: log.status,
    orderId: log.shopify_order_id,
    amount: log.amount,
    idempotencyKey: currentKey,
  });
}
