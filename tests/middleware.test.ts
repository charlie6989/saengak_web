import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import middleware, {
  SHELL_REQUEST_HEADER,
  canonicalRedirectPath,
  config,
  documentHeadFor,
  handleRequest,
  renderDocument,
} from '../middleware';
import { injectHeadTags, injectPageFallback, toProductSeoRecord, type DocumentHead } from '../api/_lib/document-head';
import { seoForLocation } from '../src/lib/seo';
import { buildProductJsonLd } from '../src/lib/structuredData';
import { formatShopifyProduct } from '../src/lib/shopify';
import { DEFAULT_FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from '../src/domain/shipping';
import { structuredDataShippingRate } from '../src/domain/structuredDataShipping';

const SHELL = readFileSync('index.html', 'utf8');
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const productNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'gid://shopify/Product/7819900551235',
  title: '冰絲無痕中腰三角褲',
  handle: 'ice-silk-brief',
  description: '涼感冰絲布料，\n無痕切邊。',
  vendor: 'LUCISSI',
  productType: '舒適內搭',
  tags: ['無痕'],
  availableForSale: true,
  seo: { title: null, description: null },
  featuredImage: { url: 'https://cdn.shopify.com/brief.jpg', width: 1200, height: 1500, altText: null },
  images: { nodes: [{ url: 'https://cdn.shopify.com/brief.jpg' }, { url: 'https://cdn.shopify.com/brief-2.jpg' }] },
  priceRange: { minVariantPrice: { amount: '680.0' } },
  variants: { nodes: [{ sku: 'BRIEF-M', availableForSale: true, price: { amount: '680.0' } }] },
  ...overrides,
});

type Answer = unknown | Error;
interface FakeShopify {
  product?: Answer;
  articles?: Answer;
  listing?: Answer;
}

/** 假的 fetch：/index.html 回殼層，Storefront 依查詢名稱回答；記錄 Storefront 查詢。 */
function fakeFetch(shopify: FakeShopify = {}, shell: { status?: number; contentType?: string } = {}) {
  const queries: Array<{ name: string; variables: Record<string, unknown> }> = [];
  const shellRequests: Headers[] = [];
  const answer = (value: Answer | undefined, key: string) => {
    if (value instanceof Error) throw value;
    return new Response(JSON.stringify({ data: { [key]: value ?? (key === 'product' ? null : { nodes: [] }) } }));
  };
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input);
    if (target.endsWith('/index.html')) {
      shellRequests.push(new Headers(init?.headers));
      return new Response(SHELL, {
        status: shell.status ?? 200,
        headers: {
          'content-type': shell.contentType ?? 'text/html; charset=utf-8',
          'content-security-policy': "default-src 'self'",
          'content-length': '1',
          etag: '"shell"',
        },
      });
    }
    const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    const name = body.query.match(/query (\w+)/)?.[1] ?? '';
    queries.push({ name, variables: body.variables });
    if (name.startsWith('ProductSeo')) return answer(shopify.product, 'product');
    if (name === 'SeoArticles') return answer(shopify.articles, 'articles');
    if (name === 'SeoListing') return answer(shopify.listing, 'products');
    throw new Error(`unexpected query ${name}`);
  }) as typeof fetch;
  return { impl, queries, shellRequests };
}

const request = (path: string, init: RequestInit & { ua?: string } = {}) =>
  new Request(`https://lucissicare.com${path}`, { ...init, headers: { 'user-agent': init.ua ?? CHROME, ...(init.headers as Record<string, string> | undefined) } });

const render = async (path: string, shopify: FakeShopify = {}, init: RequestInit & { ua?: string } = {}) => {
  const fake = fakeFetch(shopify);
  const response = await handleRequest(request(path, init), fake.impl);
  return { response, html: response.status === 200 || response.status === 404 ? await response.text() : '', ...fake };
};

const jsonLdBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json" data-seo-jsonld>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]) as Record<string, any>);

