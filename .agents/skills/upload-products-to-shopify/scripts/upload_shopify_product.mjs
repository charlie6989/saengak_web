/**
 * Shopify 商品自動上架腳本 (Shopify Multi-Variant Product Upload Tool)
 * 
 * 功能：
 * 1. 使用 Shopify App Admin API (Client Credentials Grant) 動態取得 24 小時 Token。
 * 2. 自動解析指定目錄中的商品文案（CSV / Markdown / _URL.txt），完整支援多規格（如：顏色、尺寸等選項組合）。
 * 3. 依截圖或使用者指定之真實售價 (Variant Price) 與原價/劃線價 (Compare At Price) 精準更新價格與庫存。
 * 4. 使用 Shopify 官方推薦的 GraphQL stagedUploadsCreate 批次上傳本機高清無品牌主圖與規格圖。
 * 5. 透過 GraphQL productCreate 與 productVariantsBulkCreate 自動建立全套多規格獨立購買選項（例如 5 顏色 x 3 尺寸 = 15 個獨立規格）。
 */

import fs from 'fs';
import path from 'path';

// -----------------------------------------------------------------------------
// 1. 環境變數載入與 Token 交換 (Dynamic Token via Client Credentials)
// -----------------------------------------------------------------------------
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
const SHOPIFY_CLIENT_SECRET = env.SHOPIFY_APP_CLIENT_SECRET || env.SHOPIFY_WEBHOOK_SECRET || env.ShopifyWebhookSecret;
const SHOPIFY_API_VERSION = env.ShopifyStorefrontApiVersion || '2024-07';

let cachedAccessToken = null;

async function getAdminAccessToken() {
  if (cachedAccessToken) return cachedAccessToken;

  if (SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_SECRET) {
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
          cachedAccessToken = data.access_token;
          return cachedAccessToken;
        }
      }
      const errText = await response.text();
      console.warn(`[Shopify Auth] Client Credentials 換發 Token 失敗 (${response.status}): ${errText}`);
    } catch (err) {
      console.warn(`[Shopify Auth] Client Credentials 換發發生例外:`, err.message);
    }
  }

  const staticToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (staticToken && !staticToken.startsWith('shpat_invalid')) {
    cachedAccessToken = staticToken;
    return cachedAccessToken;
  }

  throw new Error('無法取得有效的 Shopify Admin Access Token，請確認 .env.local 中 SHOPIFY_APP_CLIENT_ID 與 SHOPIFY_APP_CLIENT_SECRET 已正確設定。');
}

