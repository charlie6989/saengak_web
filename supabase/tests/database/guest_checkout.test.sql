begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

-- =============================================================================
-- Schema and grants
-- =============================================================================
select has_table('private', 'guest_order_contacts', 'guest order contacts table exists');
select ok(
  not has_table_privilege('anon', 'private.guest_order_contacts', 'SELECT')
    and not has_table_privilege('authenticated', 'private.guest_order_contacts', 'SELECT'),
  'guest order contacts are not readable through PostgREST roles'
);
select ok(
  not has_function_privilege('anon', 'public.claim_guest_orders()', 'EXECUTE'),
  'anonymous visitors cannot call claim_guest_orders'
);
select ok(
  has_function_privilege('authenticated', 'public.claim_guest_orders()', 'EXECUTE'),
  'members can call claim_guest_orders'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.sync_shopify_order_webhook(text,text,text,text,text,text,numeric,text,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb,jsonb,text[],numeric,numeric,text)',
    'EXECUTE'
  ),
  'anonymous visitors cannot call the order sync function'
);
select results_eq(
  $$ select value::text || '|' || is_public::text from public.site_settings where key = 'guest_checkout_enabled' $$,
  array['false|true'::text],
  'guest checkout launch switch defaults to off'
);
select throws_ok(
  $$ insert into public.shopify_checkout_links (shopify_store_domain, shopify_cart_token, user_id)
     values ('saengak.myshopify.com', 'member-link-without-user', null) $$,
  '23514',
  null,
  'a member checkout link must carry a user id'
);
select throws_ok(
  $$ insert into private.guest_order_contacts (order_id, email_normalized)
     values (gen_random_uuid(), 'Mixed@Example.test') $$,
  '23514',
  null,
  'guest contact emails must be stored normalized'
);

-- =============================================================================
-- Fixtures
-- =============================================================================
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('55555555-5555-4555-8555-555555555555', 'Guest-Buyer@Example.test', now(), '{}'::jsonb),
  ('66666666-6666-4666-8666-666666666666', 'squatter-target@example.test', null, '{}'::jsonb),
  ('77777777-7777-4777-8777-777777777777', 'member-buyer@example.test', now(), '{}'::jsonb),
  ('88888888-8888-4888-8888-888888888888', 'bystander@example.test', now(), '{}'::jsonb);

insert into public.shopify_checkout_links (
  shopify_store_domain, shopify_cart_token, user_id, checkout_kind, expires_at
) values
  ('saengak.myshopify.com', 'guest-cart-token-0001', null, 'guest', '2030-01-01T00:00:00Z'),
  ('saengak.myshopify.com', 'guest-cart-token-0002', null, 'guest', '2030-01-01T00:00:00Z'),
  ('saengak.myshopify.com', 'guest-cart-token-0003', null, 'guest', '2030-01-01T00:00:00Z'),
  ('saengak.myshopify.com', 'member-cart-token-0001', '77777777-7777-4777-8777-777777777777', 'member', '2030-01-01T00:00:00Z'),
  ('saengak.myshopify.com', 'member-cart-token-0002', '77777777-7777-4777-8777-777777777777', 'member', '2030-01-01T00:00:00Z');

set local role service_role;

select public.save_checkout_invoice_preference(
  'saengak.myshopify.com', 'member-cart-token-0002',
  '{"kind":"personal","notificationEmail":"own-invoice@example.test","carrier":"none","carrierId":""}'::jsonb
);

