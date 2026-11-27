import { next, rewrite } from '@vercel/functions';
import { SHOPIFY_API_VERSION, SHOPIFY_STOREFRONT_PUBLIC_TOKEN, SHOPIFY_STORE_DOMAIN } from './api/_lib/shopify-config.js';
import {
  fetchListingProducts,
  fetchProductSeo,
  fetchPublicArticles,
  injectHeadTags,
  injectPageFallback,
  type ArticleSeoRecord,
  type DocumentHead,
  type PageLink,
  type ProductSeoRecord,
  type StorefrontOptions,
} from './api/_lib/document-head.js';
import { formatTwd } from './src/domain/algorithms.js';
import { CARE_PILLARS, belongsToCarePillar, findCarePillarByName } from './src/content/carePillars.js';
import { publicArticleSet } from './src/content/curatedArticles.js';
import {
  DEFAULT_SHARE_IMAGE,
  NOINDEX_ROBOTS,
  SITE_NAME,
  canonicalUrlFor,
  formatPageTitle,
  seoForLocation,
  type RouteSeo,
} from './src/lib/seo.js';
import {
  HOME_CRUMB,
  articleBreadcrumbs,
  articleMeta,
  breadcrumbJsonLd,
  buildArticleJsonLd,
  buildProductJsonLd,
  productBreadcrumbs,
  productMetaDescription,
  productPageTitle,
  siteJsonLd,
  type ArticleSeoSource,
} from './src/lib/structuredData.js';

/**
 * 所有網頁請求的第一份 HTML：取本次部署的 /index.html，依路由寫入 head（標題、說明、robots、canonical、
 * Open Graph、結構化資料）與給爬蟲的備援文字，查無商品／文章／路由時回 HTTP 404（畫面仍由 SPA 顯示）。
 * 所有 User-Agent 拿到同一份 HTML；任何失敗都退回原本的殼層（next()）。
 * 例外：社群連結預覽爬蟲（LINE、Facebook 等）的商品／文章頁仍改寫到 /api/share/product。
 * 搜尋引擎爬蟲絕不能送到那個函式（它回 X-Robots-Tag: noindex）。
 */

// 社群連結預覽爬蟲（LINE 用 facebookexternalhit;line-poker）。只列預覽用的爬蟲，不含搜尋引擎，
// 也不比對 LINE／Facebook 內建瀏覽器的一般訪客 UA（Line/、FBAN）。
export const SHARE_PREVIEW_BOT = /facebookexternalhit|facebot|line-poker|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|skypeuripreview|redditbot|embedly/i;

const SHARE_PRODUCT_PATH = /^\/product\/(\d{1,20})$/;
const SHARE_ARTICLE_PATH = /^\/blog\/([a-z0-9][a-z0-9-]{0,99})$/;

// 殼層由本次部署經過 middleware 再取一次；這個標頭讓 /index.html → / 的轉址不會對它形成迴圈
export const SHELL_REQUEST_HEADER = 'x-lucissi-care-shell';
const SHELL_TIMEOUT_MS = 3000;
const STOREFRONT_TIMEOUT_MS = 1500;

// 舊網域由 vercel.json 整站轉到 lucissicare.com，middleware 不處理
const LEGACY_HOSTS = new Set(['saengak.com.tw', 'www.saengak.com.tw']);

const isGetOrHead = (request: Request) => request.method === 'GET' || request.method === 'HEAD';
const hasFileExtension = (pathname: string) => /\.[a-z0-9]+$/i.test(pathname);

/** API、建置產物、圖片與點開頭的路徑（.well-known）不經過這裡。 */
export function isPassthroughPath(pathname: string): boolean {
  // _vercel：Vercel Web Analytics／Speed Insights 的腳本與收集端點，由平台處理
  return /^\/(?:api|assets|images|_vercel)(?:\/|$)/.test(pathname) || /^\/\./.test(pathname);
}

function isDocumentRequest(request: Request, url: URL) {
  return isGetOrHead(request) && url.pathname !== '/index.html' && !hasFileExtension(url.pathname);
}

/**
 * 每頁只有一個網址：/index.html 轉到 /，去掉結尾與重複的斜線（保留查詢字串）。
 * 已是標準網址時回傳 null。
 */
export function canonicalRedirectPath(request: Request, url: URL): string | null {
  if (!isGetOrHead(request)) return null;
  if (url.pathname === '/index.html') return request.headers.has(SHELL_REQUEST_HEADER) ? null : `/${url.search}`;
  if (hasFileExtension(url.pathname)) return null;
  const path = `/${url.pathname.split('/').filter(Boolean).join('/')}`;
  return path === url.pathname ? null : `${path}${url.search}`;
}

function storefrontOptions(fetchImpl: typeof fetch): StorefrontOptions {
  return {
    domain: SHOPIFY_STORE_DOMAIN,
    token: SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
    apiVersion: SHOPIFY_API_VERSION,
    fetchImpl,
    timeoutMs: STOREFRONT_TIMEOUT_MS,
  };
}

export type RenderedHead = DocumentHead & { status: number; redirectPath?: string };

