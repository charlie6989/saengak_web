begin;

create extension if not exists pgtap with schema extensions;
select plan(43);

select has_table('private', 'checkout_invoice_preferences', 'invoice preferences are private');
select has_table('private', 'amego_invoice_jobs', 'Amego transactional outbox is private');
select ok(
  not has_table_privilege('authenticated', 'private.amego_invoice_jobs', 'SELECT'),
  'members cannot read invoice outbox PII'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_amego_invoice_job(text)',
    'EXECUTE'
  ),
  'members cannot claim invoice work'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_amego_invoice_job(uuid,uuid,text,boolean,boolean,text,integer,timestamptz,text,text)',
    'EXECUTE'
  ),
  'members cannot forge provider outcomes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.mark_amego_invoice_mutation_started(uuid,uuid)',
    'EXECUTE'
  ),
  'members cannot mark an external invoice mutation as started'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('88888888-8888-4888-8888-888888888888', 'amego-owner@example.test', '{}'::jsonb);
insert into public.shopify_checkout_links (
  shopify_store_domain, shopify_cart_token, user_id, expires_at
) values (
  'saengak.myshopify.com', 'amego-cart-token-123456',
  '88888888-8888-4888-8888-888888888888', '2026-09-01T00:00:00Z'
);

set local role service_role;
select lives_ok(
  $$ select public.save_checkout_invoice_preference(
    'saengak.myshopify.com',
    'amego-cart-token-123456',
    '{"kind":"personal","notificationEmail":"buyer@example.test","carrier":"mobile","carrierId":"/TRM+O+P"}'::jsonb
  ) $$,
  'trusted checkout backend stores the validated preference'
);

select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'a1111111-1111-4111-8111-111111111111', 'orders/paid',
    'saengak.myshopify.com', 'gid://shopify/Order/9990001112223',
    'amego-cart-token-123456', '#A1001', 680, 'TWD', 'paid', 'paid',
    'ShipAny 7-ELEVEN', 'unfulfilled',
    '2026-08-13T01:00:00Z', '2026-08-13T01:01:00Z', '2026-08-13T01:01:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222333","productId":"gid://shopify/Product/444555666","productVariantGid":"gid://shopify/ProductVariant/777888999","productName":"測試商品","quantity":1,"price":"680","imageUrl":""}]'::jsonb,
    '[]'::jsonb
  ) $$,
  array['applied'::text],
  'exact paid status applies the order and enqueues invoice work'
);
select results_eq(
  $$ select status || '|' || operation from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112223' $$,
  array['pending|issue'::text],
  'paid order creates one pending issue operation'
);
select results_eq(
  $$ select count(*)::bigint from private.amego_invoice_jobs
     where request_sha256 ~ '^[0-9a-f]{64}$' $$,
  array[1::bigint],
  'immutable invoice snapshot has a SHA-256 digest'
);

