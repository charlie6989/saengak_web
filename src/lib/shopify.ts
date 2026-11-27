import { createStorefrontApiClient, type StorefrontApiClient } from '@shopify/storefront-api-client';
import { normalizeSizeChart, type SizeChart } from '../domain/sizeChart';
import { captureExceptionSafe } from './sentry';
import { isNonSaengakOwnBrandProduct, resolveDisplayVendor } from './brandOwnership';
import { hasTestProductMarker } from '../domain/testProducts';
import { articleBylineAuthor, hasPublicArticleTag, normalizeLegacyStorefrontCopy } from '../domain/storefrontCopy';
import { CURATED_ARTICLES, type CuratedArticle } from '../content/curatedArticles';

/**
 * Shopify Storefront GraphQL API Client
 * 依據 docs/00_DECISION_LOG.md 權威決策：前端商品與分類直接對接 Shopify Storefront API
 * 採用官方 @shopify/storefront-api-client SDK 實作 (純前端安全公開憑證模式)
 */

function getEnv(key: string, fallback: string = ''): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key] || fallback;
  }
  return fallback;
}
export const SHOPIFY_STORE_DOMAIN = getEnv(
  'VITE_PUBLIC_SHOPIFY_STORE_DOMAIN',
  getEnv('VITE_SHOPIFY_DOMAIN', 'gh2xgs-zf.myshopify.com')
);

export const SHOPIFY_STOREFRONT_PUBLIC_TOKEN = getEnv(
  'VITE_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN',
  getEnv('SHOPIFY_STOREFRONT_ACCESS_TOKEN', '9862bdf1a7178bd589dd83a130a3e24b')
);

export const SHOPIFY_API_VERSION = getEnv('VITE_PUBLIC_SHOPIFY_API_VERSION', '2026-07');

/**
 * Shopify Storefront 官方 Client 實例
 */
export const storefrontClient: StorefrontApiClient = createStorefrontApiClient({
  storeDomain: SHOPIFY_STORE_DOMAIN.startsWith('http')
    ? SHOPIFY_STORE_DOMAIN
    : `https://${SHOPIFY_STORE_DOMAIN}`,
  apiVersion: SHOPIFY_API_VERSION || '2026-07',
  publicAccessToken: SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
});

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  availableForSale: boolean;
  quantityAvailable?: number;
  sku?: string;
  selectedOptions?: { name: string; value: string }[];
  image?: { url: string; altText?: string };
}

export interface ShopifyProductOption {
  id?: string;
  name: string;
  values: string[];
}

export interface MusinsaFitGuide {
  fit?: string;
  thickness?: string;
  elasticity?: string;
  breathability?: string;
}

export interface CareSpecs {
  volume?: string;
  texture?: string;
  application?: string;
  origin?: string;
  ingredients?: string;
  shelf_life?: string;
  [key: string]: string | undefined;
}

export interface LifestyleShowcaseItem {
  /** Explicitly authored feature rows precede details; legacy rows remain usage content. */
  kind?: 'feature' | 'usage';
  badge: string;
  title: string;
  description: string;
  image?: string;
}

export interface CraftDetailItem {
  category: string;
  title: string;
  description: string;
  image?: string;
}

export interface ShopifyProduct {
  id: string;
  name: string;
  title: string;
  description: string;
  descriptionHtml: string;
  handle: string;
  price: number;
  originalPrice?: number;
  totalInventory?: number;
  image: string;
  hoverImage: string;
  images: { url: string; altText?: string }[];
  tags: string[];
  productType: string;
  vendor: string;
  createdAt: string;
  availableForSale: boolean;
  variants: ShopifyProductVariant[];
  options?: ShopifyProductOption[];
  highlights?: string[];
  subtitle?: string;
  promotionBadge?: string;
  fitGuide?: MusinsaFitGuide;
  sizeChart?: SizeChart;
  careSpecs?: CareSpecs;
  careInstructions?: string[];
  lifestyleShowcase?: LifestyleShowcaseItem[];
  craftDetails?: CraftDetailItem[];
  /** Shopify「搜尋引擎清單」的 SEO 標題／說明；未填時為 undefined */
  seoTitle?: string;
  seoDescription?: string;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string | null;
}

