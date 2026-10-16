begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'partner_member_perks', 'partner_member_perks table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.partner_member_perks'::regclass),
  'RLS is enabled on partner_member_perks'
);
select ok(has_table_privilege('authenticated', 'public.partner_member_perks', 'SELECT'), 'members can read perks (own rows via RLS)');
select ok(not has_table_privilege('authenticated', 'public.partner_member_perks', 'INSERT'), 'members cannot issue perks');
select ok(not has_table_privilege('anon', 'public.partner_member_perks', 'SELECT'), 'anon cannot read perks');
select ok(not has_function_privilege('anon', 'public.partner_member_exists(text)', 'EXECUTE'), 'anon cannot look up members');
select ok(not has_function_privilege('authenticated', 'public.partner_member_exists(text)', 'EXECUTE'), 'members cannot look up other members');
select ok(has_function_privilege('service_role', 'public.partner_member_exists(text)', 'EXECUTE'), 'service_role can look up members');

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'verified-perk@example.test', now(), '{}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'unverified-perk@example.test', null, '{}'::jsonb);

select ok(public.partner_member_exists('  Verified-Perk@Example.test '), 'verified member is found case-insensitively');
select ok(not public.partner_member_exists('unverified-perk@example.test'), 'unverified email does not count as a member');

insert into public.partner_member_perks (user_id, email_normalized, coupon_code, status)
values
  ('a1111111-1111-4111-8111-111111111111', 'verified-perk@example.test', 'LCTESTCODE01', 'issued'),
  ('a2222222-2222-4222-8222-222222222222', 'unverified-perk@example.test', 'LCTESTCODE02', 'issued');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select results_eq(
  'select coupon_code from public.partner_member_perks',
  array['LCTESTCODE01'::text],
  'a member only sees their own perk'
);

select throws_ok(
  $$ insert into public.partner_member_perks (user_id, email_normalized, coupon_code) values ('a1111111-1111-4111-8111-111111111111', 'verified-perk@example.test', 'LCSELFISSUED') $$,
  '42501',
  null,
  'a member cannot issue a perk to themselves'
);

reset role;

select * from finish();
rollback;
