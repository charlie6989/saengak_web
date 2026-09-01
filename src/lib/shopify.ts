import { createStorefrontApiClient, type StorefrontApiClient } from '@shopify/storefront-api-client';
import { captureExceptionSafe } from './sentry';

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

  const fallbackImage = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800';

  const highlights = parseProductHighlights(node.highlights?.value, node.descriptionHtml || '');
  const subtitle = node.subtitle?.value?.trim() || undefined;
  const promotionBadge = node.promotionBadge?.value?.trim() || undefined;

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
    tags: node.tags || [],
    productType: node.productType || '',
    vendor: node.vendor || 'SAENGAK',
    createdAt: node.createdAt || new Date().toISOString(),
    availableForSale: node.availableForSale ?? true,
    variants,
    options,
    highlights,
    subtitle,
    promotionBadge,
  };
}

const TEST_PRODUCT_PATTERN = /驗收測試|請勿購買|測試商品|payment\s*test|test\s*product/i;

export function isPublicShopifyProduct(product: ShopifyProduct): boolean {
  const searchable = [product.title, product.handle, product.vendor, ...product.tags].join(' ');
  return !TEST_PRODUCT_PATTERN.test(searchable);
}

export function isPublicShopifyArticle(article: ShopifyArticle): boolean {
  return (article.tags || []).some((tag) => /^(saengak|公開|public)$/i.test(tag.trim()));
}

const PRODUCT_FRAGMENT = `
  id
  title
  description
  descriptionHtml
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
export async function getShopifyProduct(idOrHandle: string): Promise<ShopifyProduct | null> {
  if (!idOrHandle) return null;

  const trimmed = idOrHandle.trim();
  const isGid = trimmed.startsWith('gid://shopify/Product/');
  const isNumeric = /^\d+$/.test(trimmed);

  if (isGid || isNumeric) {
    const gid = isGid ? trimmed : `gid://shopify/Product/${trimmed}`;
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
        return isPublicShopifyProduct(product) ? product : null;
      }
    } catch {
      // 若 ID 查詢未果，繼續嘗試 handle
    }
  }

  return getShopifyProductByHandle(trimmed);
}

/**
 * 依 Handle 取得單一商品詳情
 */
export async function getShopifyProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  if (!handle) return null;

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

    if (!data.product) return null;
    const product = formatShopifyProduct(data.product);
    return isPublicShopifyProduct(product) ? product : null;
  } catch {
    return null;
  }
}

/**
 * 依多個 ID (GID 或數字 ID) 批次取得商品
 */
export async function getShopifyProductsByIds(ids: string[]): Promise<ShopifyProduct[]> {
  if (!ids || ids.length === 0) return [];

  const gids = ids.map((id) => (id.startsWith('gid://shopify/Product/') ? id : `gid://shopify/Product/${id}`));

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
            }
          }
        }
      }
    `;

    const data = await shopifyFetch<{ articles: { edges: { node: any }[] } }>({
      query: gqlQuery,
      variables: { first },
    });

    const articles: ShopifyArticle[] = (data.articles?.edges || []).map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      excerpt: edge.node.excerpt || '',
      contentHtml: edge.node.contentHtml || '',
      publishedAt: edge.node.publishedAt,
      image: edge.node.image ? { url: edge.node.image.url, altText: edge.node.image.altText } : null,
      blog: edge.node.blog ? { handle: edge.node.blog.handle, title: edge.node.blog.title } : null,
      author: edge.node.authorV2?.name || 'SAENGAK 編輯團隊',
      tags: edge.node.tags || [],
    })).filter(isPublicShopifyArticle);

    if (articles.length > 0) {
      return articles;
    }
  } catch (err) {
    console.warn('Storefront articles query failed, using curated fallback:', err);
    captureExceptionSafe(err, { source: 'getShopifyArticles', fallback: 'curatedArticles' });
  }

  // Shopify 文章必須明確標記 SAENGAK／公開／public 才能進正式站。
  // 沒有合格文章時使用已審視、不含身份或療效宣稱的站內內容。
  return [
    {
      id: 'fallback-article-1',
      title: '日常私密護理：先理解身體，再選擇產品',
      handle: 'daily-feminine-care-guide',
      excerpt: '從溫和清潔、生活習慣到何時應尋求專業協助，建立可長期執行的溫和照護原則。',
      contentHtml: `
