-- 貨到付款（COD）訂單的發票偏好保存
--
-- COD 訂單建立時尚未付款，要等送達、結算後人工在 Shopify 標記已付款，
-- sync_shopify_order_webhook 才會依結帳時保存的發票偏好建立發票工作。
-- 原本偏好只保存 30 天，且每次處理 webhook 前都會刪除過期資料，
-- 超過 30 天才標記已付款的訂單會退回一般個人發票。
--
-- 本次只重新定義 sync_shopify_order_webhook（參數與其他邏輯不變）：
-- 1. 訂單成立但未付款、未取消時，把對應偏好保存到下單後 120 天。
-- 2. 付款並建立發票工作後，偏好已寫入工作內容，刪除原始資料。
-- 3. 訂單取消時刪除偏好（含以 orders/updated 帶 cancelled_at 的取消）。

begin;

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

  -- 貨到付款等未付款訂單要等標記已付款才開發票，可能超過偏好原本的 30 天保存期。
  -- 訂單成立但尚未付款時，把偏好保存到下單後 120 天，付款時仍能依結帳時的選擇開立。
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

    -- 偏好已寫入發票工作的 request_payload，不需再保留原始資料
    delete from private.checkout_invoice_preferences
    where shopify_store_domain = p_shopify_store_domain
      and shopify_cart_token = p_shopify_cart_token;

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

commit;
