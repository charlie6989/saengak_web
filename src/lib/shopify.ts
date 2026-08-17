import { createStorefrontApiClient, type StorefrontApiClient } from '@shopify/storefront-api-client';

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
  sku?: string;
  selectedOptions?: { name: string; value: string }[];
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
  image: string;
  hoverImage: string;
  images: { url: string; altText?: string }[];
  tags: string[];
  productType: string;
  vendor: string;
  createdAt: string;
  availableForSale: boolean;
  variants: ShopifyProductVariant[];
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
    sku: e.node?.sku || '',
    selectedOptions: e.node?.selectedOptions || [],
  }));

  const fallbackImage = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800';

  return {
    id: node.id || '',
    name: node.title || '',
    title: node.title || '',
    description: node.description || '',
    descriptionHtml: node.descriptionHtml || '',
    handle: node.handle || '',
    price: price,
    originalPrice: compareAtPrice > price ? compareAtPrice : undefined,
    image: images[0]?.url || fallbackImage,
    hoverImage: images[1]?.url || images[0]?.url || fallbackImage,
    images,
    tags: node.tags || [],
    productType: node.productType || '',
    vendor: node.vendor || 'SAENGAK',
    createdAt: node.createdAt || new Date().toISOString(),
    availableForSale: node.availableForSale ?? true,
    variants,
  };
}

const PRODUCT_FRAGMENT = `
  id
  title
  description
  descriptionHtml
  handle
  availableForSale
  productType
  vendor
  tags
  createdAt
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
  images(first: 10) {
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
      }
    }
  }
`;

/**
 * 取得商品列表 (支援依標籤、關鍵字查詢或排序)
 */
export async function getShopifyProducts(options: {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
} = {}): Promise<ShopifyProduct[]> {
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

  return (data.products?.edges || []).map((edge) => formatShopifyProduct(edge.node));
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
        return formatShopifyProduct(data.node);
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
    return formatShopifyProduct(data.product);
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
    .map((node) => formatShopifyProduct(node));
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
  );

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
    }));

    if (articles.length > 0) {
      return articles;
    }
  } catch (err) {
    console.warn('Storefront articles query failed, using curated fallback:', err);
  }

  // 門市尚未發布文章時之精選文章展示備案
  return [
    {
      id: 'fallback-article-1',
      title: '私密日常清潔的 3 大關鍵心法：平衡、溫和與細緻防護',
      handle: 'daily-feminine-care-guide',
      excerpt: '正確理解弱酸環境與清潔成分，為女性身體帶來最安心的每日舒適守護。',
      publishedAt: '2026-08-15T08:00:00Z',
      image: {
        url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
        altText: '日常清潔指南',
      },
      blog: { handle: 'care-talk', title: 'SAENGAK Talk' },
      author: 'SAENGAK 專業護理專欄',
      tags: ['專欄文章', '日常護理', '女性健康'],
    },
    {
      id: 'fallback-article-2',
      title: '如何選擇適合敏感肌膚的無痕親膚內著？從織物結構說起',
      handle: 'how-to-choose-seamless-underwear',
      excerpt: '從透氣性、彈性與抑菌纖維技術出發，為妳打造整日無感自在的穿著體驗。',
      publishedAt: '2026-08-10T08:00:00Z',
      image: {
        url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=800',
        altText: '內著選擇指南',
      },
      blog: { handle: 'lifestyle', title: '生活美學' },
      author: 'SAENGAK 設計團隊',
      tags: ['專欄文章', '舒適穿著', '材質解析'],
    },
    {
      id: 'fallback-article-3',
      title: '生理期舒適指南：告別悶熱與異味，享受自在生活步調',
      handle: 'period-care-comfort-routine',
      excerpt: '掌握生理期的護理節奏與保養習慣，讓每一個特殊週期都溫柔度過。',
      publishedAt: '2026-08-05T08:00:00Z',
      image: {
        url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
        altText: '生理期護理',
      },
      blog: { handle: 'health', title: '健康生活' },
      author: 'SAENGAK 婦科護理顧問',
      tags: ['專欄文章', '生理護理', '自我關懷'],
    },
  ];
}
