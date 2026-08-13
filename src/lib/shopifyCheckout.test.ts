import { describe, expect, it } from 'vitest';
import {
  getShopifyCheckoutErrorMessage,
  validateShopifyCheckoutUrl,
} from './shopifyCheckout';

describe('Shopify checkout safeguards', () => {
  it('accepts only the active SAENGAK Shopify checkout host', () => {
    expect(validateShopifyCheckoutUrl(
      'https://gh2xgs-zf.myshopify.com/checkouts/cn/example',
    )).toBe('https://gh2xgs-zf.myshopify.com/checkouts/cn/example');

    expect(() => validateShopifyCheckoutUrl(
      'https://zy6dge-rn.myshopify.com/checkouts/cn/legacy',
    )).toThrow('Shopify 結帳商店不符');
  });

  it('rejects insecure checkout URLs', () => {
    expect(() => validateShopifyCheckoutUrl(
      'http://gh2xgs-zf.myshopify.com/checkouts/cn/example',
    )).toThrow('不安全的結帳網址');
  });

  it('translates the Shopify locked-channel response for customers', () => {
    expect(getShopifyCheckoutErrorMessage({
      error: 'Shopify GraphQL request failed',
      details: ['Online Store channel is locked.'],
    }, 502)).toContain('Shopify 商店尚未解鎖');
  });

  it('explains why sensitive invoice preferences require a member session', () => {
    expect(getShopifyCheckoutErrorMessage({
      error: 'Sign in before saving invoice details',
      code: 'INVOICE_PREFERENCE_REQUIRES_MEMBER',
    }, 401)).toContain('請先登入會員');
  });
});
