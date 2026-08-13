begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.orders
  add column if not exists shopify_triggered_at timestamptz;

create table if not exists private.checkout_invoice_preferences (
  shopify_store_domain text not null,
  shopify_cart_token text not null,
  preference jsonb not null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shopify_store_domain, shopify_cart_token),
  constraint checkout_invoice_preferences_domain_check check (
    shopify_store_domain ~ '^[a-z0-9][a-z0-9.-]*\.myshopify\.com$'
  ),
  constraint checkout_invoice_preferences_cart_token_check check (
    length(shopify_cart_token) between 8 and 255
  ),
  constraint checkout_invoice_preferences_json_check check (
    jsonb_typeof(preference) = 'object'
    and preference ->> 'kind' in ('personal', 'company')
  )
);

create table if not exists private.shopify_order_event_watermarks (
  shopify_order_gid text primary key,
  source_updated_at timestamptz not null,
  triggered_at timestamptz not null,
  topic text not null,
  updated_at timestamptz not null default now(),
  constraint shopify_order_event_watermarks_gid_check check (
    shopify_order_gid ~ '^gid://shopify/Order/[0-9]+$'
  )
);

create table if not exists private.amego_invoice_jobs (
  id uuid primary key default gen_random_uuid(),
  shopify_order_gid text not null unique,
  order_id uuid references public.orders (id) on delete set null,
  amego_order_id text not null unique,
  request_payload jsonb not null,
  request_sha256 text not null,
  expected_total_amount numeric not null check (expected_total_amount >= 0),
  expected_buyer_identifier text check (expected_buyer_identifier is null or expected_buyer_identifier ~ '^[0-9]{8,10}$'),
  source_updated_at timestamptz not null,
  operation text not null default 'issue' check (operation in ('issue', 'void')),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'provider_pending', 'failed', 'failed_terminal', 'manual_review', 'issued', 'void_review', 'void_pending', 'voided', 'cancelled')
  ),
  attempts integer not null default 0 check (attempts between 0 and 100),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_token uuid,
  mutation_accepted boolean not null default false,
  cancel_requested boolean not null default false,
  provider_invoice_number text,
  provider_status integer,
  provider_updated_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amego_invoice_jobs_order_gid_check check (
    shopify_order_gid ~ '^gid://shopify/Order/[0-9]+$'
  ),
  constraint amego_invoice_jobs_order_id_check check (
    amego_order_id ~ '^S[0-9]+$' and length(amego_order_id) <= 40
  ),
  constraint amego_invoice_jobs_payload_check check (jsonb_typeof(request_payload) = 'object'),
  constraint amego_invoice_jobs_digest_check check (request_sha256 ~ '^[0-9a-f]{64}$'),
  constraint amego_invoice_jobs_invoice_number_check check (
    provider_invoice_number is null or provider_invoice_number ~ '^[A-Z]{2}[0-9]{8}$'
  )
);

create index if not exists amego_invoice_jobs_due_idx
  on private.amego_invoice_jobs (next_attempt_at, created_at)
  where status in ('pending', 'provider_pending', 'failed', 'void_pending', 'processing');

revoke all on table private.checkout_invoice_preferences from public, anon, authenticated;
revoke all on table private.shopify_order_event_watermarks from public, anon, authenticated;
revoke all on table private.amego_invoice_jobs from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.checkout_invoice_preferences to service_role;
grant select, insert, update, delete on table private.shopify_order_event_watermarks to service_role;
grant select, insert, update, delete on table private.amego_invoice_jobs to service_role;

