-- Collection-based successor to the unshipped dispatch-approval design.
-- Local/review only. Enable policy and deployment separately after mapping + E2E acceptance.
begin;
alter table private.cod_invoice_policy add column collection_enabled boolean not null default false;
alter table private.cod_invoice_policy add constraint collection_cutover_required check (not collection_enabled or starts_at is not null);
create table private.cod_collection_evidence (
  order_id uuid primary key references public.orders(id),
  fulfillment_id text not null unique,
  tracking_number text not null unique,
  evidence jsonb not null,
  snapshot jsonb not null,
  recorded_at timestamptz not null default clock_timestamp(),
  verified_at timestamptz not null default clock_timestamp(),
  review_required boolean not null default false,
  review_reason text,
  payment_projection text not null default 'pending' check (payment_projection in ('pending','processing','synced','retry')),
  payment_lease uuid,
  payment_lease_until timestamptz,
  payment_error text
);
create table private.cod_collection_checks (
  order_id uuid primary key references public.orders(id),
  next_check_at timestamptz not null default now(),
  checked_at timestamptz,
  last_error text
);
alter table private.cod_collection_evidence enable row level security;
alter table private.cod_collection_checks enable row level security;
revoke all on private.cod_collection_evidence, private.cod_collection_checks from public, anon, authenticated;
grant all on private.cod_collection_evidence, private.cod_collection_checks to service_role;
-- Retire the old mutation entry even if an old deployment calls it.
create or replace function public.confirm_cod_dispatch(
  p_order_gid text, p_confirmation_id uuid, p_actor_id uuid,
  p_expected_updated_at timestamptz, p_expected_total numeric,
  p_tracking_number text, p_carrier text, p_whole_order boolean
) returns uuid language plpgsql security invoker set search_path = '' as $$
begin raise exception 'COD_DISPATCH_RETIRED'; end;
$$;
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

  -- 未付款時保留偏好 120 天；新範圍 COD 於收款證據快照成功後才移除。
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


-- Webhook content changes are sticky even when edited back. Ordinary paid/fulfillment
-- projection revisions do not invalidate an otherwise identical invoice snapshot.
create function private.review_cod_collection_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  update private.cod_collection_evidence set review_required = true, review_reason = 'COD_COLLECTION_ORDER_CHANGED'
  where order_id = new.order_id and (new.snapshot - 'contactEmail') is distinct from
    (snapshot - 'preference' - 'issueBasis' - 'collectionFingerprint');
  return new;
end;
$$;
create trigger review_cod_collection_change after update on private.cod_order_context
for each row execute function private.review_cod_collection_change();
revoke all on function private.review_cod_collection_change() from public, anon, authenticated;

create function public.get_cod_collection_work(p_order_gid text) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('snapshot', c.snapshot - 'contactEmail', 'evidence', e.evidence,
    'reviewRequired', coalesce(e.review_required,false), 'enabled', p.collection_enabled,
    'managed', private.cod_order_managed(o.shopify_store_domain,o.shopify_created_at))
  from public.orders o join private.cod_order_context c on c.order_id=o.id
  cross join private.cod_invoice_policy p left join private.cod_collection_evidence e on e.order_id=o.id
  where o.shopify_order_gid=p_order_gid and o.shopify_store_domain='gh2xgs-zf.myshopify.com'
    and c.context->>'paymentKind'='cod' and c.context->>'test'='false';
$$;

