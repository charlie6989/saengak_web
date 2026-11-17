import { hasTestProductMarker } from '../../src/domain/testProducts.js';
import { hasPublicArticleTag } from '../../src/domain/storefrontCopy.js';
import { summarizeText, type RobotsDirective } from '../../src/lib/seo.js';
import type { ArticleSeoSource, Crumb, JsonLd, ProductSeoSource } from '../../src/lib/structuredData.js';

/**
 * 伺服器產生的 document head（middleware.ts 使用）。單頁應用的第一份 HTML 原本每頁都一樣；
 * 搜尋引擎與分享預覽只讀這份 HTML，所以先把路由的標題、說明、canonical、Open Graph 與結構化資料寫進去，
 * 並在空的 #root 放一段只給不執行 JavaScript 的爬蟲讀的文字（React 掛載時會整段取代）。
 * 瀏覽器換頁後由 src/lib/documentMeta.ts 更新同一組標籤。所有訪客拿到同一份 HTML。
 * 放在 api/_lib/：底線開頭的目錄不算 Vercel 函式（Hobby 方案 12 個已滿）。import 一律寫 .js 副檔名。
 */

export interface PageLink {
  name: string;
  url: string;
}

/** 給不執行 JavaScript 的爬蟲讀的頁面摘要；React 掛載時會取代。 */
export interface PageFallback {
  heading: string;
  /** 已格式化，例如「NT$680」或「NT$321 – NT$645」。 */
  price?: string;
  summary?: string;
  /** 首頁在前，最後一層是頁面本身（不加連結）。 */
  breadcrumbs: Crumb[];
  links?: PageLink[];
}

export interface HeadImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface DocumentHead {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: RobotsDirective;
  type: 'website' | 'product' | 'article';
  image?: HeadImage;
  jsonLd?: JsonLd[];
  fallback?: PageFallback;
}

const MANAGED_HEAD_TAGS = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="(?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)"[^>]*>\s*/gi,
  /<meta\s+property="og:(?:title|description|type|url|image|image:width|image:height|image:alt)"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<script\s+type="application\/ld\+json"\s+data-seo-jsonld[^>]*>[\s\S]*?<\/script>\s*/gi,
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** <script> 內的 JSON 不能關閉元素或開啟註解。 */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderHeadTags(head: DocumentHead): string {
  const meta = (attribute: 'name' | 'property', key: string, content?: string | number) =>
    content === undefined || content === '' ? '' : `<meta ${attribute}="${key}" content="${escapeHtml(String(content))}" />`;
  return [
    `<title>${escapeHtml(head.title)}</title>`,
    meta('name', 'description', head.description),
    meta('name', 'robots', head.robots),
    `<link rel="canonical" href="${escapeHtml(head.canonicalUrl)}" />`,
    meta('property', 'og:type', head.type),
    meta('property', 'og:url', head.canonicalUrl),
    meta('property', 'og:title', head.title),
    meta('property', 'og:description', head.description),
    meta('property', 'og:image', head.image?.url),
    meta('property', 'og:image:width', head.image?.width),
    meta('property', 'og:image:height', head.image?.height),
    meta('property', 'og:image:alt', head.image?.alt),
    meta('name', 'twitter:card', head.image ? 'summary_large_image' : 'summary'),
    meta('name', 'twitter:title', head.title),
    meta('name', 'twitter:description', head.description),
    meta('name', 'twitter:image', head.image?.url),
    ...(head.jsonLd ?? []).map((item) => `<script type="application/ld+json" data-seo-jsonld>${scriptSafeJson(item)}</script>`),
  ].filter(Boolean).join('\n    ');
}

/** 取代殼層的預設路由標籤；其他 head 元素（字型、圖示、og:site_name 等）不動。 */
export function injectHeadTags(html: string, head: DocumentHead): string {
  const closing = html.search(/<\/head>/i);
  if (closing < 0) throw new Error('Document shell has no </head>.');
  let documentHead = html.slice(0, closing);
  for (const pattern of MANAGED_HEAD_TAGS) documentHead = documentHead.replace(pattern, '');
  return `${documentHead.trimEnd()}\n    ${renderHeadTags(head)}\n  ${html.slice(closing)}`;
}

