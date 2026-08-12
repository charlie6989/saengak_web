begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order_items table exists');
select has_table('public', 'user_favorites', 'user_favorites table exists');

select results_eq(
  $$
    select count(*)::bigint
    from pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.orders'::regclass,
      'public.order_items'::regclass,
      'public.user_favorites'::regclass
    )
      and relrowsecurity
  $$,
  array[4::bigint],
  'RLS is enabled on every exposed application table'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'orders', 'order_items', 'user_favorites')
  $$,
  array[9::bigint],
  'all expected ownership policies exist'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-1@example.test', '{"name":"Owner One"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'owner-2@example.test', '{"name":"Owner Two"}'::jsonb);

select results_eq(
  'select count(*)::bigint from public.profiles',
  array[2::bigint],
  'new auth users receive profile rows'
);

select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'), 'authenticated can select profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'authenticated can insert profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'authenticated can update profiles');
select ok(has_table_privilege('authenticated', 'public.orders', 'SELECT'), 'authenticated can select orders');
select ok(not has_table_privilege('authenticated', 'public.orders', 'INSERT'), 'authenticated cannot create orders');
select ok(has_table_privilege('authenticated', 'public.order_items', 'SELECT'), 'authenticated can select order items');
select ok(not has_table_privilege('authenticated', 'public.order_items', 'INSERT'), 'authenticated cannot create order items');
select ok(has_table_privilege('authenticated', 'public.user_favorites', 'SELECT'), 'authenticated can select favorites');
select ok(has_table_privilege('authenticated', 'public.user_favorites', 'INSERT'), 'authenticated can insert favorites');
select ok(has_table_privilege('authenticated', 'public.user_favorites', 'UPDATE'), 'authenticated can update favorites');
select ok(has_table_privilege('authenticated', 'public.user_favorites', 'DELETE'), 'authenticated can delete favorites');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anonymous users cannot read profiles');
select ok(
  not has_function_privilege('authenticated', 'private.handle_new_user()', 'EXECUTE'),
  'authenticated users cannot call the privileged auth trigger function'
);

insert into public.orders (id, user_id, order_number, total_amount)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'TEST-OWNER-1', 680),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'TEST-OWNER-2', 880);

insert into public.order_items (order_id, product_name, quantity, price)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner One Product', 1, 680),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Owner Two Product', 1, 880);

insert into public.user_favorites (user_id, product_id, product_name, product_price)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-1-product', 'Owner One Favorite', 680),
  ('22222222-2222-4222-8222-222222222222', 'owner-2-product', 'Owner Two Favorite', 880);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select results_eq(
  'select count(*)::bigint from public.profiles',
  array[1::bigint],
  'a member sees only their own profile'
);

select results_eq(
  'select count(*)::bigint from public.orders',
  array[1::bigint],
  'a member sees only their own orders'
);

select results_eq(
  'select count(*)::bigint from public.order_items',
  array[1::bigint],
  'a member sees only items from their own orders'
);

select results_eq(
  'select count(*)::bigint from public.user_favorites',
  array[1::bigint],
  'a member sees only their own favorites'
);

select is_empty(
  $$
    update public.profiles
    set name = 'Cross-account update'
    where id = '22222222-2222-4222-8222-222222222222'
    returning id
  $$,
  'a member cannot update another profile'
);

select lives_ok(
  $$
    insert into public.user_favorites (user_id, product_id, product_name, product_price)
    values (
      '11111111-1111-4111-8111-111111111111',
      'owner-1-product-2',
      'Owner One Favorite Two',
      780
    )
  $$,
  'a member can create their own favorite'
);

select results_eq(
  'select count(*)::bigint from public.user_favorites',
  array[2::bigint],
  'the member can read the favorite they created'
);

select * from finish();
rollback;