create function public.record_cod_collection(p_order_gid text, p_snapshot jsonb, p_evidence jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare o public.orders%rowtype; c private.cod_order_context%rowtype;
  e private.cod_collection_evidence%rowtype; pref jsonb; payload jsonb; jid uuid; item_total numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid,0));
  if not exists(select 1 from private.cod_invoice_policy where collection_enabled) then raise exception 'COD_COLLECTION_DISABLED'; end if;
  select * into o from public.orders where shopify_order_gid=p_order_gid for update;
  if not found or not private.cod_order_managed(o.shopify_store_domain,o.shopify_created_at) then raise exception 'COD_COLLECTION_OUTSIDE_CUTOVER'; end if;
  select * into c from private.cod_order_context where order_id=o.id;
  if not found or c.context->>'test' is distinct from 'false' or c.context->>'paymentKind' is distinct from 'cod'
    or o.status in ('cancelled','refunded') or o.payment_status not in ('pending','paid')
    or o.fulfillment_status is distinct from 'fulfilled' or o.currency_code is distinct from 'TWD' then raise exception 'COD_COLLECTION_ORDER_INELIGIBLE'; end if;
  if p_snapshot is distinct from (c.snapshot - 'contactEmail') then raise exception 'COD_COLLECTION_SNAPSHOT_CHANGED'; end if;
  if p_evidence->>'source' is distinct from 'shopify_admin_shipany_delivered'
    or p_evidence->>'contract' is distinct from 'shipany-black-cat-cod-2026-10-22'
    or p_evidence->>'amountBasis' is distinct from 'contract_inferred'
    or p_evidence->>'currency' is distinct from 'TWD'
    or (p_evidence->>'amount')::numeric is distinct from o.total_amount
    or coalesce(p_evidence->>'fingerprint','') !~ '^[a-f0-9]{64}$'
    or coalesce(p_evidence->>'fulfillmentId','') !~ '^gid://shopify/Fulfillment/[1-9][0-9]*$'
    or coalesce(p_evidence->>'serviceId','') !~ '^gid://shopify/FulfillmentService/[1-9][0-9]*$'
    or coalesce(p_evidence->>'trackingNumber','') !~ '^[0-9]{10,20}$'
    or coalesce(p_evidence->>'trackingCompany','')='' or coalesce(p_evidence->>'shippingCode','')=''
    or (p_evidence->>'deliveredAt')::timestamptz is null
    or (p_evidence->>'deliveredAt')::timestamptz > clock_timestamp() then raise exception 'COD_COLLECTION_EVIDENCE_REQUIRED'; end if;
  if exists(select 1 from private.cod_fulfillment_events where order_gid=p_order_gid
    and fulfillment_gid=p_evidence->>'fulfillmentId' and deleted and status='delivered') then
    raise exception 'COD_COLLECTION_EVENT_DELETED';
  end if;
  select * into e from private.cod_collection_evidence where order_id=o.id for update;
  if found then
    if e.review_required or e.evidence is distinct from p_evidence then raise exception 'COD_COLLECTION_EVIDENCE_CHANGED'; end if;
    update private.cod_collection_evidence set verified_at=clock_timestamp() where order_id=o.id;
    select id into jid from private.amego_invoice_jobs where order_id=o.id;
    return jid;
  end if;
  select sum((x->>'quantity')::numeric * (x->>'price')::numeric) into item_total
    from jsonb_array_elements(c.snapshot->'lineItems') x;
  if item_total is null or o.total_amount<=0 or trunc(o.total_amount)<>o.total_amount
    or item_total+o.shipping_amount-o.total_discount_amount<>o.total_amount
    or exists(select 1 from jsonb_array_elements(c.snapshot->'lineItems') x where (x->>'quantity')::numeric <=0
      or trunc((x->>'quantity')::numeric)<>(x->>'quantity')::numeric or trunc((x->>'price')::numeric)<>(x->>'price')::numeric)
    then raise exception 'COD_COLLECTION_AMOUNT_MISMATCH'; end if;
  if exists(select 1 from private.amego_invoice_jobs where shopify_order_gid=p_order_gid) then raise exception 'COD_COLLECTION_EXISTING_INVOICE'; end if;
  select preference into pref from private.checkout_invoice_preferences where shopify_store_domain=o.shopify_store_domain
    and shopify_cart_token=c.cart_token and expires_at>now() for update;
  if pref is null then raise exception 'COD_COLLECTION_PREFERENCE_REQUIRED'; end if;
  if pref->>'kind'='personal' and coalesce(pref->>'notificationEmail','')='' then
    pref:=jsonb_set(pref,'{notificationEmail}',coalesce(c.snapshot->'contactEmail','""'::jsonb));
  end if;
  payload := p_snapshot || jsonb_build_object('preference',pref,'issueBasis','cod_collection','collectionFingerprint',p_evidence->>'fingerprint');
  insert into private.cod_collection_evidence(order_id,fulfillment_id,tracking_number,evidence,snapshot)
    values(o.id,p_evidence->>'fulfillmentId',p_evidence->>'trackingNumber',p_evidence,payload);
  insert into private.amego_invoice_jobs(shopify_order_gid,order_id,amego_order_id,request_payload,request_sha256,
    expected_total_amount,expected_buyer_identifier,source_updated_at,status)
    values(p_order_gid,o.id,'S'||replace(p_order_gid,'gid://shopify/Order/',''),payload,
      encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex'),o.total_amount,
      case when pref->>'kind'='company' then pref->>'taxId' else '0000000000' end,o.shopify_updated_at,'pending') returning id into jid;
  delete from private.checkout_invoice_preferences where shopify_store_domain=o.shopify_store_domain and shopify_cart_token=c.cart_token;
  return jid;