export interface ShopifyArticle {
  id: string;
  title: string;
  handle: string;
  excerpt?: string;
  contentHtml?: string;
  publishedAt: string;
  image?: { url: string; altText?: string } | null;
  blog?: { handle: string; title?: string } | null;
  author?: string;
  tags?: string[];
  /** Shopify 後台「搜尋引擎清單」的 SEO 標題／說明（文章頁的 head 優先使用）。 */
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * 將 Shopify 文章的舊商店層級文案正規化為目前商店名稱。
 * SAENGAK 商品品牌與文章標籤不在此處改寫，避免誤傷品牌歸屬資料。
 */
export function normalizeShopifyArticle(node: any): ShopifyArticle {
  const blogTitle = normalizeLegacyStorefrontCopy(node?.blog?.title);

  return {
    id: node?.id || '',
    title: normalizeLegacyStorefrontCopy(node?.title),
    handle: node?.handle || '',
    excerpt: normalizeLegacyStorefrontCopy(node?.excerpt || ''),
    contentHtml: normalizeLegacyStorefrontCopy(node?.contentHtml || ''),
    publishedAt: node?.publishedAt || '',
    image: node?.image
      ? { url: node.image.url, altText: normalizeLegacyStorefrontCopy(node.image.altText) }
      : null,
    blog: node?.blog
      ? {
          handle: node.blog.handle,
          title: blogTitle,
        }
      : null,
    author: articleBylineAuthor(node?.authorV2?.name),
    tags: (node?.tags || []).map((tag: unknown) =>
      typeof tag === 'string' && tag.trim().toUpperCase() === 'SAENGAK' ? 'LUCISSI CARE' : String(tag),
    ),
    seoTitle: (node?.seo?.title || '').trim() || undefined,
    seoDescription: (node?.seo?.description || '').trim() || undefined,
  };
}

/**
 * 智慧解析商品重點亮點 (Highlights / Bullet Points)
 * 優先讀取 Shopify Metafield (custom.highlights)，若無則自 descriptionHtml 萃取商品特色清單
 */
function parseProductHighlights(metafieldValue: any, descriptionHtml: string): string[] | undefined {
  if (metafieldValue) {
    if (typeof metafieldValue === 'string') {
      try {
        const parsed = JSON.parse(metafieldValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map((item: any) => String(item).trim()).filter(Boolean);
          if (list.length > 0) return list;
        }
      } catch {
        const split = metafieldValue.split(/[\n\r|]+/).map((s: string) => s.trim()).filter(Boolean);
        if (split.length > 0) return split;
      }
    } else if (Array.isArray(metafieldValue) && metafieldValue.length > 0) {
      return metafieldValue.map((item: any) => String(item).trim()).filter(Boolean);
    }
  }

  // 智慧 Fallback：從 HTML 描述中的 <li> 標籤萃取特色重點
  if (descriptionHtml) {
    const liMatches = descriptionHtml.match(/<li>[\s\S]*?<\/li>/gi);
    if (liMatches && liMatches.length > 0) {
      const extracted: string[] = [];
      for (const li of liMatches) {
        const clean = li
          .replace(/<\/?(?:li|strong|b|span|p|em)[^>]*>/gi, '')
          .replace(/^[\s\n\r\t•\-✓✔\u2022]+/g, '')
          .trim();
        if (clean && clean.length > 2 && clean.length < 90) {
          if (
            !clean.startsWith('商品品類') &&
            !clean.startsWith('包裝規格') &&
            !clean.startsWith('適用對象') &&
            !clean.startsWith('商品規格') &&
            !clean.startsWith('商品材質')
          ) {
            extracted.push(clean);
          }
        }
      }
      if (extracted.length > 0) {
        return extracted.slice(0, 5);
      }
    }
  }

  return undefined;
}

/**
 * 執行 Storefront GraphQL 查詢 (封裝官方 SDK request)
 */
export async function shopifyFetch<T = any>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<T> {
  const response = await storefrontClient.request<T>(query, {
    variables,
  });

  if (response.errors) {
    const errorMsg = response.errors.graphQLErrors
      ? response.errors.graphQLErrors.map((e: any) => e.message).join(', ')
      : response.errors.message || 'Unknown GraphQL Error';
    throw new Error(`Shopify GraphQL Error: ${errorMsg}`);
  }

  return response.data as T;
}

/**
 * 將 Shopify GraphQL 原始商品節點轉換為前端相容的 Product 介面
 */
export function formatShopifyProduct(node: any): ShopifyProduct {
  if (!node) {
    throw new Error('Cannot format null product node');
  }

  const price = parseFloat(node.priceRange?.minVariantPrice?.amount || '0');
  const compareAtPrice = parseFloat(node.compareAtPriceRange?.minVariantPrice?.amount || '0');
  const images = (node.images?.edges || []).map((e: any) => ({
    url: e.node?.url || '',
    altText: e.node?.altText || node.title || '',
  })).filter((img: { url: string }) => Boolean(img.url));

  const variants: ShopifyProductVariant[] = (node.variants?.edges || []).map((e: any) => ({
    id: e.node?.id || '',
    title: e.node?.title || '',
    price: parseFloat(e.node?.price?.amount || '0'),
    compareAtPrice: e.node?.compareAtPrice ? parseFloat(e.node.compareAtPrice.amount) : undefined,
    availableForSale: e.node?.availableForSale ?? true,
    quantityAvailable: typeof e.node?.quantityAvailable === 'number' ? e.node.quantityAvailable : undefined,
    sku: e.node?.sku || '',
    selectedOptions: e.node?.selectedOptions || [],
    image: e.node?.image?.url ? { url: e.node.image.url, altText: e.node.image.altText || '' } : undefined,
  }));

  const options: ShopifyProductOption[] = (node.options || []).map((opt: any) => ({
    id: opt.id,
    name: opt.name,
    values: Array.isArray(opt.values) ? opt.values : [],
  }));

  // 沒有商品圖時留空，由各元件顯示底色，不放與商品無關的圖庫照片
  const fallbackImage = '';

  // 建立 metafield lookup map，相容單一欄位 query 與批次 identifiers query
  const metafieldMap = new Map<string, any>();
  if (Array.isArray(node.metafields)) {
    node.metafields.forEach((m: any) => {
      if (m && m.key) {
        metafieldMap.set(`${m.namespace || 'custom'}.${m.key}`, m);
        metafieldMap.set(m.key, m);
      }
    });
  }
  const getMeta = (key: string, directMeta: any) => {
    return directMeta?.value || metafieldMap.get(key)?.value || metafieldMap.get(`custom.${key}`)?.value;
  };

  const highlights = parseProductHighlights(getMeta('highlights', node.highlights), node.descriptionHtml || '');
  const subtitle = (getMeta('subtitle', node.subtitle) || '').trim() || undefined;
  const promotionBadge = (getMeta('promotion_badge', node.promotionBadge) || '').trim() || undefined;

  const parseJsonMetafield = <T>(val: string | undefined): T | undefined => {
    if (!val) return undefined;
    try {
      return JSON.parse(val) as T;
    } catch {
      return undefined;
    }
  };

  const fitGuide = parseJsonMetafield<MusinsaFitGuide>(getMeta('fit_guide', node.fitGuide));
  const sizeChart = normalizeSizeChart(parseJsonMetafield<unknown>(getMeta('size_chart', node.sizeChart)));
  const careSpecs = parseJsonMetafield<CareSpecs>(getMeta('care_specs', node.careSpecs));
  const careInstructions = parseJsonMetafield<string[]>(getMeta('care_instructions', node.careInstructions));
  const lifestyleShowcase = parseJsonMetafield<LifestyleShowcaseItem[]>(getMeta('lifestyle_showcase', node.lifestyleShowcase));
  const craftDetails = parseJsonMetafield<CraftDetailItem[]>(getMeta('craft_details', node.craftDetails));

  return {
    id: node.id || '',
    name: node.title || '',
    title: node.title || '',
    description: node.description || '',
    descriptionHtml: node.descriptionHtml || '',
    handle: node.handle || '',
    price: price,
    originalPrice: compareAtPrice > price ? compareAtPrice : undefined,
    totalInventory: typeof node.totalInventory === 'number' ? node.totalInventory : undefined,
    image: images[0]?.url || fallbackImage,
    hoverImage: images[1]?.url || images[0]?.url || fallbackImage,
    images,
    tags: (() => {
      const rawTags = node.tags || [];
      // 內著／周邊商品嚴禁攜帶 SAENGAK 標籤，分類判斷統一交由 brandOwnership 共用模組處理
      return isNonSaengakOwnBrandProduct({ productType: node.productType, title: node.title })
        ? rawTags.filter((t: string) => t.toUpperCase() !== 'SAENGAK')
        : rawTags;
    })(),
    productType: node.productType || '',
    // 僅做資料正規化（濾除 Shopify 佔位店名 'My Store 7'，並防止內著／周邊商品殘留 SAENGAK 字樣），
    // 不套用 SAENGAK fallback——是否顯示 SAENGAK 由各展示元件依情境自行決定
    vendor: resolveDisplayVendor(
      { productType: node.productType, title: node.title, vendor: node.vendor },
      { allowSaengakFallbackForOwnBrand: false }
    ),
    createdAt: node.createdAt || new Date().toISOString(),
    availableForSale: node.availableForSale ?? true,
    variants,
    options,
    highlights,
    subtitle,
    promotionBadge,
    fitGuide,
    sizeChart,
    careSpecs,
    careInstructions,
    lifestyleShowcase,
    craftDetails,
    seoTitle: (node.seo?.title || '').trim() || undefined,
    seoDescription: (node.seo?.description || '').trim() || undefined,
  };
}

// 權威決策：全站嚴格僅展示 SAENGAK 核心私密保養商品，排除其他非相關商品
export const CORE_SAENGAK_KEYWORDS = [
  '深層修護私密清潔露',
  '私密雙層修護精華噴霧',
  '益生菌私密養膚濕巾',
  '平衡調理私密潔淨慕斯',
  '益生菌私密舒緩凝膠',
  'deep-repair-wash',
  'calming-mist',
  'refreshing-wipes',
  'cleansing-mousse',
  'soothing-gel',
];

export const FEATURED_PRODUCT_TAG_PATTERN = /^(featured|精選|精選商品|featured[-_]?product|人氣推薦)$/i;

/**
 * 智慧識別是否為精選商品（優先讀取 Shopify Tags 標籤）
 */
export function isFeaturedShopifyProduct(product: ShopifyProduct): boolean {
  const tags = Array.isArray(product.tags) ? product.tags : [];
  return tags.some((tag) => typeof tag === 'string' && FEATURED_PRODUCT_TAG_PATTERN.test(tag.trim()));
}

export function isPublicShopifyProduct(product: ShopifyProduct): boolean {
  return !hasTestProductMarker([product.title, product.name, product.handle, product.vendor, ...(product.tags || [])]);
}


export function isPublicShopifyArticle(article: ShopifyArticle): boolean {
  return hasPublicArticleTag(article.tags);
}

const PRODUCT_FRAGMENT = `
  id
  title
  description
  descriptionHtml
  seo {
    title
    description
  }
  handle
  availableForSale
  totalInventory
  productType
  vendor
  tags
  createdAt
  highlights: metafield(namespace: "custom", key: "highlights") {
    value
    type
  }
  subtitle: metafield(namespace: "custom", key: "subtitle") {
    value
    type
  }
  promotionBadge: metafield(namespace: "custom", key: "promotion_badge") {
    value
    type
  }
  fitGuide: metafield(namespace: "custom", key: "fit_guide") {
    value
    type
  }
  sizeChart: metafield(namespace: "custom", key: "size_chart") {
    value
    type
  }
  careSpecs: metafield(namespace: "custom", key: "care_specs") {
    value
    type
  }
  careInstructions: metafield(namespace: "custom", key: "care_instructions") {
    value
    type
  }
  lifestyleShowcase: metafield(namespace: "custom", key: "lifestyle_showcase") {
    value
    type
  }
  craftDetails: metafield(namespace: "custom", key: "craft_details") {
    value
    type
  }
  metafields(identifiers: [
    { namespace: "custom", key: "highlights" },
    { namespace: "custom", key: "subtitle" },
    { namespace: "custom", key: "promotion_badge" },
    { namespace: "custom", key: "fit_guide" },
    { namespace: "custom", key: "size_chart" },
    { namespace: "custom", key: "care_specs" },
    { namespace: "custom", key: "care_instructions" },
    { namespace: "custom", key: "lifestyle_showcase" },
    { namespace: "custom", key: "craft_details" }
  ]) {
    namespace
    key
    value
    type
  }
  options {
    id
    name
    values
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  images(first: 20) {
    edges {
      node {
        url
        altText
      }
    }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        sku
        availableForSale
        quantityAvailable
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
        selectedOptions {
          name
          value
        }
        image {
          url
          altText
        }
      }
    }
  }
`;

/**
 * 取得商品列表 (支援依標籤、關鍵字查詢、排序，或直接傳入數量數字)
 */
export async function getShopifyProducts(optionsOrFirst: number | {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
} = {}): Promise<ShopifyProduct[]> {
  const options = typeof optionsOrFirst === 'number' ? { first: optionsOrFirst } : optionsOrFirst;
  const { first = 24, query = '', sortKey = 'BEST_SELLING', reverse = false } = options;

  const gqlQuery = `
    query GetProducts($first: Int!, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
      products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            ${PRODUCT_FRAGMENT}
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<{ products: { edges: { node: any }[] } }>({
    query: gqlQuery,
    variables: { first, query: query || null, sortKey, reverse },
  });

  return (data.products?.edges || [])
    .map((edge) => formatShopifyProduct(edge.node))
    .filter(isPublicShopifyProduct);
}

/**
 * 依 ID (純數字 ID、Shopify GID) 或 Handle 查詢商品
 */
export type ProductLookup =
  | { status: 'found'; product: ShopifyProduct }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/**
 * 依數字 ID、GID 或 handle 取得單一商品，並區分「確定不存在」與「暫時讀不到」。
 * Shopify 查詢失敗時不能斷定商品不存在，商品頁不可因此設成 noindex（規則見 src/lib/servedDocument.ts）。
 */
export async function lookupShopifyProduct(idOrHandle: string): Promise<ProductLookup> {
  if (!idOrHandle) return { status: 'not-found' };

  const trimmed = decodeURIComponent(idOrHandle.trim());
  const gidMatch = trimmed.match(/(\d+)$/);
  const isNumeric = /^\d+$/.test(trimmed) || (trimmed.includes('gid:') && Boolean(gidMatch));
  const numericId = gidMatch ? gidMatch[1] : trimmed;
  let failed = false;

  if (isNumeric) {
    const gid = `gid://shopify/Product/${numericId}`;
    try {
      const gqlQuery = `
        query GetProductById($id: ID!) {
          node(id: $id) {
            ... on Product {
              ${PRODUCT_FRAGMENT}
            }
          }
        }
      `;
      const data = await shopifyFetch<{ node: any }>({
        query: gqlQuery,
        variables: { id: gid },
      });

      if (data.node) {
        const product = formatShopifyProduct(data.node);
        return isPublicShopifyProduct(product) ? { status: 'found', product } : { status: 'not-found' };
      }
    } catch (err) {
      // ID 查詢失敗，繼續嘗試 handle；兩者都沒有結果時回報暫時讀不到
      console.warn('Storefront product lookup by id failed:', err);
      failed = true;
    }
  }

