begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- 1. 表格存在性與 RLS 狀態檢查
select has_table('public', 'transaction_logs', 'transaction_logs table exists');
select has_table('public', 'site_settings', 'site_settings table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.transaction_logs'::regclass),
  'transaction_logs has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.site_settings'::regclass),
  'site_settings has RLS enabled'
);

-- 2. transaction_logs 欄位完整性檢查
select has_column('public', 'transaction_logs', 'id', 'transaction_logs has id column');
select has_column('public', 'transaction_logs', 'idempotency_key', 'transaction_logs has idempotency_key column');
select has_column('public', 'transaction_logs', 'payload_hash', 'transaction_logs has payload_hash column');
select has_column('public', 'transaction_logs', 'status', 'transaction_logs has status column');
select has_column('public', 'transaction_logs', 'amount', 'transaction_logs has amount column');
select has_column('public', 'transaction_logs', 'payload', 'transaction_logs has payload column');
select has_column('public', 'transaction_logs', 'guest_phone_normalized', 'transaction_logs has guest_phone_normalized column');
select has_column('public', 'transaction_logs', 'guest_email_normalized', 'transaction_logs has guest_email_normalized column');

-- 3. transaction_logs 權限隔離檢查 (Deny All to anon / authenticated)
select ok(
  not has_table_privilege('anon', 'public.transaction_logs', 'SELECT'),
  'anonymous users cannot read transaction_logs'
);
select ok(
  not has_table_privilege('authenticated', 'public.transaction_logs', 'SELECT'),
  'authenticated members cannot read transaction_logs'
);
select ok(
  not has_table_privilege('authenticated', 'public.transaction_logs', 'INSERT'),
  'authenticated members cannot insert transaction_logs'
);
select ok(
  has_table_privilege('service_role', 'public.transaction_logs', 'SELECT'),
  'service_role can read transaction_logs'
);
select ok(
  has_table_privilege('service_role', 'public.transaction_logs', 'INSERT'),
  'service_role can insert transaction_logs'
);

-- 4. 插入與約束驗證 (以 service_role 執行)
set local role service_role;

select lives_ok(
  $$
    insert into public.transaction_logs (
      idempotency_key, payload_hash, status, amount, payload, guest_phone_normalized, guest_email_normalized
    ) values (
      'idemp_test_key_001',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'INITIATED',
      1200,
      '{"items":[{"variant_id":"var_1","quantity":2,"amount":600}],"shipping_code":"standard"}'::jsonb,
      '0912345678',
      'test@example.com'
    )
  $$,
  'service_role can insert valid transaction log'
);

select throws_ok(
  $$
    insert into public.transaction_logs (
      idempotency_key, payload_hash, status, amount
    ) values (
      'idemp_test_key_002',
      'hash_002',
      'INVALID_STATUS',
      500
    )
  $$,
  '23514',
  null,
  'invalid transaction status is rejected by check constraint'
);

select throws_ok(
  $$
    insert into public.transaction_logs (
      idempotency_key, payload_hash, status, amount
    ) values (
      'idemp_test_key_001',
      'hash_duplicate',
      'INITIATED',
      1200
    )
  $$,
  '23505',
  null,
  'duplicate idempotency_key is rejected by unique constraint'
);

-- 5. site_settings 權限與 RLS 驗證
-- 插入內部機密設定以測試 is_public 隔離
insert into public.site_settings (key, value, is_public, description)
values ('internal_secret_config', '{"secret_token":"test1234"}'::jsonb, false, '內部私密設定')
on conflict (key) do nothing;

reset role;
set local role anon;

select results_eq(
  $$
    select count(*)::bigint
    from public.site_settings
    where key = 'internal_secret_config'
  $$,
  array[0::bigint],
  'anonymous users cannot see private site_settings'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.site_settings
    where is_public = true
  $$,
  array[2::bigint],
  'anonymous users can see public site_settings (free_shipping_threshold, maintenance_mode)'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

select lives_ok(
  $$
    insert into public.site_settings (key, value, is_public, description)
    values ('admin_created_setting', '"admin_val"'::jsonb, true, '由管理員建立之設定')
    on conflict (key) do nothing;
  $$,
  'admin authenticated role can insert into site_settings'
);

select * from finish();
rollback;
