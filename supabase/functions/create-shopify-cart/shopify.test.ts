import { describe, expect, it } from 'vitest';
import {
  buildStorefrontHeaders,
  getBuyerIp,
  isValidShopifyDomain,
  normalizeShopifyDomain,
  resolveShopifyDomain,
} from './shopify';

describe('Shopify Storefront request configuration', () => {
  it('normalizes and validates a myshopify domain', () => {
    expect(normalizeShopifyDomain(' https://example-store.myshopify.com/ '))
      .toBe('example-store.myshopify.com');
    expect(isValidShopifyDomain('example-store.myshopify.com')).toBe(true);
    expect(isValidShopifyDomain('example.com')).toBe(false);
  });

  it('pins checkout to the active SAENGAK store even with an obsolete override', () => {
    expect(resolveShopifyDomain(undefined)).toBe('gh2xgs-zf.myshopify.com');
    expect(resolveShopifyDomain('zy6dge-rn.myshopify.com'))
      .toBe('gh2xgs-zf.myshopify.com');
  });

  it('supports tokenless Cart requests and forwards the buyer IP', () => {
    expect(buildStorefrontHeaders(undefined, '203.0.113.8')).toEqual({
      'Content-Type': 'application/json',
      'Shopify-Storefront-Buyer-IP': '203.0.113.8',
    });
  });

  it('adds a configured public Storefront token and selects the first proxy IP', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });
    expect(getBuyerIp(headers)).toBe('203.0.113.9');
    expect(buildStorefrontHeaders(' storefront-token ', undefined)).toEqual({
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': 'storefront-token',
    });
  });
});