describe('document head injection', () => {
  const head: DocumentHead = {
    title: '冰絲 "無痕" <內褲>｜LUCISSI CARE',
    description: 'Soft & cool',
    canonicalUrl: 'https://lucissicare.com/product/1',
    robots: 'index,follow',
    type: 'product',
    image: { url: 'https://cdn.shopify.com/a.jpg' },
    jsonLd: [{ '@type': 'Product', name: '</script><script>alert(1)</script>' }],
  };

  it('replaces the shell route tags once, escapes text and keeps unmanaged tags', () => {
    const html = injectHeadTags(SHELL, head);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    // 分享圖換成商品圖時，殼層品牌圖的尺寸不能留下
    expect(html).not.toContain('og:image:width');
    expect(html).toContain('<title>冰絲 &quot;無痕&quot; &lt;內褲&gt;｜LUCISSI CARE</title>');
    expect(html).toContain('<meta property="og:site_name" content="LUCISSI CARE" />');
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(injectHeadTags(html, head)).toBe(html);
    expect(() => injectHeadTags('<html><body></body></html>', head)).toThrow();
  });

  it('fills only the empty root with escaped, visually hidden crawler text', () => {
    const html = '<body><div id="root"></div></body>';
    const filled = injectPageFallback(html, {
      heading: '<b>A&B</b>',
      price: 'NT$680',
      summary: '"$&" text',
      breadcrumbs: [{ name: '首頁', url: '/' }, { name: 'x"><script>', url: '/products?category=a&b=2' }, { name: 'A' }],
      links: [{ name: '商品', url: '/product/1' }],
    });
    expect(filled).toContain('<h1>&lt;b&gt;A&amp;B&lt;/b&gt;</h1>');
    expect(filled).toContain('<p>&quot;$&amp;&quot; text</p>');
    expect(filled).toContain('<a href="/products?category=a&amp;b=2">x&quot;&gt;&lt;script&gt;</a>');
    expect(filled).toContain('<li><a href="/product/1">商品</a></li>');
    expect(filled).toContain('clip:rect(0,0,0,0)');
    expect(filled).not.toContain('<script>');
    expect(injectPageFallback(filled, { heading: 'again', breadcrumbs: [] })).toBe(filled);
    expect(injectPageFallback(html)).toBe(html);
  });
});

