import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, renderSitemap, STATIC_PATHS } from '../api/sitemap.js';

afterEach(() => vi.unstubAllGlobals());

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

  it('follows Storefront pagination and returns cacheable XML', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(page([{ id: 'gid://shopify/Product/1' }], { hasNextPage: true, endCursor: 'next' }))
      .mockResolvedValueOnce(page([{ id: 'gid://shopify/Product/2' }]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const xml = await response.text();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).variables.after).toBe('next');
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(xml).toContain('/product/1<');
    expect(xml).toContain('/product/2<');
  });

  it('still serves the static pages with a short cache when Shopify fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 502 })));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(await response.text()).toContain('<loc>https://lucissicare.com/products</loc>');
  });

  it('is rewritten before the SPA catch-all, with no static file shadowing it', () => {
    const { rewrites } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string; destination: string }[] };
    expect(rewrites[0]).toEqual({ source: '/sitemap.xml', destination: '/api/sitemap' });
    expect(() => readFileSync('public/sitemap.xml')).toThrow();
    expect(readFileSync('public/robots.txt', 'utf8')).toContain('Sitemap: https://lucissicare.com/sitemap.xml');
  });
});