function productPrice(product: ProductSeoRecord): string | undefined {
  const prices = (product.variants ?? []).map((variant) => variant.price ?? 0).filter((price) => price > 0);
  const low = prices.length ? Math.min(...prices) : product.price;
  const high = prices.length ? Math.max(...prices) : product.price;
  if (!(low > 0)) return undefined;
  return high > low ? `${formatTwd(low)} – ${formatTwd(high)}` : formatTwd(low);
}

const productLink = (product: { numericId: string; name: string }): PageLink => ({ name: product.name, url: `/product/${product.numericId}` });
const pillarLinks = (): PageLink[] => CARE_PILLARS.map((pillar) => ({
  name: pillar.name,
  url: `/products?${new URLSearchParams({ category: pillar.name })}`,
}));

function notFoundHead(base: RenderedHead, heading: string): RenderedHead {
  return {
    ...base,
    title: formatPageTitle(heading),
    robots: NOINDEX_ROBOTS,
    status: 404,
    jsonLd: undefined,
    fallback: { heading, breadcrumbs: [HOME_CRUMB, { name: heading }], links: [{ name: '全部商品', url: '/products' }] },
  };
}

async function productHead(base: RenderedHead, route: RouteSeo, url: URL, options: StorefrontOptions): Promise<RenderedHead> {
  // gid 形式的舊網址直接轉到數字 ID，不需要查商品
  if (route.productId && url.pathname !== `/product/${route.productId}`) {
    return { ...base, status: 308, redirectPath: `/product/${route.productId}${url.search}` };
  }
  let product: ProductSeoRecord | null;
  try {
    product = await fetchProductSeo(route.productId ? { id: route.productId } : { handle: route.productHandle ?? '' }, options);
  } catch {
    // Shopify 逾時或失敗不代表商品不存在：回路由預設 head，不回 404
    return base;
  }
  if (!product) return notFoundHead(base, '找不到商品');
  if (!route.productId) return { ...base, status: 308, redirectPath: `/product/${product.numericId}${url.search}` };

  const breadcrumbs = productBreadcrumbs(product);
  const jsonLd = buildProductJsonLd(product);
  return {
    ...base,
    title: productPageTitle(product),
    description: productMetaDescription(product) || base.description,
    image: product.featuredImage ?? base.image,
    jsonLd: jsonLd ? [jsonLd, breadcrumbJsonLd(breadcrumbs)] : undefined,
    fallback: { heading: product.name, price: productPrice(product), summary: product.summary, breadcrumbs },
  };
}

async function articleHead(base: RenderedHead, route: RouteSeo, options: StorefrontOptions): Promise<RenderedHead> {
  const handle = route.articleHandle ?? '';
  let shopifyArticles: ArticleSeoRecord[] | null = null;
  try {
    shopifyArticles = await fetchPublicArticles(options);
  } catch {
    shopifyArticles = null;
  }
  // 與文章頁相同：有公開的 Shopify 文章時只用它們，否則（含讀取失敗）用站內精選文章
  const article: ArticleSeoSource | undefined = publicArticleSet(shopifyArticles).find((item) => item.handle === handle);
  // Shopify 沒有回應時不能斷定文章不存在
  if (!article) return shopifyArticles ? notFoundHead(base, '找不到文章') : base;

  const meta = articleMeta(article);
  const breadcrumbs = articleBreadcrumbs(article);
  return {
    ...base,
    title: meta.title,
    description: meta.description || base.description,
    canonicalUrl: meta.canonicalUrl,
    image: meta.image ?? base.image,
    jsonLd: [buildArticleJsonLd(article), breadcrumbJsonLd(breadcrumbs)],
    fallback: { heading: meta.heading, summary: meta.description, breadcrumbs },
  };
}

/** 固定頁面的伺服器 HTML 附上常用頁面連結，未執行 JavaScript 的爬蟲也能看到內容與站內連結。 */
const SERVICE_LINKS: PageLink[] = [
  { name: '全部商品', url: '/products' },
  { name: 'LUCISSI Talk 私密對話', url: '/community' },
  { name: '優惠活動', url: '/promotion' },
  { name: '常見問題', url: '/faq' },
  { name: '退換貨說明', url: '/return-policy' },
  { name: '客服中心', url: '/customer-service' },
  { name: '隱私權政策', url: '/privacy' },
  { name: '條款和協議', url: '/terms' },
];
const serviceLinks = (currentPath: string): PageLink[] => SERVICE_LINKS.filter((item) => item.url !== currentPath);

async function listingLinks(route: RouteSeo, options: StorefrontOptions): Promise<PageLink[]> {
  const products = await fetchListingProducts(options).catch(() => []);
  const pillar = findCarePillarByName(route.category);
  return products.filter((product) => !pillar || belongsToCarePillar(product, pillar.id)).map(productLink);
}

async function articleListLinks(options: StorefrontOptions): Promise<PageLink[]> {
  const shopify = await fetchPublicArticles(options).catch(() => null);
  // 與文章列表相同：有公開的 Shopify 文章時只列 Shopify 文章
  return publicArticleSet(shopify).map((article) => ({ name: articleMeta(article).heading, url: `/blog/${article.handle}` }));
}

