begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'order_invoices', 'provider-neutral invoice projection exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_invoices'::regclass),
  'invoice projection has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.order_invoices', 'SELECT'),
  'anonymous visitors cannot read invoice data'
);
select ok(
  not has_table_privilege('authenticated', 'public.order_invoices', 'INSERT'),
  'members cannot forge invoice state'
);
select ok(
  has_table_privilege('authenticated', 'public.order_invoices', 'SELECT'),
  'members may query invoice state through RLS'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('55555555-5555-4555-8555-555555555555', 'invoice-owner@example.test', '{}'::jsonb),
  ('66666666-6666-4666-8666-666666666666', 'invoice-other@example.test', '{}'::jsonb);

set local role service_role;

insert into public.orders (
  id, user_id, order_number, total_amount, currency_code, status, payment_status
)
values (
  '77777777-7777-4777-8777-777777777777',
  '55555555-5555-4555-8555-555555555555',
  '#INV-1001', 680, 'TWD', 'paid', 'paid'
);

select lives_ok(
  $$ insert into public.order_invoices (
       order_id, provider, provider_invoice_id, invoice_number, status,
       issued_at, provider_updated_at
     ) values (
       '77777777-7777-4777-8777-777777777777', 'amego', 'provider-doc-1001',
       'AA12345678', 'issued', '2026-07-20T00:00:00Z', '2026-07-20T00:00:00Z'
     ) $$,
  'trusted backend can project a provider-issued invoice'
);

select throws_ok(
  $$ insert into public.order_invoices (
       order_id, provider, provider_invoice_id, status, provider_updated_at
     ) values (
       '77777777-7777-4777-8777-777777777777', 'amego', 'provider-doc-invalid',
       'issued', '2026-07-20T00:00:00Z'
     ) $$,
  '23514',
  null,
  'issued status requires provider issued_at evidence'
);

select throws_ok(
  $$ insert into public.order_invoices (
       order_id, provider, provider_invoice_id, status, provider_updated_at
     ) values (
       '77777777-7777-4777-8777-777777777777', 'amego', 'provider-doc-1001',
       'failed', '2026-07-20T01:00:00Z'
     ) $$,
  '23505',
  null,
  'provider document IDs are idempotent'
);

reset role;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);
select results_eq(
  $$ select count(*)::bigint from public.order_invoices $$,
  array[1::bigint],
  'order owner can read the invoice projection'
);
select results_eq(
  $$ select status from public.order_invoices $$,
  array['issued'::text],
  'order owner sees provider-confirmed status'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);
select results_eq(
  $$ select count(*)::bigint from public.order_invoices $$,
  array[0::bigint],
  'another member cannot read the invoice projection'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$ select * from public.order_invoices $$,
  '42501',
  null,
  'anonymous visitors have no invoice table grant'
);

select * from finish();
rollback;
