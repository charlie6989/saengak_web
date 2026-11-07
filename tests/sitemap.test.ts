import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSitemapProducts, renderSitemap, STATIC_PATHS } from '../src/domain/sitemap';

afterEach(() => vi.unstubAllGlobals());

const config = { domain: 'shop.example', apiVersion: '2026-07', token: 'public-token' };
const page = (nodes: unknown[], pageInfo: unknown = { hasNextPage: false, endCursor: null }) =>
  new Response(JSON.stringify({ data: { products: { nodes, pageInfo } } }), { status: 200 });

describe('sitemap', () => {
  it('lists static pages and products by numeric product URL', () => {
    const xml = renderSitemap([
      { id: 'gid://shopify/Product/7819900551235', updatedAt: '2026-10-25T01:02:03Z' },
      { id: 'not-a-product-gid' },
    ]);
    expect(xml).toContain('<loc>https://lucissicare.com/product/7819900551235</loc><lastmod>2026-10-25T01:02:03Z</lastmod>');
    expect(xml).not.toContain('not-a-product-gid');
    for (const path of STATIC_PATHS) expect(xml).toContain(`<loc>https://lucissicare.com${path}</loc>`);
  });

  it('never lists private or transitional pages', () => {
    for (const path of ['/admin', '/profile', '/welcome', '/auth/confirm']) {
      expect(STATIC_PATHS).not.toContain(path);
    }
  });

  it('lists the article index, not URLs that only redirect', () => {
    expect(STATIC_PATHS).toContain('/community');
    expect(STATIC_PATHS).not.toContain('/blog');
    expect(STATIC_PATHS).not.toContain('/brand-story');
  });

  it('leaves out internal test products, as the storefront does', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page([
      { id: 'gid://shopify/Product/1', title: '金流驗收測試－請勿購買' },
      { id: 'gid://shopify/Product/2', title: '絨面收納包', tags: ['隨身收納'] },
    ])));

    const products = await fetchSitemapProducts(config);

    expect(products.map((product) => product.id)).toEqual(['gid://shopify/Product/2']);
  });

  it('follows Storefront pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(page([{ id: 'gid://shopify/Product/1' }], { hasNextPage: true, endCursor: 'next' }))
      .mockResolvedValueOnce(page([{ id: 'gid://shopify/Product/2' }]));
    vi.stubGlobal('fetch', fetchMock);

    const products = await fetchSitemapProducts(config);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).variables.after).toBe('next');
    expect(products.map((product) => product.id)).toEqual(['gid://shopify/Product/1', 'gid://shopify/Product/2']);
  });

  it('throws when Shopify fails, so the build can warn and fall back to static pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 502 })));
    await expect(fetchSitemapProducts(config)).rejects.toThrow('502');
    expect(renderSitemap([])).toContain('<loc>https://lucissicare.com/products</loc>');
  });

  it('is served from the build output, with no rewrite or static file shadowing it', () => {
    const { rewrites } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string }[] };
    expect(rewrites.map((rewrite) => rewrite.source)).not.toContain('/sitemap.xml');
    expect(() => readFileSync('public/sitemap.xml')).toThrow();
    expect(readFileSync('public/robots.txt', 'utf8')).toContain('Sitemap: https://lucissicare.com/sitemap.xml');
  });
});
