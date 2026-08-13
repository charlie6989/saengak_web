begin;

create extension if not exists pgtap with schema extensions;
select plan(34);

select has_table('public', 'order_invoice_allowances', 'allowance projection exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_invoice_allowances'::regclass),
  'allowance projection has RLS enabled'
);
select has_table('private', 'amego_allowance_jobs', 'allowance outbox is private');
select ok(
  (select relrowsecurity from pg_class where oid = 'private.amego_allowance_jobs'::regclass),
  'allowance outbox has defense-in-depth RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'private.amego_allowance_jobs', 'SELECT'),
  'members cannot read allowance outbox data'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.claim_amego_allowance_job(text)', 'EXECUTE'
  ),
  'members cannot claim allowance work'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_amego_allowance_job(uuid,uuid,text,boolean,boolean,text,integer,timestamptz,text,text)',
    'EXECUTE'
  ),
  'members cannot forge allowance provider outcomes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.mark_amego_allowance_mutation_started(uuid,uuid)',
    'EXECUTE'
  ),
  'members cannot open an allowance provider mutation boundary'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('99999999-9999-4999-8999-999999999991', 'allowance-owner@example.test', '{}'::jsonb),
  ('99999999-9999-4999-8999-999999999992', 'allowance-other@example.test', '{}'::jsonb);

set local role service_role;

insert into public.orders (
  id, user_id, order_number, shopify_order_gid, shopify_store_domain,
  total_amount, currency_code, status, payment_status,
  shopify_created_at, shopify_updated_at
) values (
  '99999999-9999-4999-8999-999999999993',
  '99999999-9999-4999-8999-999999999991', '#ALLOW-1001',
  'gid://shopify/Order/9554194432293', 'gh2xgs-zf.myshopify.com',
  680, 'TWD', 'paid', 'partially_refunded',
  '2026-08-13T01:00:00Z', '2026-08-13T02:00:00Z'
);

insert into private.amego_invoice_jobs (
  shopify_order_gid, order_id, amego_order_id, request_payload, request_sha256,
  expected_total_amount, source_updated_at, status, provider_invoice_number,
  provider_status, provider_updated_at, mutation_accepted
) values (
  'gid://shopify/Order/9554194432293',
  '99999999-9999-4999-8999-999999999993', 'S9554194432293',
  '{}'::jsonb, repeat('a', 64), 680, '2026-08-13T02:00:00Z',
  'issued', 'AA12345678', 99, '2026-08-13T02:01:00Z', true
);

insert into public.order_invoices (
  id, order_id, provider, provider_invoice_id, invoice_number, status,
  issued_at, provider_updated_at
) values (
  '99999999-9999-4999-8999-999999999994',
  '99999999-9999-4999-8999-999999999993', 'amego', 'S9554194432293',
  'AA12345678', 'issued', '2026-08-13T02:01:00Z', '2026-08-13T02:01:00Z'
);

select results_eq(
  $$ select public.sync_shopify_refund_webhook(
    '99999999-9999-4999-8999-999999999901', 'refunds/create',
    'gh2xgs-zf.myshopify.com', 'gid://shopify/Order/9554194432293',
    'gid://shopify/Refund/889900112233', '889900112233',
    '2026-08-13T03:00:00Z', '2026-08-13T03:00:01Z',
    680, 648, 32,
    '{"currencyCode":"TWD","allowanceDate":"20260813","lineItems":[{"description":"測試商品","quantity":1,"netAmount":"648","taxAmount":"32"}]}'::jsonb
  ) $$,
  array['applied'::text],
  'signed refund projection creates an accounting review item'
);
select results_eq(
  $$ select status || '|' || operation from private.amego_allowance_jobs
     where shopify_refund_gid = 'gid://shopify/Refund/889900112233' $$,
  array['allowance_review|allowance_issue'::text],
  'refund waits for explicit allowance approval'
);
select results_eq(
  'select count(*)::bigint from public.order_invoice_allowances',
  array[0::bigint],
  'refund receipt alone cannot forge an issued allowance'
);
select results_eq(
  $$ select public.sync_shopify_refund_webhook(
    '99999999-9999-4999-8999-999999999901', 'refunds/create',
    'gh2xgs-zf.myshopify.com', 'gid://shopify/Order/9554194432293',
    'gid://shopify/Refund/889900112233', '889900112233',
    '2026-08-13T03:00:00Z', '2026-08-13T03:00:01Z',
    680, 648, 32,
    '{"currencyCode":"TWD","allowanceDate":"20260813","lineItems":[{"description":"測試商品","quantity":1,"netAmount":"648","taxAmount":"32"}]}'::jsonb
  ) $$,
  array['duplicate'::text],
  'duplicate refund webhook is idempotent'
);
select lives_ok(
  $$ select public.approve_amego_allowance_issue(
    'gid://shopify/Refund/889900112233'
  ) $$,
  'trusted accounting approval releases allowance issue work'
);

