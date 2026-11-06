import { describe, expect, it } from 'vitest';
import { CORE_FEATURED_KEYWORDS, selectFeaturedProducts } from './featuredProducts';

const product = (id: string, name: string, options: { soldOut?: boolean; tagged?: boolean } = {}) => ({
  id,
  name,
  availableForSale: !options.soldOut,
  tagged: Boolean(options.tagged),
});
const isTagged = (item: { tagged: boolean }) => item.tagged;
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('selectFeaturedProducts', () => {
  it('drops sold-out featured products when enough in-stock featured products fill the slots', () => {
    const selected = selectFeaturedProducts([
      product('sold', '精選售完', { tagged: true, soldOut: true }),
      product('a', '精選A', { tagged: true }),
      product('b', '精選B', { tagged: true }),
      product('c', '精選C', { tagged: true }),
      product('d', '精選D', { tagged: true }),
      product('e', '精選E', { tagged: true }),
    ], isTagged);
    expect(ids(selected)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('fills open slots with other in-stock products instead of showing sold-out featured ones', () => {
    const selected = selectFeaturedProducts([
      product('other1', '一般商品一'),
      product('sold', '精選售完', { tagged: true, soldOut: true }),
      product('a', '精選A', { tagged: true }),
      product('other2', '一般商品二'),
      product('other3', '一般商品三'),
    ], isTagged);
    expect(ids(selected)).toEqual(['a', 'other1', 'other2', 'other3']);
  });

  it('orders core products by the configured priority after tagged products', () => {
    const selected = selectFeaturedProducts([
      product('core-last', CORE_FEATURED_KEYWORDS[4]),
      product('core-first', CORE_FEATURED_KEYWORDS[0]),
      product('tagged', '精選A', { tagged: true }),
    ], isTagged, 3);
    expect(ids(selected)).toEqual(['tagged', 'core-first', 'core-last']);
  });

  it('uses sold-out featured products only as a last resort, after every in-stock product', () => {
    const selected = selectFeaturedProducts([
      product('sold', '精選售完', { tagged: true, soldOut: true }),
      product('other', '一般商品'),
      product('sold-plain', '一般售完', { soldOut: true }),
    ], isTagged);
    expect(ids(selected)).toEqual(['other', 'sold']);
  });

  it('treats a product whose variants are all sold out as sold out', () => {
    const allSoldOut = {
      ...product('variants', '精選規格售完', { tagged: true }),
      variants: [{ availableForSale: false }],
    };
    const selected = selectFeaturedProducts([allSoldOut, product('other', '一般商品')], isTagged, 1);
    expect(ids(selected)).toEqual(['other']);
  });
});
