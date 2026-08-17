import { createStorefrontApiClient, type StorefrontApiClient } from '@shopify/storefront-api-client';

/**
 * Shopify Storefront GraphQL API Client
 * 依據 docs/00_DECISION_LOG.md 權威決策：前端商品與分類直接對接 Shopify Storefront API
 * 採用官方 @shopify/storefront-api-client SDK 實作
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

const domain = getEnv('VITE_PUBLIC_SHOPIFY_STORE_DOMAIN', getEnv('VITE_SHOPIFY_DOMAIN', 'gh2xgs-zf.myshopify.com'));
const publicAccessToken = getEnv('VITE_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN', getEnv('SHOPIFY_STOREFRONT_ACCESS_TOKEN', '9862bdf1a7178bd589dd83a130a3e24b'));
const apiVersion = getEnv('VITE_PUBLIC_SHOPIFY_API_VERSION', '2024-07');

/**
 * Shopify Storefront 官方 Client 實例 (前端安全模式：僅使用 Storefront Public Access Token)
 */
export const storefrontClient: StorefrontApiClient = createStorefrontApiClient({
  storeDomain: domain.startsWith('http') ? domain : `https://${domain}`,
  apiVersion: apiVersion || '2024-07',
  publicAccessToken: publicAccessToken || '9862bdf1a7178bd589dd83a130a3e24b',
});

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
  variants: {
    id: string;
    title: string;
    price: number;
    compareAtPrice?: number;
    availableForSale: boolean;
    sku?: string;
    selectedOptions?: { name: string; value: string }[];
  }[];
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string | null;
  productsCount: number;
}

/**
 * 執行 Storefront GraphQL 查詢 (底層封裝官方 SDK request)
 */
export async function shopifyFetch<T = any>({
  query,
  variables = {}
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
  const price = parseFloat(node.priceRange?.minVariantPrice?.amount || '0');
  const compareAtPrice = parseFloat(node.compareAtPriceRange?.minVariantPrice?.amount || '0');
  const images = (node.images?.edges || []).map((e: any) => ({
    url: e.node.url,
    altText: e.node.altText || node.title
  }));
  const variants = (node.variants?.edges || []).map((e: any) => ({
    id: e.node.id,
    title: e.node.title,
    price: parseFloat(e.node.price?.amount || '0'),
    compareAtPrice: e.node.compareAtPrice ? parseFloat(e.node.compareAtPrice.amount) : undefined,
    availableForSale: e.node.availableForSale ?? true,
    sku: e.node.sku || '',
    selectedOptions: e.node.selectedOptions || []
  }));

  return {
    id: node.id,
    name: node.title,
    title: node.title,
    description: node.description || '',
    descriptionHtml: node.descriptionHtml || '',
    handle: node.handle,
    price: price,
    originalPrice: compareAtPrice > price ? compareAtPrice : undefined,
    image: images[0]?.url || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
    hoverImage: images[1]?.url || images[0]?.url || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
    images,
    tags: node.tags || [],
    productType: node.productType || '',
    vendor: node.vendor || 'SAENGAK',
    createdAt: node.createdAt || new Date().toISOString(),
    availableForSale: node.availableForSale ?? true,
    variants
  };
}

/**
 * 取得商品列表 (支援依標籤、關鍵字查詢或全部)
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
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 20) {
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
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<{ products: { edges: { node: any }[] } }>({
    query: gqlQuery,
    variables: { first, query: query || null, sortKey, reverse }
  });

  return (data.products?.edges || []).map(edge => formatShopifyProduct(edge.node));
}

/**
 * 依 Handle 取得單一商品詳情
 */
export async function getShopifyProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const gqlQuery = `
    query GetProductByHandle($handle: String!) {
      product(handle: $handle) {
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
      }
    }
  `;

  const data = await shopifyFetch<{ product: any }>({
    query: gqlQuery,
    variables: { handle }
  });

  if (!data.product) return null;
  return formatShopifyProduct(data.product);
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
            products(first: 1) {
              totalCount
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<{ collections: { edges: { node: any }[] } }>({
    query: gqlQuery,
    variables: { first }
  });

  return (data.collections?.edges || []).map(edge => ({
    id: edge.node.id,
    title: edge.node.title,
    handle: edge.node.handle,
    description: edge.node.description || '',
    image: edge.node.image?.url || null,
    productsCount: edge.node.products?.totalCount || 0
  }));
}
