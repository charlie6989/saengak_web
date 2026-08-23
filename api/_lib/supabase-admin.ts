/**
 * Supabase Admin / Service Role 操作模組
 * 依據 docs/CHECKOUT_PAYMENT_SPEC.md §5 分散式交易與 Transaction_Logs 狀態機規範
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TransactionStatus =
  | 'INITIATED'
  | 'PAYMENT_CAPTURED'
  | 'ORDER_CREATED'
  | 'INVOICE_ISSUED'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'ORDER_FAILED'
  | 'COMPENSATED';

export interface TransactionLogRecord {
  idempotency_key: string;
  payload_hash: string;
  user_identifier: string;
  status: TransactionStatus;
  tappay_rec_trade_id?: string | null;
  shopify_order_id?: string | null;
  invoice_id?: string | null;
  amount: number;
  currency_code?: string;
  payload?: Record<string, unknown>;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceJobPayload {
  shopify_order_gid: string;
  order_id?: string | null;
  amego_order_id: string;
  request_payload: Record<string, unknown>;
  request_sha256: string;
  expected_total_amount: number;
  expected_buyer_identifier?: string | null;
  status?: string;
}

// 記憶體備援儲存庫 (當 Supabase 未連線或測試時)
const memoryTransactionLogs = new Map<string, TransactionLogRecord>();
const memoryInvoiceJobs = new Map<string, InvoiceJobPayload>();
const memorySiteSettings = new Map<string, unknown>();

export function getSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return null;
}

/**
 * 查詢 Transaction Log
 */
export async function getTransactionLog(idempotencyKey: string): Promise<TransactionLogRecord | null> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from('transaction_logs')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (!error && data) return data as TransactionLogRecord;
    } catch {
      // fallback to memory
    }
  }

  return memoryTransactionLogs.get(idempotencyKey) || null;
}

/**
 * 更新 Transaction Log
 */
export async function updateTransactionLog(
  idempotencyKey: string,
  updates: Partial<TransactionLogRecord>
): Promise<TransactionLogRecord | null> {
  const existing = await getTransactionLog(idempotencyKey);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: TransactionLogRecord = {
    ...existing,
    ...updates,
    updated_at: now,
  };

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      await admin
        .from('transaction_logs')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('idempotency_key', idempotencyKey);
    } catch {
      // fallback to memory
    }
  }

  memoryTransactionLogs.set(idempotencyKey, updated);
  return updated;
}

/**
 * 寫入 Amego 發票 Outbox Job
 * 注意: private.amego_invoice_jobs 未曝露於 PostgREST public schema，
 * 因此必須透過 public.enqueue_amego_invoice_job RPC 寫入，
 * 不可使用 .from('amego_invoice_jobs') 直接存取（會因表不存在於可見 schema 而失敗）。
 */
export async function enqueueAmegoInvoiceJob(job: InvoiceJobPayload): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { error } = await admin.rpc('enqueue_amego_invoice_job', {
        p_shopify_order_gid: job.shopify_order_gid,
        p_amego_order_id: job.amego_order_id,
        p_request_payload: job.request_payload,
        p_request_sha256: job.request_sha256,
        p_expected_total_amount: job.expected_total_amount,
        p_expected_buyer_identifier: job.expected_buyer_identifier || '0000000000',
        p_order_id: job.order_id || null,
      });

      if (!error) {
        memoryInvoiceJobs.set(job.shopify_order_gid, job);
        return true;
      }
      console.error('enqueue_amego_invoice_job RPC error', error);
    } catch (err) {
      console.error('enqueue_amego_invoice_job RPC exception', err);
    }
  }

  memoryInvoiceJobs.set(job.shopify_order_gid, job);
  return true;
}

/**
 * 查詢系統設定 (site_settings)
 */
export async function getSiteSetting<T = unknown>(key: string): Promise<T | null> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from('site_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (!error && data) {
        return data.value as T;
      }
    } catch {
      // fallback to memory
    }
  }

  if (memorySiteSettings.has(key)) {
    return memorySiteSettings.get(key) as T;
  }
  return null;
}

/**
 * 設定記憶體系統設定 (測試使用)
 */
export function setMemorySiteSetting(key: string, value: unknown): void {
  memorySiteSettings.set(key, value);
}

/**
 * 重設記憶體資料庫 (測試使用)
 */
export function resetMemoryDatabase(): void {
  memoryTransactionLogs.clear();
  memoryInvoiceJobs.clear();
  memorySiteSettings.clear();
}
