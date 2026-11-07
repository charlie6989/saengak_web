/**
 * /sitemap.xml 由 vite build 產生（vite.config.ts 的 sitemapPlugin），商品清單在每次部署時更新。
 * 不用 Vercel Function：Hobby 方案的 12 個函式額度已滿。
 */

import { hasTestProductMarker } from './testProducts';

const SITE_URL = 'https://lucissicare.com';
const PAGE_SIZE = 250;
const MAX_PAGES = 4;
const REQUEST_TIMEOUT_MS = 10_000;

export const STATIC_PATHS = [
  '/',
  '/products',
  '/best-rated',
  '/promotion',
  '/about',
  '/community',
  '/faq',
  '/customer-service',
  '/return-policy',
  '/privacy',
  '/terms',
];

export interface SitemapProduct {
  id: string;
  updatedAt?: string;
  title?: string;
  handle?: string;
  vendor?: string;
  tags?: string[];
}

export interface StorefrontConfig {
  domain: string;
  apiVersion: string;
  token: string;
}

interface ProductsPage {
  data?: {
    products?: {
      nodes?: SitemapProduct[];
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    };
  };
}

const QUERY = 'query SitemapProducts($first: Int!, $after: String) { products(first: $first, after: $after) { nodes { id updatedAt title handle vendor tags } pageInfo { hasNextPage endCursor } } }';

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const numericProductId = (gid: string): string | undefined => gid.match(/^gid:\/\/shopify\/Product\/(\d{1,20})$/)?.[1];

export function renderSitemap(products: SitemapProduct[]): string {
  const staticUrls = STATIC_PATHS.map((path) => `  <url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`);
  const productUrls = products.flatMap((product) => {
    const id = numericProductId(product.id);
    if (!id) return [];
    const lastmod = product.updatedAt && !Number.isNaN(Date.parse(product.updatedAt))
      ? `<lastmod>${escapeXml(product.updatedAt)}</lastmod>`
      : '';
    return [`  <url><loc>${SITE_URL}/product/${id}</loc>${lastmod}</url>`];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...productUrls].join('\n')}
</urlset>
`;
}

const isTestProduct = ({ title, handle, vendor, tags }: SitemapProduct): boolean =>
  hasTestProductMarker([title, handle, vendor, ...(tags ?? [])]);

/** 讀取 Storefront 可見且對顧客公開的商品（與前台相同，排除內部驗收商品）。任何一頁失敗就 throw，由呼叫端決定如何退回。 */
export async function fetchSitemapProducts({ domain, apiVersion, token }: StorefrontConfig): Promise<SitemapProduct[]> {
  const products: SitemapProduct[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response: Response = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query: QUERY, variables: { first: PAGE_SIZE, after: cursor } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Storefront responded ${response.status}`);
    const body = await response.json() as ProductsPage;
    const connection = body.data?.products;
    if (!connection?.nodes) throw new Error('Storefront returned no products');
    products.push(...connection.nodes.filter((product) => !isTestProduct(product)));
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;
    cursor = connection.pageInfo.endCursor;
  }
  return products;
}
