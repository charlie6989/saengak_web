import { SHOPIFY_API_VERSION, SHOPIFY_STOREFRONT_PUBLIC_TOKEN, SHOPIFY_STORE_DOMAIN } from '../_lib/shopify-config.js';

/**
 * 社群分享預覽（LINE、Facebook 等）專用：爬蟲不執行 JavaScript，只讀第一份 HTML 的 og 標籤，
 * 所以由 middleware 把爬蟲對 /product/:id 的請求改寫到這裡，回傳含商品名稱、說明與主圖的精簡 HTML。
 * 一般訪客不會經過這個函式。
 */

const SITE_URL = 'https://lucissicare.com';
const SITE_NAME = 'LUCISSI CARE';
const SITE_TITLE = 'LUCISSI CARE｜LUCISSI 的日常照護系列';
const SITE_DESCRIPTION = 'LUCISSI CARE 是 LUCISSI 的日常照護系列：私密保養、舒適內搭與生理期照護，照顧貼近身體的每一天。';
const SITE_IMAGE = { url: `${SITE_URL}/images/brand/og-image.png`, width: 1200, height: 630, alt: SITE_NAME };
const DESCRIPTION_MAX = 120;
const PRODUCT_ID = /^\d{1,20}$/;

export interface ShareMeta {
  title: string;
  description: string;
  url: string;
  type: 'website' | 'product';
  image: { url: string; width?: number; height?: number; alt: string };
}

interface StorefrontProduct {
  title?: string;
  description?: string;
  featuredImage?: { url?: string; width?: number; height?: number; altText?: string | null } | null;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function summarize(text: string | undefined, max = DESCRIPTION_MAX): string {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function siteShareMeta(url = SITE_URL): ShareMeta {
  return { title: SITE_TITLE, description: SITE_DESCRIPTION, url, type: 'website', image: SITE_IMAGE };
}

export function productShareMeta(id: string, product: StorefrontProduct | null | undefined): ShareMeta {
  const url = `${SITE_URL}/product/${id}`;
  if (!product?.title) return siteShareMeta(url);
  const image = product.featuredImage?.url
    ? {
        url: product.featuredImage.url,
        width: product.featuredImage.width,
        height: product.featuredImage.height,
        alt: product.featuredImage.altText || product.title,
      }
    : SITE_IMAGE;
  return {
    title: `${product.title}｜${SITE_NAME}`,
    description: summarize(product.description) || SITE_DESCRIPTION,
    url,
    type: 'product',
    image,
  };
}

export function renderShareHtml(meta: ShareMeta): string {
  const tag = (property: string, content: string | number | undefined) =>
    content === undefined || content === '' ? '' : `  <meta property="${property}" content="${escapeHtml(String(content))}" />\n`;
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />
  <link rel="canonical" href="${escapeHtml(meta.url)}" />
${tag('og:type', meta.type)}${tag('og:site_name', SITE_NAME)}${tag('og:locale', 'zh_TW')}${tag('og:url', meta.url)}${tag('og:title', meta.title)}${tag('og:description', meta.description)}${tag('og:image', meta.image.url)}${tag('og:image:width', meta.image.width)}${tag('og:image:height', meta.image.height)}${tag('og:image:alt', meta.image.alt)}  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <a href="${escapeHtml(meta.url)}">${escapeHtml(meta.title)}</a>
</body>
</html>
`;
}

async function fetchProduct(id: string): Promise<StorefrontProduct | null> {
  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
    },
    body: JSON.stringify({
      query: 'query ShareProduct($id: ID!) { product(id: $id) { title description featuredImage { url width height altText } } }',
      variables: { id: `gid://shopify/Product/${id}` },
    }),
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as { data?: { product?: StorefrontProduct | null } } | null;
  return body?.data?.product ?? null;
}

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') || '';
  let meta = siteShareMeta();
  if (PRODUCT_ID.test(id)) {
    // 查不到商品或 Shopify 暫時失敗時，仍回傳站台預設預覽，不讓分享變成空白
    const product = await fetchProduct(id).catch(() => null);
    meta = productShareMeta(id, product);
  }
  return new Response(renderShareHtml(meta), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