create temporary table claimed_amego_job as
select * from public.claim_amego_invoice_job('gid://shopify/Order/9990001112223');
select results_eq(
  'select operation || ''|'' || attempts::text from claimed_amego_job',
  array['issue|1'::text],
  'worker atomically leases the issue operation'
);
update private.amego_invoice_jobs
set locked_at = now() - interval '11 minutes'
where shopify_order_gid = 'gid://shopify/Order/9990001112223';
create temporary table reclaimed_amego_job as
select * from public.claim_amego_invoice_job('gid://shopify/Order/9990001112223');
select isnt(
  (select lease_token from claimed_amego_job),
  (select lease_token from reclaimed_amego_job),
  'reclaimed work receives a new fencing token'
);
select throws_ok(
  $$ select public.complete_amego_invoice_job(
    (select job_id from claimed_amego_job), (select lease_token from claimed_amego_job),
    'provider_pending', true, false, null, null, null, 'STALE', null
  ) $$,
  'P0001',
  'Amego job is not claimable',
  'an expired worker cannot complete a newer lease'
);
select throws_ok(
  $$ select public.mark_amego_invoice_mutation_started(
    (select job_id from claimed_amego_job), (select lease_token from claimed_amego_job)
  ) $$,
  'P0001',
  'Amego mutation lease is not claimable',
  'an expired worker cannot open the mutation boundary'
);
select lives_ok(
  $$ select public.mark_amego_invoice_mutation_started(
    (select job_id from reclaimed_amego_job), (select lease_token from reclaimed_amego_job)
  ) $$,
  'current fenced worker persists the mutation boundary before provider I/O'
);
select results_eq(
  $$ select mutation_accepted from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112223' $$,
  array[true],
  'a reclaimed worker can only query after the mutation boundary is persisted'
);
select throws_ok(
  $$ select public.complete_amego_invoice_job(
    (select job_id from reclaimed_amego_job), (select lease_token from reclaimed_amego_job),
    'issued', true, false, 'AA12345678', 31,
    '2026-08-13T01:02:00Z', null, null
  ) $$,
  'P0001',
  'provider status 99 is required',
  'accepted or processing provider status cannot forge issued state'
);
select results_eq(
  $$ select count(*)::bigint from public.order_invoices where provider = 'amego' $$,
  array[0::bigint],
  'no invoice projection exists before provider completion'
);
select lives_ok(
  $$ select public.complete_amego_invoice_job(
    (select job_id from reclaimed_amego_job), (select lease_token from reclaimed_amego_job),
    'issued', true, false, 'AA12345678', 99,
    '2026-08-13T01:02:00Z', null, null
  ) $$,
  'verified provider completion writes the invoice projection'
);
select results_eq(
  $$ select status || '|' || invoice_number from public.order_invoices where provider = 'amego' $$,
  array['issued|AA12345678'::text],
  'member projection contains the confirmed Amego invoice only'
);
select results_eq(
  $$ select request_payload::text || '|' || coalesce(expected_buyer_identifier, 'NULL') from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112223' $$,
  array['{}|NULL'::text],
  'PII-bearing request payload and buyer identifier are scrubbed after completion'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'a2222222-2222-4222-8222-222222222222', 'orders/cancelled',
    'saengak.myshopify.com', 'gid://shopify/Order/9990001112223',
    'amego-cart-token-123456', '#A1001', 680, 'TWD', 'cancelled', 'paid',
    'ShipAny 7-ELEVEN', 'unfulfilled',
    '2026-08-13T01:00:00Z', '2026-08-13T02:01:00Z', '2026-08-13T02:01:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222333","productId":"gid://shopify/Product/444555666","productVariantGid":"gid://shopify/ProductVariant/777888999","productName":"測試商品","quantity":1,"price":"680","imageUrl":""}]'::jsonb,
    '[]'::jsonb
  ) $$,
  array['applied'::text],
  'a paid cancellation does not re-enqueue an issue operation'
);
select results_eq(
  $$ select status from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112223' $$,
  array['void_review'::text],
  'cancelled issued invoice stops for accounting review'
);
select lives_ok(
  $$ select public.approve_amego_invoice_void('gid://shopify/Order/9990001112223') $$,
  'trusted accounting approval releases the void operation'
);

update private.amego_invoice_jobs
set status = 'processing', operation = 'issue', cancel_requested = false,
    mutation_accepted = true, lease_token = '33333333-3333-4333-8333-333333333333',
    request_payload = '{"preference":{"kind":"personal"}}'::jsonb