-- =============================================================================
-- Guest order sync
-- =============================================================================
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'guest-webhook-0001', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7000000000001',
    p_shopify_cart_token => 'guest-cart-token-0001', p_order_number => '#2001',
    p_total_amount => 680, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '宅配',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => '2026-10-01T03:00:00Z',
    p_shopify_updated_at => '2026-10-01T03:01:00Z',
    p_triggered_at => '2026-10-01T03:01:01Z',
    p_line_items => '[{"shopifyLineItemGid":"gid://shopify/LineItem/1","productId":"gid://shopify/Product/2","productVariantGid":"gid://shopify/ProductVariant/3","productName":"深層修護私密清潔露","quantity":1,"price":"680.00","imageUrl":""}]'::jsonb,
    p_fulfillments => '[]'::jsonb,
    p_contact_email => '  Guest-Buyer@Example.TEST '
  ) $$,
  array['applied'::text],
  'a guest paid order is applied instead of unlinked'
);
select results_eq(
  $$ select coalesce(user_id::text, 'null') || '|' || checkout_kind
     from public.orders where shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array['null|guest'::text],
  'the guest order is stored without a member'
);
select results_eq(
  $$ select contacts.email_normalized
     from private.guest_order_contacts as contacts
     join public.orders as orders on orders.id = contacts.order_id
     where orders.shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array['guest-buyer@example.test'::text],
  'the guest contact email is normalized and kept in private'
);
select results_eq(
  $$ select count(*)::bigint from public.order_items items
     join public.orders orders on orders.id = items.order_id
     where orders.shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array[1::bigint],
  'guest order items are projected'
);
select results_eq(
  $$ select status || '|' || (request_payload -> 'preference' ->> 'notificationEmail') || '|' || order_id::text
     from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  $$ select 'pending|guest-buyer@example.test|' || id::text
     from public.orders where shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  'a guest invoice job is enqueued with the order email as notification fallback'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'guest-webhook-0002', p_topic => 'orders/updated',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7000000000001',
    p_shopify_cart_token => 'guest-cart-token-0001', p_order_number => '#2001',
    p_total_amount => 680, p_currency_code => 'TWD', p_status => 'completed',
    p_payment_status => 'paid', p_shipping_method => '宅配',
    p_fulfillment_status => 'fulfilled',
    p_shopify_created_at => '2026-10-01T03:00:00Z',
    p_shopify_updated_at => '2026-10-02T03:00:00Z',
    p_triggered_at => '2026-10-02T03:00:01Z',
    p_line_items => '[{"shopifyLineItemGid":"gid://shopify/LineItem/1","productId":"gid://shopify/Product/2","productVariantGid":"gid://shopify/ProductVariant/3","productName":"深層修護私密清潔露","quantity":1,"price":"680.00","imageUrl":""}]'::jsonb,
    p_fulfillments => '[]'::jsonb,
    p_contact_email => 'guest-buyer@example.test'
  ) $$,
  array['applied'::text],
  'a later event for a guest order is not rejected as stale'
);
select results_eq(
  $$ select status || '|' || fulfillment_status from public.orders
     where shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array['completed|fulfilled'::text],
  'the later guest event updates the order'
);
select results_eq(
  $$ select count(*)::bigint from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array[1::bigint],
  'later paid events do not duplicate the guest invoice job'
);

select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'guest-webhook-0003', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7000000000002',
    p_shopify_cart_token => 'guest-cart-token-0002', p_order_number => '#2002',
    p_total_amount => 880, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '宅配',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => '2026-10-01T04:00:00Z',
    p_shopify_updated_at => '2026-10-01T04:01:00Z',
    p_triggered_at => '2026-10-01T04:01:01Z',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb,
    p_contact_email => 'not-an-email'
  ) $$,
  array['applied'::text],
  'a guest order with an invalid contact email is still applied'
);
select results_eq(
  $$ select (select count(*) from private.guest_order_contacts contacts
             join public.orders orders on orders.id = contacts.order_id
             where orders.shopify_order_gid = 'gid://shopify/Order/7000000000002')::text
       || '|' || (request_payload -> 'preference' ->> 'notificationEmail')
     from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/7000000000002' $$,
  array['0|'::text],
  'an invalid contact email is neither stored nor used for the invoice'
);

