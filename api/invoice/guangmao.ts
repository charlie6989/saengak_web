/**
 * 光貿 Amego 電子發票 Outbox Worker API
 * 依據 docs/00_DECISION_LOG.md、docs/CHECKOUT_PAYMENT_SPEC.md §5、docs/VERCEL_MIGRATION_SPEC.md 規格：
 * - 處理 private.amego_invoice_jobs Outbox
 * - 呼叫光貿 API (/json/f0401 開立 /json/f0501 作廢)
 * - 嚴格回讀 /json/invoice_query 確認 invoice_status === 99
 * - 投影至 public.order_invoices 並標記 INVOICE_ISSUED
 */

import { jsonResponse, timingSafeStringEqual } from '../_lib/security.js';
import { getSupabaseAdminClient, updateTransactionLog } from '../_lib/supabase-admin.js';
import {
  dispatchAmegoJob,
  type AmegoCredentials,
  type AmegoJob,
} from '../../supabase/functions/amego-invoice-dispatch/amego.js';

export function getAmegoCredentials(): AmegoCredentials {
  const sellerTaxId = process.env.AmegoSellerTaxId || '12345678';
  const appKey = process.env.AmegoAppKey || 'test-amego-app-key-1234567890';
  const mode = (process.env.AmegoMode as 'test' | 'production') || 'test';
  const allowedSellerTaxIds = (process.env.AmegoAllowedSellerTaxIds || '12345678')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    sellerTaxId,
    appKey,
    mode,
    allowedSellerTaxIds,
  };
}

export async function GET(request: Request): Promise<Response> {
  return handler(request);
}

export default { fetch: handler };

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

async function handler(
  request: Request,
  customFetcher: typeof fetch = fetch
): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ error: '不支援此 HTTP 方法' }, { status: 405 });
  }

  // 1. 授權防禦檢查 (AmegoDispatchToken 或 CRON_SECRET, Fail-Closed)
  const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedToken = process.env.AmegoDispatchToken || process.env.CRON_SECRET || '';

  if (!expectedToken) {
    console.error('AmegoDispatchToken/CRON_SECRET 未設定，拒絕處理發票派送以避免未授權呼叫');
    return jsonResponse({ error: '派送金鑰未設定，暫時無法處理' }, { status: 500 });
  }

  if (!authHeader || !timingSafeStringEqual(authHeader, expectedToken)) {
    return jsonResponse({ error: '未授權的呼叫 (Unauthorized)' }, { status: 401 });
  }

  // 2. 檢查發票開立閘門
  if (process.env.AmegoInvoiceReleaseEnabled === 'false') {
    return jsonResponse({ error: '光貿發票模組目前已停用' }, { status: 503 });
  }

  const credentials = getAmegoCredentials();

  let body: { shopifyOrderGid?: string } = {};
  if (request.method === 'POST') {
    try {
      body = await request.json() as { shopifyOrderGid?: string };
    } catch {
      // ignore
    }
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return jsonResponse({
      ok: true,
      message: 'Supabase 未配置，略過資料庫 Outbox 掃描 (Mock Mode)',
    });
  }

  // 3. Claim Job from Outbox
  let claimedJob: AmegoJob | null = null;
  try {
    const { data, error } = await admin.rpc('claim_amego_invoice_job', {
      p_shopify_order_gid: body.shopifyOrderGid || null,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      claimedJob = data[0] as AmegoJob;
    }
  } catch (err) {
    console.error('Claim Amego job error', err);
  }

  if (!claimedJob) {
    return jsonResponse({ ok: true, message: '目前無待處理的發票任務' }, { status: 200 });
  }

  const job = claimedJob;

  // 4. 派送至光貿並回讀確認
  const result = await dispatchAmegoJob(
    job,
    credentials,
    customFetcher,
    async () => {
      await admin.rpc('mark_amego_invoice_mutation_started', {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
      });
    }
  );

  const persistedOutcome =
    result.outcome === 'failed' && !result.retryable ? 'failed_terminal' : result.outcome;

  // 5. 完成 Job 並寫入 order_invoices 投影
  try {
    await admin.rpc('complete_amego_invoice_job', {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_outcome: persistedOutcome,
      p_mutation_accepted: 'mutationAccepted' in result ? result.mutationAccepted : false,
      p_mutation_rejected: 'mutationRejected' in result ? result.mutationRejected === true : false,
      p_invoice_number: 'invoiceNumber' in result ? result.invoiceNumber ?? null : null,
      p_provider_status: 'providerStatus' in result ? result.providerStatus ?? null : null,
      p_provider_updated_at: 'providerUpdatedAt' in result ? result.providerUpdatedAt : null,
      p_error_code: 'errorCode' in result ? result.errorCode : null,
      p_error_message: 'errorMessage' in result ? result.errorMessage : null,
    });
  } catch (completeErr) {
    console.error('Complete Amego job error', completeErr);
  }

  // 6. 更新 transaction_logs
  if (result.outcome === 'issued') {
    // 依 shopify_order_gid 更新對應 transaction_log
    try {
      const { data: logs } = await admin
        .from('transaction_logs')
        .select('idempotency_key')
        .eq('shopify_order_id', job.shopify_order_gid);

      if (Array.isArray(logs)) {
        for (const log of logs) {
          await updateTransactionLog(log.idempotency_key, {
            status: 'INVOICE_ISSUED',
            invoice_id: result.invoiceNumber,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return jsonResponse({
    ok: true,
    jobId: job.job_id,
    outcome: result.outcome,
    invoiceNumber: 'invoiceNumber' in result ? result.invoiceNumber : undefined,
  });
}