where shopify_order_gid = 'gid://shopify/Order/9990001112223';
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'a3333333-3333-4333-8333-333333333333', 'orders/cancelled',
    'saengak.myshopify.com', 'gid://shopify/Order/9990001112223',
    'amego-cart-token-123456', '#A1001', 680, 'TWD', 'cancelled', 'paid',
    'ShipAny 7-ELEVEN', 'unfulfilled',
    '2026-08-13T01:00:00Z', '2026-08-13T03:01:00Z', '2026-08-13T03:01:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222333","productId":"gid://shopify/Product/444555666","productVariantGid":"gid://shopify/ProductVariant/777888999","productName":"測試商品","quantity":1,"price":"680","imageUrl":""}]'::jsonb,
    '[]'::jsonb
  ) $$,
  array['applied'::text],
  'cancellation remains reconcilable while provider mutation is in flight'
);
select results_eq(
  $$ select status || '|' || cancel_requested::text from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112223' $$,
  array['processing|true'::text],
  'in-flight cancellation does not abandon the provider reconciliation'
);
select lives_ok(
  $$ select public.complete_amego_invoice_job(
    (select id from private.amego_invoice_jobs where shopify_order_gid = 'gid://shopify/Order/9990001112223'),
    '33333333-3333-4333-8333-333333333333', 'issued', true, false,
    'AA12345678', 99, '2026-08-13T03:02:00Z', null, null
  ) $$,
  'provider-confirmed issue completes even after cancellation arrives'
);
select results_eq(
  $$ select status || '|' || operation from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112223' $$,
  array['void_review|void'::text],
  'confirmed orphan risk is routed to reviewed void instead of being lost'
);

insert into private.amego_invoice_jobs (
  shopify_order_gid, amego_order_id, request_payload, request_sha256,
  expected_total_amount, expected_buyer_identifier, source_updated_at,
  status, attempts, next_attempt_at, mutation_accepted
) values (
  'gid://shopify/Order/9990001112999', 'S9990001112999',
  '{"preference":{"kind":"personal","notificationEmail":"retention@example.test"}}'::jsonb,
  repeat('a', 64), 680, '0000000000', '2026-08-13T04:00:00Z',
  'provider_pending', 9, now(), true
);
create temporary table exhausted_amego_job as
select * from public.claim_amego_invoice_job('gid://shopify/Order/9990001112999');
select lives_ok(
  $$ select public.complete_amego_invoice_job(
    (select job_id from exhausted_amego_job), (select lease_token from exhausted_amego_job),
    'provider_pending', true, false, null, null, null, 'PROVIDER_PENDING', null
  ) $$,
  'provider polling budget closes without a hot retry loop'
);
select results_eq(
  $$ select status || '|' || request_payload::text from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112999' $$,
  array['manual_review|{}'::text],
  'exhausted provider polling stops for review and scrubs PII'
);
update private.checkout_invoice_preferences
set expires_at = now() - interval '1 day'
where shopify_cart_token = 'amego-cart-token-123456';
select lives_ok(
  $$ select public.purge_expired_invoice_data() $$,
  'trusted retention job can purge expired invoice preferences'
);
select results_eq(
  $$ select count(*)::bigint from private.checkout_invoice_preferences
     where shopify_cart_token = 'amego-cart-token-123456' $$,
  array[0::bigint],
  'expired invoice preference PII is deleted'
);

