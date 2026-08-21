-- SAENGAK Database Migration: 修正發票 Outbox 寫入路徑
-- 問題: api/_lib/supabase-admin.ts 的 enqueueAmegoInvoiceJob() 先前透過
-- PostgREST 直接 .from('amego_invoice_jobs') 存取，但該表實際位於
-- private.amego_invoice_jobs（未曝露於 PostgREST 的 public schema），
-- 導致寫入永遠失敗並靜默退回記憶體暫存，發票 Outbox 實質上收不到工作。
-- 修正: 提供與既有 claim/complete RPC 相同風格的 public.enqueue_amego_invoice_job()
-- 供 Serverless Checkout API 直接呼叫寫入 private.amego_invoice_jobs。

begin;

create or replace function public.enqueue_amego_invoice_job(
  p_shopify_order_gid text,
  p_amego_order_id text,
  p_request_payload jsonb,
  p_request_sha256 text,
  p_expected_total_amount numeric,
  p_expected_buyer_identifier text default null,
  p_order_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.amego_invoice_jobs (
    shopify_order_gid, order_id, amego_order_id, request_payload, request_sha256,
    expected_total_amount, expected_buyer_identifier,
    source_updated_at, status, next_attempt_at, updated_at
  ) values (
    p_shopify_order_gid,
    p_order_id,
    p_amego_order_id,
    p_request_payload,
    p_request_sha256,
    p_expected_total_amount,
    coalesce(p_expected_buyer_identifier, '0000000000'),
    now(),
    'pending',
    now(),
    now()
  )
  on conflict (shopify_order_gid) do update
  set order_id = coalesce(excluded.order_id, private.amego_invoice_jobs.order_id),
      request_payload = excluded.request_payload,
      request_sha256 = excluded.request_sha256,
      expected_total_amount = excluded.expected_total_amount,
      expected_buyer_identifier = excluded.expected_buyer_identifier,
      source_updated_at = now(),
      status = case when private.amego_invoice_jobs.status in ('pending', 'failed') then 'pending' else private.amego_invoice_jobs.status end,
      next_attempt_at = case when private.amego_invoice_jobs.status in ('pending', 'failed') then now() else private.amego_invoice_jobs.next_attempt_at end,
      updated_at = now()
  where private.amego_invoice_jobs.status not in ('issued', 'void_review', 'void_pending', 'voided', 'cancelled', 'manual_review');
end;
$$;

revoke all on function public.enqueue_amego_invoice_job(
  text, text, jsonb, text, numeric, text, uuid
) from public, anon, authenticated;
grant execute on function public.enqueue_amego_invoice_job(
  text, text, jsonb, text, numeric, text, uuid
) to service_role;

commit;
