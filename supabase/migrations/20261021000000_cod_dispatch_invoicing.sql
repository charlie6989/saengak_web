-- Review-only migration. Default disabled; no production rollout is implied.
-- A persistent cutover scopes new CARE orders even if dispatch is later paused.
begin;
create table private.cod_invoice_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  starts_at timestamptz,
  check (not enabled or starts_at is not null)
);
insert into private.cod_invoice_policy default values;
create table private.cod_order_context (
  order_id uuid primary key references public.orders(id),
  cart_token text not null,
  context jsonb not null,
  snapshot jsonb not null
);
create table private.cod_dispatch_confirmations (
  order_id uuid primary key references public.orders(id),
  confirmation_id uuid not null unique,
  actor_id uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  source_updated_at timestamptz not null,
  carrier text not null check (carrier = 'black_cat_ambient'),
  tracking_number text not null check (tracking_number ~ '^[0-9]{10,20}$'),
  snapshot jsonb not null
);
alter table private.cod_invoice_policy enable row level security;
alter table private.cod_order_context enable row level security;
alter table private.cod_dispatch_confirmations enable row level security;
revoke all on private.cod_invoice_policy, private.cod_order_context, private.cod_dispatch_confirmations from public, anon, authenticated;
grant all on private.cod_invoice_policy, private.cod_order_context, private.cod_dispatch_confirmations to service_role;

