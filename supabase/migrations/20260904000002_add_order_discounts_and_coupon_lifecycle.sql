-- SAENGAK Database Migration: 補上訂單折扣碼／運費解析與會員優惠券生命週期管理
-- 問題: Shopify 折扣碼購物車折抵功能上線後，訂單 webhook（sync_shopify_order_webhook）
-- 完全沒有解析 discount_codes / total_discounts / total_shipping_price_set，導致
-- (1) orders 表看不出這筆訂單用了哪些折扣碼、折了多少、運費多少；
-- (2) 會員領取的優惠券（user_coupons）永遠不會被標記為「已使用」；
-- (3) 訂單取消時已使用的優惠券也不會被復原成可用，優惠券永久卡在 used 狀態無法再領用。
-- 修正: orders 新增 discount_codes / total_discount_amount / shipping_amount 三個
-- 可為 null 的補充欄位（additive，不影響既有資料與必填驗證）；sync_shopify_order_webhook
-- 新增三個帶預設值的參數（p_discount_codes / p_discount_amount / p_shipping_amount），
-- 對既有 17 參數呼叫端完全向後相容。付款完成建立 amego_invoice_jobs 時，若訂單帶有折扣碼，
-- 一併把對應會員優惠券標記為 used 並記錄 order_id；訂單取消（orders/cancelled）時，將該筆
-- 訂單已標記為 used 的優惠券復原為 available，讓會員可以重新使用。同時把 shippingAmount /
-- discountAmount 併入 amego_invoice_jobs.request_payload，供發票 Outbox 後續讀取。
-- 冪等去重（shopify_webhook_receipts）、watermark 防倒退（shopify_order_event_watermarks）、
-- orders/order_items/order_fulfillments 投影與既有 amego_invoice_jobs 邏輯完全原封不動。

begin;

-- =============================================================================
-- 1. orders 表新增折扣碼／折扣金額／運費金額欄位（可為 null，不影響既有資料）
-- =============================================================================
alter table public.orders
  add column if not exists discount_codes text[] not null default '{}',
  add column if not exists total_discount_amount numeric,
  add column if not exists shipping_amount numeric;

-- =============================================================================
-- 2. 擴充 sync_shopify_order_webhook：解析折扣碼／運費，並管理優惠券生命週期
-- =============================================================================
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
  p_fulfillments jsonb,
  p_discount_codes text[] default '{}',
  p_discount_amount numeric default 0,
  p_shipping_amount numeric default 0
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
  v_amego_request_payload jsonb;
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
    shopify_triggered_at, created_at, updated_at,
    discount_codes, total_discount_amount, shipping_amount
  ) values (
    v_user_id, p_order_number, p_shopify_order_gid, p_shopify_store_domain,
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
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric
) from public, anon, authenticated;
grant execute on function public.sync_shopify_order_webhook(
  text, text, text, text, text, text, numeric, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb, jsonb, text[], numeric, numeric
) to service_role;

commit;
