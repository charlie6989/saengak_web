begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select is(
  (select value from public.site_settings where key = 'store_pickup_enabled'),
  'false'::jsonb,
  'store pickup switch defaults to off'
);
select ok(
  (select is_public from public.site_settings where key = 'store_pickup_enabled'),
  'store pickup switch is readable by the storefront'
);
select is(
  (select value from public.site_settings where key = 'pickup_shipping_fee'),
  '60'::jsonb,
  'pickup shipping fee defaults to NT$60'
);

select has_table('private', 'shipany_api_tokens', 'ShipAny tokens live in the private schema');
select ok(
  (select relrowsecurity from pg_class where oid = 'private.shipany_api_tokens'::regclass),
  'ShipAny token table has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'private.shipany_api_tokens', 'SELECT'),
  'members cannot read ShipAny tokens'
);
select ok(
  not has_function_privilege('anon', 'public.get_shipany_api_tokens()', 'EXECUTE'),
  'the storefront cannot call the token reader'
);
select ok(
  not has_function_privilege('authenticated', 'public.rotate_shipany_api_tokens(text, text, timestamptz, text)', 'EXECUTE'),
  'members cannot rotate ShipAny tokens'
);

select ok(
  public.rotate_shipany_api_tokens(null, 'access-1', now() + interval '4 hours', 'refresh-1'),
  'the first token pair is stored when none exists'
);
select ok(
  not public.rotate_shipany_api_tokens(null, 'access-x', now(), 'refresh-x'),
  'a second bootstrap cannot overwrite the stored tokens'
);
select ok(
  public.rotate_shipany_api_tokens('refresh-1', 'access-2', now() + interval '4 hours', 'refresh-2'),
  'the holder of the current refresh token can rotate it'
);
select ok(
  not public.rotate_shipany_api_tokens('refresh-1', 'access-stale', now(), 'refresh-stale'),
  'a stale refresh token cannot overwrite a newer rotation'
);

select * from finish();
rollback;