insert into private.amego_invoice_jobs (
  shopify_order_gid, amego_order_id, request_payload, request_sha256,
  expected_total_amount, expected_buyer_identifier, source_updated_at,
  status, next_attempt_at
) values (
  'gid://shopify/Order/9990001112888', 'S9990001112888',
  '{"preference":{"kind":"personal"}}'::jsonb, repeat('b', 64),
  680, '0000000000', '2026-08-13T05:00:00Z', 'pending', now()
);
create temporary table rejected_amego_job as
select * from public.claim_amego_invoice_job('gid://shopify/Order/9990001112888');
select lives_ok(
  $$ select public.mark_amego_invoice_mutation_started(
    (select job_id from rejected_amego_job), (select lease_token from rejected_amego_job)
  ) $$,
  'retryable provider mutation starts behind the fenced boundary'
);
select lives_ok(
  $$ select public.complete_amego_invoice_job(
    (select job_id from rejected_amego_job), (select lease_token from rejected_amego_job),
    'failed', false, true, null, null, null, 'AMEGO_21', 'provider busy'
  ) $$,
  'an explicit provider rejection closes the mutation boundary safely'
);
select results_eq(
  $$ select status || '|' || mutation_accepted::text from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112888' $$,
  array['failed|false'::text],
  'explicit retryable rejection backs off with mutation permission reset'
);
update private.amego_invoice_jobs set next_attempt_at = now()
where shopify_order_gid = 'gid://shopify/Order/9990001112888';
create temporary table retried_amego_job as
select * from public.claim_amego_invoice_job('gid://shopify/Order/9990001112888');
select results_eq(
  $$ select mutation_accepted from retried_amego_job $$,
  array[false],
  'the next fenced lease may retry only after explicit provider rejection'
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'a4444444-4444-4444-8444-444444444444', 'orders/cancelled',
    'saengak.myshopify.com', 'gid://shopify/Order/9990001112888',
    'amego-cart-token-123456', '#A1002', 680, 'TWD', 'cancelled', 'paid',
    'ShipAny 7-ELEVEN', 'unfulfilled',
    '2026-08-13T05:00:00Z', '2026-08-13T05:01:00Z', '2026-08-13T05:01:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222334","productId":"gid://shopify/Product/444555667","productVariantGid":"gid://shopify/ProductVariant/777889000","productName":"測試商品","quantity":1,"price":"680","imageUrl":""}]'::jsonb,
    '[]'::jsonb
  ) $$,
  array['applied'::text],
  'cancellation arriving before provider I/O is recorded on the current lease'
);
select throws_ok(
  $$ select public.mark_amego_invoice_mutation_started(
    (select job_id from retried_amego_job), (select lease_token from retried_amego_job)
  ) $$,
  'P0001',
  'Amego mutation lease is not claimable',
  'a cancelled lease cannot start an external invoice mutation'
);
select lives_ok(
  $$ select public.complete_amego_invoice_job(
    (select job_id from retried_amego_job), (select lease_token from retried_amego_job),
    'failed', false, false, null, null, null, 'MUTATION_NOT_STARTED', null
  ) $$,
  'cancelled pre-mutation work closes without retrying provider I/O'
);
select results_eq(
  $$ select status || '|' || request_payload::text from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990001112888' $$,
  array['cancelled|{}'::text],
  'pre-mutation cancellation is terminal and scrubs request PII'
);

insert into private.amego_invoice_jobs (
  shopify_order_gid, amego_order_id, request_payload, request_sha256,
  expected_total_amount, expected_buyer_identifier, source_updated_at,
  status, next_attempt_at
) values (
  'gid://shopify/Order/9990001112777', 'S9990001112777',
  '{"preference":{"kind":"company","taxId":"12345678"}}'::jsonb, repeat('c', 64),
  680, '12345678', '2026-08-13T06:00:00Z', 'pending', now()
);
select results_eq(
  $$ select public.sync_shopify_order_webhook(
    'a5555555-5555-4555-8555-555555555555', 'orders/cancelled',
    'saengak.myshopify.com', 'gid://shopify/Order/9990001112777',
    'amego-cart-token-123456', '#A1003', 680, 'TWD', 'cancelled', 'paid',
    'ShipAny 7-ELEVEN', 'unfulfilled',
    '2026-08-13T06:00:00Z', '2026-08-13T06:01:00Z', '2026-08-13T06:01:01Z',
    '[{"shopifyLineItemGid":"gid://shopify/LineItem/111222335","productId":"gid://shopify/Product/444555668","productVariantGid":"gid://shopify/ProductVariant/777889001","productName":"測試商品","quantity":1,"price":"680","imageUrl":""}]'::jsonb,
    '[]'::jsonb
  ) $$,
  array['applied'::text],
  'pending company invoice can be cancelled before any provider mutation'
);
select results_eq(
  $$ select status || '|' || request_payload::text || '|' || coalesce(expected_buyer_identifier, 'NULL')
     from private.amego_invoice_jobs where shopify_order_gid = 'gid://shopify/Order/9990001112777' $$,
  array['cancelled|{}|NULL'::text],
  'pending cancellation scrubs payload and buyer tax identifier'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',
  true
);
select results_eq(
  $$ select status || '|' || provider from public.order_invoices $$,
  array['issued|amego'::text],
  'order owner can read the confirmed provider projection'
);

select * from finish();
rollback;