/** 第一份 HTML 的 head 與狀態碼；商品與文章頁加入 Shopify 的公開資料。 */
export async function documentHeadFor(url: URL, fetchImpl: typeof fetch = fetch): Promise<RenderedHead> {
  const route = seoForLocation(url.pathname, url.search);
  const base: RenderedHead = {
    title: route.title,
    description: route.description,
    canonicalUrl: canonicalUrlFor(route),
    robots: route.robots,
    type: route.type,
    image: DEFAULT_SHARE_IMAGE,
    status: 200,
  };
  if (route.redirectTo) return { ...base, status: 308, redirectPath: `${route.redirectTo}${url.search}` };
  if (route.notFound) return notFoundHead(base, route.heading);

  const options = storefrontOptions(fetchImpl);
  const pageCrumbs = [HOME_CRUMB, { name: route.heading }];
  switch (route.page) {
    case 'home':
      return {
        ...base,
        jsonLd: siteJsonLd(),
        fallback: {
          heading: SITE_NAME,
          summary: route.description,
          breadcrumbs: [],
          links: [...pillarLinks(), { name: 'LUCISSI Talk', url: '/community' }, ...await listingLinks(route, options)],
        },
      };
    case 'products':
      return { ...base, fallback: { heading: route.heading, summary: route.description, breadcrumbs: pageCrumbs, links: await listingLinks(route, options) } };
    case 'articles':
      return { ...base, fallback: { heading: route.heading, summary: route.description, breadcrumbs: pageCrumbs, links: await articleListLinks(options) } };
    case 'product':
      return productHead(base, route, url, options);
    case 'article':
      return articleHead(base, route, options);
    case 'static':
      return { ...base, fallback: { heading: route.heading, summary: route.description, breadcrumbs: pageCrumbs, links: serviceLinks(route.canonicalPath) } };
    default:
      return base;
  }
}

/** 以路由 head 送出 SPA 殼層；任何失敗都退回原本的殼層。 */
export async function renderDocument(request: Request, url: URL, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!isDocumentRequest(request, url)) return next();
  try {
    const shellHeaders = new Headers({ [SHELL_REQUEST_HEADER]: '1' });
    // 預覽部署有存取保護時，殼層請求需要同一組 cookie
    const cookie = request.headers.get('cookie');
    if (cookie) shellHeaders.set('cookie', cookie);
    const [shellResponse, head] = await Promise.all([
      fetchImpl(new URL('/index.html', url), { headers: shellHeaders, signal: AbortSignal.timeout(SHELL_TIMEOUT_MS) }),
      documentHeadFor(url, fetchImpl),
    ]);
    if (head.redirectPath) return Response.redirect(new URL(head.redirectPath, url), 308);
    if (!shellResponse.ok || !(shellResponse.headers.get('content-type') ?? '').includes('text/html')) return next();
    const html = injectPageFallback(injectHeadTags(await shellResponse.text(), head), head.fallback);
    const headers = new Headers(shellResponse.headers);
    for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified', 'age']) headers.delete(name);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    // 找不到的頁面仍顯示 SPA 的 NotFound，狀態碼讓爬蟲不把它當成內容
    return new Response(request.method === 'HEAD' ? null : html, { status: head.status, headers });
  } catch {
    return next();
  }
}

export async function handleRequest(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (LEGACY_HOSTS.has(url.hostname) || isPassthroughPath(url.pathname)) return next();

  // 只會轉址的舊網址（與 vercel.json 的 redirects 相同），保留查詢字串。
  // 先於斜線整理判斷：seoForLocation 會自行去掉多餘斜線，/blog/ 一次就轉到 /community，不必先 308 到 /blog。
  const redirectTo = isDocumentRequest(request, url) ? seoForLocation(url.pathname).redirectTo : undefined;
  if (redirectTo) return Response.redirect(new URL(`${redirectTo}${url.search}`, url), 308);

  const canonicalPath = canonicalRedirectPath(request, url);
  if (canonicalPath) return Response.redirect(new URL(canonicalPath, url), 308);

  if (SHARE_PREVIEW_BOT.test(request.headers.get('user-agent') || '')) {
    const product = url.pathname.match(SHARE_PRODUCT_PATH);
    if (product) return rewrite(new URL(`/api/share/product?id=${product[1]}`, request.url));
    const article = url.pathname.match(SHARE_ARTICLE_PATH);
    if (article) return rewrite(new URL(`/api/share/product?article=${article[1]}`, request.url));
  }

  return renderDocument(request, url, fetchImpl);
}

// Vercel 呼叫時第二個參數是 context，不是 fetch，所以另外包一層
export default function middleware(request: Request): Promise<Response> {
  return handleRequest(request);
}

export const config = {
  // Node.js runtime：與 api/ 函式相同，以 .js 副檔名載入專案內的 TypeScript 模組
  runtime: 'nodejs',
  matcher: ['/((?!api/|assets/|images/|_vercel/).*)'],
};
