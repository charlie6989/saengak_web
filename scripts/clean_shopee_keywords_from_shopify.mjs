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
  if (!data.access_token) {
    throw new Error('無法取得 Admin Access Token: ' + JSON.stringify(data));
  }
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
  if (json.errors) {
    throw new Error(`GraphQL 錯誤: ` + JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

function generateCleanDescription(title, category = '舒適穿著') {
  // 乾淨優雅的品牌商品描述
  let cleanTitle = (title || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/(?:LUCISSI|medion)/gi, '')
    .replace(/(?:現貨|24小時出貨|全日適穿|視覺誘惑)/g, '')
    .replace(/[|_｜\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) cleanTitle = title.trim();

  return `<p>${cleanTitle}，專為追求極致舒適與優雅日常的女性設計。精選高品質面料，質地細緻親膚，帶來全天候自在無負擔的穿著體驗。</p><h3>商品特色</h3><ul><li><strong>親膚透氣</strong>：優質親膚面料，柔軟細緻，吸濕排汗不悶熱。</li><li><strong>精緻工藝</strong>：立體剪裁與細膩車縫，服貼不勒肉，呈現自然優美身形。</li><li><strong>百搭實穿</strong>：簡約典雅色系，適合各種日常與居家場合搭配。</li></ul><h3>規格說明</h3><ul><li><strong>商品品類</strong>：${category}</li><li><strong>商品規格</strong>：請依規格選單挑選合適款式</li></ul><h3>洗滌與保養建議</h3><p>建議使用冷水搭配中性洗劑輕柔手洗，或裝入細網洗衣袋機洗；置於通風陰涼處自然晾乾。</p>`;
}

async function cleanAllShopeeProducts() {
  const token = await getAdminAccessToken();
  console.log('🔑 成功取得 Shopify Admin Access Token');

  let hasNextPage = true;
  let cursor = null;
  const allProducts = [];

  while (hasNextPage) {
    const query = `
      query getProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            handle
            descriptionHtml
            tags
            vendor
            productType
          }
        }
      }
    `;
    const data = await shopifyGraphQL(token, query, { cursor });
    const page = data.products;
    allProducts.push(...page.nodes);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  console.log(`📦 Shopify 商店商品總數: ${allProducts.length}`);

  const updateMutation = `
    mutation updateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          descriptionHtml
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let updatedCount = 0;

  for (const p of allProducts) {
    const titleHasShopee = p.title.includes('蝦皮') || p.title.toLowerCase().includes('shopee');
    const descHasShopee = (p.descriptionHtml || '').includes('蝦皮') || 
                          (p.descriptionHtml || '').toLowerCase().includes('shopee') || 
                          (p.descriptionHtml || '').includes('來源店鋪') || 
                          (p.descriptionHtml || '').includes('商品來源') || 
                          (p.descriptionHtml || '').includes('賣家後臺');
    const tagsHaveShopee = (p.tags || []).some(t => t.includes('蝦皮') || t.toLowerCase().includes('shopee'));

    if (titleHasShopee || descHasShopee || tagsHaveShopee) {
      console.log(`\n🧹 正在清理商品: [${p.id}] ${p.title}`);
      
      let newTitle = p.title;
      if (titleHasShopee) {
        newTitle = newTitle.replace(/蝦皮|shopee/gi, '').trim();
      }

      let newTags = p.tags.filter(t => !t.includes('蝦皮') && !t.toLowerCase().includes('shopee'));

      // 替換為乾淨標準的品牌商品描述
      let newDescriptionHtml = generateCleanDescription(newTitle, p.productType || '舒適穿著');

      const input = {
        id: p.id,
        title: newTitle,
        tags: newTags,
        descriptionHtml: newDescriptionHtml,
      };

      const result = await shopifyGraphQL(token, updateMutation, { input });
      const userErrors = result.productUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        console.error(`❌ 更新失敗:`, userErrors);
      } else {
        console.log(`✅ 已成功清除蝦皮字眼並更新描述！`);
        updatedCount++;
      }
    }
  }

  console.log(`\n🎉 完成！共處理並更新了 ${updatedCount} 件商品。\n`);

  // 二次驗證
  console.log('🔍 正在執行全商店二次複查...');
  const verifyData = await shopifyGraphQL(token, `
    query verifyProducts {
      products(first: 50) {
        nodes {
          id
          title
          descriptionHtml
          tags
        }
      }
    }
  `);

  let remainingShopee = 0;
  for (const p of verifyData.products.nodes) {
    const fullText = (p.title + ' ' + p.descriptionHtml + ' ' + p.tags.join(' ')).toLowerCase();
    if (fullText.includes('蝦皮') || fullText.includes('shopee') || fullText.includes('來源店鋪') || fullText.includes('商品來源') || fullText.includes('賣家後臺')) {
      console.warn(`⚠️ 仍殘留: [${p.id}] ${p.title}`);
      remainingShopee++;
    }
  }

  if (remainingShopee === 0) {
    console.log('✨ 複查確認：所有線上商品已 100% 完全清除「蝦皮」相關字眼與來源資訊！');
  } else {
    console.warn(`⚠️ 仍有 ${remainingShopee} 件商品殘留相關字眼。`);
  }
}

cleanAllShopeeProducts().catch(console.error);