<p class="lead text-lg mb-6 leading-relaxed">女性私密肌膚具有獨特的生理結構與自淨微生態。建立正確的日常清潔與生活觀念，能幫助維持舒適清爽的健康狀態。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">一、 理解私密處的微生態平衡</h2>
<p class="mb-4 leading-relaxed">健康的女性私密微環境呈現弱酸性狀態（pH 3.5～4.5），主要由乳酸菌菌群維持平衡，形成天然屏障。維持微生態穩定的核心在於「不破壞自然平衡」，而非過度追求無菌。</p>
<p class="mb-6 leading-relaxed">日常生活中，荷爾蒙波動、作息壓力、衣物不透氣或過度清潔，都可能暫時影響微生態平衡。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">二、 日常清潔的三大溫和守則</h2>
<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">1. 分區清潔，嚴禁灌洗</h3>
<p class="mb-4 leading-relaxed">陰道內部具備自然的自淨機制，<strong>平時切勿灌洗陰道內部</strong>，以免沖洗掉健康的好菌菌群。外陰部則可使用清水或溫和弱酸性潔膚露輕柔洗滌。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">2. 水溫控制與手法輕柔</h3>
<p class="mb-4 leading-relaxed">清潔時水溫建議維持在 37℃～40℃ 溫涼感，避免過熱熱水造成水分流失與乾燥。清潔後以乾淨柔軟的毛巾「輕壓拍乾」，切忌用力摩擦。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">3. 正確的擦拭順序</h3>
<p class="mb-6 leading-relaxed">如廁後的擦拭習慣至關重要，應始終保持<strong>「由前往後」</strong>的擦拭方向，避免將微生物帶至前方敏感區域。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">三、 健康生活與穿著習慣</h2>
<ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
  <li><strong>選擇透氣棉質內著：</strong> 保持局部通風乾燥，減少悶熱環境。</li>
  <li><strong>生理期勤加更換：</strong> 每 2～3 小時更換衛生棉或棉條，保持乾爽。</li>
  <li><strong>作息規律與水分補充：</strong> 充足飲水並避免憋尿，維持良好代謝。</li>
</ul>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">四、 何時應尋求專科醫師協助？</h2>
<p class="mb-6 leading-relaxed">日常護理產品僅供外在潔淨與舒適維持，不具備任何醫療與治療效果。若您發現分泌物顏色、氣味異常（如豆腐渣狀、黃綠色或異味），或伴隨局部紅腫灼熱、排尿不適時，請務必第一時間尋求合格婦產科醫師的專業診斷與協助，切勿自行使用偏方或成藥。</p>

<div class="p-6 rounded-xl my-8 border border-emerald-200 bg-emerald-50/50">
  <p class="text-sm text-emerald-900 leading-relaxed font-medium"><strong>貼心提醒：</strong> 本專欄內容為日常衛生習慣與一般生活衛教分享，不能取代個別醫療診斷。如有任何健康疑問，請諮詢合格專業醫師。</p>
</div>
      `.trim(),
      publishedAt: '2026-09-01T10:37:30Z',
      image: {
        url: '/images/blog/daily-feminine-care-guide.jpg',
        altText: '日常私密護理指南',
      },
      blog: { handle: 'care-talk', title: 'SAENGAK Talk' },
      author: 'SAENGAK 編輯團隊',
      tags: ['SAENGAK', '健康知識', '私密護理', '日常保養', '公開'],
    },
    {
      id: 'fallback-article-2',
      title: '貼身衣物材質怎麼選？透氣、摩擦與清潔頻率的日常指南',
      handle: 'how-to-choose-seamless-underwear',
      excerpt: '用透氣度、摩擦感與清潔頻率三個面向，整理日常挑選貼身衣物的實用重點。',
      contentHtml: `
