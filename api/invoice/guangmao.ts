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

// Vercel Hobby 方案 Serverless function 執行上限約 10 秒；每筆 job 派送需對光貿發出
// 最多 3 次序列外部呼叫 (invoice_query -> f0401/f0501 -> invoice_query 回讀)，故僅在完成
// 第一筆 job 後才檢查時間預算，決定是否繼續認領下一筆，保留緩衝供最後一筆完成與回應。
const MAX_JOBS_PER_INVOCATION = 25;
const TIME_BUDGET_MS = 6_000;

/**
 * 讀取光貿 Amego 電子發票 API 憑證設定 (Fail-Closed)。
 * `AmegoSellerTaxId`／`AmegoAppKey` 為必須由環境變數明確提供、不可有預設值的憑證本體；
 * 依 docs/CHECKOUT_PAYMENT_SPEC.md §7.8 Fail-Closed 鐵則，任一缺漏時一律回傳 null，
 * 交由呼叫端拒絕請求，嚴禁靜默補上硬編測試值讓呼叫端誤以為憑證齊全。
 * `AmegoMode`／`AmegoAllowedSellerTaxIds` 非需保密或需正確性之憑證本體，允許保留合理預設值。
 */
export function getAmegoCredentials(): AmegoCredentials | null {
  const sellerTaxId = process.env.AmegoSellerTaxId || '';
  const appKey = process.env.AmegoAppKey || '';
  if (!sellerTaxId || !appKey) {
    return null;
  }

  const mode = (process.env.AmegoMode as 'test' | 'production') || 'test';
  const allowedSellerTaxIds = (process.env.AmegoAllowedSellerTaxIds || '12345678')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const issuerNote = (process.env.AmegoIssuerNote || '').trim().slice(0, 100);
  if (process.env.AmegoInvoiceReleaseEnabled === 'true' && !issuerNote) {
    return null;
  }

  return {
    sellerTaxId,
    appKey,
    mode,
    allowedSellerTaxIds,
    issuerNote,
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

  // 1. 授權防禦檢查 (Fail-Closed)：AmegoDispatchToken 與 CRON_SECRET 為兩把獨立且可能不同值
  //    的合法金鑰（Vercel Cron 自動附帶 CRON_SECRET；手動/其他排程器可能改用 AmegoDispatchToken），
  //    任一相符即視為授權——絕不可用 `||` 短路只認第一把，否則另一把金鑰的呼叫者會被誤擋 401。
  const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const acceptedTokens = [process.env.AmegoDispatchToken, process.env.CRON_SECRET]
    .filter((value): value is string => Boolean(value));

  if (acceptedTokens.length === 0) {
    console.error('AmegoDispatchToken/CRON_SECRET 均未設定，拒絕處理發票派送以避免未授權呼叫');
    return jsonResponse({ error: '派送金鑰未設定，暫時無法處理' }, { status: 500 });
  }

  const isAuthorized = authHeader.length > 0 &&
    acceptedTokens.some((token) => timingSafeStringEqual(authHeader, token));

  if (!isAuthorized) {
    return jsonResponse({ error: '未授權的呼叫 (Unauthorized)' }, { status: 401 });
  }

  // 2. 檢查發票開立閘門
  if (process.env.AmegoInvoiceReleaseEnabled === 'false') {
    return jsonResponse({ error: '光貿發票模組目前已停用' }, { status: 503 });
  }

  // 2.5 憑證 Fail-Closed 檢查：AmegoSellerTaxId／AmegoAppKey 任一未設定時嚴禁靜默補上硬編測試值，
  //    一律直接拒絕並記錄告警日誌，避免誤用測試憑證對正式光貿環境發出請求 (docs/CHECKOUT_PAYMENT_SPEC.md §7.8)。
  const credentials = getAmegoCredentials();
  if (!credentials) {
    console.error('AmegoSellerTaxId/AmegoAppKey 未設定，拒絕派送光貿發票以避免誤用硬編測試憑證');
    return jsonResponse({ error: '發票憑證未設定，暫時無法處理' }, { status: 500 });
  }

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

  // 3. 認領並派送 Job：`claim_amego_invoice_job` 採 `FOR UPDATE SKIP LOCKED` + `LIMIT 1`
  //    設計，本就是設計成「重複呼叫直到淨空」的佇列 worker 模式。指定 shopifyOrderGid 時代表
  //    呼叫端只想立即處理該筆訂單，故僅嘗試 1 次；未指定（例如 vercel.json 每日排程掃描）則
  //    在時間預算內持續認領，避免 Outbox 只消化 1 筆／次造成任務無限積壓。
  const targetOrderGid = body.shopifyOrderGid || null;
  const maxJobsThisInvocation = targetOrderGid ? 1 : MAX_JOBS_PER_INVOCATION;
  const startedAt = Date.now();
  const processedJobs: Array<{ jobId: string; outcome: string; invoiceNumber?: string }> = [];

  for (let attempt = 0; attempt < maxJobsThisInvocation; attempt += 1) {
    if (attempt > 0 && Date.now() - startedAt > TIME_BUDGET_MS) {
      // 逼近 Serverless 執行逾時，保留緩衝讓已認領的 job 正常完成與回應；
      // 其餘 Outbox 積壓工作留待下次排程觸發繼續消化，不強行硬吃逾時。
      break;
    }

    let claimedJob: AmegoJob | null = null;
    try {
      const { data, error } = await admin.rpc('claim_amego_invoice_job', {
        p_shopify_order_gid: targetOrderGid,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        claimedJob = data[0] as AmegoJob;
      }
    } catch (err) {
      console.error('Claim Amego job error', err);
      break;
    }

    if (!claimedJob) break;

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

    processedJobs.push({
      jobId: job.job_id,
      outcome: result.outcome,
      invoiceNumber: 'invoiceNumber' in result ? result.invoiceNumber : undefined,
    });
  }

  if (processedJobs.length === 0) {
    return jsonResponse({ ok: true, message: '目前無待處理的發票任務' }, { status: 200 });
  }

  const [firstJob] = processedJobs;
  return jsonResponse({
    ok: true,
    processedCount: processedJobs.length,
    jobs: processedJobs,
    // 向下相容：保留首筆頂層欄位，供既有「指定單一訂單」呼叫端沿用既有讀取方式。
    jobId: firstJob.jobId,
    outcome: firstJob.outcome,
    invoiceNumber: firstJob.invoiceNumber,
  });
}
