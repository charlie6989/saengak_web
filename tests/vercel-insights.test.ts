import { describe, expect, it } from 'vitest';
import { insightsEnabled, insightsRoute, redactInsightsUrl } from '../src/lib/vercelInsights';
import { isPassthroughPath } from '../middleware';

function storage(value: string | null) {
  return { getItem: () => value };
}

describe('vercel insights', () => {
  it('runs only on the production domains', () => {
    expect(insightsEnabled('lucissicare.com')).toBe(true);
    expect(insightsEnabled('www.lucissicare.com')).toBe(true);
    expect(insightsEnabled('saengak-web-d2ux.vercel.app')).toBe(false);
    expect(insightsEnabled('localhost')).toBe(false);
  });

  it('drops query strings except product category filters', () => {
    expect(redactInsightsUrl('https://lucissicare.com/order-status?order_id=1019&email=a%40b.c', storage(null))).toBe('https://lucissicare.com/order-status');
    expect(redactInsightsUrl('https://lucissicare.com/products?category=%E7%94%9F%E7%90%86%E6%9C%9F&q=x', storage(null))).toBe(
      'https://lucissicare.com/products?category=%E7%94%9F%E7%90%86%E6%9C%9F',
    );
    expect(redactInsightsUrl('https://lucissicare.com/', storage(null))).toBe('https://lucissicare.com/');
  });

  it('skips admin, auth callback and reset-password pages', () => {
    expect(redactInsightsUrl('https://lucissicare.com/admin/orders', storage(null))).toBeNull();
    expect(redactInsightsUrl('https://lucissicare.com/auth/callback?code=x', storage(null))).toBeNull();
    expect(redactInsightsUrl('https://lucissicare.com/reset-password', storage(null))).toBeNull();
  });

  it('skips browsers marked as internal traffic and survives blocked storage', () => {
    expect(redactInsightsUrl('https://lucissicare.com/products', storage('1'))).toBeNull();
    const blocked = { getItem: () => { throw new Error('blocked'); } };
    expect(redactInsightsUrl('https://lucissicare.com/products', blocked)).toBe('https://lucissicare.com/products');
    expect(redactInsightsUrl('not a url', storage(null))).toBeNull();
  });

  it('groups product and article pages by route pattern', () => {
    expect(insightsRoute('/product/7829164785731')).toBe('/product/[id]');
    expect(insightsRoute('/blog/period-cleansing-pad-change')).toBe('/blog/[handle]');
    expect(insightsRoute('/products')).toBe('/products');
  });

  it('lets the Vercel insights paths through the middleware', () => {
    expect(isPassthroughPath('/_vercel/insights/script.js')).toBe(true);
    expect(isPassthroughPath('/_vercel/speed-insights/vitals')).toBe(true);
    expect(isPassthroughPath('/products')).toBe(false);
  });
});
