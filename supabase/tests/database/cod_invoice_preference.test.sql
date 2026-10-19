begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

-- 貨到付款（COD）：訂單成立時未付款，要等人工標記已付款才開發票。
-- 發票偏好要保存到那時候，付款建立發票工作後再刪除；取消的訂單也刪除。

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values ('99999999-9999-4999-8999-999999999991', 'cod-buyer@example.test', now(), '{}'::jsonb);

insert into public.shopify_checkout_links (
  shopify_store_domain, shopify_cart_token, user_id, checkout_kind, expires_at
) values
  ('saengak.myshopify.com', 'cod-cart-token-0001', '99999999-9999-4999-8999-999999999991', 'member', '2030-01-01T00:00:00Z'),
  ('saengak.myshopify.com', 'cod-cart-token-0002', '99999999-9999-4999-8999-999999999991', 'member', '2030-01-01T00:00:00Z'),
  ('saengak.myshopify.com', 'card-cart-token-0001', '99999999-9999-4999-8999-999999999991', 'member', '2030-01-01T00:00:00Z');

set local role service_role;

select public.save_checkout_invoice_preference(
  'saengak.myshopify.com', 'cod-cart-token-0001',
  '{"kind":"company","taxId":"12345678","companyName":"測試股份有限公司","notificationEmail":"company@example.test"}'::jsonb
);
select public.save_checkout_invoice_preference(
  'saengak.myshopify.com', 'cod-cart-token-0002',
  '{"kind":"personal","notificationEmail":"cod-cancel@example.test","carrier":"mobile","carrierId":"/ABC1234"}'::jsonb
);
select public.save_checkout_invoice_preference(
  'saengak.myshopify.com', 'card-cart-token-0001',
  '{"kind":"personal","notificationEmail":"card@example.test","carrier":"mobile","carrierId":"/XYZ9876"}'::jsonb
);

-- =============================================================================
-- 未付款的 COD 訂單：偏好延長保存，且不會被清除
-- =============================================================================
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'cod-webhook-0001', p_topic => 'orders/create',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7100000000001',
    p_shopify_cart_token => 'cod-cart-token-0001', p_order_number => '#3001',
    p_total_amount => 826, p_currency_code => 'TWD', p_status => 'processing',
    p_payment_status => 'pending', p_shipping_method => '全家店到店',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => now(),
    p_shopify_updated_at => now(),
    p_triggered_at => now(),
    p_line_items => '[{"shopifyLineItemGid":"gid://shopify/LineItem/71","productId":"gid://shopify/Product/72","productVariantGid":"gid://shopify/ProductVariant/73","productName":"潔淨慕斯","quantity":1,"price":"680.00","imageUrl":""}]'::jsonb,
    p_fulfillments => '[]'::jsonb
  ) $$,
  array['applied'::text],
  'an unpaid COD order is applied'
);
select ok(
  (select expires_at > now() + interval '100 days'
   from private.checkout_invoice_preferences
   where shopify_cart_token = 'cod-cart-token-0001'),
  'the invoice preference of an unpaid order is kept well beyond the default 30 days'
);
select is(
  (select count(*)::int from private.amego_invoice_jobs where shopify_order_gid = 'gid://shopify/Order/7100000000001'),
  0,
  'no invoice job is created while the COD order is unpaid'
);
select public.purge_expired_invoice_data();
select is(
  (select count(*)::int from private.checkout_invoice_preferences where shopify_cart_token = 'cod-cart-token-0001'),
  1,
  'purging expired invoice data keeps the preference of the unpaid order'
);