<p class="lead text-lg mb-6 leading-relaxed">貼身衣物是每天與肌膚接觸時間最長的物品。選對合適的材質與剪裁，是維持一整天清爽舒適的重要起點。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">一、 常見貼身衣物面料特性比較</h2>
<p class="mb-4 leading-relaxed">不同面料在吸濕性、透氣度與親膚感上各有優勢，可依個人穿著習慣與場景選擇：</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">1. 天然純棉 (Cotton)</h3>
<p class="mb-4 leading-relaxed">天然植物纖維，觸感親膚柔軟、吸濕性佳，不易引起摩擦不適，非常適合居家休閒、睡眠與一般日常穿著。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">2. 莫代爾 (Modal) 與天絲 (Tencel)</h3>
<p class="mb-4 leading-relaxed">萃取自天然木漿纖維，質地絲滑細緻、垂墜感佳，且具備優異的透氣與散熱特性，在夏季或久坐辦公環境能有效減少悶熱感。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">3. 機能彈性人造纖維</h3>
<p class="mb-6 leading-relaxed">多為尼龍與彈性纖維混紡，具備快乾、高彈性與貼合無痕特點，適合運動、健身或穿著貼身裙褲時使用。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">二、 挑選時的三大核心關鍵</h2>
<ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
  <li><strong>底襠材質最關鍵：</strong> 接觸私密處的襠部布料，優先選擇純棉或親膚透氣結構，給予最溫柔的保護。</li>
  <li><strong>合身不勒肉：</strong> 避免過度緊繃的腰圍與大腿圍剪裁，減少皮膚受壓摩擦與勒痕。</li>
  <li><strong>依場合替換：</strong> 日常放鬆選棉質或天絲，運動流汗選排汗速乾款。</li>
</ul>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">三、 貼身衣物清潔與汰舊原則</h2>
<p class="mb-4 leading-relaxed">貼身衣物的清潔方式直接影響布料壽命與衛生狀態：</p>
<ol class="list-decimal list-inside space-y-2 mb-6 leading-relaxed">
  <li><strong>使用專用溫和洗劑：</strong> 建議使用中性或貼身衣物手洗精，避免強鹼洗劑殘留刺激肌膚。</li>
  <li><strong>獨立手洗或加裝洗衣袋：</strong> 避免與外出衣物、襪子混洗，防止交叉污染。</li>
  <li><strong>充分通風晾乾：</strong> 陽光自然晾曬或通風處完全陰乾後再收納，避免潮濕滋生黴菌。</li>
  <li><strong>定期更換週期：</strong> 貼身衣物屬於消耗品，建議每 3～6 個月定期更換新內著，若布料變硬、鬆弛或變形應提前汰換。</li>
</ol>
      `.trim(),
      publishedAt: '2026-09-01T10:37:33Z',
      image: {
        url: '/images/blog/how-to-choose-seamless-underwear.jpg',
        altText: '貼身衣物材質指南',
      },
      blog: { handle: 'lifestyle', title: '生活美學' },
      author: 'SAENGAK 編輯團隊',
      tags: ['SAENGAK', '選購指南', '生活美學', '親膚材質', '公開'],
    },
    {
      id: 'fallback-article-3',
      title: '我們如何整理產品與內容：SAENGAK 編輯團隊的透明度承諾',
      handle: 'how-we-review-products-and-content',
      excerpt: '所有產品資訊堅持來源透明與成分公開；沒有即時評價時，就以編輯精選清楚標示。',
      contentHtml: `
