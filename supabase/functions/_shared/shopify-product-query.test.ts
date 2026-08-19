import { describe, expect, it } from 'vitest';
import {
  buildShopifyProductsQuery,
  parseShopifyProductIds,
} from './shopify-product-query';

describe('Shopify product query safeguards', () => {
  it('normalizes exact numeric and Product GID inputs', () => {
    expect(parseShopifyProductIds([
      '7786993614915',
      'gid://shopify/Product/7786993614916',
    ])).toEqual({
      ok: true,
      ids: [
        'gid://shopify/Product/7786993614915',
        'gid://shopify/Product/7786993614916',
      ],
    });
  });

  it('rejects malformed and injectable product IDs', () => {
    for (const productId of [
      'gid://shopify/Product/123/extra',
      'gid://shopify/Product/0',
      '123\") { variants(first: 10) { edges { node { quantityAvailable } } } #',
      123,
    ]) {
      expect(parseShopifyProductIds([productId])).toMatchObject({ ok: false });
    }
  });

  it('limits product lookup batches to 50 IDs', () => {
    expect(parseShopifyProductIds(
      Array.from({ length: 51 }, (_, index) => String(index + 1)),
    )).toEqual({ ok: false, error: 'At most 50 product IDs are allowed' });
  });

  it('uses GraphQL variables and keeps optional fields server-controlled', () => {
    const query = buildShopifyProductsQuery(false, false);
    expect(query).toContain('query GetProducts($ids: [ID!]!)');
    expect(query).toContain('nodes(ids: $ids)');
    expect(query).not.toContain('quantityAvailable');

    const privilegedQuery = buildShopifyProductsQuery(true, true);
    expect(privilegedQuery).toContain('tags');
    expect(privilegedQuery).toContain('quantityAvailable');
  });
});
