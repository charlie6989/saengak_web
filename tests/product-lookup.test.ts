import { afterEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@shopify/storefront-api-client', () => ({ createStorefrontApiClient: () => ({ request }) }));
vi.mock('../src/lib/sentry', () => ({ captureExceptionSafe: () => {} }));

import { getShopifyProduct, lookupShopifyProduct } from '../src/lib/shopify';

const PRODUCT_ID = '7829164785731';

function productNode(title = 'Saengak 全效微生態修護組') {
  return {
    id: `gid://shopify/Product/${PRODUCT_ID}`,
    title,
    handle: 'saengak-full-care-set',
    priceRange: { minVariantPrice: { amount: '1680.0', currencyCode: 'TWD' } },
    compareAtPriceRange: { minVariantPrice: { amount: '0.0', currencyCode: 'TWD' } },
    images: { edges: [] },
    variants: { edges: [] },
    tags: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  request.mockReset();
});

describe('lookupShopifyProduct', () => {
  it('finds a public product by numeric id', async () => {
    request.mockResolvedValueOnce({ data: { node: productNode() } });
    const result = await lookupShopifyProduct(PRODUCT_ID);
    expect(result.status).toBe('found');
    expect(result.status === 'found' && result.product.id).toBe(`gid://shopify/Product/${PRODUCT_ID}`);
  });

  it('reports not-found only when Shopify answered and the product does not exist', async () => {
    request.mockResolvedValueOnce({ data: { node: null } }).mockResolvedValueOnce({ data: { product: null } });
    expect(await lookupShopifyProduct(PRODUCT_ID)).toEqual({ status: 'not-found' });
  });

  it('reports unavailable, not not-found, when every Storefront request fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    request.mockRejectedValue(new Error('network timeout'));
    expect(await lookupShopifyProduct(PRODUCT_ID)).toEqual({ status: 'unavailable' });
    expect(await lookupShopifyProduct('saengak-full-care-set')).toEqual({ status: 'unavailable' });
  });

  it('reports unavailable when the id query fails and the handle fallback finds nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    request.mockResolvedValueOnce({ errors: { message: 'Throttled' } }).mockResolvedValueOnce({ data: { product: null } });
    expect(await lookupShopifyProduct(PRODUCT_ID)).toEqual({ status: 'unavailable' });
  });

  it('keeps getShopifyProduct returning null for both missing and unavailable products', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    request.mockRejectedValue(new Error('network timeout'));
    expect(await getShopifyProduct(PRODUCT_ID)).toBeNull();
  });
});
