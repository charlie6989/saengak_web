-- LUCISSI CARE Database Migration: 訪客結帳訂單同步、發票與會員認領
-- 規範來源: docs/GUEST_CHECKOUT_PLAN.md §2、§4、§6（2026-10-16 營運決定開放訪客結帳）
-- 問題: shopify_checkout_links.user_id 與 orders.user_id 為 not null，且
-- sync_shopify_order_webhook 在找不到會員時回 'unlinked' 並提早結束，訪客訂單
-- 不會寫入 orders，也不會建立光貿發票工作。upsert 條件 excluded.user_id = orders.user_id
-- 在 user_id 為 null 時不成立，後續事件會全部被判為 stale。
-- 修正（additive，會員訂單行為不變）:
-- 1. shopify_checkout_links / orders 的 user_id 可為 null，新增 checkout_kind
--    ('member' | 'guest') 與檢查條件：會員列必須有 user_id。
-- 2. 訪客 Email 存在 private.guest_order_contacts（PostgREST 不曝露）。
-- 3. 重建 sync_shopify_order_webhook，新增 p_contact_email text default ''（既有呼叫端相容）：
--    訪客 link 以 user_id = null 寫入訂單；upsert 改用 is not distinct from；
--    個人發票未填通知 Email 時以訂單 Email 補上（會員與訪客皆適用）。
--    找不到 link 仍回 'unlinked'（不經網站建立的 Shopify 訂單維持現狀）。
-- 4. public.claim_guest_orders()：已驗證 Email（email_confirmed_at 不為 null）的會員
--    認領同 Email 的訪客訂單。
-- 5. purge_expired_invoice_data() 另清除過期且未轉換的 checkout link。
-- 6. site_settings.guest_checkout_enabled 上線開關，預設 false（不覆寫既有值）。

begin;

-- =============================================================================
-- 1. 結帳 link 與訂單可為訪客
-- =============================================================================
alter table public.shopify_checkout_links
  alter column user_id drop not null,
  add column if not exists checkout_kind text not null default 'member';

alter table public.shopify_checkout_links
  drop constraint if exists shopify_checkout_links_checkout_kind_check,
  add constraint shopify_checkout_links_checkout_kind_check
    check (checkout_kind in ('member', 'guest')),
  drop constraint if exists shopify_checkout_links_member_user_check,
  add constraint shopify_checkout_links_member_user_check
    check (checkout_kind = 'guest' or user_id is not null);

create index if not exists shopify_checkout_links_converted_order_gid_idx
  on public.shopify_checkout_links (converted_order_gid)
  where converted_order_gid is not null;

alter table public.orders
  alter column user_id drop not null,
  add column if not exists checkout_kind text not null default 'member',
  add column if not exists guest_claimed_at timestamptz;

alter table public.orders
  drop constraint if exists orders_checkout_kind_check,
  add constraint orders_checkout_kind_check
    check (checkout_kind in ('member', 'guest')),
  drop constraint if exists orders_member_user_check,
  add constraint orders_member_user_check
    check (checkout_kind = 'guest' or user_id is not null),
  drop constraint if exists orders_guest_claim_check,
  add constraint orders_guest_claim_check
    check (guest_claimed_at is null or (checkout_kind = 'guest' and user_id is not null));

