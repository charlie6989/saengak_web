import { describe, expect, it } from 'vitest';
import {
  getBearerToken,
  getPreferredPublicKey,
  getPreferredSecretKey,
} from './auth';
import { extractShopifyCartToken } from './shopify';

describe('member checkout linkage', () => {
  it('selects named Supabase keys before legacy keys', () => {
    expect(getPreferredPublicKey('legacy', JSON.stringify({ default: 'publishable' })))
      .toBe('publishable');
    expect(getPreferredSecretKey('legacy-secret', JSON.stringify({ checkout: 'secret' })))
      .toBe('secret');
  });

  it('parses only valid bearer authorization', () => {
    expect(getBearerToken('Bearer member-jwt')).toBe('member-jwt');
    expect(getBearerToken('Basic member-jwt')).toBeUndefined();
  });

  it('extracts the server-created cart token used for order linkage', () => {
    expect(extractShopifyCartToken('gid://shopify/Cart/cart-token-123456?key=secret-part'))
      .toBe('cart-token-123456');
    expect(extractShopifyCartToken('gid://shopify/Product/123')).toBeUndefined();
  });
});
