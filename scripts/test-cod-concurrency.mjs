// Real multi-connection PostgreSQL tests. Requires a disposable LOCAL clone.
// The fixture is committed to make races observable and must never target postgres/production.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const database = process.env.DB_TEST_DATABASE ?? '';
if (!/^cod_invoice_tests_[0-9]{8}$/.test(database)) throw new Error('Use a disposable cod_invoice_tests_YYYYMMDD database');
const active = new Set();
function session(name, initial, keepOpen = false) {
  const child = spawn('docker', ['exec', '-i', 'supabase_db_saengak_web', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database]);
  active.add(child);
  let output = '';
  const done = new Promise(resolve => {
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('close', code => { active.delete(child); resolve({ code, output }); });
  });
  child.stdin.write(`set application_name='${name}'; set statement_timeout='12s'; ${initial}\n`);
  if (!keepOpen) child.stdin.end();
  return { done, write: sql => child.stdin.end(sql), output: () => output };
}
async function sql(value) {
  const result = await session('cod-test-control', value).done;
  assert.equal(result.code, 0, result.output); return result.output.trim();
}
const gid = n => `gid://shopify/Order/82000${n}`;
const key = n => `hashtextextended('${gid(n)}',0)`;
const confirm = (n, suffix = n) => `select public.confirm_cod_dispatch('${gid(n)}','88888888-8888-4888-8888-${String(suffix).padStart(12, '0')}',
 '99999999-9999-4999-8999-999999999981',(select shopify_updated_at from public.orders where shopify_order_gid='${gid(n)}'),826,'123456789012','black_cat_ambient',true);`;