select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'guest-webhook-0004', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7000000000003',
    p_shopify_cart_token => 'guest-cart-token-0003', p_order_number => '#2003',
    p_total_amount => 980, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '宅配',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => '2026-10-01T05:00:00Z',
    p_shopify_updated_at => '2026-10-01T05:01:00Z',
    p_triggered_at => '2026-10-01T05:01:01Z',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb,
    p_contact_email => 'squatter-target@example.test'
  ) $$,
  array['applied'::text],
  'a second guest order is applied'
);

select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'unlinked-webhook-0001', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7000000000009',
    p_shopify_cart_token => 'cart-created-outside-site', p_order_number => '#2009',
    p_total_amount => 100, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => '2026-10-01T06:00:00Z',
    p_shopify_updated_at => '2026-10-01T06:01:00Z',
    p_triggered_at => '2026-10-01T06:01:01Z',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb,
    p_contact_email => 'someone@example.test'
  ) $$,
  array['unlinked'::text],
  'an order without a site checkout link is still unlinked'
);

-- =============================================================================
-- Member order sync is unchanged apart from the notification email fallback
-- =============================================================================
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'member-webhook-0001', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7100000000001',
    p_shopify_cart_token => 'member-cart-token-0001', p_order_number => '#2101',
    p_total_amount => 680, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '宅配',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => '2026-10-01T07:00:00Z',
    p_shopify_updated_at => '2026-10-01T07:01:00Z',
    p_triggered_at => '2026-10-01T07:01:01Z',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb,
    p_contact_email => 'member-buyer@example.test'
  ) $$,
  array['applied'::text],
  'a member paid order is applied'
);
select results_eq(
  $$ select orders.user_id::text || '|' || orders.checkout_kind || '|'
       || (jobs.request_payload -> 'preference' ->> 'notificationEmail') || '|'
       || (select count(*) from private.guest_order_contacts where order_id = orders.id)::text
     from public.orders as orders
     join private.amego_invoice_jobs as jobs on jobs.order_id = orders.id
     where orders.shopify_order_gid = 'gid://shopify/Order/7100000000001' $$,
  array['77777777-7777-4777-8777-777777777777|member|member-buyer@example.test|0'::text],
  'a member order keeps its member, gets the email fallback and stores no guest contact'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'member-webhook-0002', p_topic => 'orders/paid',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7100000000002',
    p_shopify_cart_token => 'member-cart-token-0002', p_order_number => '#2102',
    p_total_amount => 680, p_currency_code => 'TWD', p_status => 'paid',
    p_payment_status => 'paid', p_shipping_method => '宅配',
    p_fulfillment_status => 'unfulfilled',
    p_shopify_created_at => '2026-10-01T08:00:00Z',
    p_shopify_updated_at => '2026-10-01T08:01:00Z',
    p_triggered_at => '2026-10-01T08:01:01Z',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb,
    p_contact_email => 'member-buyer@example.test'
  ) $$,
  array['applied'::text],
  'a member order with its own invoice email is applied'
);
select results_eq(
  $$ select request_payload -> 'preference' ->> 'notificationEmail'
     from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/7100000000002' $$,
  array['own-invoice@example.test'::text],
  'an explicit invoice notification email is not overwritten'
);

-- =============================================================================
-- RLS isolation and guest order claims
-- =============================================================================
reset role;
set local role anon;
select throws_ok(
  'select count(*) from public.orders',
  '42501',
  null,
  'anonymous visitors cannot read orders'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true);
select results_eq(
  'select count(*)::bigint from public.orders',
  array[2::bigint],
  'a member reads only their own orders, never unclaimed guest orders'
);

select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}', true);
select results_eq(
  'select public.claim_guest_orders()',
  array[0],
  'a member with an unconfirmed email cannot claim guest orders'
);

select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
select results_eq(
  'select public.claim_guest_orders()',
  array[0],
  'a member cannot claim guest orders placed with another email'
);

