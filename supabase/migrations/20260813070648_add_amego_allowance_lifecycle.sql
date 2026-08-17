begin;

create table if not exists public.order_invoice_allowances (
  id uuid primary key default gen_random_uuid(),
  order_invoice_id uuid not null references public.order_invoices (id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  provider_allowance_id text not null check (length(provider_allowance_id) between 1 and 160),
  allowance_number text not null check (length(allowance_number) between 1 and 40),
  shopify_refund_gid text not null unique check (
    shopify_refund_gid ~ '^gid://shopify/Refund/[1-9][0-9]*$'
  ),
  status text not null check (status in ('issued', 'voided', 'failed')),
  gross_amount numeric not null check (gross_amount > 0),
  net_amount numeric not null check (net_amount >= 0),
  tax_amount numeric not null check (tax_amount >= 0),
  issued_at timestamptz not null,
  voided_at timestamptz,
  provider_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_invoice_allowances_amount_check check (
    gross_amount = net_amount + tax_amount
  ),
  constraint order_invoice_allowances_voided_at_check check (
    status <> 'voided' or voided_at is not null
  ),
  constraint order_invoice_allowances_provider_unique unique (
    provider, provider_allowance_id
  )
);

create index if not exists order_invoice_allowances_invoice_idx
  on public.order_invoice_allowances (order_invoice_id, created_at);

alter table public.order_invoice_allowances enable row level security;

drop policy if exists order_invoice_allowances_select_own
  on public.order_invoice_allowances;
create policy order_invoice_allowances_select_own
on public.order_invoice_allowances for select
to authenticated
using (
  exists (
    select 1
    from public.order_invoices as invoice
    join public.orders as customer_order on customer_order.id = invoice.order_id
    where invoice.id = public.order_invoice_allowances.order_invoice_id
      and customer_order.user_id = (select auth.uid())
  )
);

revoke all on table public.order_invoice_allowances from public, anon, authenticated;
grant select on table public.order_invoice_allowances to authenticated;
grant select, insert, update, delete on table public.order_invoice_allowances to service_role;

drop trigger if exists order_invoice_allowances_touch_updated_at
  on public.order_invoice_allowances;
create trigger order_invoice_allowances_touch_updated_at
before update on public.order_invoice_allowances
for each row execute function private.touch_updated_at();

create table if not exists private.amego_allowance_jobs (
  id uuid primary key default gen_random_uuid(),
  shopify_order_gid text not null check (
    shopify_order_gid ~ '^gid://shopify/Order/[1-9][0-9]*$'
  ),
  shopify_refund_gid text not null unique check (
    shopify_refund_gid ~ '^gid://shopify/Refund/[1-9][0-9]*$'
  ),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_invoice_id uuid references public.order_invoices (id) on delete set null,
  amego_order_id text not null check (
    amego_order_id ~ '^S[1-9][0-9]*$' and length(amego_order_id) <= 40
  ),
  allowance_number text not null unique check (
    allowance_number ~ '^[1-9][0-9]{0,15}$'
  ),
  request_payload jsonb not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_total_amount numeric not null check (expected_total_amount > 0),
  expected_net_amount numeric not null check (expected_net_amount >= 0),
  expected_tax_amount numeric not null check (expected_tax_amount >= 0),
  expected_invoice_total_amount numeric,
  provider_invoice_number text check (
    provider_invoice_number is null or provider_invoice_number ~ '^[A-Z]{2}[0-9]{8}$'
  ),
  source_created_at timestamptz not null,
  operation text not null default 'allowance_issue' check (
    operation in ('allowance_issue', 'allowance_void')
  ),
  status text not null default 'allowance_review' check (
    status in (
      'allowance_review', 'pending', 'processing', 'provider_pending', 'failed',
      'failed_terminal', 'manual_review', 'issued', 'void_review', 'void_pending',
      'voided', 'cancelled'
    )
  ),
  attempts integer not null default 0 check (attempts between 0 and 100),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_token uuid,
  mutation_accepted boolean not null default false,
  provider_status integer,
  provider_updated_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amego_allowance_jobs_payload_check check (
    jsonb_typeof(request_payload) = 'object'
  ),
  constraint amego_allowance_jobs_amount_check check (
    expected_total_amount = expected_net_amount + expected_tax_amount
  )
);

alter table private.amego_allowance_jobs
  add column if not exists expected_invoice_total_amount numeric;
alter table private.amego_allowance_jobs
  drop constraint if exists amego_allowance_jobs_invoice_total_check;
alter table private.amego_allowance_jobs
  add constraint amego_allowance_jobs_invoice_total_check check (
    expected_invoice_total_amount is null or expected_invoice_total_amount > 0
  );

create index if not exists amego_allowance_jobs_due_idx
  on private.amego_allowance_jobs (next_attempt_at, created_at)
  where status in ('pending', 'provider_pending', 'failed', 'void_pending', 'processing');

alter table private.amego_allowance_jobs enable row level security;
revoke all on table private.amego_allowance_jobs from public, anon, authenticated;
grant select, insert, update, delete on table private.amego_allowance_jobs to service_role;

drop trigger if exists amego_allowance_jobs_touch_updated_at
  on private.amego_allowance_jobs;
create trigger amego_allowance_jobs_touch_updated_at
before update on private.amego_allowance_jobs
for each row execute function private.touch_updated_at();

create or replace function public.sync_shopify_refund_webhook(
  p_webhook_id text,
  p_topic text,
  p_shopify_store_domain text,
  p_shopify_order_gid text,
  p_shopify_refund_gid text,
  p_allowance_number text,
  p_refund_created_at timestamptz,
  p_triggered_at timestamptz,
  p_total_amount numeric,
  p_net_amount numeric,
  p_tax_amount numeric,
  p_request_payload jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_invoice_id uuid;
  v_provider_invoice_number text;
  v_inserted boolean;
  v_payload_total numeric;
  v_payload_net numeric;
  v_payload_tax numeric;
begin
  if p_topic <> 'refunds/create'
    or p_shopify_order_gid !~ '^gid://shopify/Order/[1-9][0-9]*$'
    or p_shopify_refund_gid !~ '^gid://shopify/Refund/[1-9][0-9]*$'
    or p_allowance_number !~ '^[1-9][0-9]{0,15}$'
    or p_total_amount <= 0
    or p_total_amount <> p_net_amount + p_tax_amount
    or jsonb_typeof(p_request_payload) <> 'object'
    or jsonb_typeof(p_request_payload -> 'lineItems') <> 'array'
    or jsonb_array_length(p_request_payload -> 'lineItems') not between 1 and 250
    or p_request_payload ->> 'currencyCode' <> 'TWD'
    or p_request_payload ->> 'allowanceDate' !~ '^[0-9]{8}$'
    or to_char(to_date(p_request_payload ->> 'allowanceDate', 'YYYYMMDD'), 'YYYYMMDD')
      <> p_request_payload ->> 'allowanceDate'
    or p_refund_created_at is null
    or p_triggered_at is null
  then
    raise exception 'invalid Shopify refund snapshot';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_request_payload -> 'lineItems') as item
    where jsonb_typeof(item) <> 'object'
      or coalesce(length(trim(item ->> 'description')), 0) not between 1 and 256
      or coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]?$'
      or coalesce(item ->> 'netAmount', '') !~ '^[0-9]+$'
      or coalesce(item ->> 'taxAmount', '') !~ '^[0-9]+$'
  ) then
    raise exception 'invalid Shopify refund lines';
  end if;

  select coalesce(sum((item ->> 'netAmount')::numeric), 0),
         coalesce(sum((item ->> 'taxAmount')::numeric), 0)
  into v_payload_net, v_payload_tax
  from jsonb_array_elements(p_request_payload -> 'lineItems') as item;
  v_payload_total := v_payload_net + v_payload_tax;
  if (v_payload_total, v_payload_net, v_payload_tax)
    is distinct from (p_total_amount, p_net_amount, p_tax_amount) then
    raise exception 'Shopify refund totals do not reconcile';
  end if;

  insert into private.shopify_webhook_receipts (
    webhook_id, topic, shopify_store_domain, shopify_order_gid, triggered_at
  ) values (
    p_webhook_id, p_topic, p_shopify_store_domain, p_shopify_order_gid, p_triggered_at
  )
  on conflict (webhook_id) do nothing
  returning true into v_inserted;
  if not coalesce(v_inserted, false) then return 'duplicate'; end if;

  select customer_order.id
  into v_order_id
  from public.orders as customer_order
  where customer_order.shopify_order_gid = p_shopify_order_gid
    and customer_order.shopify_store_domain = p_shopify_store_domain
    and customer_order.currency_code = 'TWD'
  for update;

  if v_order_id is null then
    update private.shopify_webhook_receipts
    set result = 'unlinked', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'unlinked';
  end if;

  select invoice.id, invoice.invoice_number
  into v_order_invoice_id, v_provider_invoice_number
  from public.order_invoices as invoice
  where invoice.order_id = v_order_id
    and invoice.provider = 'amego'
    and invoice.status in ('issued', 'allowance-issued')
  order by invoice.created_at desc
  limit 1;

  insert into private.amego_allowance_jobs (
    shopify_order_gid, shopify_refund_gid, order_id, order_invoice_id,
    amego_order_id, allowance_number, request_payload, request_sha256,
    expected_total_amount, expected_net_amount, expected_tax_amount,
    provider_invoice_number, source_created_at, status, next_attempt_at
  ) values (
    p_shopify_order_gid, p_shopify_refund_gid, v_order_id, v_order_invoice_id,
    'S' || replace(p_shopify_order_gid, 'gid://shopify/Order/', ''),
    p_allowance_number, p_request_payload,
    encode(extensions.digest(convert_to(p_request_payload::text, 'UTF8'), 'sha256'), 'hex'),
    p_total_amount, p_net_amount, p_tax_amount,
    v_provider_invoice_number, p_refund_created_at, 'allowance_review', now()
  )
  on conflict (shopify_refund_gid) do nothing;

  update private.shopify_webhook_receipts
  set result = 'applied', processed_at = now()
  where webhook_id = p_webhook_id;
  return 'applied';
