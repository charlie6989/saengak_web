/**
 * SAENGAK 自建結帳交易中樞 (Checkout API)
 * 依據 docs/00_DECISION_LOG.md、docs/CHECKOUT_PAYMENT_SPEC.md 規格：
 * 1. 來源防護 (Origin & CORS)
 * 2. Fail-Closed 閘門開關 (CHECKOUT_RELEASE_ENABLED)
 * 3. 滑動視窗 Rate Limit (Upstash Redis)
 * 4. 冪等性與狀態機 (Idempotency-Key + SHA-256 + transaction_logs)
 * 5. 伺服器端權威重算 (Server-Side Price Authority)
 * 6. TapPay Direct Pay SDK pay-by-prime 授權
 * 7. 3DS 跳轉與補償退款機制
 */

import {
  isOriginAllowed,
  jsonResponse,
  hashPayload,
  getClientIp,
  sanitizeTransactionPayload,
} from './_lib/security.js';
import { checkRateLimit } from './_lib/ratelimit.js';
import { payByPrime } from './_lib/tappay.js';
import { recalculateCheckoutTotal, createShopifyOrder } from './_lib/shopify-admin.js';
import {
  getTransactionLog,
  createTransactionLog,
  updateTransactionLog,
  enqueueAmegoInvoiceJob,
} from './_lib/supabase-admin.js';

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handler(request);
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, Authorization, Origin',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: '不支援此 HTTP 請求方法' },
      { status: 405, headers: { Allow: 'POST, OPTIONS' } }
    );
  }

  // 1. Origin 防禦檢查
  const requestOrigin = request.headers.get('origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return jsonResponse({ error: '非法的請求來源 (Invalid Origin)' }, { status: 403 });
  }

  // 2. Fail-Closed 開關防禦
  if (process.env.CHECKOUT_RELEASE_ENABLED !== 'true') {
    return jsonResponse(
      {
        error: '結帳交易系統目前為維護狀態或尚未開放公開交易',
        code: 'CHECKOUT_DISABLED',
      },
      { status: 503 }
    );
  }

  // 3. Rate Limit 檢查 (同 IP 每分鐘上限 5 次，滑動視窗)
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`checkout:${clientIp}`, { maxRequests: 5, windowMs: 60_000 });
  if (!rateLimitResult.success) {
    return jsonResponse(
      {
        error: '交易請求過於頻繁，請稍候再試',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(0, Math.ceil((rateLimitResult.reset - Date.now()) / 1000))) },
      }
    );
  }

  // 4. 冪等 Key 與 Payload 檢查
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16) {
    return jsonResponse(
      { error: '缺少或無效的 Idempotency-Key 標頭' },
      { status: 400 }
    );
  }

  let body: Record<string, any>;
  try {
    body = await request.json() as Record<string, any>;
  } catch {
    return jsonResponse({ error: '無效的 JSON 請求內容' }, { status: 400 });
  }

  const {
    prime,
    items,
    customer,
    shippingAddress,
    shippingMethodCode,
    invoicePreference,
    userId,
  } = body;

  if (!prime || typeof prime !== 'string') {
    return jsonResponse({ error: '缺少有效的付款 Prime Token' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: '購物車項目不得為空' }, { status: 400 });
  }
  if (!customer?.email || !shippingAddress?.firstName || !shippingAddress?.address1) {
    return jsonResponse({ error: '缺少完整的顧客或收件地址資訊' }, { status: 400 });
  }

  // 計算 Payload SHA-256 Hash 與身分識別
  const userIdentifier = userId || customer.email || clientIp;
  const payloadHash = hashPayload({
    items: items.map((i: any) => ({ variantId: i.variantId, quantity: i.quantity })),
    customer: { email: customer.email },
    shippingAddress: { address1: shippingAddress.address1, city: shippingAddress.city },
    shippingMethodCode,
    invoicePreference: invoicePreference || null,
  });

  // 檢查既有 Transaction Log (冪等性)
  const existingLog = await getTransactionLog(idempotencyKey);
  if (existingLog) {
    if (existingLog.payload_hash !== payloadHash) {
      return jsonResponse(
        {
          error: '同一個 Idempotency-Key 不得傳遞不同交易內容 (422 Unprocessable Entity)',
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        },
        { status: 422 }
      );
    }

    // 若已為終態 (成功)
    if (['ORDER_CREATED', 'INVOICE_ISSUED', 'COMPLETED'].includes(existingLog.status)) {
      return jsonResponse({
        ok: true,
        status: existingLog.status,
        orderId: existingLog.shopify_order_id,
        amount: existingLog.amount,
        message: '既有訂單交易已完成',
      });
    }

    // 若正在處理中
    if (['INITIATED', 'PAYMENT_CAPTURED'].includes(existingLog.status)) {
      return jsonResponse(
        {
          status: existingLog.status,
          message: '交易正在處理中，請稍候輪詢結果',
          idempotencyKey,
        },
        { status: 409 }
      );
    }
  }

  // 5. 伺服器端金額權威重算 (Server-Side Price Authority)
  let calculated;
  try {
    calculated = await recalculateCheckoutTotal(items, {
      shippingMethodCode,
    });
  } catch (err: any) {
    return jsonResponse(
      {
        error: `商品價格或庫存查核失敗: ${err.message}`,
        code: 'PRICE_RECALCULATION_FAILED',
      },
      { status: 400 }
    );
  }

  const { totalAmount, subtotal, shippingFee } = calculated;

  // 記錄初始 Transaction Log (INITIATED)
  const sanitizedPayload = sanitizeTransactionPayload({
    items,
    shippingMethod: shippingMethodCode,
    invoiceType: invoicePreference?.kind || 'personal',
    currency: 'TWD',
    subtotal,
    shippingFee,
    totalAmount,
    userId: userIdentifier,
  });

  await createTransactionLog({
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    user_identifier: userIdentifier,
    status: 'INITIATED',
    amount: totalAmount,
    currency_code: 'TWD',
    payload: sanitizedPayload,
  });

  // 6. TapPay Direct Pay pay-by-prime 扣款授權
  let payResult;
  try {
    payResult = await payByPrime({
      prime,
      amount: totalAmount,
      details: 'SAENGAK 官方購物訂單',
      cardholder: {
        phoneNumber: shippingAddress.phone || customer.phone || '0900000000',
        name: `${shippingAddress.lastName || ''}${shippingAddress.firstName || ''}` || '客人',
        email: customer.email,
      },
      origin: requestOrigin || 'https://saengak.com.tw',
      enable3DS: true,
    });
  } catch (err: any) {
    await updateTransactionLog(idempotencyKey, {
      status: 'PAYMENT_FAILED',
      error_message: err.message,
    });
    return jsonResponse(
      { error: `金流連線失敗: ${err.message}`, code: 'GATEWAY_ERROR' },
      { status: 500 }
    );
  }

  // 7. 處理 3DS 驗證分支
  if (payResult.paymentUrl) {
    await updateTransactionLog(idempotencyKey, {
      tappay_rec_trade_id: payResult.recTradeId,
      status: 'INITIATED',
    });

    return jsonResponse({
      action: '3ds_required',
      paymentUrl: payResult.paymentUrl,
      recTradeId: payResult.recTradeId,
      idempotencyKey,
      amount: totalAmount,
    });
  }

  // 扣款失敗
  if (payResult.status !== 0) {
    await updateTransactionLog(idempotencyKey, {
      status: 'PAYMENT_FAILED',
      tappay_rec_trade_id: payResult.recTradeId,
      error_message: payResult.msg,
    });
    return jsonResponse(
      {
        error: `信用卡扣款授權失敗: ${payResult.msg}`,
        code: 'PAYMENT_AUTH_FAILED',
      },
      { status: 400 }
    );
  }

  // 直接扣款成功 (status === 0)
  await updateTransactionLog(idempotencyKey, {
    status: 'PAYMENT_CAPTURED',
    tappay_rec_trade_id: payResult.recTradeId,
  });

  // 8. 呼叫 Shopify Admin API 建立訂單
  let orderResult;
  try {
    orderResult = await createShopifyOrder({
      items: calculated.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        price: i.unitPrice,
      })),
      customer,
      shippingAddress,
      shippingMethodCode,
      shippingFee,
      transactionId: payResult.recTradeId,
      idempotencyKey,
    });
  } catch (err: any) {
    // 訂單建立失敗 -> 觸發分散式補償退款 (TapPay Refund)
    await updateTransactionLog(idempotencyKey, {
      status: 'ORDER_FAILED',
      error_message: `Shopify 建單失敗: ${err.message}`,
    });

    try {
      const { refundTransaction } = await import('./_lib/tappay.js');
      await refundTransaction(payResult.recTradeId, totalAmount);
      await updateTransactionLog(idempotencyKey, {
        status: 'COMPENSATED',
        error_message: `建單失敗已自動補償退款: ${err.message}`,
      });
    } catch (refundErr: any) {
      console.error('TapPay 補償退款異常', refundErr);
    }

    return jsonResponse(
      {
        error: '訂單建立失敗，已為您自動辦理信用卡退款授權取消',
        code: 'ORDER_CREATION_FAILED',
      },
      { status: 500 }
    );
  }

  // 9. 建單成功，寫入發票 Outbox
  await updateTransactionLog(idempotencyKey, {
    status: 'ORDER_CREATED',
    shopify_order_id: orderResult.id,
  });

  await enqueueAmegoInvoiceJob({
    shopify_order_gid: orderResult.id,
    amego_order_id: `S${orderResult.orderNumber}`,
    request_payload: {
      currencyCode: 'TWD',
      totalAmount,
      lineItems: calculated.items.map((i) => ({
        productName: `${i.productTitle} - ${i.variantTitle}`,
        quantity: i.quantity,
        price: String(i.unitPrice),
      })),
      preference: invoicePreference || {
        kind: 'personal',
        notificationEmail: customer.email,
        carrier: 'none',
        carrierId: '',
      },
    },
    request_sha256: hashPayload({
      orderId: orderResult.id,
      totalAmount,
      customerEmail: customer.email,
    }),
    expected_total_amount: totalAmount,
    expected_buyer_identifier:
      invoicePreference?.kind === 'company' ? invoicePreference.taxId : '0000000000',
  });

  return jsonResponse({
    ok: true,
    status: 'ORDER_CREATED',
    orderId: orderResult.id,
    orderNumber: orderResult.orderNumber,
    name: orderResult.name,
    amount: totalAmount,
    idempotencyKey,
  });
}

export default { fetch: handler };
