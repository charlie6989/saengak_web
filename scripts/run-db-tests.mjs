import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const testFiles = [
  'supabase/tests/database/saengak_membership_rls.test.sql',
  'supabase/tests/database/shopify_order_sync.test.sql',
  'supabase/tests/database/order_invoice_projection.test.sql',
  'supabase/tests/database/amego_invoice_outbox.test.sql',
  'supabase/tests/database/amego_allowance_lifecycle.test.sql',
  'supabase/tests/database/transaction_logs.test.sql',
  'supabase/tests/database/enqueue_amego_invoice_job.test.sql',
];
const sql = testFiles.map((testFile) => readFileSync(testFile, 'utf8')).join('\n');
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_saengak_web',
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ],
  {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const errors = [];

if (result.error) errors.push(result.error.message);
if (result.status !== 0) errors.push(`psql exited with status ${result.status}`);
if (/\bnot ok\b/i.test(output)) errors.push('pgTAP reported a failed assertion');
if (!/ok 27 - the member can read the favorite they created/i.test(output)) {
  errors.push('pgTAP did not complete all 27 assertions');
}
if (!/ok 25 - another member cannot read tracking details/i.test(output)) {
  errors.push('pgTAP did not complete all 25 Shopify order and fulfillment assertions');
}
if (!/ok 12 - anonymous visitors have no invoice table grant/i.test(output)) {
  errors.push('pgTAP did not complete all 12 invoice projection assertions');
}
if (!/ok 43 - order owner can read the confirmed provider projection/i.test(output)) {
  errors.push('pgTAP did not complete all 43 Amego outbox assertions');
}
if (!/ok 34 - anonymous visitors have no allowance table grant/i.test(output)) {
  errors.push('pgTAP did not complete all 34 allowance lifecycle assertions');
}
if (!/ok 24 - admin authenticated role can insert into site_settings/i.test(output)) {
  errors.push('pgTAP did not complete all 24 transaction_logs/site_settings assertions');
}
if (!/ok 6 - idempotent enqueue does not create a duplicate row/i.test(output)) {
  errors.push('pgTAP did not complete all 6 enqueue_amego_invoice_job assertions');
}
const rollbackCount = output.match(/^ROLLBACK\r?$/gm)?.length ?? 0;
if (rollbackCount !== testFiles.length) {
  errors.push(`expected ${testFiles.length} database test rollbacks, received ${rollbackCount}`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  assertions: 171,
  testFiles,
  database: 'local Supabase PostgreSQL',
}, null, 2));