end;
$$;

create or replace function private.guard_cod_invoice_job() returns trigger
language plpgsql set search_path = '' as $$
declare o public.orders%rowtype; c private.cod_order_context%rowtype; e private.cod_collection_evidence%rowtype;
begin
  select * into o from public.orders where shopify_order_gid=new.shopify_order_gid;
  if not found then
    if exists(select 1 from private.cod_invoice_policy where starts_at is not null) then raise exception 'COD_ORDER_CONTEXT_REQUIRED'; end if;
    return new;
  end if;
  if not private.cod_order_managed(o.shopify_store_domain,o.shopify_created_at) then return new; end if;
  select * into c from private.cod_order_context where order_id=o.id;
  select * into e from private.cod_collection_evidence where order_id=o.id;
  if tg_op='UPDATE' and new.request_payload='{}'::jsonb and new.status in ('issued','void_review','voided','cancelled','failed_terminal','manual_review') then return new; end if;
  if new.operation='issue' and (tg_op='INSERT' or new.request_payload is distinct from old.request_payload) then
    if c.context->>'test' is distinct from 'false' then raise exception 'COD_TEST_OR_UNKNOWN_ORDER'; end if;
    if c.context->>'paymentKind' is distinct from 'other' or e.order_id is not null then
      if e.order_id is null or new.request_payload is distinct from e.snapshot then raise exception 'COD_COLLECTION_EVIDENCE_REQUIRED'; end if;
    end if;
  end if;
  if new.operation='issue' and new.status='processing' and tg_op='UPDATE' and new.mutation_accepted and not old.mutation_accepted
    and (c.context->>'paymentKind' is distinct from 'other' or e.order_id is not null or old.request_payload->>'issueBasis'='cod_dispatch') then
    if e.order_id is null or e.review_required or not exists(select 1 from private.cod_invoice_policy where collection_enabled)
      or o.status in ('cancelled','refunded') or o.payment_status not in ('pending','paid')
      or o.fulfillment_status is distinct from 'fulfilled' or c.context->>'test' is distinct from 'false'
      or c.context->>'paymentKind' is distinct from 'cod' or o.currency_code is distinct from 'TWD'
      or e.verified_at < clock_timestamp()-interval '60 seconds'
      or new.request_payload is distinct from e.snapshot
      or (c.snapshot-'contactEmail') is distinct from (e.snapshot-'preference'-'issueBasis'-'collectionFingerprint')
      then raise exception 'COD_COLLECTION_REVIEW_REQUIRED'; end if;
  end if;
  return new;
end;
$$;

-- Reserve one candidate at a time, in oldest-check order. A crash releases the
-- reservation by time, so scheduled catchup is not dependent on webhook delivery.
create function public.claim_cod_collection_check() returns text
language plpgsql security invoker set search_path = '' as $$
declare oid uuid; gid text;
begin
  if not exists(select 1 from private.cod_invoice_policy where collection_enabled) then return null; end if;
  insert into private.cod_collection_checks(order_id)
    select o.id from public.orders o join private.cod_order_context c on c.order_id=o.id
    where private.cod_order_managed(o.shopify_store_domain,o.shopify_created_at)
      and c.context->>'paymentKind'='cod' and c.context->>'test'='false'
    on conflict do nothing;
  select q.order_id,o.shopify_order_gid into oid,gid from private.cod_collection_checks q
    join public.orders o on o.id=q.order_id left join private.cod_collection_evidence e on e.order_id=o.id
    where q.next_check_at<=clock_timestamp() and not coalesce(e.review_required,false)
      and o.status not in ('cancelled','refunded')
    order by q.next_check_at,q.order_id for update of q skip locked limit 1;
  if oid is null then return null; end if;
  update private.cod_collection_checks set next_check_at=clock_timestamp()+interval '5 minutes' where order_id=oid;
  return gid;
