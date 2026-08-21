-- SAENGAK Database Migration: 建立交易日誌狀態機 (transaction_logs)
-- 規範來源: docs/00_DECISION_LOG.md & docs/CHECKOUT_PAYMENT_SPEC.md §5.1

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

-- 建立 transaction_logs 表
create table if not exists public.transaction_logs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  payload_hash text not null,
  status text not null check (
    status in (
      'INITIATED',
      'PAYMENT_CAPTURED',
      'ORDER_CREATED',
      'INVOICE_ISSUED',
      'COMPLETED',
      'PAYMENT_FAILED',
      'ORDER_FAILED',
      'COMPENSATED'
    )
  ),
  tappay_rec_trade_id text,
  shopify_order_id text,
  invoice_id text,
  amount integer not null check (amount >= 0),
  currency text not null default 'TWD',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  user_id uuid references auth.users (id) on delete set null,
  guest_phone_normalized text,
  guest_email_normalized text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 建立必要索引以支援狀態查詢、對帳排程與訪客交集歸戶比對
create unique index if not exists transaction_logs_idempotency_key_unique
  on public.transaction_logs (idempotency_key);

create index if not exists transaction_logs_shopify_order_id_idx
  on public.transaction_logs (shopify_order_id)
  where shopify_order_id is not null;

create index if not exists transaction_logs_tappay_rec_trade_id_idx
  on public.transaction_logs (tappay_rec_trade_id)
  where tappay_rec_trade_id is not null;

create index if not exists transaction_logs_guest_phone_email_idx
  on public.transaction_logs (guest_phone_normalized, guest_email_normalized)
  where guest_phone_normalized is not null or guest_email_normalized is not null;

create index if not exists transaction_logs_created_at_idx
  on public.transaction_logs (created_at desc);

create index if not exists transaction_logs_status_idx
  on public.transaction_logs (status);

-- 觸發器：更新 updated_at
drop trigger if exists transaction_logs_touch_updated_at on public.transaction_logs;
create trigger transaction_logs_touch_updated_at
before update on public.transaction_logs
for each row execute function private.touch_updated_at();

-- 啟用 Row Level Security (預設全拒絕 Deny All，前端與一般會員禁止直讀寫)
alter table public.transaction_logs enable row level security;

-- 撤銷公開、匿名與認證使用者權限
revoke all on table public.transaction_logs from public, anon, authenticated;

-- 僅授權受信任之後端 service_role 擁有完全讀寫權限
grant select, insert, update, delete on table public.transaction_logs to service_role;

commit;
