import { SHOPIFY_API_VERSION, SHOPIFY_STOREFRONT_PUBLIC_TOKEN, SHOPIFY_STORE_DOMAIN } from '../_lib/shopify-config.js';
import { editorialShareImage } from '../../src/content/editorialImages.js';
import { hasPublicArticleTag, normalizeLegacyStorefrontCopy } from '../../src/domain/storefrontCopy.js';

/**
 * 社群分享預覽（LINE、Facebook 等）專用：爬蟲不執行 JavaScript，只讀第一份 HTML 的 og 標籤，
 * 所以由 middleware 把爬蟲對 /product/:id（?id=）與 /blog/:handle（?article=）的請求改寫到這裡，
 * 回傳含名稱、說明與主圖的精簡 HTML。一般訪客不會經過這個函式。
 * （Vercel Hobby 方案的函式數量已滿，所以文章與商品共用這一個函式。）
 */

const SITE_URL = 'https://lucissicare.com';
const SITE_NAME = 'LUCISSI CARE';
const SITE_TITLE = 'LUCISSI CARE｜LUCISSI 的日常照護系列';
const SITE_DESCRIPTION = 'LUCISSI CARE 是 LUCISSI 的日常照護系列：私密保養、舒適內搭與生理期照護，照顧貼近身體的每一天。';
const SITE_IMAGE = { url: `${SITE_URL}/images/brand/og-image.png`, width: 1200, height: 630, alt: SITE_NAME };
const DESCRIPTION_MAX = 120;
const PRODUCT_ID = /^\d{1,20}$/;
const ARTICLE_HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;

export interface ShareMeta {
  title: string;
  description: string;
  url: string;
  type: 'website' | 'product' | 'article';
  image: { url: string; width?: number; height?: number; alt: string };
}

interface StorefrontProduct {
  title?: string;
  description?: string;
  seo?: { title?: string | null; description?: string | null } | null;
  featuredImage?: { url?: string; width?: number; height?: number; altText?: string | null } | null;
}

interface StorefrontArticle {
  title?: string;
  handle?: string;
  excerpt?: string | null;
  seo?: { title?: string | null; description?: string | null } | null;
  image?: { url?: string; width?: number; height?: number; altText?: string | null } | null;
  tags?: string[];
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
  // 優先使用 Shopify 的 SEO 標題／說明，與商品頁一致；沒填時退回商品名稱與說明摘要
  const title = product.seo?.title?.trim() || product.title;
  return {
    title: `${title}｜${SITE_NAME}`,
    description: summarize(product.seo?.description?.trim() || product.description) || SITE_DESCRIPTION,
    url,
    type: 'product',
    image,
  };
}

export function articleShareMeta(handle: string, article: StorefrontArticle | null | undefined): ShareMeta {
  const url = `${SITE_URL}/blog/${handle}`;
  if (!article?.title) return siteShareMeta(url);
  // 與文章頁相同：店層級舊名稱改寫成 LUCISSI CARE，並優先使用網站文章卡片的編輯圖
  const title = normalizeLegacyStorefrontCopy(article.seo?.title?.trim() || article.title);
  const editorial = editorialShareImage(handle);
  const image = editorial
    ? { url: `${SITE_URL}${editorial}`, width: 1200, height: 630, alt: title }
    : article.image?.url
      ? { url: article.image.url, width: article.image.width, height: article.image.height, alt: normalizeLegacyStorefrontCopy(article.image.altText) || title }
      : SITE_IMAGE;
  return {
    title: `${title}｜${SITE_NAME}`,
    description: summarize(normalizeLegacyStorefrontCopy(article.seo?.description?.trim() || article.excerpt || '')) || SITE_DESCRIPTION,
    url,
    type: 'article',
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

async function storefront<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as { data?: T } | null;
  return body?.data ?? null;
}

async function fetchProduct(id: string): Promise<StorefrontProduct | null> {
  const data = await storefront<{ product?: StorefrontProduct | null }>(
    'query ShareProduct($id: ID!) { product(id: $id) { title description seo { title description } featuredImage { url width height altText } } }',
    { id: `gid://shopify/Product/${id}` },
  );
  return data?.product ?? null;
}

async function fetchArticle(handle: string): Promise<StorefrontArticle | null> {
  // Storefront 只能依部落格查單篇文章，而文章分屬不同部落格，所以與文章頁一樣取前 50 篇再比對 handle
  const data = await storefront<{ articles?: { nodes?: StorefrontArticle[] } }>(
    'query ShareArticles($first: Int!) { articles(first: $first) { nodes { title handle excerpt seo { title description } image { url width height altText } tags } } }',
    { first: 50 },
  );
  const article = data?.articles?.nodes?.find((node) => node.handle === handle);
  return article && hasPublicArticleTag(article.tags) ? article : null;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const handle = params.get('article') || '';
  let meta = siteShareMeta();
  // 查不到商品／文章或 Shopify 暫時失敗時，仍回傳站台預設預覽，不讓分享變成空白
  if (PRODUCT_ID.test(id)) {
    meta = productShareMeta(id, await fetchProduct(id).catch(() => null));
  } else if (ARTICLE_HANDLE.test(handle)) {
    meta = articleShareMeta(handle, await fetchArticle(handle).catch(() => null));
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