create or replace function public.save_checkout_invoice_preference(
  p_shopify_store_domain text,
  p_shopify_cart_token text,
  p_preference jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from private.checkout_invoice_preferences where expires_at < now();

  if p_shopify_store_domain !~ '^[a-z0-9][a-z0-9.-]*\.myshopify\.com$'
    or length(p_shopify_cart_token) not between 8 and 255
    or jsonb_typeof(p_preference) <> 'object'
    or p_preference ->> 'kind' not in ('personal', 'company') then
    raise exception 'invalid checkout invoice preference';
  end if;

  insert into private.checkout_invoice_preferences (
    shopify_store_domain,
    shopify_cart_token,
    preference,
    expires_at,
    updated_at
  ) values (
    p_shopify_store_domain,
    p_shopify_cart_token,
    p_preference,
    now() + interval '30 days',
    now()
  )
  on conflict (shopify_store_domain, shopify_cart_token) do update
  set preference = excluded.preference,
      expires_at = excluded.expires_at,
      updated_at = now();
end;
$$;

revoke all on function public.save_checkout_invoice_preference(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_checkout_invoice_preference(text, text, jsonb)
  to service_role;

drop function if exists public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb
);

create or replace function public.sync_shopify_order_webhook(
  p_webhook_id text,
  p_topic text,
  p_shopify_store_domain text,
  p_shopify_order_gid text,
  p_shopify_cart_token text,
  p_order_number text,
  p_total_amount numeric,
  p_currency_code text,
  p_status text,
  p_payment_status text,
  p_shipping_method text,
  p_fulfillment_status text,
  p_shopify_created_at timestamptz,
  p_shopify_updated_at timestamptz,
  p_triggered_at timestamptz,
  p_line_items jsonb,
  p_fulfillments jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_order_id uuid;
  v_inserted boolean;
  v_event_accepted boolean;
  v_invoice_preference jsonb;
begin
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_typeof(p_fulfillments) <> 'array' then
    raise exception 'line items and fulfillments must be arrays';
  end if;

  delete from private.checkout_invoice_preferences where expires_at < now();

  insert into private.shopify_webhook_receipts (
    webhook_id, topic, shopify_store_domain, shopify_order_gid, triggered_at
  ) values (
    p_webhook_id, p_topic, p_shopify_store_domain, p_shopify_order_gid, p_triggered_at
  )
  on conflict (webhook_id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return 'duplicate';
  end if;

  insert into private.shopify_order_event_watermarks (
    shopify_order_gid, source_updated_at, triggered_at, topic, updated_at
  ) values (
    p_shopify_order_gid, p_shopify_updated_at, p_triggered_at, p_topic, now()
  )
  on conflict (shopify_order_gid) do update
  set source_updated_at = excluded.source_updated_at,
      triggered_at = excluded.triggered_at,
      topic = excluded.topic,
      updated_at = now()
  where (excluded.source_updated_at, excluded.triggered_at)
    > (private.shopify_order_event_watermarks.source_updated_at,
       private.shopify_order_event_watermarks.triggered_at)
  returning true into v_event_accepted;

  if not coalesce(v_event_accepted, false) then
    update private.shopify_webhook_receipts
    set result = 'stale', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'stale';
  end if;

  if p_topic = 'orders/cancelled' then
    update private.amego_invoice_jobs
    set status = case
          when status = 'issued' then 'void_review'
          when status in ('processing', 'provider_pending', 'manual_review') or mutation_accepted then status
          else 'cancelled'
        end,
        operation = case when status = 'issued' then 'void' else operation end,
        mutation_accepted = case when status = 'issued' then false else mutation_accepted end,
        cancel_requested = status in ('processing', 'provider_pending', 'manual_review') or mutation_accepted,
        request_payload = case
          when status not in ('issued', 'processing', 'provider_pending') and not mutation_accepted then '{}'::jsonb
          else request_payload
        end,
        expected_buyer_identifier = case
          when status not in ('issued', 'processing', 'provider_pending', 'manual_review') and not mutation_accepted then null
          else expected_buyer_identifier
        end,
        next_attempt_at = now(),
        updated_at = now()
    where shopify_order_gid = p_shopify_order_gid
      and status in ('pending', 'processing', 'provider_pending', 'failed', 'manual_review', 'issued');
  end if;

  select link.user_id
  into v_user_id
  from public.shopify_checkout_links as link
  where link.shopify_store_domain = p_shopify_store_domain
    and link.shopify_cart_token = p_shopify_cart_token
    and link.expires_at >= coalesce(p_shopify_created_at, now())
  limit 1;

  if v_user_id is null then
    update private.shopify_webhook_receipts
    set result = 'unlinked', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'unlinked';
  end if;

  insert into public.orders (
    user_id, order_number, shopify_order_gid, shopify_store_domain,
    total_amount, currency_code, status, payment_status, shipping_method,
    fulfillment_status, shopify_created_at, shopify_updated_at,
    shopify_triggered_at, created_at, updated_at
  ) values (
    v_user_id, p_order_number, p_shopify_order_gid, p_shopify_store_domain,
    p_total_amount, p_currency_code, p_status, p_payment_status,
    nullif(p_shipping_method, ''), p_fulfillment_status, p_shopify_created_at,
    p_shopify_updated_at, p_triggered_at, coalesce(p_shopify_created_at, now()), now()
  )
  on conflict (shopify_order_gid) do update
  set order_number = excluded.order_number,
      total_amount = excluded.total_amount,
      currency_code = excluded.currency_code,
      status = excluded.status,
      payment_status = excluded.payment_status,
      shipping_method = excluded.shipping_method,
      fulfillment_status = excluded.fulfillment_status,
      shopify_updated_at = excluded.shopify_updated_at,
      shopify_triggered_at = excluded.shopify_triggered_at,
      updated_at = now()
  where excluded.shopify_store_domain = public.orders.shopify_store_domain
    and excluded.user_id = public.orders.user_id
    and (excluded.shopify_updated_at, excluded.shopify_triggered_at)
      > (public.orders.shopify_updated_at, coalesce(public.orders.shopify_triggered_at, '-infinity'::timestamptz))
  returning id into v_order_id;

  if v_order_id is null then
    update private.shopify_webhook_receipts
    set result = 'stale', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'stale';
  end if;

  delete from public.order_items where order_id = v_order_id;
  insert into public.order_items (
    order_id, shopify_line_item_gid, product_id, product_variant_gid,
    product_name, quantity, price, image_url
  )
  select v_order_id,
    item ->> 'shopifyLineItemGid',
    item ->> 'productId',
    nullif(item ->> 'productVariantGid', ''),
    item ->> 'productName',
    (item ->> 'quantity')::integer,
    (item ->> 'price')::numeric,
    nullif(item ->> 'imageUrl', '')
  from jsonb_array_elements(p_line_items) as item;

  delete from public.order_fulfillments where order_id = v_order_id;
  insert into public.order_fulfillments (
    order_id, shopify_fulfillment_gid, status, tracking_company,
    tracking_numbers, tracking_urls, shopify_created_at,
    shopify_updated_at, updated_at
  )
  select v_order_id,
    fulfillment ->> 'shopifyFulfillmentGid',
    fulfillment ->> 'status',
    nullif(fulfillment ->> 'trackingCompany', ''),
    array(select jsonb_array_elements_text(fulfillment -> 'trackingNumbers')),
    array(select jsonb_array_elements_text(fulfillment -> 'trackingUrls')),
    (fulfillment ->> 'createdAt')::timestamptz,
    (fulfillment ->> 'updatedAt')::timestamptz,
    now()
  from jsonb_array_elements(p_fulfillments) as fulfillment;

  update public.shopify_checkout_links
  set converted_order_gid = p_shopify_order_gid
  where shopify_store_domain = p_shopify_store_domain
    and shopify_cart_token = p_shopify_cart_token;

  if p_payment_status = 'paid' and p_topic <> 'orders/cancelled' then
    select preference into v_invoice_preference
    from private.checkout_invoice_preferences
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token
      and expires_at >= p_shopify_created_at;

    v_invoice_preference := coalesce(
      v_invoice_preference,
      '{"kind":"personal","notificationEmail":"","carrier":"none","carrierId":""}'::jsonb
    );

    insert into private.amego_invoice_jobs (
      shopify_order_gid, order_id, amego_order_id, request_payload, request_sha256,
      expected_total_amount, expected_buyer_identifier,
      source_updated_at, status, next_attempt_at, updated_at
    ) values (
      p_shopify_order_gid,
      v_order_id,
      'S' || replace(p_shopify_order_gid, 'gid://shopify/Order/', ''),
      jsonb_build_object(
        'orderNumber', p_order_number,
        'currencyCode', p_currency_code,
        'totalAmount', p_total_amount,
        'lineItems', p_line_items,
        'preference', v_invoice_preference
      ),
      encode(extensions.digest(convert_to(jsonb_build_object(
        'orderNumber', p_order_number,
        'currencyCode', p_currency_code,
        'totalAmount', p_total_amount,
        'lineItems', p_line_items,
        'preference', v_invoice_preference
      )::text, 'UTF8'), 'sha256'), 'hex'),
      p_total_amount,
      case when v_invoice_preference ->> 'kind' = 'company'
        then v_invoice_preference ->> 'taxId' else '0000000000' end,
      p_shopify_updated_at,
      'pending',
      now(),
      now()
    )
    on conflict (shopify_order_gid) do update
    set order_id = excluded.order_id,
        source_updated_at = greatest(private.amego_invoice_jobs.source_updated_at, excluded.source_updated_at),
        status = case when private.amego_invoice_jobs.status in ('pending', 'failed') then 'pending' else private.amego_invoice_jobs.status end,
        next_attempt_at = case when private.amego_invoice_jobs.status in ('pending', 'failed') then now() else private.amego_invoice_jobs.next_attempt_at end,
        updated_at = now()
    where private.amego_invoice_jobs.status not in ('issued', 'void_review', 'void_pending', 'voided', 'cancelled', 'manual_review');
  end if;

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

revoke all on function public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb
) to service_role;

create or replace function public.approve_amego_invoice_void(
  p_shopify_order_gid text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update private.amego_invoice_jobs
  set status = 'void_pending',
      attempts = 0,
      mutation_accepted = false,
      cancel_requested = false,
      next_attempt_at = now(),
      updated_at = now()
  where shopify_order_gid = p_shopify_order_gid
    and status = 'void_review'
    and operation = 'void';

  if not found then raise exception 'invoice void is not awaiting review'; end if;
end;
$$;

revoke all on function public.approve_amego_invoice_void(text) from public, anon, authenticated;
grant execute on function public.approve_amego_invoice_void(text) to service_role;

create or replace function public.claim_amego_invoice_job(
  p_shopify_order_gid text default null
)
returns table (
  job_id uuid,
  shopify_order_gid text,
  amego_order_id text,
  operation text,
  request_payload jsonb,
  expected_total_amount numeric,
  expected_buyer_identifier text,
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
  delete from private.checkout_invoice_preferences where expires_at < now();

  select job.id into v_job_id
  from private.amego_invoice_jobs as job
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
  update private.amego_invoice_jobs as job
  set status = 'processing',
      attempts = job.attempts + 1,
      locked_at = now(),
      lease_token = v_lease_token,
      updated_at = now()
  where job.id = v_job_id
  returning job.id,
    job.shopify_order_gid,
    job.amego_order_id,
    job.operation,
    job.request_payload,
    job.expected_total_amount,
    job.expected_buyer_identifier,
    job.provider_invoice_number,
    job.mutation_accepted,
    job.lease_token,
    job.attempts;
end;
$$;

revoke all on function public.claim_amego_invoice_job(text) from public, anon, authenticated;
grant execute on function public.claim_amego_invoice_job(text) to service_role;

create or replace function public.mark_amego_invoice_mutation_started(
  p_job_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update private.amego_invoice_jobs
  set mutation_accepted = true,
      updated_at = now()
  where id = p_job_id
    and lease_token = p_lease_token
    and status = 'processing'
    and cancel_requested = false
    and mutation_accepted = false;

  if not found then raise exception 'Amego mutation lease is not claimable'; end if;
end;
$$;

revoke all on function public.mark_amego_invoice_mutation_started(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mark_amego_invoice_mutation_started(uuid, uuid)
  to service_role;

create or replace function public.complete_amego_invoice_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_mutation_accepted boolean default false,
  p_mutation_rejected boolean default false,
  p_invoice_number text default null,
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
  v_order_id uuid;
  v_amego_order_id text;
begin
  if p_outcome not in ('issued', 'voided', 'provider_pending', 'failed', 'failed_terminal') then
    raise exception 'invalid Amego job outcome';
  end if;
  if p_outcome in ('issued', 'voided')
    and (p_invoice_number is null or p_invoice_number !~ '^[A-Z]{2}[0-9]{8}$') then
    raise exception 'verified invoice number is required';
  end if;
  if p_outcome in ('issued', 'voided') and p_provider_status is distinct from 99 then
    raise exception 'provider status 99 is required';
  end if;
  if p_outcome in ('issued', 'voided') and p_provider_updated_at is null then
    raise exception 'provider event timestamp is required';
  end if;
  if p_mutation_rejected and p_outcome not in ('failed', 'failed_terminal') then
    raise exception 'mutation rejection requires a failed outcome';
  end if;

  update private.amego_invoice_jobs as job
  set status = case
        when job.cancel_requested and (p_mutation_rejected or (not job.mutation_accepted and not p_mutation_accepted)) then 'cancelled'
        when p_outcome = 'issued' and job.cancel_requested then 'void_review'
        when p_outcome in ('provider_pending', 'failed') and job.attempts >= 10 then 'manual_review'
        else p_outcome
      end,
      provider_invoice_number = coalesce(p_invoice_number, provider_invoice_number),
      provider_status = p_provider_status,
      provider_updated_at = p_provider_updated_at,
      last_error_code = left(nullif(p_error_code, ''), 80),
      last_error_message = left(nullif(p_error_message, ''), 300),
      next_attempt_at = case
        when p_outcome in ('provider_pending', 'failed') and job.attempts < 10
          then now() + least(power(2, job.attempts), 60) * interval '1 minute'
        else next_attempt_at
      end,
      locked_at = null,
      lease_token = null,
      attempts = case when p_outcome = 'issued' and job.cancel_requested then 0 else job.attempts end,
      mutation_accepted = case
        when job.cancel_requested and (p_mutation_rejected or (not job.mutation_accepted and not p_mutation_accepted)) then false
        when p_outcome = 'issued' and job.cancel_requested then false
        when p_outcome in ('issued', 'voided') then true
        when p_mutation_rejected then false
        else job.mutation_accepted or p_mutation_accepted
      end,
      operation = case when p_outcome = 'issued' and job.cancel_requested then 'void' else job.operation end,
      cancel_requested = case when p_outcome = 'issued' and job.cancel_requested then false else job.cancel_requested end,
      request_payload = case
        when job.cancel_requested and (p_mutation_rejected or (not job.mutation_accepted and not p_mutation_accepted))
          then '{}'::jsonb
        when p_outcome in ('issued', 'voided', 'failed_terminal')
          or (p_outcome in ('provider_pending', 'failed') and job.attempts >= 10)
          then '{}'::jsonb
        else job.request_payload
      end,
      expected_buyer_identifier = case
        when job.cancel_requested and (p_mutation_rejected or (not job.mutation_accepted and not p_mutation_accepted)) then null
        when p_outcome in ('issued', 'voided', 'failed_terminal')
          or (p_outcome in ('provider_pending', 'failed') and job.attempts >= 10)
          then null
        else job.expected_buyer_identifier
      end,
      updated_at = now()
  where job.id = p_job_id
    and job.lease_token = p_lease_token
    and job.status = 'processing'
  returning job.order_id, job.amego_order_id
    into v_order_id, v_amego_order_id;

  if v_amego_order_id is null then raise exception 'Amego job is not claimable'; end if;

  if v_order_id is not null and p_outcome = 'issued' then
    insert into public.order_invoices (
      order_id, provider, provider_invoice_id, invoice_number, status,
      issued_at, provider_updated_at
    ) values (
      v_order_id, 'amego', v_amego_order_id, p_invoice_number, 'issued',
      p_provider_updated_at, p_provider_updated_at
    )
    on conflict (provider, provider_invoice_id) do update
    set invoice_number = excluded.invoice_number,
        status = 'issued',
        issued_at = excluded.issued_at,
        provider_updated_at = excluded.provider_updated_at,
        updated_at = now();
  elsif v_order_id is not null and p_outcome = 'voided' then
    update public.order_invoices
    set status = 'voided',
        voided_at = p_provider_updated_at,
        provider_updated_at = p_provider_updated_at,
        updated_at = now()
    where order_id = v_order_id
      and provider = 'amego'
      and provider_invoice_id = v_amego_order_id;
  end if;
end;
$$;

revoke all on function public.complete_amego_invoice_job(
  uuid, uuid, text, boolean, boolean, text, integer, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.complete_amego_invoice_job(
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
    and (
      status in ('cancelled', 'failed_terminal', 'manual_review')
    );
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_invoice_data() from public, anon, authenticated;
grant execute on function public.purge_expired_invoice_data() to service_role;

commit;