describe('route table', () => {
  it('gives every router path a page head, and only unknown paths are not found', () => {
    const router = readFileSync('src/router/config.tsx', 'utf8');
    const paths = [...router.matchAll(/path:\s*'([^']+)'/g)]
      .map((match) => match[1])
      .filter((path) => path.startsWith('/') && path !== '/product-preview')
      .map((path) => path.replace('/*', '/gid:/shopify/Product/1').replace(':id', '7819900551235').replace(':handle', 'daily-feminine-care-guide'));
    expect(paths.length).toBeGreaterThan(30);
    for (const path of paths) expect(seoForLocation(path).notFound, path).not.toBe(true);
    for (const child of ['dashboard', 'products', 'orders', 'settings']) expect(seoForLocation(`/admin/${child}`).robots).toBe('noindex,nofollow');
    // 示範商品頁只在本機開發環境存在
    expect(seoForLocation('/product-preview').notFound).toBe(true);
    expect(seoForLocation('/no-such-page').notFound).toBe(true);
    expect(seoForLocation('/blog/Bad_Handle').notFound).toBe(true);
    expect(seoForLocation('/product/a/b').notFound).toBe(true);
  });

  it('gives each indexable page its own title and description', () => {
    const indexable = ['/', '/products', '/best-rated', '/promotion', '/about', '/community', '/faq', '/customer-service', '/return-policy', '/privacy', '/terms', '/adchoices', '/sitemap'];
    const heads = indexable.map((path) => seoForLocation(path));
    for (const head of heads) expect(head.robots, head.canonicalPath).toBe('index,follow');
    expect(new Set(heads.map((head) => head.title)).size).toBe(indexable.length);
    expect(new Set(heads.map((head) => head.description)).size).toBe(indexable.length);
    expect(seoForLocation('/').title).toBe('LUCISSI CARE｜私密處清潔保養・無痕內褲・生理褲');
    expect(seoForLocation('/faq').title).toBe('常見問題｜訂購、付款、配送與退換貨｜LUCISSI CARE');
    // Bing 建議：標題與說明不要太短（中文標題 20 字、說明 50 字以上）
    for (const head of heads) {
      expect(head.title.length, head.canonicalPath).toBeGreaterThanOrEqual(20);
      expect(head.description.length, head.canonicalPath).toBeGreaterThanOrEqual(50);
    }
  });

  it('gives noindex pages their own description instead of the home description', () => {
    const home = seoForLocation('/').description;
    expect(seoForLocation('/order-status').description).not.toBe(home);
    expect(seoForLocation('/order-status').description).toContain('訂單查詢');
  });

  it('keeps member, login, order lookup and admin pages out of the index', () => {
    for (const path of ['/login', '/register', '/profile', '/welcome', '/forgot-password', '/reset-password', '/auth/confirm', '/auth/callback', '/auth/v1/callback', '/admin', '/admin/orders', '/order-status']) {
      expect(seoForLocation(path).robots, path).toBe('noindex,nofollow');
    }
  });

  it('canonicalises product listings to the apex domain and keeps only category and collection', () => {
    expect(seoForLocation('/products', '?utm_source=line&sort=price').canonicalPath).toBe('/products');
    const category = seoForLocation('/products', '?category=私密保養&utm_source=line');
    expect(category.canonicalPath).toBe(`/products?category=${encodeURIComponent('私密保養')}`);
    expect(category.title).toBe('私密處清潔與保養｜慕斯、凝膠、噴霧、濕巾｜LUCISSI CARE');
    expect(seoForLocation('/products', '?category=舒適內搭').title).toBe('女生內褲｜無痕內褲、純棉內褲、安全褲｜LUCISSI CARE');
    expect(seoForLocation('/products', '?category=貼身穿著').title).toBe('女生內褲｜無痕內褲、純棉內褲、安全褲｜LUCISSI CARE');
    expect(seoForLocation('/products').title).toBe('全部商品｜私密處清潔保養、女生內褲與生理褲｜LUCISSI CARE');
    expect(seoForLocation('/products', '?q=凝膠').title).toBe('搜尋: 凝膠｜LUCISSI CARE');
    expect(seoForLocation('/community').title).toBe('LUCISSI Talk｜私密處保養與女性健康知識｜LUCISSI CARE');
    expect(seoForLocation('/community').heading).toBe('LUCISSI Talk 私密對話');
    expect(category.robots).toBe('index,follow');
    expect(seoForLocation('/products', '?category=all').canonicalPath).toBe('/products');
    expect(seoForLocation('/products', '?collection=summer').canonicalPath).toBe('/products?collection=summer');
    for (const search of ['?q=凝膠', '?query=濕巾', '?keyword=x', '?search=x', '?tag=無痕']) {
      expect(seoForLocation('/products', search).robots, search).toBe('noindex,follow');
    }
    expect(seoForLocation('/products', '?query=all').robots).toBe('index,follow');
    expect(seoForLocation('/FAQ').canonicalPath).toBe('/faq');
  });

  it('points redirect-only paths at their destination', () => {
    expect(seoForLocation('/search', '?q=x')).toMatchObject({ redirectTo: '/products', robots: 'noindex,follow' });
    expect(seoForLocation('/blog').redirectTo).toBe('/community');
    expect(seoForLocation('/brand-story').redirectTo).toBe('/about');
    expect(seoForLocation('/terms-of-service').redirectTo).toBe('/terms');
    expect(seoForLocation('/product').redirectTo).toBe('/products');
  });
});

