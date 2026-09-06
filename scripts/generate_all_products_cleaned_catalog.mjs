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

function cleanTitle(raw) {
  if (!raw) return '';
  let str = raw
    .replace(/^(\s*SAENGAK\s*[｜|_\-–—]\s*)+/gi, '')
    .replace(/^(\s*LUCISSI\s*[｜|_\-–—]\s*)+/gi, '')
    .replace(/^(\s*✨|\s*🌸|\s*🌹|\s*🎀|\s*💫|\s*🌬️)+/g, '')
    .replace(/\s*(現貨|現貨\s*\d*|_images|_URL|\.jpg|\.png).*$/gi, '')
    .replace(/[ _\t]+/g, ' ')
    .trim();

  // 核心產品精準對齊
  if (str.includes('慕斯') || str.includes('潔淨慕斯')) return '平衡調理私密潔淨慕斯';
  if (str.includes('舒緩凝膠') || str.includes('私密凝膠') || (str.includes('益生菌') && str.includes('凝膠'))) return '益生菌私密舒緩凝膠';
  if (str.includes('精華噴霧') || str.includes('修護噴霧') || str.includes('雙層修護')) return '私密雙層修護精華噴霧';
  if (str.includes('養膚濕巾') || str.includes('私密濕巾') || (str.includes('益生菌') && str.includes('濕巾'))) return '益生菌私密養膚濕巾';
  if (str.includes('除毛刀')) return '親膚安全私密除毛刀';
  if (str.includes('清洗袋') || str.includes('洗衣護衣網')) return '高質感護衣洗衣袋';
  if (str.includes('睡衣') || str.includes('睡袍')) {
    if (str.includes('蕾絲')) return '性感蕾絲親膚睡衣';
    if (str.includes('冰絲')) return '冰絲純慾性感睡衣';
    return '法式輕奢舒適睡衣';
  }
  if (str.includes('內衣') || str.includes('胸罩')) {
    if (str.includes('運動') || str.includes('寬肩帶')) return '乾爽透氣運動內衣';
    if (str.includes('無鋼圈') || str.includes('薄杯')) return '無鋼圈透氣薄杯內衣';
    if (str.includes('蕾絲')) return '輕薄透氣蕾絲內衣';
    if (str.includes('副乳')) return '副乳包覆無痕內衣';
    return '無痕透氣舒適內衣';
  }
  if (str.includes('生理褲') || str.includes('生理內褲')) return '純棉高腰防漏生理褲';
  if (str.includes('丁字褲')) return '超薄無痕性感丁字褲';
  if (str.includes('平口褲')) return '無痕冰絲防磨平口褲';
  if (str.includes('收腹')) return '高腰無痕收腹內褲';
  if (str.includes('蕾絲')) {
    if (str.includes('三角')) return '性感蕾絲女三角內褲';
    if (str.includes('純棉') || str.includes('高腰')) return '蕾絲純棉高腰內褲';
    return '性感透氣蕾絲內褲';
  }
  if (str.includes('冰絲')) {
    if (str.includes('蠶絲')) return '冰絲蠶絲低腰內褲';
    return '涼感冰絲無痕內褲';
  }
  if (str.includes('純棉') || str.includes('棉質')) {
    if (str.includes('細帶')) return '細帶純棉無痕女內褲';
    if (str.includes('高腰')) return '純棉高腰舒適內褲';
    if (str.includes('三角')) return '透氣親膚純棉三角褲';
    return '舒適純棉透氣內褲';
  }

  // 若仍超過 12 字，截斷至 12 字
  if (str.length > 12) {
    const parts = str.split(/[\s_]+/);
    if (parts[0] && parts[0].length <= 12 && parts[0].length >= 4) {
      return parts[0];
    }
    return str.slice(0, 12);
  }
  return str;
}

