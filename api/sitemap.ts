import { SHOPIFY_API_VERSION, SHOPIFY_STOREFRONT_PUBLIC_TOKEN, SHOPIFY_STORE_DOMAIN } from './_lib/shopify-config.js';

/**
 * /sitemap.xml（vercel.json rewrite 到這裡）：固定頁面加上 Storefront 可見的商品。
 * Shopify 暫時失敗時仍回傳固定頁面，不讓整份 sitemap 變成錯誤頁。
 */

const SITE_URL = 'https://lucissicare.com';
const PAGE_SIZE = 250;
const MAX_PAGES = 4;

export const STATIC_PATHS = [
  '/',
  '/products',
  '/best-rated',
  '/promotion',
  '/about',
  '/brand-story',
  '/blog',
  '/faq',
  '/customer-service',
  '/return-policy',
  '/privacy',
  '/terms',
];

export interface SitemapProduct {
  id: string;
  updatedAt?: string;
}

interface ProductsPage {
  data?: {
    products?: {
      nodes?: SitemapProduct[];
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    };
  };
}

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

async function fetchAllProducts(): Promise<SitemapProduct[]> {
  const products: SitemapProduct[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
      },
      body: JSON.stringify({
        query: 'query SitemapProducts($first: Int!, $after: String) { products(first: $first, after: $after) { nodes { id updatedAt } pageInfo { hasNextPage endCursor } } }',
        variables: { first: PAGE_SIZE, after: cursor },
      }),
    });
    if (!response.ok) throw new Error('SITEMAP_PRODUCTS_UNAVAILABLE');
    const body = await response.json() as ProductsPage;
    const connection = body.data?.products;
    if (!connection?.nodes) throw new Error('SITEMAP_PRODUCTS_UNAVAILABLE');
    products.push(...connection.nodes);
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;
    cursor = connection.pageInfo.endCursor;
  }
  return products;
}

export async function GET(): Promise<Response> {
  const products = await fetchAllProducts().catch(() => null);
  return new Response(renderSitemap(products ?? []), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // 失敗時短暫快取，讓下一次爬取能拿回完整商品清單
      'Cache-Control': products
        ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
        : 'public, max-age=0, s-maxage=60',
    },
  });
}
