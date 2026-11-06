import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMetaDescription, buildProductJsonLd, productCanonicalUrl, productMetaDescription, productPageTitle, summarizeText } from '../src/lib/productMeta';

afterEach(() => vi.unstubAllGlobals());

describe('product page meta', () => {
  it('uses the Shopify SEO title when it is filled in', () => {
    expect(productPageTitle({ name: '冰絲無痕中腰三角褲', seoTitle: '冰絲無痕中腰三角褲 無痕切邊 涼感' })).toBe(
      '冰絲無痕中腰三角褲 無痕切邊 涼感｜LUCISSI CARE',
    );
  });

  it('falls back to the product name when the SEO title is empty', () => {
    expect(productPageTitle({ name: '冰絲無痕中腰三角褲', seoTitle: '  ' })).toBe('冰絲無痕中腰三角褲｜LUCISSI CARE');
    expect(productPageTitle({ name: '冰絲無痕中腰三角褲' })).toBe('冰絲無痕中腰三角褲｜LUCISSI CARE');
  });

  it('prefers the SEO description and otherwise summarises the product description', () => {
    expect(productMetaDescription({ name: 'x', seoDescription: '中腰冰絲女三角褲。', description: '說明' })).toBe('中腰冰絲女三角褲。');
    expect(productMetaDescription({ name: 'x', description: '第一段，\n  第二段。' })).toBe('第一段， 第二段。');
    expect(summarizeText('字'.repeat(200))).toHaveLength(120);
  });

  it('sets the description tags and restores the previous content', () => {
    const tags = new Map<string, { content: string | null }>([
      ['meta[name="description"]', { content: '網站預設說明' }],
      ['meta[property="og:description"]', { content: '網站預設說明' }],
    ]);
    const elements = new Map(
      [...tags].map(([selector, state]) => [
        selector,
        {
          getAttribute: () => state.content,
          setAttribute: (_: string, value: string) => {
            state.content = value;
          },
          removeAttribute: () => {
            state.content = null;
          },
        },
      ]),
    );
    vi.stubGlobal('document', { querySelector: (selector: string) => elements.get(selector) ?? null });

    const restore = applyMetaDescription('商品說明');
    expect(tags.get('meta[name="description"]')?.content).toBe('商品說明');
    expect(tags.get('meta[property="og:description"]')?.content).toBe('商品說明');

    restore();
    expect(tags.get('meta[name="description"]')?.content).toBe('網站預設說明');
    expect(tags.get('meta[property="og:description"]')?.content).toBe('網站預設說明');
  });

  it('leaves the tags alone when there is no description', () => {
    const setAttribute = vi.fn();
    vi.stubGlobal('document', { querySelector: () => ({ getAttribute: () => 'x', setAttribute, removeAttribute: vi.fn() }) });
    applyMetaDescription('')();
    expect(setAttribute).not.toHaveBeenCalled();
  });
});

describe('product page SEO', () => {
  const product = {
    id: 'gid://shopify/Product/7819900551235',
    name: '冰絲無痕中腰三角褲',
    description: '商品說明',
    price: 680,
    image: 'https://cdn.shopify.com/a.jpg',
    images: [{ url: 'https://cdn.shopify.com/a.jpg' }, { url: 'https://cdn.shopify.com/b.jpg' }],
    vendor: 'LUCISSI',
    availableForSale: true,
    variants: [{ availableForSale: true, sku: 'SKU-1' }],
  };

  it('builds the canonical URL from the numeric product ID', () => {
    expect(productCanonicalUrl(product.id)).toBe('https://lucissicare.com/product/7819900551235');
    expect(productCanonicalUrl('7819900551235')).toBe('https://lucissicare.com/product/7819900551235');
    expect(productCanonicalUrl('some-handle')).toBeUndefined();
    expect(productCanonicalUrl(undefined)).toBeUndefined();
  });

  it('describes the offer in TWD with live availability', () => {
    const jsonLd = buildProductJsonLd(product)!;
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.url).toBe('https://lucissicare.com/product/7819900551235');
    expect(jsonLd.image).toEqual(['https://cdn.shopify.com/a.jpg', 'https://cdn.shopify.com/b.jpg']);
    expect(jsonLd.sku).toBe('SKU-1');
    expect(jsonLd.offers).toMatchObject({ price: 680, priceCurrency: 'TWD', availability: 'https://schema.org/InStock' });
  });

  it('reports sold-out products as out of stock', () => {
    const jsonLd = buildProductJsonLd({ ...product, availableForSale: false })!;
    expect((jsonLd.offers as { availability: string }).availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits a single SKU for multi-variant products and never adds ratings', () => {
    const jsonLd = buildProductJsonLd({ ...product, variants: [{ sku: 'A' }, { sku: 'B' }] })!;
    expect(jsonLd.sku).toBeUndefined();
    expect(jsonLd.aggregateRating).toBeUndefined();
    expect(jsonLd.review).toBeUndefined();
  });

  it('emits nothing for a product it cannot describe accurately', () => {
    expect(buildProductJsonLd({ ...product, price: 0 })).toBeUndefined();
    expect(buildProductJsonLd({ ...product, id: 'some-handle' })).toBeUndefined();
  });
});
