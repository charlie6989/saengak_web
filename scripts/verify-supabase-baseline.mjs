import { readdirSync, readFileSync } from 'node:fs';

const migrationDirectory = 'supabase/migrations';
const migrationFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const baselineFile = migrationFiles.find((file) => file.includes('saengak_membership_orders'));
if (!baselineFile) {
  console.error('ERROR: 找不到 SAENGAK 會員／訂單 baseline migration');
  process.exit(1);
}

const migration = migrationFiles
  .map((file) => readFileSync(`${migrationDirectory}/${file}`, 'utf8'))
  .join('\n');
const rlsTest = readFileSync(
  'supabase/tests/database/saengak_membership_rls.test.sql',
  'utf8',
);
const functionConfig = readFileSync('supabase/config.toml', 'utf8');

const tables = [
  'profiles',
  'orders',
  'order_items',
  'order_fulfillments',
  'order_invoices',
  'user_favorites',
  'shopify_checkout_links',
];
const policies = [
  'profiles_select_own',
  'profiles_insert_own',
  'profiles_update_own',
  'orders_select_own',
  'order_items_select_own',
  'order_fulfillments_select_own',
  'order_invoices_select_own',
  'user_favorites_select_own',
  'user_favorites_insert_own',
  'user_favorites_update_own',
  'user_favorites_delete_own',
];

const errors = [];
const requirePattern = (pattern, message) => {
  if (!pattern.test(migration)) errors.push(message);
};

const publicStorefrontFunctions = [
  'create-shopify-cart',
  'get-articles',
  'get-collections',
  'get-products',
  'get-products-by-tag',
  'smart-search',
];

for (const functionName of publicStorefrontFunctions) {
  const functionSource = readFileSync(
    `supabase/functions/${functionName}/index.ts`,
    'utf8',
  );
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`\\[functions\\.${escapedName}\\]\\s+verify_jwt\\s*=\\s*false`, 'm').test(functionConfig)) {
    errors.push(`${functionName} 未明確設定 verify_jwt=false`);
  }
  if (!functionSource.includes('hasAcceptedPublicKey')) {
    errors.push(`${functionName} 未在函式內核對 publishable/anon apikey`);
  }
}

const storefrontConfigSource = readFileSync(
  'supabase/functions/_shared/shopify-storefront.ts',
  'utf8',
);
if (!storefrontConfigSource.includes("SAENGAK_SHOPIFY_DOMAIN = 'gh2xgs-zf.myshopify.com'")) {
  errors.push('Storefront 預設網域不是 SAENGAK 專用 Shopify 商店');
}
if (!storefrontConfigSource.includes("SAENGAK_STOREFRONT_API_VERSION = '2026-07'")) {
  errors.push('Storefront API version 未固定為 2026-07 基線');
}

for (const table of tables) {
  requirePattern(
    new RegExp(`create table if not exists public\\.${table}\\s*\\(`, 'i'),
    `migration 未建立 public.${table}`,
  );
  requirePattern(
    new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
    `public.${table} 未啟用 RLS`,
  );
  requirePattern(
    new RegExp(`revoke all on table public\\.${table} from (?:public, )?anon, authenticated`, 'i'),
    `public.${table} 未先撤銷瀏覽器角色權限`,
  );

  if (!['shopify_checkout_links', 'order_fulfillments', 'order_invoices'].includes(table) && !rlsTest.includes(`'${table}'`)) {
    errors.push(`pgTAP 測試未覆蓋 public.${table}`);
  }
}

const shopifyRlsTest = readFileSync(
  'supabase/tests/database/shopify_order_sync.test.sql',
  'utf8',
);
const invoiceRlsTest = readFileSync(
  'supabase/tests/database/order_invoice_projection.test.sql',
  'utf8',
);
if (!shopifyRlsTest.includes("'shopify_checkout_links'")) {
  errors.push('pgTAP 測試未覆蓋 public.shopify_checkout_links');
}
if (!shopifyRlsTest.includes("'order_fulfillments'")) {
  errors.push('pgTAP 測試未覆蓋 public.order_fulfillments');
}
if (!invoiceRlsTest.includes("'order_invoices'")) {
  errors.push('pgTAP 測試未覆蓋 public.order_invoices');
}

for (const policy of policies) {
  requirePattern(
    new RegExp(`create policy ${policy}\\s`, 'i'),
    `缺少 RLS policy ${policy}`,
  );
}

requirePattern(
  /create or replace function private\.handle_new_user\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  '新會員 trigger function 必須位於 private schema 並固定空 search_path',
);
requirePattern(
  /revoke all on function private\.handle_new_user\(\) from public, anon, authenticated/i,
  '新會員 trigger function 未撤銷公開執行權限',
);
requirePattern(
  /grant select on table public\.orders to authenticated/i,
  '會員缺少自己的訂單讀取權限',
);
requirePattern(
  /grant select on table public\.order_items to authenticated/i,
  '會員缺少自己的訂單明細讀取權限',
);
requirePattern(
  /grant select on table public\.order_fulfillments to authenticated/i,
  '會員缺少自己的物流追蹤讀取權限',
);
requirePattern(
  /grant select on table public\.order_invoices to authenticated/i,
  '會員缺少自己的發票狀態讀取權限',
);

if (/grant\s+(?:all|insert|update|delete)[^;]*public\.orders[^;]*authenticated/i.test(migration)) {
  errors.push('authenticated 不得直接寫入 orders');
}
if (/grant\s+(?:all|insert|update|delete)[^;]*public\.order_items[^;]*authenticated/i.test(migration)) {
  errors.push('authenticated 不得直接寫入 order_items');
}
if (/grant\s+(?:all|insert|update|delete)[^;]*public\.order_fulfillments[^;]*authenticated/i.test(migration)) {
  errors.push('authenticated 不得直接寫入 order_fulfillments');
}
if (/grant\s+(?:all|insert|update|delete)[^;]*public\.order_invoices[^;]*authenticated/i.test(migration)) {
  errors.push('authenticated 不得直接寫入 order_invoices');
}
if (/using\s*\(\s*true\s*\)/i.test(migration)) {
  errors.push('會員／訂單 baseline 不得包含 using (true) 的寬鬆 RLS');
}
requirePattern(
  /revoke all on table public\.shopify_checkout_links from public, anon, authenticated/i,
  'checkout link 不得開放給瀏覽器角色',
);
requirePattern(
  /revoke all on function public\.sync_shopify_order_webhook[\s\S]*from public, anon, authenticated/i,
  'Shopify 訂單同步 RPC 未撤銷公開執行權限',
);
requirePattern(
  /grant execute on function public\.sync_shopify_order_webhook[\s\S]*to service_role/i,
  'Shopify 訂單同步 RPC 必須只交給受信任後端角色',
);

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  migration: baselineFile,
  tables,
  policies: policies.length,
  databaseTest: 'npm run test:db',
}, null, 2));