create function private.cod_order_managed(p_shop text, p_created timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(p_shop = 'gh2xgs-zf.myshopify.com' and p_created >= starts_at, false)
  from private.cod_invoice_policy where singleton;
$$;
revoke all on function private.cod_order_managed(text, timestamptz) from public, anon, authenticated;
grant execute on function private.cod_order_managed(text, timestamptz) to service_role;

drop function public.sync_shopify_order_webhook(text, text, text, text, text, text, numeric, text, text, text, text, text, timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric, text);
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
  p_fulfillments jsonb,
  p_discount_codes text[] default '{}',
  p_discount_amount numeric default 0,
  p_shipping_amount numeric default 0,
  p_contact_email text default '',
  p_invoice_context jsonb default '{}'::jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_checkout_kind text;
  v_order_id uuid;
  v_inserted boolean;
  v_event_accepted boolean;
  v_invoice_preference jsonb;
  v_amego_request_payload jsonb;
  v_contact_email text;
  v_managed boolean;
begin
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_typeof(p_fulfillments) <> 'array' then
    raise exception 'line items and fulfillments must be arrays';
  end if;

  v_contact_email := lower(btrim(coalesce(p_contact_email, '')));
  if length(v_contact_email) > 254
    or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    v_contact_email := '';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_shopify_order_gid, 0));
  v_managed := private.cod_order_managed(p_shopify_store_domain, p_shopify_created_at);
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

  if p_topic = 'orders/cancelled' or p_status = 'cancelled' then
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

    update public.user_coupons
    set status = 'available',
        used_at = null,
        order_id = null,
        updated_at = now()
    where status = 'used'
      and order_id = (
        select id from public.orders where shopify_order_gid = p_shopify_order_gid
      );

    -- 已取消的訂單不會再開發票，結帳時的發票偏好（載具、捐贈碼、統編）不再保留
    delete from private.checkout_invoice_preferences
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token;
  end if;

  -- 訪客 link 的 user_id 為 null（會員認領後會補上），所以改以 checkout_kind 判斷是否找到 link。
  select link.user_id, link.checkout_kind
  into v_user_id, v_checkout_kind
  from public.shopify_checkout_links as link
  where link.shopify_store_domain = p_shopify_store_domain
    and link.shopify_cart_token = p_shopify_cart_token
    and link.expires_at >= coalesce(p_shopify_created_at, now())
  limit 1;

  if v_checkout_kind is null then
    update private.shopify_webhook_receipts
    set result = 'unlinked', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'unlinked';
  end if;

  insert into public.orders (
    user_id, checkout_kind, order_number, shopify_order_gid, shopify_store_domain,
    total_amount, currency_code, status, payment_status, shipping_method,
    fulfillment_status, shopify_created_at, shopify_updated_at,
    shopify_triggered_at, created_at, updated_at,
    discount_codes, total_discount_amount, shipping_amount
  ) values (
    v_user_id, v_checkout_kind, p_order_number, p_shopify_order_gid, p_shopify_store_domain,
    p_total_amount, p_currency_code, p_status, p_payment_status,
    nullif(p_shipping_method, ''), p_fulfillment_status, p_shopify_created_at,
    p_shopify_updated_at, p_triggered_at, coalesce(p_shopify_created_at, now()), now(),
    p_discount_codes, p_discount_amount, p_shipping_amount
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
      discount_codes = excluded.discount_codes,
      total_discount_amount = excluded.total_discount_amount,
      shipping_amount = excluded.shipping_amount,
      updated_at = now()
  -- 第二個條件處理認領競態：webhook 讀到 link 時 user_id 仍為 null，之後 claim_guest_orders 才提交。
  -- update 不改 user_id，已認領的會員不會被覆寫。
  where excluded.shopify_store_domain = public.orders.shopify_store_domain
    and (
      excluded.user_id is not distinct from public.orders.user_id
      or (public.orders.checkout_kind = 'guest' and excluded.user_id is null)
    )
    and (excluded.shopify_updated_at, excluded.shopify_triggered_at)
      > (public.orders.shopify_updated_at, coalesce(public.orders.shopify_triggered_at, '-infinity'::timestamptz))
  returning id into v_order_id;

  if v_order_id is null then
    update private.shopify_webhook_receipts
    set result = 'stale', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'stale';
  end if;

  insert into private.cod_order_context (order_id, cart_token, context, snapshot)
  values (v_order_id, p_shopify_cart_token, p_invoice_context,
    jsonb_build_object('orderNumber', p_order_number, 'currencyCode', p_currency_code,
      'totalAmount', p_total_amount, 'lineItems', p_line_items,
      'shippingAmount', p_shipping_amount, 'discountAmount', p_discount_amount,
      'contactEmail', v_contact_email))
  on conflict (order_id) do update set context = excluded.context, snapshot = excluded.snapshot,
    cart_token = excluded.cart_token;

  if v_checkout_kind = 'guest' and v_contact_email <> '' then
    insert into private.guest_order_contacts (order_id, email_normalized)
    values (v_order_id, v_contact_email)
    on conflict (order_id) do update
    set email_normalized = excluded.email_normalized
    where private.guest_order_contacts.email_normalized <> excluded.email_normalized;
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

  -- 未付款時保留偏好 120 天；新範圍 COD 於出貨核准快照成功後才移除。
  -- 舊範圍仍維持既有 paid 開票路徑，正式切換前必須逐單盤點。
  -- 取消也可能只出現在 orders/updated（cancelled_at 會轉成 status = cancelled），一併刪除偏好。
  if p_topic = 'orders/cancelled' or p_status = 'cancelled' then
    delete from private.checkout_invoice_preferences
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token;
  elsif p_payment_status <> 'paid' then
    update private.checkout_invoice_preferences
    set expires_at = greatest(expires_at, coalesce(p_shopify_created_at, now()) + interval '120 days'),
        updated_at = now()
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token;
  end if;

  if p_payment_status = 'paid' and p_topic <> 'orders/cancelled' and p_status <> 'cancelled' then
    if not v_managed or (p_invoice_context ->> 'paymentKind' = 'other'
      and p_invoice_context ->> 'test' = 'false') then
    select preference into v_invoice_preference
    from private.checkout_invoice_preferences
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token
      and expires_at >= p_shopify_created_at;

    v_invoice_preference := coalesce(
      v_invoice_preference,
      '{"kind":"personal","notificationEmail":"","carrier":"none","carrierId":""}'::jsonb
    );

    -- 個人發票未填通知 Email 時，以訂單 Email 補上，避免光貿收到空的 BuyerEmailAddress。
    if v_invoice_preference ->> 'kind' = 'personal'
      and coalesce(v_invoice_preference ->> 'notificationEmail', '') = ''
      and v_contact_email <> '' then
      v_invoice_preference := jsonb_set(
        v_invoice_preference, '{notificationEmail}', to_jsonb(v_contact_email), true
      );
    end if;

    v_amego_request_payload := jsonb_build_object(
      'orderNumber', p_order_number,
      'currencyCode', p_currency_code,
      'totalAmount', p_total_amount,
      'lineItems', p_line_items,
      'preference', v_invoice_preference,
      'shippingAmount', p_shipping_amount,
      'discountAmount', p_discount_amount
    );

    insert into private.amego_invoice_jobs (
      shopify_order_gid, order_id, amego_order_id, request_payload, request_sha256,
      expected_total_amount, expected_buyer_identifier,
      source_updated_at, status, next_attempt_at, updated_at
    ) values (
      p_shopify_order_gid,
      v_order_id,
      'S' || replace(p_shopify_order_gid, 'gid://shopify/Order/', ''),
      v_amego_request_payload,
      encode(extensions.digest(convert_to(v_amego_request_payload::text, 'UTF8'), 'sha256'), 'hex'),
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

    -- 偏好已寫入發票工作的 request_payload，不需再保留原始資料
    delete from private.checkout_invoice_preferences
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token;

    end if; -- COD invoice eligibility is independent of payment / coupon settlement.

    -- 訪客訂單 v_user_id 為 null，下列條件不會比對到任何會員優惠券。
    if array_length(p_discount_codes, 1) > 0 then
      update public.user_coupons
      set status = 'used',
          used_at = now(),
          order_id = v_order_id,
          updated_at = now()
      where user_id = v_user_id
        and coupon_code = any(p_discount_codes)
        and status = 'available';
    end if;
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
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric, text, jsonb
) to service_role;


-- Read only the administrator claim; service_role has no broad auth.users grant.
create function private.cod_actor_is_admin(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = actor and raw_app_meta_data->>'role' = 'admin');
$$;
revoke all on function private.cod_actor_is_admin(uuid) from public, anon, authenticated;
grant execute on function private.cod_actor_is_admin(uuid) to service_role;

create function public.confirm_cod_dispatch(
  p_order_gid text, p_confirmation_id uuid, p_actor_id uuid,
  p_expected_updated_at timestamptz, p_expected_total numeric,
  p_tracking_number text, p_carrier text, p_whole_order boolean
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  o public.orders%rowtype;
  c private.cod_order_context%rowtype;
  d private.cod_dispatch_confirmations%rowtype;
  pref jsonb;
  payload jsonb;
  jid uuid;
  item_total numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid, 0));
  if not exists (select 1 from private.cod_invoice_policy where enabled) then
    raise exception 'COD_DISPATCH_DISABLED';
  end if;
  if not private.cod_actor_is_admin(p_actor_id) then
    raise exception 'COD_ADMIN_REQUIRED';
  end if;
  select * into o from public.orders where shopify_order_gid = p_order_gid for update;
  if not found or not private.cod_order_managed(o.shopify_store_domain, o.shopify_created_at) then
    raise exception 'COD_ORDER_OUT_OF_SCOPE';
  end if;
  select * into d from private.cod_dispatch_confirmations where order_id = o.id;
  if found then
    if d.confirmation_id <> p_confirmation_id or d.tracking_number <> p_tracking_number
      or d.carrier <> p_carrier or p_whole_order is distinct from true then
      raise exception 'COD_CONFIRMATION_CONFLICT';
    end if;
    select id into jid from private.amego_invoice_jobs where order_id = o.id;
    return jid; -- same immutable operation; worker fences any subsequent mutation
  end if;
  select * into c from private.cod_order_context where order_id = o.id;
  if not found or c.context ->> 'paymentKind' is distinct from 'cod'
    or c.context ->> 'test' is distinct from 'false' then
    raise exception 'COD_EVIDENCE_REQUIRED';
  end if;
  if o.status in ('cancelled', 'refunded') or o.payment_status is distinct from 'pending'
    or o.fulfillment_status is distinct from 'unfulfilled' or o.currency_code is distinct from 'TWD'
    or o.shipping_method is distinct from '標準' or p_whole_order is distinct from true
    or p_carrier is distinct from 'black_cat_ambient'
    or p_tracking_number is null or p_tracking_number !~ '^[0-9]{10,20}$'
    or exists (select 1 from public.order_fulfillments where order_id = o.id and status <> 'cancelled') then
    raise exception 'COD_WHOLE_ORDER_REQUIRED';
  end if;
  if o.shopify_updated_at is distinct from p_expected_updated_at
    or o.total_amount is distinct from p_expected_total then
    raise exception 'COD_SNAPSHOT_CHANGED';
  end if;
  select sum((x->>'quantity')::numeric * (x->>'price')::numeric) into item_total
  from jsonb_array_elements(c.snapshot -> 'lineItems') x;
  if item_total is null or o.total_amount <= 0 or trunc(o.total_amount) <> o.total_amount
    or item_total + o.shipping_amount - o.total_discount_amount <> o.total_amount
    or exists (select 1 from jsonb_array_elements(c.snapshot -> 'lineItems') x
      where trunc((x->>'price')::numeric) <> (x->>'price')::numeric) then
    raise exception 'COD_AMOUNT_MISMATCH';
  end if;
  select preference into pref from private.checkout_invoice_preferences
  where shopify_store_domain = o.shopify_store_domain and shopify_cart_token = c.cart_token
    and expires_at > now() for update;
  if pref is null then raise exception 'COD_INVOICE_PREFERENCE_REQUIRED'; end if;
  if pref->>'kind' = 'personal' and coalesce(pref->>'notificationEmail', '') = '' then
    pref := jsonb_set(pref, '{notificationEmail}', coalesce(c.snapshot->'contactEmail', '""'::jsonb));
  end if;
  payload := (c.snapshot - 'contactEmail') || jsonb_build_object('preference', pref,
    'issueBasis', 'cod_dispatch', 'confirmationId', p_confirmation_id);
  if exists (select 1 from private.amego_invoice_jobs where shopify_order_gid = p_order_gid) then
    raise exception 'COD_EXISTING_INVOICE_REVIEW';
  end if;
  insert into private.cod_dispatch_confirmations
    (order_id, confirmation_id, actor_id, source_updated_at, carrier, tracking_number, snapshot)
  values (o.id, p_confirmation_id, p_actor_id, o.shopify_updated_at, p_carrier, p_tracking_number, payload);
  insert into private.amego_invoice_jobs
    (shopify_order_gid, order_id, amego_order_id, request_payload, request_sha256,
     expected_total_amount, expected_buyer_identifier, source_updated_at, status)
  values (p_order_gid, o.id, 'S' || replace(p_order_gid, 'gid://shopify/Order/', ''), payload,
    encode(extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex'), o.total_amount,
    case when pref->>'kind' = 'company' then pref->>'taxId' else '0000000000' end,
    o.shopify_updated_at, 'pending') returning id into jid;
  delete from private.checkout_invoice_preferences
    where shopify_store_domain = o.shopify_store_domain and shopify_cart_token = c.cart_token;
  return jid;
end;
$$;
revoke all on function public.confirm_cod_dispatch(text,uuid,uuid,timestamptz,numeric,text,text,boolean) from public, anon, authenticated;
grant execute on function public.confirm_cod_dispatch(text,uuid,uuid,timestamptz,numeric,text,text,boolean) to service_role;

-- Protect ALL enqueue/update paths, including the legacy enqueue RPC.
create function private.guard_cod_invoice_job() returns trigger
language plpgsql set search_path = '' as $$
declare
  o public.orders%rowtype;
  c private.cod_order_context%rowtype;
  d private.cod_dispatch_confirmations%rowtype;
begin
  select * into o from public.orders where shopify_order_gid = new.shopify_order_gid;
  if not found then
    if exists (select 1 from private.cod_invoice_policy where starts_at is not null) then
      raise exception 'COD_ORDER_CONTEXT_REQUIRED';
    end if;
    return new;
  end if;
  if not private.cod_order_managed(o.shopify_store_domain, o.shopify_created_at) then return new; end if;
  select * into c from private.cod_order_context where order_id = o.id;
  if new.operation = 'issue' and (tg_op = 'INSERT' or new.request_payload is distinct from old.request_payload) then
    if c.context->>'test' is distinct from 'false' then raise exception 'COD_TEST_OR_UNKNOWN_ORDER'; end if;
    if c.context->>'paymentKind' is distinct from 'other'
      or exists (select 1 from private.cod_dispatch_confirmations where order_id = o.id) then
      select * into d from private.cod_dispatch_confirmations where order_id = o.id;
      if not found or new.request_payload is distinct from d.snapshot then
        -- Cancellation may redact an unissued job, but may not enqueue it again.
        if tg_op = 'UPDATE' and new.status = 'cancelled' then return new; end if;
        raise exception 'COD_DISPATCH_CONFIRMATION_REQUIRED';
      end if;
    end if;
  end if;
  -- At-most-once provider boundary: don't mutate an unconfirmed or changed COD invoice.
  if new.operation = 'issue' and new.request_payload->>'issueBasis' = 'cod_dispatch'
    and tg_op = 'UPDATE' and new.mutation_accepted and not old.mutation_accepted then
    select * into d from private.cod_dispatch_confirmations where order_id = o.id;
    if not exists (select 1 from private.cod_invoice_policy where enabled)
      or d.confirmed_at < now() - interval '10 minutes'
      or o.status in ('cancelled', 'refunded') or c.context->>'test' is distinct from 'false'
      or c.context->>'paymentKind' is distinct from 'cod'
      or new.request_payload is distinct from d.snapshot
      or (c.snapshot - 'contactEmail') is distinct from (d.snapshot - 'preference' - 'issueBasis' - 'confirmationId') then
      raise exception 'COD_DISPATCH_REVIEW_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_cod_invoice_job before insert or update on private.amego_invoice_jobs
for each row execute function private.guard_cod_invoice_job();
revoke all on function private.guard_cod_invoice_job() from public, anon, authenticated;

create function public.get_cod_dispatch_status(p_order_gid text) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('enabled', (select enabled from private.cod_invoice_policy),
    'confirmationId', d.confirmation_id, 'trackingNumber', d.tracking_number,
    'status', j.status, 'invoiceNumber', j.provider_invoice_number,
    'confirmedAt', d.confirmed_at, 'paymentStatus', o.payment_status,
    'settlementStatus', 'external_reconciliation_required')
  from public.orders o left join private.cod_dispatch_confirmations d on d.order_id = o.id
  left join private.amego_invoice_jobs j on j.order_id = o.id
  where o.shopify_order_gid = p_order_gid and o.shopify_store_domain = 'gh2xgs-zf.myshopify.com';
$$;
revoke all on function public.get_cod_dispatch_status(text) from public, anon, authenticated;
grant execute on function public.get_cod_dispatch_status(text) to service_role;
commit;
