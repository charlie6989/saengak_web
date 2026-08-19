import { describe, expect, it } from 'vitest';
import { buildShopifyArticleUrl } from './shopifyNavigation';

describe('buildShopifyArticleUrl', () => {
  it('builds only the fixed SAENGAK Shopify host', () => {
    expect(buildShopifyArticleUrl('news', 'daily-care')).toBe(
      'https://gh2xgs-zf.myshopify.com/blogs/news/daily-care',
    );
  });

  it('rejects unsafe handles', () => {
    expect(buildShopifyArticleUrl('news/../../evil', 'post')).toBeNull();
    expect(buildShopifyArticleUrl('news', 'post?next=evil')).toBeNull();
  });
});