// -----------------------------------------------------------------------------
// 2. GraphQL 輔助函式
// -----------------------------------------------------------------------------
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify GraphQL 請求失敗 (${response.status}): ${text}`);
  }

  const result = await response.json();
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Shopify GraphQL 錯誤: ${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.data;
}

// -----------------------------------------------------------------------------
// 3. 多媒體上傳：GraphQL stagedUploadsCreate + 二進位上傳
// -----------------------------------------------------------------------------
async function uploadProductImage(token, filePath, altText = '') {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length.toString();
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const stageMutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const stageData = await shopifyGraphQL(token, stageMutation, {
    input: [
      {
        filename,
        mimeType,
        resource: 'PRODUCT_IMAGE',
        fileSize,
        httpMethod: 'POST',
      },
    ],
  });

  const target = stageData.stagedUploadsCreate?.stagedTargets?.[0];
  const userErrors = stageData.stagedUploadsCreate?.userErrors;

  if (!target || (userErrors && userErrors.length > 0)) {
    throw new Error(`建立 Staged Upload 失敗: ${JSON.stringify(userErrors || stageData)}`);
  }

  const formData = new FormData();
  for (const param of target.parameters) {
    formData.append(param.name, param.value);
  }
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);

  const uploadRes = await fetch(target.url, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 204) {
    const errText = await uploadRes.text();
    throw new Error(`二進位檔案上傳失敗 (${uploadRes.status}): ${errText}`);
  }

  return {
    originalSource: target.resourceUrl,
    mediaContentType: 'IMAGE',
    alt: altText || filename,
  };
}

// -----------------------------------------------------------------------------
// 4. CSV 解析器 (支援引號與多行欄位)
// -----------------------------------------------------------------------------
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      if (currentRow.some(c => c.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(c => c.trim())) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const results = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const entry = {};
    for (let c = 0; c < headers.length; c++) {
      entry[headers[c]] = row[c] !== undefined ? row[c].trim() : '';
    }
    results.push(entry);
  }

  return results;
}

// -----------------------------------------------------------------------------
// 5. 目錄文案與圖片解析器 (支援多規格陣列)
// -----------------------------------------------------------------------------
function parseProductDirectory(targetDir) {
  targetDir = os_path_resolve(targetDir);
  if (!fs.existsSync(targetDir)) {
    throw new Error(`找不到指定目錄: ${targetDir}`);
  }

  let csvRows = [];
  const csvFiles = fs.readdirSync(targetDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length > 0) {
    const csvPath = path.join(targetDir, csvFiles[0]);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    csvRows = parseCSV(csvContent);
    if (csvRows.length > 0) {
      console.log(`[文案來源] 成功自 ${csvFiles[0]} 載入 ${csvRows.length} 筆規格設定。`);
    }
  }

  const primaryRow = csvRows[0] || {};

  let urlData = {};
  const urlPath = path.join(targetDir, '_URL.txt');
  if (fs.existsSync(urlPath)) {
    const lines = fs.readFileSync(urlPath, 'utf8').split('\n');
    let currentKey = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('商品標題:')) currentKey = 'title';
      else if (trimmed.includes('商品鏈接:')) currentKey = 'link';
      else if (trimmed.includes('店鋪名稱:')) currentKey = 'shop';
      else if (trimmed.startsWith('http') && currentKey) {
        urlData[currentKey] = trimmed;
      } else if (currentKey && trimmed) {
        urlData[currentKey] = (urlData[currentKey] ? urlData[currentKey] + ' ' : '') + trimmed;
      }
    }
  }

  const imageCandidates = [];
  
  // 1. 優先載入主圖
  const mainDir = path.join(targetDir, '主圖');
  if (fs.existsSync(mainDir)) {
    const files = fs.readdirSync(mainDir);
    const cleanFiles = files.filter(f => f.includes('無品牌') && (f.endsWith('.jpg') || f.endsWith('.png')));
    if (cleanFiles.length > 0) {
      cleanFiles.sort().forEach(f => imageCandidates.push(path.join(mainDir, f)));
    } else {
      const general = files.filter(f => (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')) && !f.startsWith('_'));
      general.sort().forEach(f => imageCandidates.push(path.join(mainDir, f)));
    }
  }

  // 2. 接著載入各規格選項圖
  const variantDir = path.join(targetDir, '規格圖');
  if (fs.existsSync(variantDir)) {
    const files = fs.readdirSync(variantDir);
    const cleanFiles = files.filter(f => f.includes('無品牌') && (f.endsWith('.jpg') || f.endsWith('.png')));
    if (cleanFiles.length > 0) {
      cleanFiles.sort().forEach(f => imageCandidates.push(path.join(variantDir, f)));
    } else {
      const general = files.filter(f => (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')) && !f.startsWith('_'));
      general.sort().forEach(f => imageCandidates.push(path.join(variantDir, f)));
    }
  }

  // 3. 若無子資料夾，檢查根目錄
  if (imageCandidates.length === 0) {
    const files = fs.readdirSync(targetDir);
    const cleanFiles = files.filter(f => f.includes('無品牌') && (f.endsWith('.jpg') || f.endsWith('.png')));
    if (cleanFiles.length > 0) {
      cleanFiles.sort().forEach(f => imageCandidates.push(path.join(targetDir, f)));
    } else {
      const general = files.filter(f => (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')) && !f.startsWith('_'));
      general.sort().forEach(f => imageCandidates.push(path.join(targetDir, f)));
    }
  }

  // 5 大嚴格商品分類定義
  const STRICT_CATEGORIES = [
    '女性護理',
    '每日清潔',
    '深層修護',
    '舒適穿著',
    '益生菌私密舒緩凝膠',
  ];

  function matchStrictCategory(val, fallbackText = '') {
    if (!val && !fallbackText) return '未分類';
    const textToMatch = `${val || ''} ${fallbackText || ''}`;
    for (const cat of STRICT_CATEGORIES) {
      if (textToMatch.includes(cat)) {
        return cat;
      }
    }
    // 依內文特徵進行智慧歸類判定
    if (textToMatch.includes('凝膠') && (textToMatch.includes('益生菌') || textToMatch.includes('舒緩'))) {
      return '益生菌私密舒緩凝膠';
    }
    if (textToMatch.includes('內褲') || textToMatch.includes('內著') || textToMatch.includes('安全褲') || textToMatch.includes('睡衣') || textToMatch.includes('穿著') || textToMatch.includes('三角褲')) {
      return '舒適穿著';
    }
    if (textToMatch.includes('清潔') || textToMatch.includes('沐浴') || textToMatch.includes('洗') || textToMatch.includes('慕斯')) {
      return '每日清潔';
    }
    if (textToMatch.includes('修護') || textToMatch.includes('精華') || textToMatch.includes('深層') || textToMatch.includes('緊緻')) {
      return '深層修護';
    }
    if (textToMatch.includes('護理') || textToMatch.includes('私密') || textToMatch.includes('女性')) {
      return '女性護理';
    }
    return '未分類';
  }

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function sanitizeTitle(rawTitle) {
    if (!rawTitle) return 'SAENGAK 精選商品';
    let clean = rawTitle
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/(?:LUCISSI|medion)/gi, '')
      .replace(/(?:現貨|24小時出貨|全日適穿|視覺誘惑)/g, '')
      .replace(/[|_｜\-—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return clean || rawTitle.trim();
  }

  const rawType = primaryRow.Type || primaryRow['Product Category'];
  const rawTitle = primaryRow.Title || urlData.title || path.basename(targetDir);
  const title = sanitizeTitle(rawTitle);
  const productType = matchStrictCategory(rawType, `${title} ${urlData.title || ''}`);

  function sanitizeBodyHtml(rawBody, cleanTitle, category) {
    if (!rawBody) {
      return `<p>${escapeHtml(cleanTitle)}，專為追求極致舒適與優雅日常的女性設計。精選高品質面料，質地細緻親膚，帶來全天候自在無負擔的穿著體驗。</p><h3>商品特色</h3><ul><li><strong>親膚透氣</strong>：優質親膚面料，柔軟細緻，吸濕排汗不悶熱。</li><li><strong>精緻工藝</strong>：立體剪裁與細膩車縫，服貼不勒肉，呈現自然優美身形。</li><li><strong>百搭實穿</strong>：簡約典雅色系，適合各種日常與居家場合搭配。</li></ul><h3>規格說明</h3><ul><li><strong>商品品類</strong>：${escapeHtml(category)}</li><li><strong>商品規格</strong>：請依規格選單挑選合適款式</li></ul><h3>洗滌與保養建議</h3><p>建議使用冷水搭配中性洗劑輕柔手洗，或裝入細網洗衣袋機洗；置於通風陰涼處自然晾乾。</p>`;
    }
    const dirtyKeywords = ['蝦皮', 'shopee', '來源店鋪', '商品來源', '賣家後臺', 'lucissi', 'medion'];
    const lowerBody = rawBody.toLowerCase();
    const hasDirty = dirtyKeywords.some(k => lowerBody.includes(k));
    if (hasDirty) {
      console.warn(`⚠️ [防禦攔截] 偵測到 CSV 內文含有外部來源或爬蟲字樣，已自動清洗並轉化為標準結構化 HTML 內文。`);
      return `<p>${escapeHtml(cleanTitle)}，專為追求極致舒適與優雅日常的女性設計。精選高品質面料，質地細緻親膚，帶來全天候自在無負擔的穿著體驗。</p><h3>商品特色</h3><ul><li><strong>親膚透氣</strong>：優質親膚面料，柔軟細緻，吸濕排汗不悶熱。</li><li><strong>精緻工藝</strong>：立體剪裁與細膩車縫，服貼不勒肉，呈現自然優美身形。</li><li><strong>百搭實穿</strong>：簡約典雅色系，適合各種日常與居家場合搭配。</li></ul><h3>規格說明</h3><ul><li><strong>商品品類</strong>：${escapeHtml(category)}</li><li><strong>商品規格</strong>：請依規格選單挑選合適款式</li></ul><h3>洗滌與保養建議</h3><p>建議使用冷水搭配中性洗劑輕柔手洗，或裝入細網洗衣袋機洗；置於通風陰涼處自然晾乾。</p>`;
    }
    return rawBody;
  }

  const bodyHtml = sanitizeBodyHtml(primaryRow['Body (HTML)'], title, productType);
  const vendor = 'SAENGAK';
  const tags = primaryRow.Tags ? primaryRow.Tags.split(',').map(t => t.trim()).filter(Boolean) : [productType, 'SAENGAK'];
  const status = (primaryRow.Status?.toUpperCase() === 'ACTIVE') ? 'ACTIVE' : 'DRAFT';

  // 解析多規格選項 (Options: Option1, Option2, Option3)
  const optionNames = [];
  for (let i = 1; i <= 3; i++) {
    const optKey = `Option${i} Name`;
    const optName = primaryRow[optKey];
    if (optName && !optionNames.includes(optName)) {
      optionNames.push(optName);
    }
  }

  // 若 CSV 沒有填表頭 Option Name，檢查第一列是否有 Option1 Value
  if (optionNames.length === 0 && primaryRow['Option1 Value']) {
    optionNames.push('選項');
  }

  // 收集所有規格組合
  const variantRows = [];
  const optionValuesMap = {};
  optionNames.forEach(n => { optionValuesMap[n] = new Set(); });

  for (const row of csvRows) {
    const optVals = [];
    for (let i = 1; i <= optionNames.length; i++) {
      const val = row[`Option${i} Value`];
      if (val) {
        optVals.push({ name: val, optionName: optionNames[i - 1] });
        optionValuesMap[optionNames[i - 1]].add(val);
      }
    }

    if (optVals.length > 0) {
      const vPrice = row['Variant Price']?.replace(/[^0-9.]/g, '') || '';
      const vCompare = row['Variant Compare At Price']?.replace(/[^0-9.]/g, '') || null;
      const inventoryRaw = row['Variant Inventory Qty']?.trim();
      const inventoryQuantity = inventoryRaw !== undefined && /^\d+$/.test(inventoryRaw)
        ? Number(inventoryRaw)
        : null;
      const rawSku = (row['Variant SKU'] || row['SKU'] || '').trim();
      variantRows.push({
        optionValues: optVals,
        price: vPrice,
        compareAtPrice: vCompare,
        inventoryQuantity,
        sku: rawSku,
      });
    }
  }

  // 類別代碼對照表
  const categoryPrefixMap = {
    '女性護理': 'WH',
    '每日清潔': 'DC',
    '深層修護': 'DR',
    '舒適穿著': 'CW',
    '益生菌私密舒緩凝膠': 'PG',
    '未分類': 'GEN',
  };
  const prefix = categoryPrefixMap[productType] || 'SG';
  const cleanDirCode = path.basename(targetDir).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'ITEM';

  // 確保每一組規格都有標準唯一 SKU (供 SiteGiant ERP 自動關聯)
  variantRows.forEach((vr, idx) => {
    if (!vr.sku) {
      const optCode = vr.optionValues.map(o => o.name.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join('-');
      const numCode = String(idx + 1).padStart(2, '0');
      vr.sku = optCode
        ? `SG-${prefix}-${cleanDirCode}-${optCode}`.toUpperCase()
        : `SG-${prefix}-${cleanDirCode}-${numCode}`.toUpperCase();
    }
  });

  const productOptions = optionNames.map(optName => ({
    name: optName,
    values: Array.from(optionValuesMap[optName]).map(v => ({ name: v })),
  }));

  const rawPrice = primaryRow['Variant Price']?.replace(/[^0-9.]/g, '') || (variantRows[0]?.price || '');
  const rawComparePrice = primaryRow['Variant Compare At Price']?.replace(/[^0-9.]/g, '') || (variantRows[0]?.compareAtPrice || null);

  return {
    title,
    bodyHtml,
    vendor,
    productType,
    tags,
    status,
    price: rawPrice,
    compareAtPrice: rawComparePrice,
    productOptions,
    variantRows,
    images: imageCandidates,
  };
}

function os_path_resolve(p) {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// -----------------------------------------------------------------------------
// 6. 核心上架主程序 (全自動多規格建立)
// -----------------------------------------------------------------------------
export async function uploadProductFromDirectory(targetDir, overrideOptions = {}) {
  console.log(`\n========================================`);
  console.log(`🛍️  Shopify 商品自動上架工具 (多規格獨立購買版)`);
  console.log(`========================================`);
  console.log(`目標商店: ${SHOPIFY_DOMAIN}`);
  console.log(`目標目錄: ${targetDir}`);

  const token = await getAdminAccessToken();
  console.log(`[步驟 1/3 OK] 成功取得動態憑證: ${token.slice(0, 12)}...`);

  const productInfo = parseProductDirectory(targetDir);

  if (!productInfo.price || (productInfo.variantRows.length > 0 && productInfo.variantRows.some(v => !v.price))) {
    throw new Error('無法確認所有規格的實際售價，為避免自行編造價格，本商品停止上傳。');
  }

  if (overrideOptions.price) productInfo.price = String(overrideOptions.price);
  if (overrideOptions.compareAtPrice) productInfo.compareAtPrice = String(overrideOptions.compareAtPrice);
  if (overrideOptions.status) productInfo.status = overrideOptions.status;

  console.log(`\n[步驟 2/3] 解析商品文案與多規格選項...`);
  console.log(`  - 商品標題: ${productInfo.title}`);
  console.log(`  - 品牌供應商: ${productInfo.vendor}`);
  console.log(`  - 上架狀態: ${productInfo.status}`);
  console.log(`  - 售價: NT$ ${productInfo.price} (劃線原價: NT$ ${productInfo.compareAtPrice})`);
  console.log(`  - 找到圖片總數: ${productInfo.images.length} 張`);
  console.log(`  - 規格維度: ${productInfo.productOptions.map(o => `${o.name} (${o.values.length} 種)`).join(', ') || '單一規格'}`);
  console.log(`  - 規格組合總數: ${productInfo.variantRows.length} 組 (全數配置標準 SKU 與防超賣設定)`);

  // 1. 上傳圖片
  const mediaInputs = [];
  if (productInfo.images.length > 0) {
    console.log(`\n[步驟 2.1] 正在透過 GraphQL stagedUploadsCreate 批次上傳 ${productInfo.images.length} 張圖片...`);
    for (let i = 0; i < productInfo.images.length; i++) {
      const imgPath = productInfo.images[i];
      const alt = `${productInfo.title} - 圖片 ${i + 1}`;
      console.log(`  (${i + 1}/${productInfo.images.length}) 上傳: ${path.basename(imgPath)}...`);
      const media = await uploadProductImage(token, imgPath, alt);
      mediaInputs.push(media);
    }
    console.log(`[步驟 2.1 OK] 所有 ${mediaInputs.length} 張圖片已成功就緒！`);
  }

  // 2. 建立主商品 (若有多規格則傳入 productOptions)
  console.log(`\n[步驟 3/3] 正在透過 GraphQL productCreate 建立多規格商品...`);
  const createMutation = `
    mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
      productCreate(input: $input, media: $media) {
        product {
          id
          title
          handle
          status
          createdAt
          options {
            id
            name
            values
          }
          variants(first: 50) {
            nodes {
              id
              title
              price
              compareAtPrice
              inventoryPolicy
              inventoryItem {
                id
                sku
                tracked
              }
              selectedOptions {
                name
                value
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const inputPayload = {
    title: productInfo.title,
    descriptionHtml: productInfo.bodyHtml,
    vendor: productInfo.vendor,
    productType: productInfo.productType,
    tags: productInfo.tags,
    status: productInfo.status,
    ...(productInfo.productOptions.length > 0 ? {
      productOptions: productInfo.productOptions.map(opt => ({
        name: opt.name,
        values: opt.values.slice(0, 1), // 第一個規格在建立商品時生成
      }))
    } : {}),
  };

  const createResult = await shopifyGraphQL(token, createMutation, {
    input: inputPayload,
    media: mediaInputs,
  });

  const createdProduct = createResult.productCreate?.product;
  const userErrors = createResult.productCreate?.userErrors;

  if (!createdProduct || (userErrors && userErrors.length > 0)) {
    throw new Error(`商品建立失敗: ${JSON.stringify(userErrors || createResult, null, 2)}`);
  }

  const defaultVariant = createdProduct.variants?.nodes?.[0];
  let bulkCreatedVariants = [];

  // 3. 若有其餘規格組合，呼叫 productVariantsBulkCreate 批次建立所有可選規格
  if (productInfo.variantRows.length > 1) {
    console.log(`\n[步驟 3.1] 正在批次建立其餘 ${productInfo.variantRows.length - 1} 組規格選項 (注入 SKU 與防超賣)...`);
    const bulkMutation = `
      mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants {
            id
            title
            price
            compareAtPrice
            inventoryPolicy
            inventoryItem {
              id
              sku
              tracked
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // 排除第一個已在 productCreate 建立的規格組合
    const remainingVariants = productInfo.variantRows.slice(1).map(vr => ({
      optionValues: vr.optionValues,
      price: String(vr.price || productInfo.price),
      ...(vr.compareAtPrice || productInfo.compareAtPrice
        ? { compareAtPrice: String(vr.compareAtPrice || productInfo.compareAtPrice) }
        : {}),
      inventoryPolicy: 'DENY',
      inventoryItem: {
        tracked: true,
        ...(vr.sku ? { sku: vr.sku } : {}),
      },
    }));

    try {
      const bulkRes = await shopifyGraphQL(token, bulkMutation, {
        productId: createdProduct.id,
        variants: remainingVariants,
      });
      const errors = bulkRes.productVariantsBulkCreate?.userErrors;
      if (errors && errors.length > 0) {
        console.warn(`[步驟 3.1 警告] 部分規格建立有訊息:`, errors);
      } else {
        bulkCreatedVariants = bulkRes.productVariantsBulkCreate?.productVariants || [];
        const createdCount = bulkCreatedVariants.length;
        console.log(`[步驟 3.1 OK] 成功建立 ${createdCount} 組可分開購買的規格組合！`);
      }
    } catch (bulkErr) {
      console.warn(`[步驟 3.1 警告] 批次規格建立異常: ${bulkErr.message}`);
    }
  }

  // 4. 更新第一個預設規格之售價、劃線原價、SKU 與防超賣策略
  if (defaultVariant) {
    const updateVariantMutation = `
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            price
            compareAtPrice
            inventoryPolicy
            inventoryItem {
              id
              sku
              tracked
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const firstVariant = productInfo.variantRows[0];
    const variantPayload = {
      id: defaultVariant.id,
      price: String(productInfo.price),
      ...(productInfo.compareAtPrice ? { compareAtPrice: String(productInfo.compareAtPrice) } : {}),
      inventoryPolicy: 'DENY',
      inventoryItem: {
        tracked: true,
        ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
      },
    };

    try {
      await shopifyGraphQL(token, updateVariantMutation, {
        productId: createdProduct.id,
        variants: [variantPayload],
      });
      console.log(`[步驟 3.2 OK] 首項規格售價、SKU (${firstVariant?.sku || '未指定'}) 與防超賣策略設定完成！`);
    } catch (vErr) {
      console.warn(`[步驟 3.2 警告] 規格售價更新略過: ${vErr.message}`);
    }
  }

  // 4.5 嘗試同步已由蝦皮後臺確認的規格庫存；若 App 未授予 inventory scope，保留本地 CSV 紀錄並明確警告。
  const inventoryRows = productInfo.variantRows.filter(v => Number.isInteger(v.inventoryQuantity));
  if (inventoryRows.length > 0) {
    try {
      const locationData = await shopifyGraphQL(token, `query { locations(first: 1) { nodes { id name } } }`);
      const location = locationData?.locations?.nodes?.[0];
      const variantRecords = [defaultVariant, ...bulkCreatedVariants]
        .map((variant, index) => ({ variant, row: productInfo.variantRows[index] }))
        .filter(({ variant, row }) => variant?.id && variant.inventoryItem?.id && Number.isInteger(row?.inventoryQuantity));
      if (!location || variantRecords.length === 0) {
        console.warn('[步驟 3.4 警告] 找不到可用 Shopify 庫存地點或規格 ID，已保留本地庫存紀錄。');
      } else {
        const inventoryMutation = `
          mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
            inventorySetQuantities(input: $input) {
              inventoryAdjustmentGroup { createdAt reason }
              userErrors { field message }
            }
          }
        `;
        const inventoryResult = await shopifyGraphQL(token, inventoryMutation, {
          input: {
            name: 'available',
            reason: 'correction',
            ignoreCompareQuantity: true,
            quantities: variantRecords.map(({ variant, row }) => ({
              inventoryItemId: variant.inventoryItem.id,
              locationId: location.id,
              quantity: row.inventoryQuantity,
            })),
          },
        });
        const inventoryErrors = inventoryResult.inventorySetQuantities?.userErrors || [];
        if (inventoryErrors.length > 0) {
          console.warn(`[步驟 3.4 警告] Shopify 庫存同步未完成，已保留本地庫存紀錄: ${JSON.stringify(inventoryErrors)}`);
        } else {
          console.log(`[步驟 3.4 OK] 已同步 ${variantRecords.length} 組規格庫存至 Shopify 地點「${location.name}」。`);
        }
      }
    } catch (inventoryErr) {
      console.warn(`[步驟 3.4 警告] Shopify 庫存同步略過，已保留本地庫存紀錄: ${inventoryErr.message}`);
    }
  }

  // 5. 自動發布商品至商店的全數銷售管道與店鋪 (Sales Channels / Publications)
  try {
    const pubQuery = `query { publications(first: 25) { nodes { id name } } }`;
    const pubData = await shopifyGraphQL(token, pubQuery);
    const publications = pubData?.publications?.nodes || [];
    if (publications.length > 0) {
      const publishMutation = `
        mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            userErrors {
              field
              message
            }
          }
        }
      `;
      await shopifyGraphQL(token, publishMutation, {
        id: createdProduct.id,
        input: publications.map(p => ({ publicationId: p.id })),
      });
      console.log(`[步驟 3.3 OK] 成功將商品同步發布至全數 ${publications.length} 個銷售管道與店鋪 (${publications.map(p => p.name).join(', ')})！`);
    }
  } catch (pubErr) {
    console.warn(`[步驟 3.3 警告] 自動同步銷售管道失敗: ${pubErr.message}`);
  }

  const numericId = createdProduct.id.replace('gid://shopify/Product/', '');
  const adminUrl = `https://${SHOPIFY_DOMAIN}/admin/products/${numericId}`;

  console.log(`\n========================================`);
  console.log(`🎉 多規格商品上架成功！`);
  console.log(`========================================`);
  console.log(`  - 商品 ID: ${createdProduct.id}`);
  console.log(`  - 商品標題: ${createdProduct.title}`);
  console.log(`  - 規格數量: 共有 ${productInfo.variantRows.length || 1} 組規格供顧客分開選擇購買`);
  console.log(`  - 統一售價: NT$ ${productInfo.price}`);
  console.log(`  - 劃線原價: NT$ ${productInfo.compareAtPrice}`);
  console.log(`  - 關聯圖片數: ${mediaInputs.length} 張`);
  console.log(`  - Shopify 後台管理連結:`);
  console.log(`    👉 ${adminUrl}`);
  console.log(`========================================\n`);

  return {
    product: createdProduct,
    adminUrl,
    numericId,
    totalVariants: productInfo.variantRows.length || 1,
  };
}

// -----------------------------------------------------------------------------
// 7. CLI 入口
// -----------------------------------------------------------------------------
if (process.argv[1] && (process.argv[1].endsWith('upload_shopify_product.mjs') || process.argv[1].endsWith('upload-shopify-product.mjs'))) {
  const defaultFolder = 'product/LUCISSI_舒適純棉女內褲_女三角內褲_女生棉內褲_女抗菌內褲_透氣親膚_舒適貼合_日常安心_現貨_48902664613_images';
  const targetDir = process.argv[2] || defaultFolder;

  uploadProductFromDirectory(targetDir).catch((err) => {
    console.error('\n❌ 上架程序發生錯誤:', err.message);
    process.exit(1);
  });
}