select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
select results_eq(
  'select count(*)::bigint from public.orders',
  array[0::bigint],
  'a guest buyer cannot read the guest order before claiming it'
);
select results_eq(
  'select public.claim_guest_orders()',
  array[1],
  'a member with the confirmed matching email claims their guest order'
);
select results_eq(
  'select order_number from public.orders',
  array['#2001'::text],
  'the claimed guest order becomes visible to its member'
);
select results_eq(
  'select public.claim_guest_orders()',
  array[0],
  'claiming again is idempotent'
);

reset role;
select results_eq(
  $$ select orders.user_id::text || '|' || orders.checkout_kind || '|'
       || (orders.guest_claimed_at is not null)::text || '|' || links.user_id::text
     from public.orders as orders
     join public.shopify_checkout_links as links
       on links.converted_order_gid = orders.shopify_order_gid
     where orders.shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array['55555555-5555-4555-8555-555555555555|guest|true|55555555-5555-4555-8555-555555555555'::text],
  'claiming keeps the guest origin and moves the checkout link to the member'
);
select results_eq(
  $$ select coalesce(user_id::text, 'null') from public.orders
     where shopify_order_gid in ('gid://shopify/Order/7000000000002', 'gid://shopify/Order/7000000000003')
     order by order_number $$,
  array['null'::text, 'null'::text],
  'other guest orders stay unclaimed'
);

set local role service_role;
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    p_webhook_id => 'guest-webhook-0005', p_topic => 'orders/updated',
    p_shopify_store_domain => 'saengak.myshopify.com',
    p_shopify_order_gid => 'gid://shopify/Order/7000000000001',
    p_shopify_cart_token => 'guest-cart-token-0001', p_order_number => '#2001',
    p_total_amount => 680, p_currency_code => 'TWD', p_status => 'refunded',
    p_payment_status => 'refunded', p_shipping_method => '宅配',
    p_fulfillment_status => 'fulfilled',
    p_shopify_created_at => '2026-10-01T03:00:00Z',
    p_shopify_updated_at => '2026-10-03T03:00:00Z',
    p_triggered_at => '2026-10-03T03:00:01Z',
    p_line_items => '[]'::jsonb, p_fulfillments => '[]'::jsonb,
    p_contact_email => 'guest-buyer@example.test'
  ) $$,
  array['applied'::text],
  'events after a claim still apply to the claimed order'
);
select results_eq(
  $$ select user_id::text || '|' || status from public.orders
     where shopify_order_gid = 'gid://shopify/Order/7000000000001' $$,
  array['55555555-5555-4555-8555-555555555555|refunded'::text],
  'the claimed order keeps its member after later events'
);

reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select public.claim_guest_orders()',
  '42501',
  null,
  'claim_guest_orders requires an authenticated member'
);

-- =============================================================================
-- Expired checkout link purge
-- =============================================================================
insert into public.shopify_checkout_links (
  shopify_store_domain, shopify_cart_token, user_id, checkout_kind, converted_order_gid, expires_at
) values
  ('saengak.myshopify.com', 'purge-expired-unconverted', null, 'guest', null, now() - interval '10 days'),
  ('saengak.myshopify.com', 'purge-recently-expired', null, 'guest', null, now() - interval '1 day'),
  ('saengak.myshopify.com', 'purge-expired-converted', null, 'guest', 'gid://shopify/Order/7000000000099', now() - interval '10 days');

set local role service_role;
select lives_ok('select public.purge_expired_invoice_data()', 'service role can purge expired data');
reset role;
select results_eq(
  $$ select shopify_cart_token from public.shopify_checkout_links
     where shopify_cart_token like 'purge-%' order by shopify_cart_token $$,
  array['purge-expired-converted'::text, 'purge-recently-expired'::text],
  'only checkout links expired past the grace period and never converted are purged'
);

select * from finish();
rollback;
