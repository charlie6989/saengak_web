import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from '../api/_lib/security';

describe('LUCISSI CARE domain migration', () => {
  it('allows new-domain cross-origin API calls during migration', () => {
    const request = new Request('https://www.saengak.com.tw/api/create-shopify-cart');
    expect(isOriginAllowed('https://lucissicare.com', request)).toBe(true);
    expect(isOriginAllowed('https://www.lucissicare.com', request)).toBe(true);
    expect(isOriginAllowed('https://lucissicare.com.attacker.example', request)).toBe(false);
  });

  it('allows origin-less GET requests on the new host', () => {
    const request = new Request('https://lucissicare.com/api/shopify/discounts');
    expect(isOriginAllowed(null, request)).toBe(true);
  });
});