create temporary table claimed_allowance_job as
select * from public.claim_amego_allowance_job('gid://shopify/Order/9554194432293');
select results_eq(
  'select operation || ''|'' || attempts::text from claimed_allowance_job',
  array['allowance_issue|1'::text],
  'worker atomically leases allowance issue work'
);
select results_eq(
  'select expected_invoice_total_amount from claimed_allowance_job',
  array[680::numeric],
  'approved allowance lease carries the immutable source invoice total'
);
update private.amego_allowance_jobs
set locked_at = now() - interval '11 minutes'
where shopify_refund_gid = 'gid://shopify/Refund/889900112233';
create temporary table reclaimed_allowance_job as
select * from public.claim_amego_allowance_job('gid://shopify/Order/9554194432293');
select isnt(
  (select lease_token from claimed_allowance_job),
  (select lease_token from reclaimed_allowance_job),
  'reclaimed allowance work receives a new fencing token'
);
select throws_ok(
  $$ select public.mark_amego_allowance_mutation_started(
    (select job_id from claimed_allowance_job),
    (select lease_token from claimed_allowance_job)
  ) $$,
  'P0001', 'Amego allowance mutation lease is not claimable',
  'expired allowance worker cannot open the provider mutation boundary'
);
select lives_ok(
  $$ select public.mark_amego_allowance_mutation_started(
    (select job_id from reclaimed_allowance_job),
    (select lease_token from reclaimed_allowance_job)
  ) $$,
  'current allowance worker persists the provider mutation boundary'
);
select throws_ok(
  $$ select public.complete_amego_allowance_job(
    (select job_id from reclaimed_allowance_job),
    (select lease_token from reclaimed_allowance_job),
    'allowance_issued', true, false, '889900112233', 31,
    '2026-08-13T03:01:00Z', null, null
  ) $$,
  'P0001', 'provider status 99 is required',
  'allowance cannot be confirmed without provider status 99'
);
select throws_ok(
  $$ select public.complete_amego_allowance_job(
    (select job_id from reclaimed_allowance_job),
    (select lease_token from reclaimed_allowance_job),
    'allowance_issued', true, false, '889900112234', 99,
    '2026-08-13T03:01:00Z', null, null
  ) $$,
  'P0001', 'allowance number does not match the immutable refund snapshot',
  'provider allowance number must match the refund snapshot'
);
select lives_ok(
  $$ select public.complete_amego_allowance_job(
    (select job_id from reclaimed_allowance_job),
    (select lease_token from reclaimed_allowance_job),
    'allowance_issued', true, false, '889900112233', 99,
    '2026-08-13T03:01:00Z', null, null
  ) $$,
  'provider-confirmed D0401 completes the allowance'
);
select results_eq(
  $$ select invoice.status || '|' || allowance.status
     from public.order_invoices as invoice
     join public.order_invoice_allowances as allowance
       on allowance.order_invoice_id = invoice.id $$,
  array['allowance-issued|issued'::text],
  'confirmed allowance is projected with its parent invoice'
);
select results_eq(
  $$ select request_payload::text from private.amego_allowance_jobs
     where shopify_refund_gid = 'gid://shopify/Refund/889900112233' $$,
  array['{}'::text],
  'allowance refund snapshot is scrubbed after completion'
);

select public.sync_shopify_refund_webhook(
  '99999999-9999-4999-8999-999999999902', 'refunds/create',
  'gh2xgs-zf.myshopify.com', 'gid://shopify/Order/9554194432293',
  'gid://shopify/Refund/889900112234', '889900112234',
  '2026-08-13T04:00:00Z', '2026-08-13T04:00:01Z',
  1, 1, 0,
  '{"currencyCode":"TWD","allowanceDate":"20260813","lineItems":[{"description":"額外退款","quantity":1,"netAmount":"1","taxAmount":"0"}]}'::jsonb
);
select throws_ok(
  $$ select public.approve_amego_allowance_issue(
    'gid://shopify/Refund/889900112234'
  ) $$,
  'P0001', 'allowance total exceeds the original invoice',
  'cumulative allowances cannot exceed the original invoice total'
);

update private.amego_invoice_jobs
set status = 'void_review', operation = 'void', mutation_accepted = false
where shopify_order_gid = 'gid://shopify/Order/9554194432293';
select throws_ok(
  $$ select public.approve_amego_invoice_void(
    'gid://shopify/Order/9554194432293'
  ) $$,
  'P0001', 'invoice with an active allowance cannot be voided',
  'invoice void and active allowance are mutually exclusive'
);
select lives_ok(
  $$ select public.approve_amego_allowance_void(
    'gid://shopify/Refund/889900112233'
  ) $$,
  'trusted accounting approval releases allowance void work'
);
create temporary table claimed_allowance_void as
select * from public.claim_amego_allowance_job('gid://shopify/Order/9554194432293');
select results_eq(
  'select operation from claimed_allowance_void',
  array['allowance_void'::text],
  'worker leases allowance void work'
);
select public.mark_amego_allowance_mutation_started(
  (select job_id from claimed_allowance_void),
  (select lease_token from claimed_allowance_void)
);
select lives_ok(
  $$ select public.complete_amego_allowance_job(
    (select job_id from claimed_allowance_void),
    (select lease_token from claimed_allowance_void),
    'allowance_voided', true, false, '889900112233', 99,
    '2026-08-13T05:01:00Z', null, null
  ) $$,
  'provider-confirmed D0501 completes allowance void'
);
select results_eq(
  'select status from public.order_invoice_allowances',
  array['voided'::text],
  'voided allowance is projected'
);
select results_eq(
  $$ select status from public.order_invoices
     where id = '99999999-9999-4999-8999-999999999994' $$,
  array['issued'::text],
  'invoice returns to issued when no active allowances remain'
);
select lives_ok(
  $$ select public.approve_amego_invoice_void(
    'gid://shopify/Order/9554194432293'
  ) $$,
  'invoice void may proceed after all allowances are voided'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999991","role":"authenticated"}',
  true
);
select results_eq(
  'select status from public.order_invoice_allowances',
  array['voided'::text],
  'order owner can read their allowance projection'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999992","role":"authenticated"}',
  true
);
select results_eq(
  'select count(*)::bigint from public.order_invoice_allowances',
  array[0::bigint],
  'another member cannot read allowance projection'
);

reset role;
set local role anon;
select throws_ok(
  'select * from public.order_invoice_allowances',
  '42501', null,
  'anonymous visitors have no allowance table grant'
);

select * from finish();
rollback;