<p class="lead text-lg mb-6 leading-relaxed">在資訊繁雜的現代生活中，SAENGAK 堅持以透明、真實與科學尊重的態度，為每一位女性整理真正需要的日常好物與知識內容。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">一、 SAENGAK 的編輯守則與透明度承諾</h2>
<p class="mb-4 leading-relaxed">我們相信，好的生活品牌不需要誇張的話術，而是透過誠實的資訊傳遞，讓使用者能安心做決定：</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">1. 來源清楚，成分完全透明</h3>
<p class="mb-4 leading-relaxed">所有產品的成份清單、原廠檢測說明與適用建議，均經嚴格核對後如實呈現，絕不隱匿任何資訊，讓每一項接觸肌膚的成分都能安心溯源。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">2. 堅守非醫療宣稱界線</h3>
<p class="mb-4 leading-relaxed">日常護理的本質是溫和清潔、舒適陪伴與維持清爽。我們嚴格遵守衛生主管機關法規，絕不宣稱任何醫療療效，讓護理回歸純粹自然的日常享受。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">3. 真實標示，拒絕虛假評價</h3>
<p class="mb-6 leading-relaxed">在網站展示階段，若尚未取得經本人授權與真實訂單驗證的使用者評價，我們一律明確標示為「編輯精選」，絕不使用合成的評分或虛假心得欺瞞使用者。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">二、 我們如何挑選與推薦商品？</h2>
<ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
  <li><strong>親膚溫和優先：</strong> 優先挑選通過低刺激測試、成分溫和的大廠配方與天然原料。</li>
  <li><strong>細節舒適體驗：</strong> 從按壓瓶器的手感、細緻泡沫的觸感，到布料貼合的舒適度，以女性真實日常需求出發。</li>
  <li><strong>簡約美學生活：</strong> 摒除過度繁複的包裝，以自然綠意與米白素雅融入居家生活空間。</li>
</ul>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">三、 陪伴妳的每一個日常</h2>
<p class="mb-6 leading-relaxed">SAENGAK 期待成為妳生活裡最值得信賴的溫柔力量。在照顧身體的路上，我們與妳一同用心聆聽身體的真實聲音。</p>
      `.trim(),
      publishedAt: '2026-09-01T10:37:36Z',
      image: {
        url: '/images/blog/how-we-review-products-and-content.jpg',
        altText: 'SAENGAK 品牌編輯標準',
      },
      blog: { handle: 'brand', title: '品牌方法' },
      author: 'SAENGAK 編輯團隊',
      tags: ['SAENGAK', '品牌方法', '透明原則', '編輯守則', '公開'],
    },
  ];
}

/**
 * 依 Handle 取得單一部落格文章詳情
 */
export async function getShopifyArticleByHandle(handle: string): Promise<ShopifyArticle | null> {
  if (!handle) return null;

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
            }
          }
        }
      }
    `;

    const data = await shopifyFetch<{ articles: { edges: { node: any }[] } }>({
      query: gqlQuery,
      variables: { first: 50 },
    });

    const articles = (data.articles?.edges || []).map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      excerpt: edge.node.excerpt || '',
      contentHtml: edge.node.contentHtml || '',
      publishedAt: edge.node.publishedAt,
      image: edge.node.image ? { url: edge.node.image.url, altText: edge.node.image.altText } : null,
      blog: edge.node.blog ? { handle: edge.node.blog.handle, title: edge.node.blog.title } : null,
      author: edge.node.authorV2?.name || 'SAENGAK 編輯團隊',
      tags: edge.node.tags || [],
    })).filter(isPublicShopifyArticle);

    const found = articles.find((a) => a.handle === handle || a.id === handle);
    if (found) return found;
  } catch (err) {
    console.warn('Storefront getShopifyArticleByHandle query failed:', err);
    captureExceptionSafe(err, { source: 'getShopifyArticleByHandle', fallback: 'curatedArticles' });
  }

  // 若 Shopify 查不到，在 fallback 中查詢
  const fallbacks = await getShopifyArticles(10);
  return fallbacks.find((a) => a.handle === handle || a.id === handle) || null;
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