describe('canonical redirects', () => {
  const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://lucissicare.com${path}`, { headers });

  it('removes index.html, trailing and doubled slashes, keeping the query', () => {
    const at = (path: string) => canonicalRedirectPath(get(path), new URL(`https://lucissicare.com${path}`));
    expect(at('/index.html')).toBe('/');
    expect(at('/index.html?a=1')).toBe('/?a=1');
    expect(at('/faq/')).toBe('/faq');
    expect(at('//products//?category=x')).toBe('/products?category=x');
    expect(at('/faq')).toBeNull();
    expect(at('/')).toBeNull();
    expect(at('/favicon.ico')).toBeNull();
    // 殼層請求不能被轉址，否則會形成迴圈
    expect(canonicalRedirectPath(get('/index.html', { [SHELL_REQUEST_HEADER]: '1' }), new URL('https://lucissicare.com/index.html'))).toBeNull();
    expect(canonicalRedirectPath(new Request('https://lucissicare.com/faq/', { method: 'POST' }), new URL('https://lucissicare.com/faq/'))).toBeNull();
  });

  it('answers with 308 from the middleware', async () => {
    const { response } = await render('/faq/?a=1');
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://lucissicare.com/faq?a=1');
    const legacy = await render('/search?q=凝膠');
    expect(legacy.response.status).toBe(308);
    expect(legacy.response.headers.get('location')).toBe(`https://lucissicare.com/products?q=${encodeURIComponent('凝膠')}`);
    expect((await render('/blog')).response.headers.get('location')).toBe('https://lucissicare.com/community');
    // 舊網址帶結尾斜線也一次轉到最終網址，不先 308 到沒有斜線的舊網址
    expect((await render('/blog/')).response.headers.get('location')).toBe('https://lucissicare.com/community');
    expect((await render('/brand-story/?a=1')).response.headers.get('location')).toBe('https://lucissicare.com/about?a=1');
    expect((await render('//search//?q=x')).response.headers.get('location')).toBe('https://lucissicare.com/products?q=x');
    const gid = await render('/product/gid:/shopify/Product/7819900551235');
    expect(gid.response.status).toBe(308);
    expect(gid.response.headers.get('location')).toBe('https://lucissicare.com/product/7819900551235');
  });

  it('matches vercel.json, which keeps the legacy domain and API rewrites', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      redirects: Array<{ source: string; destination: string; permanent: boolean; has?: unknown }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    const plain = vercel.redirects.filter((redirect) => !redirect.has);
    for (const [source, destination] of Object.entries({ '/blog': '/community', '/brand-story': '/about', '/terms-of-service': '/terms', '/product': '/products', '/search': '/products' })) {
      expect(plain).toContainEqual({ source, destination, permanent: true });
      expect(seoForLocation(source).redirectTo).toBe(destination);
    }
    expect(vercel.redirects.filter((redirect) => redirect.has)).toHaveLength(2);
    expect(vercel.rewrites[0]).toEqual({ source: '/api/pickup-points', destination: '/api/shopify/discounts?resource=pickup-points' });
    const spa = new RegExp(`^${vercel.rewrites.at(-1)?.source}$`);
    for (const path of ['/', '/product/1', '/blog/a']) expect(spa.test(path)).toBe(true);
    for (const path of ['/assets/x.js', '/api/share/product']) expect(spa.test(path)).toBe(false);
  });
});

