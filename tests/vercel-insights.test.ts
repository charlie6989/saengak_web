import { describe, expect, it } from 'vitest';
import { insightsEnabled, insightsPath, insightsRoute, redactInsightsUrl } from '../src/lib/vercelInsights';
import { isPassthroughPath } from '../middleware';

function storage(value: string | null) {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_key: string, next: string) => {
      stored = next;
    },
    removeItem: () => {
      stored = null;
    },
  };
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
    expect(redactInsightsUrl('https://lucissicare.com/?utm_source=line&utm_campaign=dec&fbclid=abc', storage(null))).toBe(
      'https://lucissicare.com/?utm_source=line&utm_campaign=dec',
    );
  });

  it('skips admin, auth callback and reset-password pages', () => {
    expect(redactInsightsUrl('https://lucissicare.com/admin/orders', storage(null))).toBeNull();
    expect(redactInsightsUrl('https://lucissicare.com/auth/callback?code=x', storage(null))).toBeNull();
    expect(redactInsightsUrl('https://lucissicare.com/reset-password', storage(null))).toBeNull();
  });

  it('skips browsers marked as internal traffic and survives blocked storage', () => {
    expect(redactInsightsUrl('https://lucissicare.com/products', storage('1'))).toBeNull();
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(redactInsightsUrl('https://lucissicare.com/products', blocked)).toBe('https://lucissicare.com/products');
    expect(redactInsightsUrl('not a url', storage(null))).toBeNull();
  });

  it('honours ?ga_internal on its own, without GA4 having stored the marker', () => {
    const store = storage(null);
    expect(redactInsightsUrl('https://lucissicare.com/?ga_internal=1', store)).toBeNull();
    expect(store.getItem()).toBe('1');
    expect(redactInsightsUrl('https://lucissicare.com/products', store)).toBeNull();
    expect(redactInsightsUrl('https://lucissicare.com/?ga_internal=0', store)).toBe('https://lucissicare.com/');
    expect(store.getItem()).toBeNull();
  });

  it('tracks category changes as page views but keeps other query strings out of the path', () => {
    expect(insightsPath('/products', '?category=%E7%A7%81%E5%AF%86%E4%BF%9D%E9%A4%8A&q=x')).toBe(
      '/products?category=%E7%A7%81%E5%AF%86%E4%BF%9D%E9%A4%8A',
    );
    expect(insightsPath('/order-status', '?order_id=1019')).toBe('/order-status');
    expect(insightsPath('/products', '')).toBe('/products');
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