-- =============================================================================
-- 標記已付款：依結帳時的偏好開立，並刪除偏好
-- =============================================================================
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'cod-webhook-0002', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7100000000001',
    p_shopify_cart_token => 'cod-cart-token-0001', p_order_number => '#3001',
    p_total_amount => 826, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '全家店到店',
    p_fulfillment_status => 'fulfilled',
    p_shopify_created_at => now(),
    p_shopify_updated_at => now() + interval '1 minute',
    p_triggered_at => now() + interval '1 minute',
    p_line_items => '[{"shopifyLineItemGid":"gid://shopify/LineItem/71","productId":"gid://shopify/Product/72","productVariantGid":"gid://shopify/ProductVariant/73","productName":"潔淨慕斯","quantity":1,"price":"680.00","imageUrl":""}]'::jsonb,
    p_fulfillments => '[]'::jsonb
  ) $$,
  array['applied'::text],
  'marking the COD order paid is applied'
);
select results_eq(
  $$ select (request_payload -> 'preference' ->> 'kind') || '|' || expected_buyer_identifier
     from private.amego_invoice_jobs where shopify_order_gid = 'gid://shopify/Order/7100000000001' $$,
  array['company|12345678'::text],
  'the invoice job uses the company tax id chosen at checkout'
);
select is(
  (select count(*)::int from private.checkout_invoice_preferences where shopify_cart_token = 'cod-cart-token-0001'),
  0,
  'the preference is deleted once it is copied into the invoice job'
);

-- =============================================================================
-- 取消的 COD 訂單：刪除偏好
-- =============================================================================
select public.sync_shopify_order_webhook(
  p_webhook_id => 'cod-webhook-0003', p_topic => 'orders/create',
  p_shopify_store_domain => 'saengak.myshopify.com',
  p_shopify_order_gid => 'gid://shopify/Order/7100000000002',
  p_shopify_cart_token => 'cod-cart-token-0002', p_order_number => '#3002',
  p_total_amount => 249, p_currency_code => 'TWD', p_status => 'processing',
  p_payment_status => 'pending', p_shipping_method => '全家店到店',
  p_fulfillment_status => 'unfulfilled',
  p_shopify_created_at => now(), p_shopify_updated_at => now(), p_triggered_at => now(),
  p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'cod-webhook-0004', p_topic => 'orders/cancelled',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7100000000002',
    p_shopify_cart_token => 'cod-cart-token-0002', p_order_number => '#3002',
    p_total_amount => 249, p_currency_code => 'TWD', p_status => 'cancelled',
    p_payment_status => 'voided', p_shipping_method => '全家店到店',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => now(),
    p_shopify_updated_at => now() + interval '1 minute',
    p_triggered_at => now() + interval '1 minute',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb
  ) $$,
  array['applied'::text],
  'cancelling the COD order is applied'
);
select is(
  (select count(*)::int from private.checkout_invoice_preferences where shopify_cart_token = 'cod-cart-token-0002'),
  0,
  'the preference of a cancelled order is deleted'
);

-- =============================================================================
-- 信用卡即時付款：維持原本流程，開立後刪除偏好
-- =============================================================================
select public.sync_shopify_order_webhook(
  p_webhook_id => 'card-webhook-0001', p_topic => 'orders/paid',
  p_shopify_store_domain => 'saengak.myshopify.com',
  p_shopify_order_gid => 'gid://shopify/Order/7100000000003',
  p_shopify_cart_token => 'card-cart-token-0001', p_order_number => '#3003',
  p_total_amount => 166, p_currency_code => 'TWD', p_status => 'paid',
  p_payment_status => 'paid', p_shipping_method => '宅配',
  p_fulfillment_status => 'unfulfilled',
  p_shopify_created_at => now(), p_shopify_updated_at => now(), p_triggered_at => now(),
  p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb
);
select results_eq(
  $$ select (request_payload -> 'preference' ->> 'carrierId') || '|' ||
       (select count(*)::text from private.checkout_invoice_preferences where shopify_cart_token = 'card-cart-token-0001')
     from private.amego_invoice_jobs where shopify_order_gid = 'gid://shopify/Order/7100000000003' $$,
  array['/XYZ9876|0'::text],
  'a card order paid at once keeps its carrier and its preference is then deleted'
);

select * from finish();
rollback;
