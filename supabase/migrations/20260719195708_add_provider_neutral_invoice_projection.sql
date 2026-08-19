begin;

create table if not exists public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  provider_invoice_id text not null check (length(provider_invoice_id) between 1 and 160),
  invoice_number text check (invoice_number is null or length(invoice_number) between 1 and 80),
  status text not null check (
    status in ('awaiting-provider', 'issued', 'voided', 'allowance-issued', 'failed')
  ),
  issued_at timestamptz,
  voided_at timestamptz,
  allowance_issued_at timestamptz,
  provider_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_invoices_provider_document_unique unique (provider, provider_invoice_id),
  constraint order_invoices_status_timestamp_check check (
    (status <> 'issued' or issued_at is not null)
    and (status <> 'voided' or voided_at is not null)
    and (status <> 'allowance-issued' or allowance_issued_at is not null)
  )
);

create index if not exists order_invoices_order_id_idx
  on public.order_invoices (order_id);

alter table public.order_invoices enable row level security;

drop policy if exists order_invoices_select_own on public.order_invoices;
create policy order_invoices_select_own
on public.order_invoices for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_invoices.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

revoke all on table public.order_invoices from public, anon, authenticated;
grant select on table public.order_invoices to authenticated;
grant select, insert, update, delete on table public.order_invoices to service_role;

drop trigger if exists order_invoices_touch_updated_at on public.order_invoices;
create trigger order_invoices_touch_updated_at
before update on public.order_invoices
for each row execute function private.touch_updated_at();

commit;