function cleanDescriptionSingleSentence(title, rawDesc) {
  if (title.includes('慕斯') || title.includes('潔淨')) {
    return '雲朵般綿密弱酸泡泡，溫和淨化異味，洗後柔嫩清爽不緊繃。';
  }
  if (title.includes('凝膠') || title.includes('舒緩')) {
    return '高活性益生菌精華深層修護，即時舒緩乾癢不適，平衡私密微生態。';
  }
  if (title.includes('噴霧') || title.includes('雙層')) {
    return '精華油與植萃雙層黃金配比，隨手一噴即時安撫乾燥與異味困擾。';
  }
  if (title.includes('濕巾') || title.includes('養膚')) {
    return '如水般溫和親膚植萃成分，隨身便攜擦拭，維持整天潔淨清新。';
  }
  if (title.includes('除毛刀')) {
    return '防刮傷安全親膚刀頭，細膩修整嬌嫩肌膚輪廓。';
  }
  if (title.includes('生理褲')) {
    return '防側漏長效加寬底襠設計，生理期間全天候安心乾爽。';
  }
  if (title.includes('丁字褲')) {
    return '極致輕薄親膚裸感無痕剪裁，舒適透氣零摩擦束縛。';
  }
  if (title.includes('內衣') || title.includes('睡衣')) {
    return '親膚柔軟零著感無鋼圈包覆，讓居家日常自在放鬆。';
  }

  // 一般內著
  if (title.includes('蠶絲') || title.includes('冰絲')) {
    return '極致涼感絲滑觸感，夏日全日透氣清爽不悶熱。';
  }
  if (title.includes('蕾絲')) {
    return '細緻柔膚透氣蕾絲雕花，優雅貼合女性臀部輪廓。';
  }
  if (title.includes('純棉') || title.includes('棉')) {
    return '嚴選天然親膚純棉底襠，全天候守護私密肌膚乾爽。';
  }

  const desc = (rawDesc || '').replace(/<[^>]+>/g, '').trim();
  const sentences = desc.split(/([。！？!?\n]+)/).filter(Boolean);
  if (sentences.length >= 2) {
    const s = (sentences[0] + sentences[1]).trim();
    if (s.length <= 36) return s;
    return s.slice(0, 35) + '...';
  }
  return '溫和親膚質感選品，細膩呵護女性日常美好生活。';
}

async function main() {
  console.log('正在連接 Shopify Admin API...');
  const token = await getAdminAccessToken();
  console.log('成功取得 Admin Token，正在抓取所有產品...');

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

  console.log(`成功撈取 ${allProducts.length} 款商品！`);

  const previewList = allProducts.map((p, index) => {
    const proposedTitle = cleanTitle(p.title);
    const proposedSingleSentence = cleanDescriptionSingleSentence(proposedTitle, p.descriptionHtml);
    return {
      index: index + 1,
      id: p.id,
      numericId: p.id.split('/').pop(),
      originalTitle: p.title,
      proposedTitle: proposedTitle,
      titleLength: proposedTitle.length,
      proposedSingleSentence: proposedSingleSentence,
      productType: p.productType
    };
  });

  const outputPath = path.resolve(process.cwd(), 'scripts/all_products_cleanup_preview.json');
  fs.writeFileSync(outputPath, JSON.stringify(previewList, null, 2), 'utf8');
  console.log(`已成功產出全品項清洗對照表：${outputPath}`);

  // 產出 Markdown 表格
  let md = `# 全品項標題（≤12字）與單句描述對照審核表\n\n`;
  md += `共盤點 ${previewList.length} 件商品。依據最新規範：標題嚴格限制在 12 字以內、搜尋頁描述為單句。\n\n`;
  md += `| 編號 | 原商品標題 | 建議新標題 (≤12字) | 字數 | 搜尋頁單句描述 |\n`;
  md += `| :---: | :--- | :--- | :---: | :--- |\n`;
  for (const item of previewList) {
    md += `| ${item.index} | ${item.originalTitle.slice(0, 25)}... | **${item.proposedTitle}** | ${item.titleLength} | ${item.proposedSingleSentence} |\n`;
  }

  const mdPath = path.resolve(process.cwd(), 'scripts/all_products_cleanup_preview.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`已產出 Markdown 審核表：${mdPath}`);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