  const byHandle = await lookupShopifyProductByHandle(trimmed);
  if (byHandle.status === 'not-found' && failed) return { status: 'unavailable' };
  return byHandle;
}

/**
 * 依數字 ID、GID 或 handle 取得單一商品；找不到或暫時讀不到都回 null。
 * 需要決定 robots 時請用 lookupShopifyProduct。
 */
export async function getShopifyProduct(idOrHandle: string): Promise<ShopifyProduct | null> {
  const result = await lookupShopifyProduct(idOrHandle);
  return result.status === 'found' ? result.product : null;
}

async function lookupShopifyProductByHandle(handle: string): Promise<ProductLookup> {
  if (!handle) return { status: 'not-found' };

  const gqlQuery = `
    query GetProductByHandle($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_FRAGMENT}
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ product: any }>({
      query: gqlQuery,
      variables: { handle },
    });

    if (!data.product) return { status: 'not-found' };
    const product = formatShopifyProduct(data.product);
    return isPublicShopifyProduct(product) ? { status: 'found', product } : { status: 'not-found' };
  } catch (err) {
    console.warn('Storefront product lookup by handle failed:', err);
    return { status: 'unavailable' };
  }
}

/**
 * 依 Handle 取得單一商品詳情
 */
export async function getShopifyProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const result = await lookupShopifyProductByHandle(handle);
  return result.status === 'found' ? result.product : null;
}

/**
 * 依多個 ID (GID 或數字 ID) 批次取得商品
 */
export async function getShopifyProductsByIds(ids: string[]): Promise<ShopifyProduct[]> {
  if (!ids || ids.length === 0) return [];

  const gids = ids.map((id) => {
    const numMatch = id.match(/(\d+)$/);
    return numMatch ? `gid://shopify/Product/${numMatch[1]}` : (id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`);
  });

  const gqlQuery = `
    query GetProductsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          ${PRODUCT_FRAGMENT}
        }
      }
    }
  `;

  const data = await shopifyFetch<{ nodes: any[] }>({
    query: gqlQuery,
    variables: { ids: gids },
  });

  return (data.nodes || [])
    .filter((node) => node && node.id)
    .map((node) => formatShopifyProduct(node))
    .filter(isPublicShopifyProduct);
}

