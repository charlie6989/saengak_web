begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function(
  'public', 'enqueue_amego_invoice_job',
  array['text','text','jsonb','text','numeric','text','uuid'],
  'enqueue_amego_invoice_job RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.enqueue_amego_invoice_job(text,text,jsonb,text,numeric,text,uuid)',
    'EXECUTE'
  ),
  'members cannot directly enqueue invoice work'
);

set local role service_role;

select lives_ok(
  $$ select public.enqueue_amego_invoice_job(
    'gid://shopify/Order/9990009991111',
    'S9990009991111',
    '{"totalAmount":680,"lineItems":[]}'::jsonb,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    680,
    '0000000000',
    null
  ) $$,
  'checkout backend can enqueue a new invoice job directly (bypassing webhook sync)'
);

select results_eq(
  $$ select status || '|' || amego_order_id from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990009991111' $$,
  array['pending|S9990009991111'::text],
  'newly enqueued job lands in private.amego_invoice_jobs as pending'
);

-- 重複呼叫 (訂單重試 / confirm.ts 與 checkout.ts 皆可能寫入同一張訂單) 應為冪等 upsert 而非報錯
select lives_ok(
  $$ select public.enqueue_amego_invoice_job(
    'gid://shopify/Order/9990009991111',
    'S9990009991111',
    '{"totalAmount":680,"lineItems":[]}'::jsonb,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    680,
    '0000000000',
    null
  ) $$,
  'enqueueing the same shopify_order_gid again is idempotent (upsert, not error)'
);

select results_eq(
  $$ select count(*)::bigint from private.amego_invoice_jobs
     where shopify_order_gid = 'gid://shopify/Order/9990009991111' $$,
  array[1::bigint],
  'idempotent enqueue does not create a duplicate row'
);

select * from finish();
rollback;