const mark = n => `select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='${gid(n)}';`;
const state = (n, column) => sql(`select ${column} from private.amego_invoice_jobs where shopify_order_gid='${gid(n)}';`);
async function prepare(n) { await sql(confirm(n)); await sql(`select public.claim_amego_invoice_job('${gid(n)}');`); }
async function until(check, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(message);
}
async function held(n, mutation = '') {
  const holder = session('cod-test-holder', `begin; select pg_advisory_xact_lock(${key(n)}); ${mutation} select 'READY';`, true);
  await until(() => holder.output().includes('READY'), `holder failed: ${holder.output()}`); return holder;
}
async function waiting(names) {
  await until(async () => Number(await sql(`select count(*) from pg_stat_activity where application_name in (${names.map(n => `'${n}'`).join(',')}) and wait_event='advisory';`)) === names.length, 'workers did not reach advisory lock');
}
async function release(holder) { holder.write('commit;'); assert.equal((await holder.done).code, 0); }
function webhook(n, kind) {
  return `select public.sync_shopify_order_webhook(
    p_webhook_id=>'cod-race-${n}', p_topic=>'orders/updated', p_shopify_store_domain=>o.shopify_store_domain,
    p_shopify_order_gid=>o.shopify_order_gid, p_shopify_cart_token=>c.cart_token, p_order_number=>o.order_number,
    p_total_amount=>${kind === 'edit' ? '900' : 'o.total_amount'}, p_currency_code=>o.currency_code,
    p_status=>'${kind === 'cancel' ? 'cancelled' : 'processing'}', p_payment_status=>'pending', p_shipping_method=>'標準',
    p_fulfillment_status=>'${kind === 'fulfill' ? 'fulfilled' : 'unfulfilled'}', p_shopify_created_at=>o.shopify_created_at,
    p_shopify_updated_at=>o.shopify_updated_at+interval '1 second', p_triggered_at=>clock_timestamp(),
    p_line_items=>c.snapshot->'lineItems', p_fulfillments=>'[]', p_shipping_amount=>146, p_invoice_context=>c.context)
    from public.orders o join private.cod_order_context c on c.order_id=o.id where o.shopify_order_gid='${gid(n)}';`;
}
let checks = 0;
function pass(label) { console.log(`ok ${++checks} - ${label}`); }
try {
  assert.equal(await sql("select enabled::text||':'||coalesce(starts_at::text,'null') from private.cod_invoice_policy;"), 'false:null', 'clone must have default-disabled policy');
  const fixture = readFileSync('supabase/tests/database/cod_dispatch.test.sql', 'utf8').split('-- END COD FIXTURE SETUP')[0];
  await sql(`${fixture}\nupdate private.cod_invoice_policy set enabled=true, starts_at=now()-interval '1 day'; commit;`);
  let holder = await held(1);
  let a = session('cod-test-a', confirm(1)); let b = session('cod-test-b', confirm(1));
  await waiting(['cod-test-a', 'cod-test-b']); await release(holder);
  let results = await Promise.all([a.done, b.done]);
  assert.ok(results.every(r => r.code === 0)); assert.equal(results[0].output, results[1].output);
  assert.equal(await state(1, 'count(*)'), '1'); pass('simultaneous identical approvals share one job');

  holder = await held(2); a = session('cod-test-a', confirm(2)); b = session('cod-test-b', confirm(2, 102));
  await waiting(['cod-test-a', 'cod-test-b']); await release(holder); results = await Promise.all([a.done, b.done]);
  assert.equal(results.filter(r => r.code === 0).length, 1); assert.ok(results.some(r => r.output.includes('COD_CONFIRMATION_CONFLICT')));
  assert.equal(await state(2, 'count(*)'), '1'); pass('competing approval IDs cannot create two jobs');

  for (const [n, kind, error] of [[3, 'cancel', 'Amego mutation lease is not claimable'], [4, 'edit', 'COD_DISPATCH_REVIEW_REQUIRED'], [5, 'fulfill', 'COD_DISPATCH_REVIEW_REQUIRED']]) {
    await prepare(n); holder = await held(n, webhook(n, kind)); a = session('cod-test-a', mark(n));
    await waiting(['cod-test-a']); await release(holder);
    const result = await a.done; assert.notEqual(result.code, 0); assert.ok(result.output.includes(error), result.output);
    assert.equal(await state(n, 'mutation_accepted'), 'f'); pass(`${kind} committed while worker waits prevents issue`);
  }

  await prepare(6);
  holder = await held(6, `update private.cod_dispatch_confirmations set confirmed_at=clock_timestamp()-interval '9 minutes 58 seconds' where order_id=(select id from public.orders where shopify_order_gid='${gid(6)}');`);
  a = session('cod-test-a', `begin; ${mark(6)} commit;`); await waiting(['cod-test-a']);
  await sql('select pg_sleep(2.1);'); await release(holder);
  let result = await a.done; assert.ok(result.output.includes('COD_DISPATCH_APPROVAL_EXPIRED'), result.output);
  assert.equal(await state(6, 'mutation_accepted'), 'f'); pass('lock wait cannot extend approval past wall-clock deadline');

  await prepare(7); holder = await held(7, mark(7)); a = session('cod-test-a', webhook(7, 'cancel'));
  await waiting(['cod-test-a']); await release(holder); assert.equal((await a.done).code, 0);
  await sql(`select public.complete_amego_invoice_job(id,lease_token,'issued',true,false,'AB22345678',99,clock_timestamp()) from private.amego_invoice_jobs where shopify_order_gid='${gid(7)}';`);
  assert.equal(await state(7, 'status'), 'void_review');
  assert.equal(await sql(`select count(*) from public.order_invoices where order_id=(select id from public.orders where shopify_order_gid='${gid(7)}');`), '1');
  pass('mutation before cancellation persists invoice and queues review');

  await prepare(8); holder = await held(8); a = session('cod-test-a', mark(8)); b = session('cod-test-b', mark(8));
  await waiting(['cod-test-a', 'cod-test-b']); await release(holder); results = await Promise.all([a.done, b.done]);
  assert.equal(results.filter(r => r.code === 0).length, 1); assert.equal(await state(8, 'mutation_accepted'), 't');
  pass('two workers with same lease admit only one mutation');
  console.log(JSON.stringify({ ok: true, assertions: checks, database, disposableFixturesCommitted: true }));
} finally {
  for (const child of active) child.stdin.end('rollback;');
}
