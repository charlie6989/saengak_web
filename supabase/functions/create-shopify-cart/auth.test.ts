import { describe, expect, it } from 'vitest';
import { getAcceptedPublicKeys, hasAcceptedPublicKey, isCheckoutReleaseEnabled } from './auth';

describe('create-shopify-cart public key validation', () => {
  it('accepts both a legacy anon key and named publishable keys', () => {
    const keys = getAcceptedPublicKeys(
      'legacy-anon',
      JSON.stringify({ default: 'sb_publishable_default', checkout: 'sb_publishable_checkout' }),
    );

    expect([...keys]).toEqual([
      'legacy-anon',
      'sb_publishable_default',
      'sb_publishable_checkout',
    ]);
    expect(hasAcceptedPublicKey('sb_publishable_checkout', 'legacy-anon', JSON.stringify({
      checkout: 'sb_publishable_checkout',
    }))).toBe(true);
  });

  it('rejects missing, unknown, and malformed key input', () => {
    expect(hasAcceptedPublicKey(null, 'legacy-anon', undefined)).toBe(false);
    expect(hasAcceptedPublicKey('unknown', 'legacy-anon', undefined)).toBe(false);
    expect(hasAcceptedPublicKey('anything', undefined, '{not-json')).toBe(false);
  });

  it('keeps checkout disabled unless the release switch is explicitly true', () => {
    expect(isCheckoutReleaseEnabled(undefined)).toBe(false);
    expect(isCheckoutReleaseEnabled('false')).toBe(false);
    expect(isCheckoutReleaseEnabled('true')).toBe(true);
  });
});
