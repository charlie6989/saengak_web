/**
 * 對帳與分散式交易補償排程端點 (Reconciliation & Compensation Cron API)
 * 依據 docs/CHECKOUT_PAYMENT_SPEC.md §5.2、§7.6 規格：
 * - 驗證 Authorization: Bearer ${CRON_SECRET} 授權標頭
 * - 定期掃描 transaction_logs 中逾時卡在中間態 (INITIATED, PAYMENT_CAPTURED, ORDER_FAILED) 的交易
 * - 查核 TapPay 真實狀態，必要時執行自動退款補償並標記 COMPENSATED
 */

import { jsonResponse, timingSafeStringEqual } from '../_lib/security.js';
import { getTradeRecord, refundTransaction } from '../_lib/tappay.js';
import {
  findStaleTransactions,
  updateTransactionLog,
} from '../_lib/supabase-admin.js';

export async function GET(request: Request): Promise<Response> {
  return handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

export default { fetch: handler };

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ error: '不支援此 HTTP 方法' }, { status: 405 });
  }

  // 1. 驗證 CRON_SECRET (Fail-Closed：未設定密鑰視為伺服器設定錯誤，一律拒絕)
  const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const cronSecret = process.env.CRON_SECRET || '';

  if (!cronSecret) {
    console.error('CRON_SECRET 未設定，拒絕處理對帳排程以避免未授權呼叫觸發退款補償');
    return jsonResponse({ error: '排程金鑰未設定，暫時無法處理' }, { status: 500 });
  }

  if (!authHeader || !timingSafeStringEqual(authHeader, cronSecret)) {
    return jsonResponse({ error: '未授權的排程呼叫 (Unauthorized)' }, { status: 401 });
  }

  // 2. 掃描逾時中間態交易 (預設 15 分鐘)
  const staleTransactions = await findStaleTransactions(15);
  const summary = {
    totalScanned: staleTransactions.length,
    compensated: 0,
    markedFailed: 0,
    skipped: 0,
    details: [] as Array<{
      idempotencyKey: string;
      action: string;
      reason?: string;
    }>,
  };

  for (const tx of staleTransactions) {
    const { idempotency_key, status, tappay_rec_trade_id, shopify_order_id, amount } = tx;

    try {
      // 情境 A: 扣款成功 (PAYMENT_CAPTURED) 或建單失敗 (ORDER_FAILED) 但無訂單
      if (status === 'PAYMENT_CAPTURED' || (status === 'ORDER_FAILED' && !shopify_order_id)) {
        if (tappay_rec_trade_id) {
          const record = await getTradeRecord(tappay_rec_trade_id);
          if (record.isPaid && !shopify_order_id) {
            // 扣款已成立但訂單未建立成功 -> 執行補償退款
            await refundTransaction(tappay_rec_trade_id, amount);
            await updateTransactionLog(idempotency_key, {
              status: 'COMPENSATED',
              error_message: '對帳排程偵測到扣款成功但建單遺失，已自動執行補償退款',
            });
            summary.compensated += 1;
            summary.details.push({
              idempotencyKey: idempotency_key,
              action: 'REFUND_COMPENSATED',
              reason: '扣款存在但無訂單，已補償退款',
            });
            continue;
          }
        }
      }

      // 情境 B: INITIATED 逾時 (顧客可能中途關閉 3DS 視窗)
      if (status === 'INITIATED') {
        if (tappay_rec_trade_id) {
          const record = await getTradeRecord(tappay_rec_trade_id);
          if (record.isPaid && !shopify_order_id) {
            // 居然有扣款但未建單
            await refundTransaction(tappay_rec_trade_id, amount);
            await updateTransactionLog(idempotency_key, {
              status: 'COMPENSATED',
              error_message: '3DS 逾時扣款但無訂單，已自動補償退款',
            });
            summary.compensated += 1;
            summary.details.push({
              idempotencyKey: idempotency_key,
              action: 'REFUND_COMPENSATED',
              reason: '3DS 逾時扣款已補償',
            });
            continue;
          }
        }

        // 無扣款，標記逾時失效
        await updateTransactionLog(idempotency_key, {
          status: 'PAYMENT_FAILED',
          error_message: '交易逾時未完成授權，已自動關閉',
        });
        summary.markedFailed += 1;
        summary.details.push({
          idempotencyKey: idempotency_key,
          action: 'MARKED_FAILED',
          reason: '交易逾時未授權',
        });
        continue;
      }

      summary.skipped += 1;
    } catch (err: any) {
      console.error(`對帳處置交易 ${idempotency_key} 異常`, err);
      summary.skipped += 1;
      summary.details.push({
        idempotencyKey: idempotency_key,
        action: 'ERROR',
        reason: err.message,
      });
    }
  }

  return jsonResponse({
    ok: true,
    timestamp: new Date().toISOString(),
    summary,
  });
}
