import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  const env = {};
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!env[key]) env[key] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const SHOPIFY_DOMAIN = env.SHOPIFY_DOMAIN || env.VITE_SHOPIFY_DOMAIN || 'gh2xgs-zf.myshopify.com';
const SHOPIFY_CLIENT_ID = env.SHOPIFY_APP_CLIENT_ID || env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = env.SHOPIFY_APP_CLIENT_SECRET || env.SHOPIFY_WEBHOOK_SECRET;
const SHOPIFY_API_VERSION = env.ShopifyStorefrontApiVersion || '2024-07';

async function getAdminAccessToken() {
  const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function shopifyGraphQL(token, query, variables = {}) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  return json.data;
}

async function run() {
  const token = await getAdminAccessToken();
  let hasNextPage = true;
  let cursor = null;
  let count = 0;
  const shopeeFound = [];
  
  while (hasNextPage) {
    const data = await shopifyGraphQL(token, `
      query getProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            descriptionHtml
            tags
            vendor
            productType
          }
        }
      }
    `, { cursor });

    for (const p of data.products.nodes) {
      count++;
      console.log(`[${count}] ${p.title} (${p.id})`);
      console.log(`    Tags: ${JSON.stringify(p.tags)}`);
      console.log(`    Desc: ${p.descriptionHtml ? p.descriptionHtml.slice(0, 70) + '...' : '(無描述)'}`);
      const fullText = JSON.stringify(p);
      const hasShopee = fullText.includes('蝦皮') || fullText.toLowerCase().includes('shopee') || fullText.includes('來源店鋪') || fullText.includes('商品來源') || fullText.includes('賣家後臺');
      if (hasShopee) {
        console.log(`    ⚠️ 包含蝦皮字眼或來源資訊！`);
        shopeeFound.push(p);
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`\n========================================`);
  console.log(`總計檢測 ${count} 件商品`);
  console.log(`包含蝦皮/來源字眼商品數: ${shopeeFound.length}`);
  console.log(`========================================\n`);
}
run();

