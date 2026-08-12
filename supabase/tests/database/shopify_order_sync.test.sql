begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('public', 'shopify_checkout_links', 'checkout links table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.shopify_checkout_links'::regclass),
  'checkout links has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.shopify_checkout_links', 'INSERT'),
  'members cannot forge checkout links'
);
select has_table('public', 'order_fulfillments', 'provider-neutral fulfillments table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_fulfillments'::regclass),
  'fulfillments have RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.order_fulfillments', 'INSERT'),
  'members cannot forge tracking data'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.sync_shopify_order_webhook(text,text,text,text,text,text,numeric,text,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb,jsonb)',
    'EXECUTE'
  ),
  'members cannot call the order sync function'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('33333333-3333-4333-8333-333333333333', 'checkout-owner@example.test', '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'other-owner@example.test', '{}'::jsonb);

insert into public.shopify_checkout_links (
  shopify_store_domain, shopify_cart_token, user_id, expires_at
)
values (
  'saengak.myshopify.com', 'cart-token-123456',
  '33333333-3333-4333-8333-333333333333', '2026-08-01T00:00:00Z'
);

set local role service_role;

select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'b54557e4-bdd9-4b37-8a5f-bf7d70bcd043', 'orders/paid',
    'saengak.myshopify.com', 'gid://shopify/Order/9554194432293',
    'cart-token-123456', '#1001', 680.00, 'TWD', 'paid', 'paid',
    '7-ELEVEN 超商取貨', 'unfulfilled',
    '2026-07-19T03:59:00Z', '2026-07-19T04:00:00Z',
    '2026-07-19T04:00:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222333","productId":"gid://shopify/Product/444555666","productVariantGid":"gid://shopify/ProductVariant/777888999","productName":"深層修護私密清潔露","quantity":1,"price":"680.00","imageUrl":""}]'::jsonb,
    '[]'::jsonb
  ) $$,
  array['applied'::text],
  'a linked paid order is applied'
);
select results_eq(
  $$ select count(*)::bigint from public.orders where shopify_order_gid = 'gid://shopify/Order/9554194432293' $$,
  array[1::bigint],
  'one order projection is created'
);
select results_eq(
  'select count(*)::bigint from public.order_items',
  array[1::bigint],
  'line items are projected'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'b54557e4-bdd9-4b37-8a5f-bf7d70bcd043', 'orders/paid',
    'saengak.myshopify.com', 'gid://shopify/Order/9554194432293',
    'cart-token-123456', '#1001', 680, 'TWD', 'paid', 'paid',
    '7-ELEVEN 超商取貨', 'unfulfilled',
    '2026-07-19T03:59:00Z', '2026-07-19T04:00:00Z',
    '2026-07-19T04:00:01Z', '[]'::jsonb, '[]'::jsonb
  ) $$,
  array['duplicate'::text],
  'a repeated webhook ID is deduplicated'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'e54557e4-bdd9-4b37-8a5f-bf7d70bcd046', 'orders/updated',
    'saengak.myshopify.com', 'gid://shopify/Order/9554194432293',
    'cart-token-123456', '#1001', 680, 'TWD', 'completed', 'paid',
    '7-ELEVEN 超商取貨', 'fulfilled',
    '2026-07-19T03:59:00Z', '2026-07-19T05:01:00Z',
    '2026-07-19T05:01:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222333","productId":"gid://shopify/Product/444555666","productVariantGid":"gid://shopify/ProductVariant/777888999","productName":"深層修護私密清潔露","quantity":1,"price":"680.00","imageUrl":""}]'::jsonb,
    '[{"shopifyFulfillmentGid":"gid://shopify/Fulfillment/99112233","status":"success","trackingCompany":"T-CAT","trackingNumbers":["TCAT-123456"],"trackingUrls":["https://example.test/track/TCAT-123456"],"createdAt":"2026-07-19T05:00:00Z","updatedAt":"2026-07-19T05:01:00Z"}]'::jsonb
  ) $$,
  array['applied'::text],
  'a newer fulfillment update is applied'
);
select results_eq(
  $$ select concat_ws('|', o.shipping_method, o.fulfillment_status, f.tracking_company, f.tracking_numbers[1])
     from public.orders o
     join public.order_fulfillments f on f.order_id = o.id
     where o.shopify_order_gid = 'gid://shopify/Order/9554194432293' $$,
  array['7-ELEVEN 超商取貨|fulfilled|T-CAT|TCAT-123456'::text],
  'shipping and tracking details are projected without provider lock-in'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'c54557e4-bdd9-4b37-8a5f-bf7d70bcd044', 'orders/cancelled',
    'saengak.myshopify.com', 'gid://shopify/Order/9554194432293',
    'cart-token-123456', '#1001', 680, 'TWD', 'cancelled', 'voided',
    '7-ELEVEN 超商取貨', 'unfulfilled',
    '2026-07-19T03:59:00Z', '2026-07-19T03:59:59Z',
    '2026-07-19T04:00:02Z', '[]'::jsonb, '[]'::jsonb
  ) $$,
  array['stale'::text],
  'an older update is rejected as stale'
);
select results_eq(
  $$ select status from public.orders where shopify_order_gid = 'gid://shopify/Order/9554194432293' $$,
  array['completed'::text],
  'a stale event cannot regress fulfillment state'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'd54557e4-bdd9-4b37-8a5f-bf7d70bcd045', 'orders/paid',
    'saengak.myshopify.com', 'gid://shopify/Order/9554194432294',
    'unknown-cart-token', '#1002', 880, 'TWD', 'paid', 'paid',
    '宅配', 'unfulfilled',
    '2026-07-19T04:01:00Z', '2026-07-19T04:02:00Z',
    '2026-07-19T04:02:01Z', '[]'::jsonb, '[]'::jsonb
  ) $$,
  array['unlinked'::text],
  'an unlinked order is not attached to a member'
);
select results_eq(
  'select count(*)::bigint from public.orders',
  array[1::bigint],
  'unlinked and duplicate deliveries do not add orders'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select results_eq('select count(*)::bigint from public.orders', array[1::bigint], 'owner reads the projected order');
select results_eq('select count(*)::bigint from public.order_items', array[1::bigint], 'owner reads projected items');
select results_eq('select count(*)::bigint from public.order_fulfillments', array[1::bigint], 'owner reads tracking details');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select results_eq('select count(*)::bigint from public.orders', array[0::bigint], 'another member cannot read the order');
select results_eq('select count(*)::bigint from public.order_fulfillments', array[0::bigint], 'another member cannot read tracking details');

select * from finish();
rollback;
