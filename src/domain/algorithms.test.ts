import { describe, expect, it } from 'vitest';
import {
  calculateEditorialScore,
  buildShopifyCheckoutLines,
  clampCartQuantity,
  deriveCatalogSignals,
  estimateReadingMinutes,
  paginateItems,
  rankProducts,
} from './algorithms';
import { mockProducts } from '../mocks/products';

const products = [
  { id: '1', name: '溫和私密清潔露', description: '敏感肌適用', tags: ['女性護理'], price: 680 },
  { id: '2', name: '抗菌無痕內褲', description: '日常舒適', tags: ['內褲', '抗菌'], price: 890 },
];

describe('catalog algorithms', () => {
  it('expands Chinese intent and ranks a matching product first', () => {
    expect(rankProducts(products, '敏感')[0].id).toBe('1');
    expect(rankProducts(products, '底褲')[0].id).toBe('2');
  });

  it('uses deterministic editorial evidence', () => {
    expect(calculateEditorialScore({ ...products[0], isBest: true, reviews: 100 }))
      .toBeGreaterThan(calculateEditorialScore(products[1]));
  });

  it('derives catalog badges only from source evidence', () => {
    expect(deriveCatalogSignals({ reviews: 12.8, tags: ['featured', 'new-arrival'] })).toEqual({
      reviews: 12,
      isBest: true,
      isNew: true,
    });
    expect(deriveCatalogSignals({ reviews: '500', isBest: 'yes' })).toEqual({
      reviews: 0,
      isBest: false,
      isNew: false,
    });
  });

  it('estimates reading time and clamps cart quantities', () => {
    expect(estimateReadingMinutes('這是一段內容')).toBe(1);
    expect(clampCartQuantity(0)).toBe(1);
    expect(clampCartQuantity(120)).toBe(99);
  });

  it('paginates results and clamps invalid page requests', () => {
    expect(paginateItems([1, 2, 3, 4, 5], 2, 2)).toEqual({
      items: [3, 4],
      page: 2,
      pageSize: 2,
      pageCount: 3,
      totalItems: 5,
    });
    expect(paginateItems([1], 99, 0).page).toBe(1);
  });

  it('builds Shopify cart lines only when every item has a variant ID', () => {
    expect(buildShopifyCheckoutLines([])).toEqual({
      ready: false,
      reason: 'empty_cart',
      missingItemIds: [],
    });

    expect(buildShopifyCheckoutLines([
      { id: 'display-product', quantity: 1 },
    ])).toEqual({
      ready: false,
      reason: 'missing_variant',
      missingItemIds: ['display-product'],
    });

    expect(buildShopifyCheckoutLines([
      { id: 'product-1', variantId: 'gid://shopify/ProductVariant/1', quantity: 2 },
      { id: 'product-1', variantId: 'gid://shopify/ProductVariant/1', quantity: 3 },
    ])).toEqual({
      ready: true,
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 5 }],
    });
  });

  it('binds the sellable mock cleanser to the current Shopify variant', () => {
    const cleanser = mockProducts.find((product) => product.id === '3');

    expect(cleanser).toBeDefined();
    expect(buildShopifyCheckoutLines([{ ...cleanser!, quantity: 1 }])).toEqual({
      ready: true,
      lines: [{
        merchandiseId: 'gid://shopify/ProductVariant/43639647502403',
        quantity: 1,
      }],
    });
  });
});