exception
  when others then
    update private.shopify_webhook_receipts
    set result = 'invalid', processed_at = now()
    where webhook_id = p_webhook_id;
    raise;
end;
$$;

revoke all on function public.sync_shopify_refund_webhook(
  text, text, text, text, text, text, timestamptz, timestamptz,
  numeric, numeric, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.sync_shopify_refund_webhook(
  text, text, text, text, text, text, timestamptz, timestamptz,
  numeric, numeric, numeric, jsonb
) to service_role;

create or replace function public.approve_amego_allowance_issue(
  p_shopify_refund_gid text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.amego_allowance_jobs%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_original_total numeric;
  v_reserved_total numeric;
begin
  select * into v_job
  from private.amego_allowance_jobs
  where shopify_refund_gid = p_shopify_refund_gid
    and status in ('allowance_review', 'manual_review')
    and operation = 'allowance_issue'
  for update;
  if v_job.id is null then raise exception 'allowance is not awaiting review'; end if;

  select invoice.id, invoice.invoice_number, invoice_job.expected_total_amount
  into v_invoice_id, v_invoice_number, v_original_total
  from public.order_invoices as invoice
  join private.amego_invoice_jobs as invoice_job
    on invoice_job.order_id = invoice.order_id
   and invoice_job.amego_order_id = invoice.provider_invoice_id
  where invoice.order_id = v_job.order_id
    and invoice.provider = 'amego'
    and invoice.status in ('issued', 'allowance-issued')
    and invoice_job.status in ('issued', 'void_review')
    and (
      invoice_job.status = 'issued'
      or (
        invoice_job.status = 'void_review'
        and invoice_job.operation = 'void'
        and not invoice_job.mutation_accepted
      )
    )
  order by invoice.created_at desc
  limit 1
  for update of invoice, invoice_job;
  if v_invoice_id is null or v_invoice_number is null then
    raise exception 'confirmed invoice is not available for allowance';
  end if;

  select coalesce(sum(job.expected_total_amount), 0)
  into v_reserved_total
  from private.amego_allowance_jobs as job
  where job.order_id = v_job.order_id
    and job.id <> v_job.id
    and job.status in (
      'pending', 'processing', 'provider_pending', 'failed', 'manual_review',
      'issued', 'void_review', 'void_pending'
    );
  if v_reserved_total + v_job.expected_total_amount > v_original_total then
    raise exception 'allowance total exceeds the original invoice';
  end if;

  update private.amego_invoice_jobs
  set status = 'issued', operation = 'issue', cancel_requested = false,
      updated_at = now()
  where order_id = v_job.order_id
    and status = 'void_review'
    and operation = 'void'
    and not mutation_accepted;

  update private.amego_allowance_jobs
  set order_invoice_id = v_invoice_id,
      provider_invoice_number = v_invoice_number,
      expected_invoice_total_amount = v_original_total,
      status = 'pending',
      attempts = 0,
      mutation_accepted = false,
      next_attempt_at = now(),
      updated_at = now()
  where id = v_job.id;
end;
$$;

revoke all on function public.approve_amego_allowance_issue(text)
  from public, anon, authenticated;
grant execute on function public.approve_amego_allowance_issue(text) to service_role;

create or replace function public.approve_amego_allowance_void(
  p_shopify_refund_gid text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update private.amego_allowance_jobs
  set operation = 'allowance_void',
      status = 'void_pending',
      attempts = 0,
      mutation_accepted = false,
      next_attempt_at = now(),
      updated_at = now()
  where shopify_refund_gid = p_shopify_refund_gid
    and status = 'issued'
    and operation = 'allowance_issue';
  if not found then raise exception 'allowance is not eligible for void'; end if;
end;
$$;

revoke all on function public.approve_amego_allowance_void(text)
  from public, anon, authenticated;
grant execute on function public.approve_amego_allowance_void(text) to service_role;

create or replace function public.approve_amego_invoice_void(
  p_shopify_order_gid text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.amego_allowance_jobs
    where shopify_order_gid = p_shopify_order_gid
      and status in (
        'pending', 'processing', 'provider_pending', 'failed', 'manual_review',
        'issued', 'void_review', 'void_pending'
      )
  ) then
    raise exception 'invoice with an active allowance cannot be voided';
  end if;

  update private.amego_invoice_jobs
  set status = 'void_pending', attempts = 0, mutation_accepted = false,
      cancel_requested = false, next_attempt_at = now(), updated_at = now()
  where shopify_order_gid = p_shopify_order_gid
    and status = 'void_review'
    and operation = 'void';
  if not found then raise exception 'invoice void is not awaiting review'; end if;
end;
$$;

revoke all on function public.approve_amego_invoice_void(text)
  from public, anon, authenticated;
grant execute on function public.approve_amego_invoice_void(text) to service_role;

create or replace function public.claim_amego_allowance_job(
  p_shopify_order_gid text default null
)
returns table (
  job_id uuid,
  shopify_order_gid text,
  shopify_refund_gid text,
  amego_order_id text,
  allowance_number text,
  operation text,
  request_payload jsonb,
  expected_net_amount numeric,
  expected_tax_amount numeric,
  expected_invoice_total_amount numeric,
  provider_invoice_number text,
  mutation_accepted boolean,
  lease_token uuid,
  attempts integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_lease_token uuid := gen_random_uuid();
begin
  select job.id into v_job_id
  from private.amego_allowance_jobs as job
  where (p_shopify_order_gid is null or job.shopify_order_gid = p_shopify_order_gid)
    and job.next_attempt_at <= now()
    and (
      job.status in ('pending', 'provider_pending', 'failed', 'void_pending')
      or (job.status = 'processing' and job.locked_at < now() - interval '10 minutes')
    )
  order by job.next_attempt_at, job.created_at
  for update skip locked
  limit 1;
  if v_job_id is null then return; end if;

  return query
  update private.amego_allowance_jobs as job
  set status = 'processing', attempts = job.attempts + 1,
      locked_at = now(), lease_token = v_lease_token, updated_at = now()
  where job.id = v_job_id
  returning job.id, job.shopify_order_gid, job.shopify_refund_gid,
    job.amego_order_id, job.allowance_number, job.operation,
    job.request_payload, job.expected_net_amount, job.expected_tax_amount,
    job.expected_invoice_total_amount,
    job.provider_invoice_number, job.mutation_accepted, job.lease_token,
    job.attempts;
end;
$$;

revoke all on function public.claim_amego_allowance_job(text)
  from public, anon, authenticated;
grant execute on function public.claim_amego_allowance_job(text) to service_role;

create or replace function public.mark_amego_allowance_mutation_started(
  p_job_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update private.amego_allowance_jobs
  set mutation_accepted = true, updated_at = now()
  where id = p_job_id
    and lease_token = p_lease_token
    and status = 'processing'
    and mutation_accepted = false;
  if not found then raise exception 'Amego allowance mutation lease is not claimable'; end if;
end;
$$;

revoke all on function public.mark_amego_allowance_mutation_started(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mark_amego_allowance_mutation_started(uuid, uuid)
  to service_role;

create or replace function public.complete_amego_allowance_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_mutation_accepted boolean default false,
  p_mutation_rejected boolean default false,
  p_allowance_number text default null,
  p_provider_status integer default null,
  p_provider_updated_at timestamptz default null,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.amego_allowance_jobs%rowtype;
begin
  if p_outcome not in (
    'allowance_issued', 'allowance_voided', 'provider_pending',
    'failed', 'failed_terminal'
  ) then raise exception 'invalid Amego allowance outcome'; end if;
  if p_outcome in ('allowance_issued', 'allowance_voided')
    and (p_allowance_number is null or p_allowance_number !~ '^[1-9][0-9]{0,15}$') then
    raise exception 'verified allowance number is required';
  end if;
  if p_outcome in ('allowance_issued', 'allowance_voided')
    and p_provider_status is distinct from 99 then
    raise exception 'provider status 99 is required';
  end if;
  if p_outcome in ('allowance_issued', 'allowance_voided')
    and p_provider_updated_at is null then
    raise exception 'provider event timestamp is required';
  end if;
  if p_mutation_rejected and p_outcome not in ('failed', 'failed_terminal') then
    raise exception 'mutation rejection requires a failed outcome';
  end if;

  update private.amego_allowance_jobs as job
  set status = case
        when p_outcome = 'allowance_issued' then 'issued'
        when p_outcome = 'allowance_voided' then 'voided'
        when p_outcome in ('provider_pending', 'failed') and job.attempts >= 10 then 'manual_review'
        else p_outcome
      end,
      provider_status = p_provider_status,
      provider_updated_at = p_provider_updated_at,
      last_error_code = left(nullif(p_error_code, ''), 80),
      last_error_message = left(nullif(p_error_message, ''), 300),
      next_attempt_at = case
        when p_outcome in ('provider_pending', 'failed') and job.attempts < 10
          then now() + least(power(2, job.attempts), 60) * interval '1 minute'
        else job.next_attempt_at
      end,
      locked_at = null,
      lease_token = null,
      mutation_accepted = case
        when p_outcome in ('allowance_issued', 'allowance_voided') then true
        when p_mutation_rejected then false
        else job.mutation_accepted or p_mutation_accepted
      end,
      request_payload = case
        when p_outcome in ('allowance_issued', 'allowance_voided', 'failed_terminal')
          or (p_outcome in ('provider_pending', 'failed') and job.attempts >= 10)
          then '{}'::jsonb
        else job.request_payload
      end,
      updated_at = now()
  where job.id = p_job_id
    and job.lease_token = p_lease_token
    and job.status = 'processing'
  returning job.* into v_job;
  if v_job.id is null then raise exception 'Amego allowance job is not claimable'; end if;
  if p_outcome in ('allowance_issued', 'allowance_voided')
    and p_allowance_number is distinct from v_job.allowance_number then
    raise exception 'allowance number does not match the immutable refund snapshot';
  end if;

  if p_outcome = 'allowance_issued' then
    insert into public.order_invoice_allowances (
      order_invoice_id, provider, provider_allowance_id, allowance_number,
      shopify_refund_gid, status, gross_amount, net_amount, tax_amount,
      issued_at, provider_updated_at
    ) values (
      v_job.order_invoice_id, 'amego', v_job.allowance_number,
      p_allowance_number, v_job.shopify_refund_gid, 'issued',
      v_job.expected_total_amount, v_job.expected_net_amount,
      v_job.expected_tax_amount, p_provider_updated_at, p_provider_updated_at
    )
    on conflict (provider, provider_allowance_id) do update
    set status = 'issued', allowance_number = excluded.allowance_number,
        issued_at = excluded.issued_at, voided_at = null,
        provider_updated_at = excluded.provider_updated_at, updated_at = now();

    update public.order_invoices
    set status = 'allowance-issued', allowance_issued_at = p_provider_updated_at,
        provider_updated_at = p_provider_updated_at, updated_at = now()
    where id = v_job.order_invoice_id;
  elsif p_outcome = 'allowance_voided' then
    update public.order_invoice_allowances
    set status = 'voided', voided_at = p_provider_updated_at,
        provider_updated_at = p_provider_updated_at, updated_at = now()
    where order_invoice_id = v_job.order_invoice_id
      and provider = 'amego'
      and provider_allowance_id = v_job.allowance_number;

    update public.order_invoices as invoice
    set status = case when exists (
          select 1 from public.order_invoice_allowances as allowance
          where allowance.order_invoice_id = invoice.id
            and allowance.status = 'issued'
        ) then 'allowance-issued' else 'issued' end,
        provider_updated_at = p_provider_updated_at,
        updated_at = now()
    where invoice.id = v_job.order_invoice_id;
  end if;
end;
$$;

revoke all on function public.complete_amego_allowance_job(
  uuid, uuid, text, boolean, boolean, text, integer, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.complete_amego_allowance_job(
  uuid, uuid, text, boolean, boolean, text, integer, timestamptz, text, text
) to service_role;

create or replace function public.purge_expired_invoice_data()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from private.checkout_invoice_preferences where expires_at < now();
  get diagnostics v_deleted = row_count;

  update private.amego_invoice_jobs
  set request_payload = '{}'::jsonb,
      expected_buyer_identifier = null,
      updated_at = now()
  where (request_payload <> '{}'::jsonb or expected_buyer_identifier is not null)
    and status in ('cancelled', 'failed_terminal', 'manual_review');

  update private.amego_allowance_jobs
  set request_payload = '{}'::jsonb, updated_at = now()
  where request_payload <> '{}'::jsonb
    and status in ('cancelled', 'failed_terminal', 'manual_review', 'issued', 'voided');
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_invoice_data() from public, anon, authenticated;
grant execute on function public.purge_expired_invoice_data() to service_role;

commit;