-- =============================================================================
-- 2. 訪客聯絡 Email（private，不經 PostgREST 曝露）
-- =============================================================================
create table if not exists private.guest_order_contacts (
  order_id uuid primary key references public.orders (id) on delete cascade,
  email_normalized text not null check (
    email_normalized = lower(btrim(email_normalized))
    and length(email_normalized) between 3 and 254
    and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_order_contacts_email_idx
  on private.guest_order_contacts (email_normalized);

alter table private.guest_order_contacts enable row level security;

drop trigger if exists guest_order_contacts_touch_updated_at
  on private.guest_order_contacts;
create trigger guest_order_contacts_touch_updated_at
before update on private.guest_order_contacts
for each row execute function private.touch_updated_at();

revoke all on table private.guest_order_contacts from public, anon, authenticated;
grant select, insert, update, delete on table private.guest_order_contacts to service_role;

-- =============================================================================
-- 3. 重建 sync_shopify_order_webhook（新增 p_contact_email）
-- =============================================================================
drop function if exists public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric
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
  p_fulfillments jsonb,
  p_discount_codes text[] default '{}',
  p_discount_amount numeric default 0,
  p_shipping_amount numeric default 0,
  p_contact_email text default ''
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
begin
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_typeof(p_fulfillments) <> 'array' then
    raise exception 'line items and fulfillments must be arrays';
  end if;

  v_contact_email := lower(btrim(coalesce(p_contact_email, '')));
  if length(v_contact_email) > 254
    or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    v_contact_email := '';
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

    update public.user_coupons
    set status = 'available',
        used_at = null,
        order_id = null,
        updated_at = now()
    where status = 'used'
      and order_id = (
        select id from public.orders where shopify_order_gid = p_shopify_order_gid
      );
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
  where excluded.shopify_store_domain = public.orders.shopify_store_domain
    and excluded.user_id is not distinct from public.orders.user_id
    and (excluded.shopify_updated_at, excluded.shopify_triggered_at)
      > (public.orders.shopify_updated_at, coalesce(public.orders.shopify_triggered_at, '-infinity'::timestamptz))
  returning id into v_order_id;

  if v_order_id is null then
    update private.shopify_webhook_receipts
    set result = 'stale', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'stale';
  end if;

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
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric, text
) to service_role;

-- =============================================================================
-- 4. 會員認領同 Email 的訪客訂單（需已驗證 Email）
-- =============================================================================
create or replace function public.claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_claimed_gids text[];
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- 未驗證的 Email 不可認領，否則任何人都能用他人 Email 註冊並取得對方訂單。
  select lower(btrim(users.email))
  into v_email
  from auth.users as users
  where users.id = v_user_id
    and users.email_confirmed_at is not null;

  if coalesce(v_email, '') = '' then
    return 0;
  end if;

  with claimed as (
    update public.orders as orders
    set user_id = v_user_id,
        guest_claimed_at = now(),
        updated_at = now()
    from private.guest_order_contacts as contacts
    where contacts.order_id = orders.id
      and contacts.email_normalized = v_email
      and orders.checkout_kind = 'guest'
      and orders.user_id is null
    returning orders.shopify_order_gid
  )
  select coalesce(array_agg(shopify_order_gid), '{}')
  into v_claimed_gids
  from claimed;

  -- 讓之後的 webhook 事件找到同一位會員，否則 upsert 條件會把它們判為 stale。
  update public.shopify_checkout_links
  set user_id = v_user_id
  where converted_order_gid = any(v_claimed_gids)
    and checkout_kind = 'guest'
    and user_id is null;

  return coalesce(array_length(v_claimed_gids, 1), 0);
end;
$$;

revoke all on function public.claim_guest_orders() from public, anon, authenticated, service_role;
grant execute on function public.claim_guest_orders() to authenticated;

-- =============================================================================
-- 5. 清除過期且未轉換的 checkout link
-- =============================================================================
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

  -- 保留 7 天緩衝，讓到期前建立、稍晚才送達（含 Shopify 重送）的 webhook 仍找得到 link。
  delete from public.shopify_checkout_links
  where converted_order_gid is null
    and expires_at < now() - interval '7 days';

  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_invoice_data() from public, anon, authenticated;
grant execute on function public.purge_expired_invoice_data() to service_role;

-- =============================================================================
-- 6. 上線開關（預設關閉，不覆寫後台已設定的值）
-- =============================================================================
insert into public.site_settings (key, value, is_public, description)
values ('guest_checkout_enabled', 'false'::jsonb, true, '訪客結帳開關（未登入可結帳，不可使用會員優惠）')
on conflict (key) do nothing;

commit;