// 殼層的 #root 是空的；備援內容只會填進這個元素
const EMPTY_ROOT = '<div id="root"></div>';

// 視覺上隱藏：React 掛載時就會取代，顧客不會看到沒有樣式的閃爍，不執行 JavaScript 的爬蟲仍讀得到
const FALLBACK_STYLE = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

export function renderPageFallback(fallback: PageFallback): string {
  const link = (item: { name: string; url?: string }) =>
    item.url ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>` : `<span>${escapeHtml(item.name)}</span>`;
  return [
    `<div data-seo-fallback style="${FALLBACK_STYLE}">`,
    fallback.breadcrumbs.length ? `<nav aria-label="路徑導覽">${fallback.breadcrumbs.map(link).join(' › ')}</nav>` : '',
    `<h1>${escapeHtml(fallback.heading)}</h1>`,
    fallback.price ? `<p>${escapeHtml(fallback.price)}</p>` : '',
    fallback.summary ? `<p>${escapeHtml(fallback.summary)}</p>` : '',
    fallback.links?.length ? `<ul>${fallback.links.map((item) => `<li>${link(item)}</li>`).join('')}</ul>` : '',
    '</div>',
  ].join('');
}

/** 把爬蟲備援內容填進殼層空的 #root；createRoot().render() 掛載時會清掉。 */
export function injectPageFallback(html: string, fallback?: PageFallback): string {
  return fallback && html.includes(EMPTY_ROOT)
    ? html.replace(EMPTY_ROOT, () => `<div id="root">${renderPageFallback(fallback)}</div>`)
    : html;
}

export interface StorefrontOptions {
  domain: string;
  token: string;
  apiVersion: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type GraphRecord = Record<string, unknown>;
const record = (value: unknown): GraphRecord => (value && typeof value === 'object' ? value as GraphRecord : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const amount = (value: unknown): number => {
  const parsed = Number.parseFloat(text(record(value).amount));
  return Number.isFinite(parsed) ? parsed : 0;
};
const nodes = (value: unknown): GraphRecord[] => {
  const list = record(value).nodes;
  return Array.isArray(list) ? list.map(record) : [];
};
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

/** 只讀公開欄位；Shopify 回答失敗或格式不對時 throw，由呼叫端退回路由預設值（不當作商品不存在）。 */
async function storefrontQuery(options: StorefrontOptions, query: string, variables: Record<string, unknown>): Promise<GraphRecord> {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(options.domain)) throw new Error('Invalid store domain.');
  const response = await (options.fetchImpl ?? fetch)(`https://${options.domain}/api/${options.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': options.token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 1500),
  });
  const payload = record(await response.json().catch(() => null));
  if (!response.ok || (Array.isArray(payload.errors) && payload.errors.length) || !payload.data) {
    throw new Error('Storefront lookup failed.');
  }
  return record(payload.data);
}

const PRODUCT_FIELDS = `id title handle description vendor productType tags availableForSale
  seo { title description }
  featuredImage { url width height altText }
  images(first: 5) { nodes { url } }
  priceRange { minVariantPrice { amount } }
  variants(first: 50) { nodes { sku availableForSale price { amount } } }`;

export interface ProductSeoRecord extends ProductSeoSource {
  numericId: string;
  handle: string;
  featuredImage?: HeadImage;
  /** 給爬蟲備援內容的較長摘要。 */
  summary: string;
}

