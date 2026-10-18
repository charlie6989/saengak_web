import { describe, expect, it } from 'vitest';
import { shopifyImageUrl } from './shopifyImage';

describe('shopifyImageUrl', () => {
  it('adds a width parameter to Shopify CDN images and keeps the version query', () => {
    const url = 'https://cdn.shopify.com/s/files/1/0701/6454/5603/files/01.jpg?v=1788773836';
    expect(shopifyImageUrl(url, 600)).toBe('https://cdn.shopify.com/s/files/1/0701/6454/5603/files/01.jpg?v=1788773836&width=600');
  });

  it('replaces an existing width', () => {
    expect(shopifyImageUrl('https://cdn.shopify.com/a.jpg?width=4000', 200)).toBe('https://cdn.shopify.com/a.jpg?width=200');
  });

  it('leaves non-Shopify and empty URLs unchanged', () => {
    expect(shopifyImageUrl('/images/brand/og-image.png', 600)).toBe('/images/brand/og-image.png');
    expect(shopifyImageUrl('https://example.com/a.jpg', 600)).toBe('https://example.com/a.jpg');
    expect(shopifyImageUrl(undefined, 600)).toBe('');
  });
});
