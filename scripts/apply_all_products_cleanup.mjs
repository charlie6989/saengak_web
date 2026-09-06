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

let cachedToken = null;

async function getAdminAccessToken(forceRefresh = false) {
  if (cachedToken && !forceRefresh) return cachedToken;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: SHOPIFY_CLIENT_ID,
          client_secret: SHOPIFY_CLIENT_SECRET,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          cachedToken = data.access_token;
          return cachedToken;
        }
      }
      console.warn(`⚠️ Token 取得失敗 (HTTP ${response.status})，第 ${attempt}/5 次重試中...`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    } catch (err) {
      if (attempt === 5) throw err;
      console.warn(`⚠️ Token 連線異常，第 ${attempt}/5 次重試中: ${err.message}`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw new Error('無法取得 Shopify Admin Access Token');
}

async function shopifyGraphQLWithRetry(query, variables = {}, maxRetries = 6) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const token = await getAdminAccessToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 401) {
        console.warn(`⚠️ Token 失效 (401)，強制更新 Token...`);
        await getAdminAccessToken(true);
        continue;
      }

      if (response.status === 500 || response.status === 503 || response.status === 429) {
        console.warn(`⚠️ Shopify API HTTP ${response.status} (第 ${attempt}/${maxRetries} 次)，${attempt * 1.5}s 後重試...`);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }

      const json = await response.json();
      if (typeof json.errors === 'string') {
        throw new Error(json.errors);
      }
      if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(`GraphQL 錯誤: ` + JSON.stringify(json.errors, null, 2));
      }

      return json.data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(`⚠️ 請求異常 (${err.message})，第 ${attempt}/${maxRetries} 次重試中...`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
}

function updateDescriptionFirstSentence(existingHtml, singleSentence) {
  if (!existingHtml || !existingHtml.trim()) {
    return `<p>${singleSentence}</p>`;
  }

  // 若已有 <p> 標籤，替換第一個 <p> 的內容
  if (existingHtml.includes('<p>')) {
    let replaced = false;
    const updated = existingHtml.replace(/<p>(.*?)<\/p>/i, () => {
      replaced = true;
      return `<p>${singleSentence}</p>`;
    });
    if (replaced) return updated;
  }

  return `<p>${singleSentence}</p>\n${existingHtml}`;
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'scripts/all_products_cleanup_preview.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('找不到 all_products_cleanup_preview.json，請先執行 generate 腳本！');
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`準備同步更新 ${items.length} 款商品至 Shopify Admin API (含標題 ≤12 字與單句描述)...`);

  await getAdminAccessToken();
  console.log('成功取得 Admin Token，開始批次寫入...\n');

  const updateMutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          descriptionHtml
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // 排除金流測試商品
    if (item.originalTitle.includes('金流驗收測試')) {
      console.log(`- [${i + 1}/${items.length}] 略過測試商品: ${item.originalTitle}`);
      skippedCount++;
      continue;
    }

    try {
      // 取得該商品的目前 descriptionHtml
      const query = `
        query getProd($id: ID!) {
          product(id: $id) {
            id
            title
            descriptionHtml
          }
        }
      `;
      const currentData = await shopifyGraphQLWithRetry(query, { id: item.id });
      const currentProd = currentData?.product;
      if (!currentProd) {
        console.warn(`⚠️ 找不到商品: ${item.id}`);
        errorCount++;
        continue;
      }

      const updatedDesc = updateDescriptionFirstSentence(
        currentProd.descriptionHtml,
        item.proposedSingleSentence
      );

      const res = await shopifyGraphQLWithRetry(updateMutation, {
        input: {
          id: item.id,
          title: item.proposedTitle,
          descriptionHtml: updatedDesc,
        },
      });

      const userErrors = res?.productUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        console.error(`❌ 更新失敗 [${item.id}]:`, userErrors);
        errorCount++;
      } else {
        console.log(`✅ [${i + 1}/${items.length}] 已更新: ${item.proposedTitle} (ID: ${item.numericId})`);
        successCount++;
      }

      // 適度間隔保護 API
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      console.error(`❌ 發生異常 [${item.id}]:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n=======================================================`);
  console.log(`🎉 批次同步完成！成功: ${successCount}, 略過: ${skippedCount}, 失敗: ${errorCount}`);
  console.log(`=======================================================`);
}

main().catch((err) => {
  console.error('執行失敗:', err);
  process.exit(1);
});
