import fs from 'fs';
import path from 'path';

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq !== -1) {
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim();
          if (!env[k]) env[k] = v;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const SHOPIFY_DOMAIN = env.SHOPIFY_DOMAIN || 'gh2xgs-zf.myshopify.com';
const SHOPIFY_CLIENT_ID = env.SHOPIFY_APP_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = env.SHOPIFY_APP_CLIENT_SECRET;

async function getAdminToken() {
  const resp = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  });
  const data = await resp.json();
  return data.access_token;
}

async function shopifyGraphQL(token, query, variables = {}) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-07/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  return result.data;
}

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

async function updateProductImages(productId, targetDir) {
  console.log(`[*] 開始更新 Shopify 商品 ${productId} 的圖片...`);
  const token = await getAdminToken();

  // 1. 取得現有 media 並刪除
  const query = `
    query getProductMedia($id: ID!) {
      product(id: $id) {
        id
        title
        media(first: 30) {
          nodes {
            id
            mediaContentType
          }
        }
      }
    }
  `;
  const pData = await shopifyGraphQL(token, query, { id: productId });
  const oldMedia = pData?.product?.media?.nodes || [];
  console.log(`[1/3] 商品目前有 ${oldMedia.length} 個媒體檔案。`);

  if (oldMedia.length > 0) {
    const mediaIds = oldMedia.map(m => m.id);
    const deleteMutation = `
      mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          deletedMediaIds
          userErrors {
            field
            message
          }
        }
      }
    `;
    const delRes = await shopifyGraphQL(token, deleteMutation, { productId, mediaIds });
    console.log(`  [OK] 舊媒體刪除完成:`, delRes.productDeleteMedia?.deletedMediaIds?.length || 0);
  }

  // 2. 收集新生成的無品牌主圖與規格圖
  const imageFiles = [];
  const mainDir = path.join(targetDir, '主圖');
  if (fs.existsSync(mainDir)) {
    fs.readdirSync(mainDir)
      .filter(f => f.includes('無品牌') && (f.endsWith('.jpg') || f.endsWith('.png')))
      .sort()
      .forEach(f => imageFiles.push(path.join(mainDir, f)));
  }
  const varDir = path.join(targetDir, '規格圖');
  if (fs.existsSync(varDir)) {
    fs.readdirSync(varDir)
      .filter(f => f.includes('無品牌') && (f.endsWith('.jpg') || f.endsWith('.png')))
      .sort()
      .forEach(f => imageFiles.push(path.join(varDir, f)));
  }

  console.log(`[2/3] 找到 ${imageFiles.length} 張無品牌高清圖檔，準備上傳...`);
  const mediaInputs = [];
  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const base = path.basename(filePath);
    console.log(`  (${i + 1}/${imageFiles.length}) 上傳: ${base}...`);
    const media = await uploadProductImage(token, filePath, `${pData.product.title} - ${base}`);
    mediaInputs.push(media);
  }

  // 3. 加入新圖片至商品
  console.log(`[3/3] 正在透過 GraphQL productCreateMedia 加入商品媒體...`);
  const createMediaMutation = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
          mediaContentType
          status
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
  `;

  const addRes = await shopifyGraphQL(token, createMediaMutation, {
    productId,
    media: mediaInputs,
  });

  const errors = addRes.productCreateMedia?.mediaUserErrors;
  if (errors && errors.length > 0) {
    console.error(`[ERR] 加入商品媒體失敗:`, errors);
  } else {
    console.log(`\n🎉 成功為商品 [${pData.product.title}] 更新 ${addRes.productCreateMedia?.media?.length} 張合格的無品牌高清圖檔！`);
    const numId = productId.replace('gid://shopify/Product/', '');
    console.log(`後台管理連結: https://${SHOPIFY_DOMAIN}/admin/products/${numId}`);
  }
}

if (process.argv[1] && (process.argv[1].endsWith('update_product_images.mjs') || process.argv[1].endsWith('update-product-images.mjs'))) {
  const prodId = process.argv[2] || 'gid://shopify/Product/7810527723587';
  const targetDir = path.resolve(process.argv[3] || 'product/LUCISSI_舒適純棉女內褲_女三角內褲_女生棉內褲_女抗菌內褲_透氣親膚_舒適貼合_日常安心_現貨_48902664613_images');
  updateProductImages(prodId, targetDir).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