end;
$$;
create function public.finish_cod_collection_check(p_order_gid text,p_error text,p_revoke boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid,0));
  insert into private.cod_collection_checks(order_id,checked_at,next_check_at,last_error)
    select id,clock_timestamp(),clock_timestamp()+interval '5 minutes',left(p_error,100) from public.orders where shopify_order_gid=p_order_gid
    on conflict(order_id) do update set checked_at=excluded.checked_at,next_check_at=excluded.next_check_at,last_error=excluded.last_error;
  if p_revoke then
    update private.cod_collection_evidence set review_required=true,review_reason=left(p_error,100)
      where order_id=(select id from public.orders where shopify_order_gid=p_order_gid);
  end if;
end;
$$;
create function public.claim_cod_payment_projection(p_order_gid text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare e private.cod_collection_evidence%rowtype; o public.orders%rowtype; token uuid:=extensions.gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid,0));
  select * into o from public.orders where shopify_order_gid=p_order_gid;
  select * into e from private.cod_collection_evidence where order_id=o.id for update;
  if not found or e.review_required or not exists(select 1 from private.cod_invoice_policy where collection_enabled)
    or o.status in ('cancelled','refunded') or o.payment_status not in ('pending','paid')
    or e.verified_at<clock_timestamp()-interval '60 seconds'
    or e.payment_projection='synced' or e.payment_lease_until>clock_timestamp() then return null; end if;
  if not exists(select 1 from private.cod_order_context c where c.order_id=o.id
    and c.context->>'test'='false' and c.context->>'paymentKind'='cod'
    and c.snapshot-'contactEmail'=e.snapshot-'preference'-'issueBasis'-'collectionFingerprint') then return null; end if;
  update private.cod_collection_evidence set payment_projection='processing',payment_lease=token,
    payment_lease_until=clock_timestamp()+interval '2 minutes' where order_id=o.id;
  return token;
end;
$$;
create function public.complete_cod_payment_projection(p_order_gid text,p_lease uuid,p_success boolean,p_error text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid,0));
  update private.cod_collection_evidence set payment_projection=case when p_success then 'synced' else 'retry' end,
    payment_lease=null,payment_lease_until=null,payment_error=left(p_error,100)
    where order_id=(select id from public.orders where shopify_order_gid=p_order_gid) and payment_lease=p_lease;
  if not found then raise exception 'COD_COLLECTION_PAYMENT_LEASE_LOST'; end if;
end;
$$;
create or replace function public.get_cod_dispatch_status(p_order_gid text) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('enabled',p.collection_enabled,'status',j.status,'invoiceNumber',j.provider_invoice_number,
    'paymentStatus',o.payment_status,'paymentProjection',e.payment_projection,'paymentError',e.payment_error,
    'fulfillmentStatus',o.fulfillment_status,'trackingNumber',e.tracking_number,
    'collectedAt',e.evidence->>'deliveredAt','amountBasis',e.evidence->>'amountBasis',
    'reviewRequired',coalesce(e.review_required,false),'reviewReason',e.review_reason,
    'lastCheckedAt',q.checked_at,'lastError',q.last_error,'settlementStatus','external_reconciliation_required')
  from public.orders o cross join private.cod_invoice_policy p
    left join private.cod_collection_evidence e on e.order_id=o.id
    left join private.cod_collection_checks q on q.order_id=o.id
    left join private.amego_invoice_jobs j on j.order_id=o.id
  where o.shopify_order_gid=p_order_gid and o.shopify_store_domain='gh2xgs-zf.myshopify.com';
$$;
revoke all on function public.get_cod_collection_work(text),public.record_cod_collection(text,jsonb,jsonb),
  public.claim_cod_collection_check(),public.finish_cod_collection_check(text,text,boolean),
  public.claim_cod_payment_projection(text),public.complete_cod_payment_projection(text,uuid,boolean,text)
  from public,anon,authenticated;
grant execute on function public.get_cod_collection_work(text),public.record_cod_collection(text,jsonb,jsonb),
  public.claim_cod_collection_check(),public.finish_cod_collection_check(text,text,boolean),
  public.claim_cod_payment_projection(text),public.complete_cod_payment_projection(text,uuid,boolean,text) to service_role;