/**
 * 依標籤查詢商品列表
 */
export async function getShopifyProductsByTags(
  tags: string[],
  options: {
    first?: number;
    sortKey?: string;
    reverse?: boolean;
  } = {}
): Promise<ShopifyProduct[]> {
  if (!tags || tags.length === 0) return [];

  const tagQuery = tags.map((t) => `tag:'${t}'`).join(' OR ');
  return getShopifyProducts({
    first: options.first || 24,
    query: tagQuery,
    sortKey: options.sortKey || 'BEST_SELLING',
    reverse: options.reverse || false,
  });
}

/**
 * 取得所有分類列表
 */
export async function getShopifyCollections(first: number = 20): Promise<ShopifyCollection[]> {
  const gqlQuery = `
    query GetCollections($first: Int!) {
      collections(first: $first) {
        edges {
          node {
            id
            title
            handle
            description
            image {
              url
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<{ collections: { edges: { node: any }[] } }>({
    query: gqlQuery,
    variables: { first },
  });

  return (data.collections?.edges || []).map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    handle: edge.node.handle,
    description: edge.node.description || '',
    image: edge.node.image?.url || null,
  }));
}

/**
 * 依 Handle 取得分類詳情與所屬商品
 */
export async function getShopifyCollectionByHandle(
  handle: string,
  options: { first?: number } = {}
): Promise<{ collection: ShopifyCollection | null; products: ShopifyProduct[] }> {
  const { first = 24 } = options;

  const gqlQuery = `
    query GetCollectionByHandle($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        id
        title
        handle
        description
        image {
          url
        }
        products(first: $first) {
          edges {
            node {
              ${PRODUCT_FRAGMENT}
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<{ collection: any }>({
    query: gqlQuery,
    variables: { handle, first },
  });

  if (!data.collection) {
    return { collection: null, products: [] };
  }

  const collection: ShopifyCollection = {
    id: data.collection.id,
    title: data.collection.title,
    handle: data.collection.handle,
    description: data.collection.description || '',
    image: data.collection.image?.url || null,
  };

  const products = (data.collection.products?.edges || []).map((edge: any) =>
    formatShopifyProduct(edge.node)
  ).filter(isPublicShopifyProduct);

  return { collection, products };
}

/**
 * 取得官方部落格文章列表 (含展示備案)
 */
export async function getShopifyArticles(first: number = 6): Promise<ShopifyArticle[]> {
  try {
    const gqlQuery = `
      query GetArticles($first: Int!) {
        articles(first: $first) {
          edges {
            node {
              id
              title
              handle
              excerpt
              contentHtml
              publishedAt
              image {
                url
                altText
              }
              blog {
                handle
                title
              }
              authorV2 {
                name
              }
              tags
              seo {
                title
                description
              }
            }
          }
        }
      }
    `;

    const data = await shopifyFetch<{ articles: { edges: { node: any }[] } }>({
      query: gqlQuery,
      variables: { first },
    });

    const articles: ShopifyArticle[] = (data.articles?.edges || [])
      .map((edge) => normalizeShopifyArticle(edge.node))
      .filter(isPublicShopifyArticle);

    if (articles.length > 0) {
      return articles;
    }
  } catch (err) {
    console.warn('Storefront articles query failed, using curated fallback:', err);
    captureExceptionSafe(err, { source: 'getShopifyArticles', fallback: 'curatedArticles' });
  }

  // Shopify 文章必須明確標記 SAENGAK／公開／public 才能進正式站。
  // 沒有合格文章時使用已審視、不含身份或療效宣稱的站內內容。
  return CURATED_ARTICLES.map(copyCuratedArticle);
}

/**
 * 依 handle 查文章的結果。
 * - found：找到公開文章
 * - not-found：Shopify 有回應，網站公開的文章裡確定沒有這篇
 * - unavailable：Shopify 讀取失敗，站內精選文章裡也沒有；不能斷定文章不存在
 */
export type ArticleLookup =
  | { status: 'found'; article: ShopifyArticle }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/**
 * 依 Handle 取得單一部落格文章詳情，並區分「確定不存在」與「暫時讀不到」。
 * 規則與 middleware 的 articleHead 相同：Shopify 沒有回應時不能斷定文章不存在，頁面不可因此設成 noindex。
 */
export async function lookupShopifyArticleByHandle(handle: string): Promise<ArticleLookup> {
  if (!handle) return { status: 'not-found' };

  let shopifyArticles: ShopifyArticle[] | null = null;
  try {
    const gqlQuery = `
      query GetArticlesForHandle($first: Int!) {
        articles(first: $first) {
          edges {
            node {
              id
              title
              handle
              excerpt
              contentHtml
              publishedAt
              image {
                url
                altText
              }
              blog {
                handle
                title
              }
              authorV2 {
                name
              }
              tags
              seo {
                title
                description
              }
            }
          }
        }
      }
    `;

    const data = await shopifyFetch<{ articles?: { edges: { node: any }[] } }>({
      query: gqlQuery,
      variables: { first: 50 },
    });
    if (!data?.articles) throw new Error('Storefront articles lookup returned no articles field.');

    shopifyArticles = (data.articles.edges || [])
      .map((edge) => normalizeShopifyArticle(edge.node))
      .filter(isPublicShopifyArticle);
  } catch (err) {
    console.warn('Storefront getShopifyArticleByHandle query failed:', err);
    captureExceptionSafe(err, { source: 'getShopifyArticleByHandle', fallback: 'curatedArticles' });
  }

  // 網站公開的文章：有公開的 Shopify 文章時只用它們，否則（含讀取失敗）用站內精選文章；middleware 與 sitemap 用同一規則
  const publicArticles = shopifyArticles?.length ? shopifyArticles : CURATED_ARTICLES.map(copyCuratedArticle);
  const found = publicArticles.find((a) => a.handle === handle || a.id === handle);
  if (found) return { status: 'found', article: found };
  return shopifyArticles ? { status: 'not-found' } : { status: 'unavailable' };
}

/**
 * 依 Handle 取得單一部落格文章詳情；找不到或暫時讀不到都回 null。
 * 需要決定 robots 時請用 lookupShopifyArticleByHandle。
 */
export async function getShopifyArticleByHandle(handle: string): Promise<ShopifyArticle | null> {
  const result = await lookupShopifyArticleByHandle(handle);
  return result.status === 'found' ? result.article : null;
}

function copyCuratedArticle(article: CuratedArticle): ShopifyArticle {
  return { ...article, image: { ...article.image }, blog: { ...article.blog }, tags: [...article.tags] };
}

export interface CartVariantCheckItem {
  id: string;
  variantId?: string;
  variantTitle?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  originalPrice?: number;
}

export interface CartStockCheckResult<T extends CartVariantCheckItem = CartVariantCheckItem> {
  validItems: T[];
  removedItems: { name: string; variantTitle?: string }[];
}

/**
 * 批次查驗購物車中所有商品的即時可售庫存 (availableForSale)
 * 若有規格已售完，自動分離出有效與被移除清單
 */
export async function checkCartVariantsAvailability<T extends CartVariantCheckItem>(
  items: T[]
): Promise<CartStockCheckResult<T>> {
  if (!items || items.length === 0) {
    return { validItems: [], removedItems: [] };
  }

  const variantIds = items
    .map((item) => item.variantId)
    .filter((id): id is string => Boolean(id));

  if (variantIds.length === 0) {
    return { validItems: items, removedItems: [] };
  }

  const gids = Array.from(
    new Set(
      variantIds.map((id) => (id.startsWith('gid://') ? id : `gid://shopify/ProductVariant/${id}`))
    )
  );

  const gqlQuery = `
    query CheckVariantsAvailability($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          availableForSale
          title
        }
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ nodes: any[] }>({
      query: gqlQuery,
      variables: { ids: gids },
    });

    const availabilityMap = new Map<string, boolean>();
    (data.nodes || []).forEach((node) => {
      if (node && node.id) {
        availabilityMap.set(node.id, Boolean(node.availableForSale));
      }
    });

    const validItems: T[] = [];
    const removedItems: { name: string; variantTitle?: string }[] = [];

    for (const item of items) {
      if (!item.variantId) {
        validItems.push(item);
        continue;
      }

      const gid = item.variantId.startsWith('gid://')
        ? item.variantId
        : `gid://shopify/ProductVariant/${item.variantId}`;

      if (availabilityMap.has(gid) && availabilityMap.get(gid) === false) {
        removedItems.push({
          name: item.name,
          variantTitle: item.variantTitle,
        });
      } else {
        validItems.push(item);
      }
    }

    return { validItems, removedItems };
  } catch (err) {
    console.warn('Shopify Storefront checkCartVariantsAvailability failed:', err);
    captureExceptionSafe(err, { source: 'checkCartVariantsAvailability' });
    return { validItems: items, removedItems: [] };
  }
}
