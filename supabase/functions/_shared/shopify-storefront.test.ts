import { describe, expect, it } from 'vitest';
import {
  buildStorefrontHeaders,
  buildStorefrontUrl,
  isValidShopifyDomain,
  resolveShopifyDomain,
  resolveStorefrontApiVersion,
  shouldIncludeStorefrontInventory,
  LUCISSI_CARE_SHOPIFY_DOMAIN,
} from './shopify-storefront';

describe('LUCISSI CARE Shopify Storefront configuration', () => {
  it('uses the dedicated LUCISSI CARE shop when no environment override exists', () => {
    expect(resolveShopifyDomain(undefined)).toBe(LUCISSI_CARE_SHOPIFY_DOMAIN);
    expect(resolveShopifyDomain('')).toBe(LUCISSI_CARE_SHOPIFY_DOMAIN);
  });

  it('ignores overrides that do not match the active LUCISSI CARE shop', () => {
    expect(resolveShopifyDomain(' https://example.myshopify.com/ '))
      .toBe(LUCISSI_CARE_SHOPIFY_DOMAIN);
    expect(resolveShopifyDomain('https://example.com'))
      .toBe(LUCISSI_CARE_SHOPIFY_DOMAIN);
    expect(isValidShopifyDomain(resolveShopifyDomain('https://example.com'))).toBe(true);
  });

  it('pins unsupported or missing API versions to the current supported baseline', () => {
    expect(resolveStorefrontApiVersion(undefined)).toBe('2026-07');
    expect(resolveStorefrontApiVersion('latest')).toBe('2026-07');
    expect(resolveStorefrontApiVersion('2026-04')).toBe('2026-04');
  });

  it('omits the Storefront token header for tokenless queries', () => {
    expect(buildStorefrontHeaders(undefined)).toEqual({ 'Content-Type': 'application/json' });
    expect(buildStorefrontHeaders(' token ', '203.0.113.1')).toEqual({
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': 'token',
      'Shopify-Storefront-Buyer-IP': '203.0.113.1',
    });
  });

  it('builds the versioned GraphQL endpoint', () => {
    expect(buildStorefrontUrl('shop.myshopify.com', '2026-07'))
      .toBe('https://shop.myshopify.com/api/2026-07/graphql.json');
  });

  it('requests restricted inventory only when explicitly enabled', () => {
    expect(shouldIncludeStorefrontInventory(undefined)).toBe(false);
    expect(shouldIncludeStorefrontInventory('false')).toBe(false);
    expect(shouldIncludeStorefrontInventory(' TRUE ')).toBe(true);
  });
});