-- Minimal durable inbox also accepts events arriving before the order projection.
-- Raw customer payloads are not retained. Delete is a tombstone: replayed create
-- must never resurrect withdrawn delivery evidence.
create table private.cod_fulfillment_events (
  event_id text primary key, order_gid text not null, fulfillment_gid text not null,
  status text not null, deleted boolean not null, received_at timestamptz not null default clock_timestamp()
);
create table private.cod_fulfillment_receipts (webhook_id text primary key, received_at timestamptz not null default clock_timestamp());
alter table private.cod_fulfillment_events enable row level security;
alter table private.cod_fulfillment_receipts enable row level security;
revoke all on private.cod_fulfillment_events,private.cod_fulfillment_receipts from public,anon,authenticated;
grant all on private.cod_fulfillment_events,private.cod_fulfillment_receipts to service_role;
create function public.receive_cod_fulfillment_event(p_webhook_id text,p_order_gid text,p_fulfillment_gid text,p_event_id text,p_status text,p_deleted boolean)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  if p_webhook_id !~ '^[a-zA-Z0-9-]{1,100}$' or p_order_gid !~ '^gid://shopify/Order/[1-9][0-9]*$'
    or p_fulfillment_gid !~ '^gid://shopify/Fulfillment/[1-9][0-9]*$' or p_event_id !~ '^[1-9][0-9]*$'
    or p_status !~ '^[a-z_]{1,40}$' or p_deleted is null then raise exception 'COD_COLLECTION_INVALID_EVENT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid,0));
  insert into private.cod_fulfillment_receipts(webhook_id) values(p_webhook_id) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  if exists(select 1 from private.cod_fulfillment_events where event_id=p_event_id
    and (order_gid<>p_order_gid or fulfillment_gid<>p_fulfillment_gid or status<>p_status)) then raise exception 'COD_COLLECTION_EVENT_CONFLICT'; end if;
  insert into private.cod_fulfillment_events(event_id,order_gid,fulfillment_gid,status,deleted)
    values(p_event_id,p_order_gid,p_fulfillment_gid,p_status,p_deleted)
    on conflict(event_id) do update set deleted=private.cod_fulfillment_events.deleted or excluded.deleted;
  if p_deleted and p_status='delivered' then
    update private.cod_collection_evidence set review_required=true,review_reason='COD_COLLECTION_EVENT_DELETED'
      where fulfillment_id=p_fulfillment_gid and order_id=(select id from public.orders where shopify_order_gid=p_order_gid);
  end if;
  insert into private.cod_collection_checks(order_id,next_check_at)
    select id,clock_timestamp() from public.orders where shopify_order_gid=p_order_gid
    on conflict(order_id) do update set next_check_at=least(private.cod_collection_checks.next_check_at,excluded.next_check_at);
  return 'recorded';
end;
$$;
-- Last local check after the final remote read. No remote API can be atomic with
-- our database; a later Shopify correction remains an explicit reconciliation case.
create function public.authorize_cod_payment_projection(p_order_gid text,p_lease uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_gid,0));
  if not exists(select 1 from private.cod_collection_evidence e join public.orders o on o.id=e.order_id
    join private.cod_order_context c on c.order_id=o.id cross join private.cod_invoice_policy p
    where o.shopify_order_gid=p_order_gid and e.payment_lease=p_lease and e.payment_lease_until>clock_timestamp()
    and e.payment_projection='processing' and not e.review_required and p.collection_enabled
    and o.status not in ('cancelled','refunded') and o.payment_status in ('pending','paid') and o.fulfillment_status='fulfilled'
    and e.verified_at>=clock_timestamp()-interval '60 seconds' and c.context->>'paymentKind'='cod' and c.context->>'test'='false'
    and c.snapshot-'contactEmail'=e.snapshot-'preference'-'issueBasis'-'collectionFingerprint') then
    raise exception 'COD_COLLECTION_REVIEW_REQUIRED';
  end if;
end;
$$;
revoke all on function public.receive_cod_fulfillment_event(text,text,text,text,text,boolean),public.authorize_cod_payment_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.receive_cod_fulfillment_event(text,text,text,text,text,boolean),public.authorize_cod_payment_projection(text,uuid) to service_role;

commit;