/** 與網站商品頁的 formatShopifyProduct 相同欄位對應，讓伺服器與瀏覽器算出相同的 head。 */
export function toProductSeoRecord(node: GraphRecord): ProductSeoRecord | null {
  const numericId = text(node.id).match(/^gid:\/\/shopify\/Product\/(\d{1,20})$/)?.[1];
  const name = text(node.title);
  if (!numericId || !name) return null;
  const tags = strings(node.tags);
  const handle = text(node.handle);
  // 內部驗收商品在網站上視同不存在
  if (hasTestProductMarker([name, handle, text(node.vendor), ...tags])) return null;
  const seo = record(node.seo);
  const featured = record(node.featuredImage);
  const images = nodes(node.images).map((image) => ({ url: text(image.url) })).filter((image) => image.url);
  const description = text(node.description);
  return {
    id: text(node.id),
    numericId,
    handle,
    name,
    description,
    seoTitle: text(seo.title).trim() || undefined,
    seoDescription: text(seo.description).trim() || undefined,
    price: amount(record(node.priceRange).minVariantPrice),
    image: images[0]?.url,
    images,
    vendor: text(node.vendor),
    productType: text(node.productType),
    tags,
    availableForSale: node.availableForSale !== false,
    variants: nodes(node.variants).map((variant) => ({
      sku: text(variant.sku),
      availableForSale: variant.availableForSale !== false,
      price: amount(variant.price),
    })),
    featuredImage: text(featured.url).startsWith('https://')
      ? {
          url: text(featured.url),
          width: typeof featured.width === 'number' ? featured.width : undefined,
          height: typeof featured.height === 'number' ? featured.height : undefined,
          alt: text(featured.altText) || name,
        }
      : undefined,
    summary: summarizeText(description, 300),
  };
}

/** 依數字 ID 或 handle 查商品。商品不存在（或是內部驗收商品）回傳 null；不確定時 throw。 */
export async function fetchProductSeo(
  ref: { id: string } | { handle: string },
  options: StorefrontOptions,
): Promise<ProductSeoRecord | null> {
  const byId = 'id' in ref;
  if (byId && !/^\d{1,20}$/.test(ref.id)) return null;
  const data = await storefrontQuery(
    options,
    byId
      ? `query ProductSeo($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`
      : `query ProductSeoByHandle($handle: String!) { product(handle: $handle) { ${PRODUCT_FIELDS} } }`,
    byId ? { id: `gid://shopify/Product/${ref.id}` } : { handle: ref.handle },
  );
  if (!('product' in data)) throw new Error('Storefront lookup failed.');
  return data.product ? toProductSeoRecord(record(data.product)) : null;
}

export interface ArticleSeoRecord extends ArticleSeoSource {
  tags: string[];
}

/** 帶公開標籤的 Shopify 文章（與文章頁相同，取前 50 篇）。Shopify 失敗時 throw。 */
export async function fetchPublicArticles(options: StorefrontOptions): Promise<ArticleSeoRecord[]> {
  const data = await storefrontQuery(
    options,
    'query SeoArticles($first: Int!) { articles(first: $first) { nodes { title handle excerpt publishedAt seo { title description } image { url altText } tags } } }',
    { first: 50 },
  );
  if (!('articles' in data)) throw new Error('Storefront lookup failed.');
  return nodes(data.articles).flatMap((node) => {
    const tags = strings(node.tags);
    const title = text(node.title);
    const handle = text(node.handle);
    if (!title || !handle || !hasPublicArticleTag(tags)) return [];
    const seo = record(node.seo);
    const image = record(node.image);
    return [{
      title,
      handle,
      excerpt: text(node.excerpt),
      publishedAt: text(node.publishedAt) || undefined,
      seoTitle: text(seo.title).trim() || undefined,
      seoDescription: text(seo.description).trim() || undefined,
      image: text(image.url) ? { url: text(image.url), altText: text(image.altText) } : null,
      tags,
    }];
  });
}

export interface ListingProduct {
  numericId: string;
  name: string;
  productType?: string;
  tags: string[];
}

/** 列表頁與首頁備援內容的商品連結：一次輕量查詢（只取名稱與分類欄位），排除內部驗收商品。 */
export async function fetchListingProducts(options: StorefrontOptions, first = 60): Promise<ListingProduct[]> {
  const data = await storefrontQuery(
    options,
    'query SeoListing($first: Int!) { products(first: $first, sortKey: BEST_SELLING) { nodes { id title handle vendor productType tags } } }',
    { first },
  );
  if (!('products' in data)) throw new Error('Storefront lookup failed.');
  return nodes(data.products).flatMap((node) => {
    const numericId = text(node.id).match(/^gid:\/\/shopify\/Product\/(\d{1,20})$/)?.[1];
    const name = text(node.title).trim();
    const tags = strings(node.tags);
    if (!numericId || !name || hasTestProductMarker([name, text(node.handle), text(node.vendor), ...tags])) return [];
    return [{ numericId, name, productType: text(node.productType), tags }];
  });
}
