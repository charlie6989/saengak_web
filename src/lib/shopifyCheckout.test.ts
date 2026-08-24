import { describe, expect, it } from 'vitest';
import {
  assertMemberOrderTracking,
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

  it('explains why checkout requires a member session', () => {
    expect(getShopifyCheckoutErrorMessage({
      error: 'Sign in before checkout',
      code: 'MEMBER_LOGIN_REQUIRED',
    }, 401)).toContain('請先登入會員');
  });

  it('asks the customer to sign in again when the member session expired', () => {
    expect(getShopifyCheckoutErrorMessage({
      error: 'Invalid or expired member session',
      code: 'MEMBER_SESSION_INVALID',
    }, 401)).toContain('請重新登入');
  });

  it('stops a signed-in member before redirect when order tracking was not linked', () => {
    expect(() => assertMemberOrderTracking({
      checkoutUrl: 'https://gh2xgs-zf.myshopify.com/checkouts/cn/example',
      orderTrackingLinked: false,
    }, true)).toThrow('無法把 Shopify 訂單綁定到會員帳號');

    expect(() => assertMemberOrderTracking({
      checkoutUrl: 'https://gh2xgs-zf.myshopify.com/checkouts/cn/example',
      orderTrackingLinked: true,
    }, true)).not.toThrow();
  });
});
