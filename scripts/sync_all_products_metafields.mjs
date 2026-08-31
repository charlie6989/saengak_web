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

async function shopifyAdminGraphQL(token, query, variables = {}) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  return await response.json();
}

// 從 HTML 描述萃取特色清單
function extractHighlightsFromHtml(html, title = '', productType = '') {
  if (!html) return getDefaultHighlights(productType);

  const highlights = [];
  // 匹配 <li>...</li>
  const liMatches = html.match(/<li>[\s\S]*?<\/li>/gi);
  if (liMatches && liMatches.length > 0) {
    for (const li of liMatches) {
      let clean = li
        .replace(/<\/?(?:li|strong|b|span|p|em)[^>]*>/gi, '')
        .replace(/^[\s\n\r\t•\-✓✔\u2022]+/g, '')
        .trim();
      if (clean && clean.length > 2 && clean.length < 80) {
        // 如果包含冒號，只保留重點或簡短化
        if (!clean.startsWith('商品品類') && !clean.startsWith('包裝規格') && !clean.startsWith('適用對象') && !clean.startsWith('商品規格') && !clean.startsWith('商品材質')) {
          highlights.push(clean);
        }
      }
    }
  }

  if (highlights.length > 0) {
    return highlights.slice(0, 5);
  }

  return getDefaultHighlights(productType);
}

function getDefaultHighlights(productType) {
  switch (productType) {
    case '女性護理':
    case '益生菌私密舒緩凝膠':
      return [
        '不含 21 種有害成分',
        '使用植物性萃取成分',
        'pH 4.5~5.5 弱酸性配方',
        '醫學等級皮膚測試認證'
      ];
    case '舒適穿著':
      return [
        '100% 純棉親膚透氣雙層底襠',
        '超細細膩彈力纖維，貼身不緊繃',
        '立體美型剪裁，服貼無痕零著感',
        '嚴選安心染料，親膚不易褪色'
      ];
    case '每日清潔':
      return [
        '植萃弱酸溫和配方，維持私密健康環境',
        '細緻綿密泡沫，深層淨化不乾澀',
        '無添加人工色素與刺激性防腐劑',
        '通過親膚低敏測試，天天使用好安心'
      ];
    case '深層修護':
      return [
        '高濃度活性修護精華，深度滋養潤澤',
        '強化私密肌膚天然屏障，舒緩乾澀緊繃',
        '輕盈凝露質地，快速吸收無負擔',
        '專業實驗室研發，全天候長效呵護'
      ];
    default:
      return [
        '官方直營 100% 正品品質保證',
        '精選親膚舒適材質，細膩呵護日常',
        '通過多項嚴格品質與安全檢驗'
      ];
  }
}

function getSubtitle(product) {
  const type = product.productType || '';
  const title = product.title || '';
  if (title.includes('益生菌') || title.includes('凝膠')) {
    return '韓國 | 韓國 Dermatest | 女性清潔劑';
  }
  if (type === '女性護理') {
    return '韓國原廠 | 溫和舒緩 | 女性私密護理';
  }
  if (type === '每日清潔') {
    return '溫和潔淨 | 植萃微酸 | 日常清潔';
  }
  if (type === '深層修護') {
    return '深層修護 | 潤澤滋養 | 私密屏障保養';
  }
  if (type === '舒適穿著') {
    if (title.includes('內衣')) {
      return '無鋼圈零束縛 | 透氣提托 | 舒適穿著';
    }
    if (title.includes('睡衣')) {
      return '絲滑親膚 | 輕柔放鬆 | 居家必備';
    }
    return '親膚純棉 | 無痕透氣 | 每日舒適首選';
  }
  return 'SAENGAK 精選 | 官方直營 | 貼心呵護';
}

async function run() {
  console.log('==============================================');
  console.log('🚀 開始執行全商店商品 Metafields 治理與同步腳本');
  console.log('==============================================');
  
  const token = await getAdminAccessToken();
  console.log('✅ Admin Access Token 取得成功');

  // 1. 確保所有 Metafield Definitions 已建立
  const createDefMutation = `
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          name
          namespace
          key
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  // custom.promotion_badge
  try {
    const resPromo = await shopifyAdminGraphQL(token, createDefMutation, {
      definition: {
        name: '商品促銷標籤與優惠文案',
        namespace: 'custom',
        key: 'promotion_badge',
        description: '商品專屬促銷文字 (例如: 2+1 促銷價，享受驚喜折扣！)',
        type: 'single_line_text_field',
        ownerType: 'PRODUCT',
        access: {
          storefront: 'PUBLIC_READ'
        }
      }
    });
    console.log('Metafield definition custom.promotion_badge 註冊檢查完成');
  } catch (e) {
    // 忽略已存在錯誤
  }

  // 2. 抓取所有商品
  const getProductsQuery = `
    query getAllProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          productType
          descriptionHtml
          metafields(first: 10) {
            nodes {
              namespace
              key
              value
            }
          }
        }
      }
    }
  `;

  let hasNext = true;
  let cursor = null;
  let totalCount = 0;
  let updatedCount = 0;

  const updateMutation = `
    mutation UpdateProductMetafields($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  while (hasNext) {
    const data = await shopifyAdminGraphQL(token, getProductsQuery, { cursor });
    const products = data.data?.products?.nodes || [];

    for (const prod of products) {
      totalCount++;
      const highlights = extractHighlightsFromHtml(prod.descriptionHtml, prod.title, prod.productType);
      const subtitle = getSubtitle(prod);

      const isGel = prod.title.includes('益生菌') || prod.title.includes('凝膠');
      const promoBadge = isGel ? '2+1 促銷價，享受驚喜折扣！' : null;

      const metafieldsToSet = [
        {
          namespace: 'custom',
          key: 'highlights',
          value: JSON.stringify(highlights),
          type: 'list.single_line_text_field',
        },
        {
          namespace: 'custom',
          key: 'subtitle',
          value: subtitle,
          type: 'single_line_text_field',
        },
      ];

      if (promoBadge) {
        metafieldsToSet.push({
          namespace: 'custom',
          key: 'promotion_badge',
          value: promoBadge,
          type: 'single_line_text_field',
        });
      }

      console.log(`[${totalCount}] 更新商品: ${prod.title}`);
      console.log(`     副標題: ${subtitle}`);
      console.log(`     亮點: ${highlights.join(' / ')}`);

      const res = await shopifyAdminGraphQL(token, updateMutation, {
        input: {
          id: prod.id,
          metafields: metafieldsToSet,
        }
      });

      const errs = res.data?.productUpdate?.userErrors || [];
      if (errs.length > 0) {
        console.warn(`     ⚠️ 更新失敗:`, JSON.stringify(errs));
      } else {
        updatedCount++;
      }
    }

    hasNext = data.data?.products?.pageInfo?.hasNextPage;
    cursor = data.data?.products?.pageInfo?.endCursor;
  }

  console.log('\n==============================================');
  console.log(`🎉 全站商品 Metafields 同步完成！共更新 ${updatedCount} / ${totalCount} 件商品。`);
  console.log('==============================================\n');
}

run();
