import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, articleShareMeta, productShareMeta, renderShareHtml, summarize } from '../api/share/product.js';
import middleware from '../middleware.js';

const product = {
  title: 'Saengak 益生菌私密養膚濕巾',
  description: '單片獨立包裝，  外出\n隨身使用。',
  featuredImage: { url: 'https://cdn.shopify.com/wipes.jpg', width: 1200, height: 1500, altText: null },
};

afterEach(() => vi.unstubAllGlobals());

describe('product share preview', () => {
  it('builds product meta with the brand suffix, canonical url and image', () => {
    const meta = productShareMeta('7819900551235', product);

    expect(meta.title).toBe('Saengak 益生菌私密養膚濕巾｜LUCISSI CARE');
    expect(meta.description).toBe('單片獨立包裝， 外出 隨身使用。');
    expect(meta.url).toBe('https://lucissicare.com/product/7819900551235');
    expect(meta.type).toBe('product');
    expect(meta.image).toEqual({ url: 'https://cdn.shopify.com/wipes.jpg', width: 1200, height: 1500, alt: product.title });
  });

  it('prefers the Shopify SEO title and description when they are filled in', () => {
    const meta = productShareMeta('7819900551235', {
      ...product,
      seo: { title: 'Saengak 益生菌私密養膚濕巾 單片獨立包裝', description: '韓國製私密濕巾，單片獨立包裝。' },
    });

    expect(meta.title).toBe('Saengak 益生菌私密養膚濕巾 單片獨立包裝｜LUCISSI CARE');
    expect(meta.description).toBe('韓國製私密濕巾，單片獨立包裝。');
  });

  it('falls back to the product title and description when the SEO fields are blank', () => {
    const meta = productShareMeta('7819900551235', { ...product, seo: { title: ' ', description: null } });

    expect(meta.title).toBe('Saengak 益生菌私密養膚濕巾｜LUCISSI CARE');
    expect(meta.description).toBe('單片獨立包裝， 外出 隨身使用。');
  });

  it('falls back to the site preview when the product is missing', () => {
    const meta = productShareMeta('1', null);

    expect(meta.title).toBe('LUCISSI CARE｜LUCISSI 的日常照護系列');
    expect(meta.url).toBe('https://lucissicare.com/product/1');
    expect(meta.image.url).toBe('https://lucissicare.com/images/brand/og-image.png');
  });

  it('truncates long descriptions and escapes html', () => {
    expect(summarize('a'.repeat(200))).toHaveLength(120);
    const html = renderShareHtml(productShareMeta('1', { title: '"<b>' }));
    expect(html).toContain('content="&quot;&lt;b&gt;｜LUCISSI CARE"');
    expect(html).not.toContain('<b>');
  });

  it('queries the storefront by product id and serves cacheable html', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { product } })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('https://lucissicare.com/api/share/product?id=7819900551235'));
    const html = await response.text();

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables.id).toBe('gid://shopify/Product/7819900551235');
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(html).toContain('<meta property="og:image" content="https://cdn.shopify.com/wipes.jpg" />');
  });

  it('never calls shopify for a malformed id and still returns the site preview', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('https://lucissicare.com/api/share/product?id=abc'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('LUCISSI CARE｜LUCISSI 的日常照護系列');
  });

  it('keeps the site preview when shopify fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const response = await GET(new Request('https://lucissicare.com/api/share/product?id=1'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('og:url" content="https://lucissicare.com/product/1"');
  });
});

const article = {
  title: '我們如何整理產品與內容：SAENGAK 編輯團隊的透明度承諾',
  handle: 'how-we-review-products-and-content',
  excerpt: '所有產品資訊堅持來源透明與成分公開。',
  seo: { title: null, description: null },
  image: { url: 'https://cdn.shopify.com/article.jpg', width: 1376, height: 768, altText: null },
  tags: ['SAENGAK', '公開'],
};

describe('article share preview', () => {
  it('uses the storefront-name rewrite, the excerpt and the editorial share image', () => {
    const meta = articleShareMeta(article.handle, article);

    expect(meta.title).toBe('我們如何整理產品與內容：LUCISSI CARE 編輯團隊的透明度承諾｜LUCISSI CARE');
    expect(meta.description).toBe('所有產品資訊堅持來源透明與成分公開。');
    expect(meta.url).toBe('https://lucissicare.com/blog/how-we-review-products-and-content');
    expect(meta.type).toBe('article');
    expect(meta.image).toMatchObject({ url: 'https://lucissicare.com/images/lucissi-v5/share-standards.jpg', width: 1200, height: 630 });
  });

  it('falls back to the Shopify article image when there is no editorial image', () => {
    const meta = articleShareMeta('new-article', { ...article, handle: 'new-article' });

    expect(meta.image.url).toBe('https://cdn.shopify.com/article.jpg');
  });

  it('serves the article preview and hides articles without a public tag', async () => {
    const respond = (tags: string[]) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { articles: { nodes: [{ ...article, tags }] } } })));

    vi.stubGlobal('fetch', respond(['公開']));
    let html = await (await GET(new Request(`https://lucissicare.com/api/share/product?article=${article.handle}`))).text();
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('LUCISSI CARE 編輯團隊');

    vi.stubGlobal('fetch', respond(['草稿']));
    html = await (await GET(new Request(`https://lucissicare.com/api/share/product?article=${article.handle}`))).text();
    expect(html).toContain('<meta property="og:title" content="LUCISSI CARE｜LUCISSI 的日常照護系列" />');
    expect(html).toContain('og:url" content="https://lucissicare.com/blog/how-we-review-products-and-content"');
  });

  it('never calls shopify for a malformed handle', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('https://lucissicare.com/api/share/product?article=..%2Fadmin'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.text()).toContain('LUCISSI CARE｜LUCISSI 的日常照護系列');
  });
});

describe('share preview middleware', () => {
  const rewriteTarget = (path: string, ua: string) =>
    middleware(new Request(`https://lucissicare.com${path}`, { headers: { 'user-agent': ua } })).headers.get('x-middleware-rewrite');

  it('rewrites link-preview bots for products and articles only', () => {
    expect(rewriteTarget('/product/7819900551235', 'facebookexternalhit/1.1')).toBe('https://lucissicare.com/api/share/product?id=7819900551235');
    expect(rewriteTarget('/blog/daily-feminine-care-guide', 'facebookexternalhit/1.1;line-poker/1.0')).toBe('https://lucissicare.com/api/share/product?article=daily-feminine-care-guide');
    expect(rewriteTarget('/blog/daily-feminine-care-guide', 'Mozilla/5.0 Line/14.0')).toBeNull();
    expect(rewriteTarget('/blog/Bad_Handle', 'facebookexternalhit/1.1')).toBeNull();
  });
});