describe('server-rendered documents', () => {
  it('serves the shell with the route head, keeping the shell security headers', async () => {
    const { response, html, shellRequests } = await render('/faq', {}, { headers: { cookie: '_vercel_jwt=x' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'");
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(shellRequests[0].get(SHELL_REQUEST_HEADER)).toBe('1');
    expect(shellRequests[0].get('cookie')).toBe('_vercel_jwt=x');
    expect(html).toContain('<title>常見問題｜訂購、付款、配送與退換貨｜LUCISSI CARE</title>');
    expect(html).toContain('<a href="/return-policy">退換貨說明</a>');
    expect(html).not.toContain('<a href="/faq">常見問題</a></li>');
    expect(html).toContain('<link rel="canonical" href="https://lucissicare.com/faq" />');
    expect(html).toContain('<meta property="og:url" content="https://lucissicare.com/faq" />');
    expect(html).toContain('<meta name="robots" content="index,follow" />');
    expect(html).toContain('<h1>常見問題</h1>');
  });

  it('gives every user agent the same HTML; only link-preview bots go to the share function', async () => {
    const shopify = { product: productNode() };
    const browser = await render('/product/7819900551235', shopify);
    const google = await render('/product/7819900551235', shopify, { ua: GOOGLEBOT });
    expect(google.html).toBe(browser.html);
    expect(google.response.headers.get('x-middleware-rewrite')).toBeNull();

    const line = await handleRequest(request('/product/7819900551235', { ua: 'facebookexternalhit/1.1;line-poker/1.0' }), fakeFetch().impl);
    expect(line.headers.get('x-middleware-rewrite')).toBe('https://lucissicare.com/api/share/product?id=7819900551235');
    const article = await handleRequest(request('/blog/daily-feminine-care-guide', { ua: 'facebookexternalhit/1.1' }), fakeFetch().impl);
    expect(article.headers.get('x-middleware-rewrite')).toBe('https://lucissicare.com/api/share/product?article=daily-feminine-care-guide');
    // LINE 內建瀏覽器是一般訪客
    const inApp = await render('/product/7819900551235', shopify, { ua: `${CHROME} Line/14.10.0` });
    expect(inApp.response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(inApp.html).toBe(browser.html);
  });

  it('leaves API routes, build assets, images, files and the legacy domain alone', async () => {
    for (const url of [
      'https://lucissicare.com/api/share/product?id=1',
      'https://lucissicare.com/assets/index-abc123.js',
      'https://lucissicare.com/images/brand/og-image.png',
      'https://lucissicare.com/robots.txt',
      'https://lucissicare.com/sitemap.xml',
      'https://lucissicare.com/.well-known/security',
      'https://saengak.com.tw/faq',
    ]) {
      const fake = fakeFetch();
      const response = await handleRequest(new Request(url), fake.impl);
      expect(response.headers.get('x-middleware-next'), url).toBe('1');
      expect(fake.shellRequests).toHaveLength(0);
    }
    expect(config.matcher).toEqual(['/((?!api/|assets/|images/|_vercel/).*)']);
    expect(config.runtime).toBe('nodejs');
  });

  it('answers unknown routes with 404 and the SPA shell', async () => {
    const { response, html } = await render('/no-such-page');
    expect(response.status).toBe(404);
    expect(html).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(html).toContain('<title>找不到頁面｜LUCISSI CARE</title>');
    expect(html).toContain('<script type="module"');
    const head = await handleRequest(request('/no-such-page', { method: 'HEAD' }), fakeFetch().impl);
    expect(head.status).toBe(404);
    expect(await head.text()).toBe('');
  });

  it('falls back to the plain shell when the shell cannot be read', async () => {
    for (const shell of [{ status: 401 }, { contentType: 'application/json' }]) {
      const response = await renderDocument(request('/faq'), new URL('https://lucissicare.com/faq'), fakeFetch({}, shell).impl);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
    const broken = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect((await renderDocument(request('/faq'), new URL('https://lucissicare.com/faq'), broken)).headers.get('x-middleware-next')).toBe('1');
  });

  it('is what Vercel calls by default', () => {
    expect(typeof middleware).toBe('function');
    expect(middleware.length).toBe(1);
  });
});

describe('product pages', () => {
  it('renders the product head, structured data and crawler text from Shopify', async () => {
    const { response, html, queries } = await render('/product/7819900551235', { product: productNode() });
    expect(response.status).toBe(200);
    expect(queries[0]).toEqual({ name: 'ProductSeo', variables: { id: 'gid://shopify/Product/7819900551235' } });
    expect(html).toContain('<title>冰絲無痕中腰三角褲｜LUCISSI CARE</title>');
    expect(html).toContain('<meta name="description" content="涼感冰絲布料， 無痕切邊。" />');
    expect(html).toContain('<link rel="canonical" href="https://lucissicare.com/product/7819900551235" />');
    expect(html).toContain('<meta property="og:type" content="product" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.shopify.com/brief.jpg" />');
    expect(html).toContain('<h1>冰絲無痕中腰三角褲</h1>');
    expect(html).toContain('<p>NT$680</p>');
    expect(html).toContain(`<a href="/products?category=${new URLSearchParams({ c: '舒適內搭' }).toString().slice(2)}">舒適內搭</a>`);
    const [product, breadcrumbs] = jsonLdBlocks(html);
    expect(product['@type']).toBe('Product');
    expect(product.offers).toMatchObject({ '@type': 'Offer', price: 680, priceCurrency: 'TWD', availability: 'https://schema.org/InStock' });
    expect(breadcrumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(['首頁', '舒適內搭', '冰絲無痕中腰三角褲']);
    expect(breadcrumbs.itemListElement[1].item).toBe(`https://lucissicare.com/products?category=${encodeURIComponent('舒適內搭')}`);
  });

  it('prefers the Shopify SEO title and description, like the product page', async () => {
    const { html } = await render('/product/7819900551235', { product: productNode({ seo: { title: '冰絲三角褲 涼感', description: '中腰冰絲女三角褲。' } }) });
    expect(html).toContain('<title>冰絲三角褲 涼感｜LUCISSI CARE</title>');
    expect(html).toContain('<meta name="description" content="中腰冰絲女三角褲。" />');
  });

  it('answers missing and internal test products with 404, but not Shopify failures', async () => {
    const missing = await render('/product/1', { product: null });
    expect(missing.response.status).toBe(404);
    expect(missing.html).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(missing.html).toContain('<title>找不到商品｜LUCISSI CARE</title>');
    expect(jsonLdBlocks(missing.html)).toHaveLength(0);

    const test = await render('/product/1', { product: productNode({ title: '金流驗收測試－請勿購買' }) });
    expect(test.response.status).toBe(404);

    const offline = await render('/product/7819900551235', { product: new Error('timeout') });
    expect(offline.response.status).toBe(200);
    expect(offline.html).toContain('<title>商品｜LUCISSI CARE</title>');
    expect(offline.html).toContain('<meta name="robots" content="index,follow" />');
  });

  it('sends handle URLs to the numeric product URL', async () => {
    const found = await render('/product/ice-silk-brief', { product: productNode() });
    expect(found.queries[0]).toEqual({ name: 'ProductSeoByHandle', variables: { handle: 'ice-silk-brief' } });
    expect(found.response.status).toBe(308);
    expect(found.response.headers.get('location')).toBe('https://lucissicare.com/product/7819900551235');
    expect((await render('/product/gone', { product: null })).response.status).toBe(404);
    expect((await render('/product/a/b')).response.status).toBe(404);
  });

  it('builds the same Product JSON-LD on the server and in the browser', () => {
    const node = productNode({
      variants: { nodes: [{ sku: 'A', availableForSale: true, price: { amount: '645.0' } }, { sku: 'B', availableForSale: false, price: { amount: '321.0' } }] },
      priceRange: { minVariantPrice: { amount: '321.0' } },
    });
    const server = toProductSeoRecord(node)!;
    // 網站的 Storefront 查詢回傳 edges，伺服器的查詢回傳 nodes
    const edges = (list: { nodes: unknown[] }) => ({ edges: list.nodes.map((item) => ({ node: item })) });
    const browser = formatShopifyProduct({ ...node, images: edges(node.images as { nodes: unknown[] }), variants: edges(node.variants as { nodes: unknown[] }) });
    expect(buildProductJsonLd(server)).toEqual(buildProductJsonLd({ ...browser, name: browser.name || browser.title }));
    expect(buildProductJsonLd(server)?.offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 321, highPrice: 645, offerCount: 2 });
  });
});

describe('product structured data', () => {
  const base = {
    id: 'gid://shopify/Product/1',
    name: '冰絲無痕中腰三角褲',
    price: 680,
    images: [{ url: 'https://cdn.shopify.com/a.jpg' }],
    vendor: '',
    productType: '舒適內搭',
    availableForSale: true,
  };
  type Offers = { shippingDetails: { shippingRate: { value: number; currency: string }; shippingDestination: { addressCountry: string } }; hasMerchantReturnPolicy?: Record<string, unknown> };

  it('states shipping to Taiwan: the cheapest home delivery fee (順豐宅配 NT$130) below the free-shipping threshold, free from it', () => {
    const below = buildProductJsonLd(base)!.offers as Offers;
    expect(below.shippingDetails.shippingRate).toEqual({ '@type': 'MonetaryAmount', value: 130, currency: 'TWD' });
    expect(below.shippingDetails.shippingDestination.addressCountry).toBe('TW');
    const free = buildProductJsonLd({ ...base, price: DEFAULT_FREE_SHIPPING_THRESHOLD })!.offers as Offers;
    expect(free.shippingDetails.shippingRate.value).toBe(0);
    expect(structuredDataShippingRate(DEFAULT_FREE_SHIPPING_THRESHOLD - 1)).toBe(130);
  });

  it('states the delivery time from the shipping page: ships within 1 working day, arrives 1–2 working days later', () => {
    const offers = buildProductJsonLd(base)!.offers as { shippingDetails: { deliveryTime: Record<string, any> } };
    const time = offers.shippingDetails.deliveryTime;
    expect(time['@type']).toBe('ShippingDeliveryTime');
    expect(time.handlingTime).toEqual({ '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' });
    expect(time.transitTime).toEqual({ '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' });
    expect(time.businessDays.dayOfWeek).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => `https://schema.org/${day}`));
  });

  it('claims the 7-day free return only for items that are not sealed personal-care goods', () => {
    const apparel = buildProductJsonLd(base)!.offers as Offers;
    expect(apparel.hasMerchantReturnPolicy).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'TW',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnFees: 'https://schema.org/FreeReturn',
      returnMethod: 'https://schema.org/ReturnByMail',
    });
    for (const name of ['Saengak 益生菌私密養膚濕巾', 'Saengak 私密舒緩凝膠', '平衡調理私密潔淨慕斯']) {
      const sealed = buildProductJsonLd({ ...base, name, productType: '女性護理' })!;
      expect((sealed.offers as Offers).hasMerchantReturnPolicy, name).toBeUndefined();
    }
  });

  it('names the brand, falling back to LUCISSI CARE, and never adds ratings', () => {
    expect(buildProductJsonLd(base)!.brand).toEqual({ '@type': 'Brand', name: 'LUCISSI CARE' });
    expect(buildProductJsonLd({ ...base, vendor: 'My Store 7' })!.brand).toEqual({ '@type': 'Brand', name: 'LUCISSI CARE' });
    expect(buildProductJsonLd({ ...base, name: '私密潔淨慕斯', productType: '女性護理', vendor: 'SAENGAK' })!.brand).toEqual({ '@type': 'Brand', name: 'SAENGAK' });
    expect(buildProductJsonLd(base)!.aggregateRating).toBeUndefined();
  });
});

describe('home, listing and article pages', () => {
  it('describes the store on the home page', async () => {
    const { html } = await render('/', { listing: { nodes: [{ id: 'gid://shopify/Product/2', title: '純棉內褲', handle: 'cotton', tags: [] }, { id: 'gid://shopify/Product/3', title: '金流驗收測試－請勿購買', tags: [] }] } });
    expect(html).toContain('<title>LUCISSI CARE｜私密處清潔保養・無痕內褲・生理褲</title>');
    const [organization, website] = jsonLdBlocks(html);
    expect(organization).toMatchObject({
      '@type': 'Organization',
      name: 'LUCISSI CARE',
      legalName: '拜悠衣品有限公司',
      url: 'https://lucissicare.com/',
      email: 'service@lucissi.com',
      sameAs: ['https://line.me/R/ti/p/@lucissi'],
    });
    expect(organization.logo).toMatch(/\.png$/);
    expect(readFileSync(`public${new URL(organization.logo).pathname}`).length).toBeGreaterThan(0);
    expect(website).toMatchObject({ '@type': 'WebSite', inLanguage: 'zh-TW' });
    expect(html).toContain('<a href="/product/2">純棉內褲</a>');
    expect(html).not.toContain('/product/3');
  });

  it('links a category listing to the products in that category', async () => {
    const listing = { nodes: [
      { id: 'gid://shopify/Product/2', title: '純棉內褲', productType: '舒適內搭', tags: [] },
      { id: 'gid://shopify/Product/4', title: 'Saengak 私密潔淨慕斯', productType: '每日清潔', tags: [] },
    ] };
    const { html } = await render(`/products?category=${encodeURIComponent('私密保養')}&utm_source=x`, { listing });
    expect(html).toContain(`<link rel="canonical" href="https://lucissicare.com/products?category=${encodeURIComponent('私密保養')}" />`);
    expect(html).toContain('<a href="/product/4">Saengak 私密潔淨慕斯</a>');
    expect(html).not.toContain('/product/2"');
    const search = await render('/products?q=凝膠', { listing });
    expect(search.html).toContain('<meta name="robots" content="noindex,follow" />');
    expect(search.html).toContain('<link rel="canonical" href="https://lucissicare.com/products" />');
    const offline = await render('/products', { listing: new Error('timeout') });
    expect(offline.response.status).toBe(200);
    expect(offline.html).toContain('<h1>全部商品</h1>');
  });

  it('renders curated articles with BlogPosting data when Shopify has no public article', async () => {
    for (const articles of [{ nodes: [] }, new Error('offline')]) {
      const { response, html } = await render('/blog/daily-feminine-care-guide', { articles });
      expect(response.status).toBe(200);
      expect(html).toContain('<title>日常私密護理：先理解身體，再選擇產品｜LUCISSI CARE</title>');
      expect(html).toContain('<link rel="canonical" href="https://lucissicare.com/blog/daily-feminine-care-guide" />');
      expect(html).toContain('<meta property="og:type" content="article" />');
      expect(html).toContain('<meta property="og:image" content="https://lucissicare.com/images/lucissi-v5/share-care.jpg" />');
      const [posting, breadcrumbs] = jsonLdBlocks(html);
      expect(posting).toMatchObject({
        '@type': 'BlogPosting',
        headline: '日常私密護理：先理解身體，再選擇產品',
        datePublished: '2026-09-01T10:37:30Z',
        dateModified: '2026-09-01T10:37:30Z',
        author: { '@type': 'Organization', name: 'LUCISSI CARE 編輯團隊' },
        publisher: { '@type': 'Organization', name: 'LUCISSI CARE' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://lucissicare.com/blog/daily-feminine-care-guide' },
      });
      expect(posting.image).toEqual(['https://lucissicare.com/images/lucissi-v5/share-care.jpg']);
      expect(breadcrumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(['首頁', 'LUCISSI Talk', '日常私密護理：先理解身體，再選擇產品']);
    }
  });

  it('prefers a public Shopify article and answers unknown articles with 404', async () => {
    const shopifyArticle = { title: 'SAENGAK 編輯團隊的新文章', handle: 'new-article', excerpt: '摘要', publishedAt: '2026-11-01T00:00:00Z', seo: { title: null, description: null }, image: null, tags: ['公開'] };
    const found = await render('/blog/new-article', { articles: { nodes: [shopifyArticle] } });
    expect(found.response.status).toBe(200);
    expect(found.html).toContain('<title>LUCISSI CARE 編輯團隊的新文章｜LUCISSI CARE</title>');

    const hidden = await render('/blog/new-article', { articles: { nodes: [{ ...shopifyArticle, tags: ['草稿'] }] } });
    expect(hidden.response.status).toBe(404);
    expect(hidden.html).toContain('<meta name="robots" content="noindex,nofollow" />');

    // Shopify 沒有回應時不能斷定文章不存在
    const offline = await render('/blog/new-article', { articles: new Error('offline') });
    expect(offline.response.status).toBe(200);

    const list = await render('/community', { articles: { nodes: [shopifyArticle] } });
    expect(list.html).toContain('<a href="/blog/new-article">LUCISSI CARE 編輯團隊的新文章</a>');
    expect(list.html).not.toContain('/blog/daily-feminine-care-guide');

    // 有公開的 Shopify 文章時，網站只用 Shopify 文章，精選文章的網址視同不存在（與文章頁相同）
    const curated = await render('/blog/daily-feminine-care-guide', { articles: { nodes: [shopifyArticle] } });
    expect(curated.response.status).toBe(404);
  });

  it('computes the head without waiting on the shell', async () => {
    const head = await documentHeadFor(new URL('https://lucissicare.com/login'), fakeFetch().impl);
    expect(head).toMatchObject({ title: '會員登入｜LUCISSI CARE', robots: 'noindex,nofollow', status: 200 });
    expect(head.fallback).toBeUndefined();
  });
});
