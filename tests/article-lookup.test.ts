import { afterEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@shopify/storefront-api-client', () => ({ createStorefrontApiClient: () => ({ request }) }));
vi.mock('../src/lib/sentry', () => ({ captureExceptionSafe: () => {} }));

import { lookupShopifyArticleByHandle, getShopifyArticleByHandle } from '../src/lib/shopify';

function articleNode(handle: string, tags = ['公開']) {
  return {
    id: `gid://shopify/Article/${handle}`,
    title: `title ${handle}`,
    handle,
    excerpt: '',
    contentHtml: '<p>body</p>',
    publishedAt: '2026-11-22T15:55:42Z',
    image: null,
    blog: { handle: 'care-talk', title: 'SAENGAK Talk' },
    authorV2: { name: 'LUCISSI CARE' },
    tags,
    seo: { title: '', description: '' },
  };
}

function mockStorefront(response: unknown) {
  request.mockReset();
  request.mockResolvedValue(response);
}

function failStorefront() {
  request.mockReset();
  request.mockRejectedValue(new Error('network timeout'));
}

afterEach(() => {
  vi.restoreAllMocks();
  request.mockReset();
});

describe('lookupShopifyArticleByHandle', () => {
  it('finds a public Shopify article', async () => {
    mockStorefront({ data: { articles: { edges: [{ node: articleNode('cotton-vs-ice-silk-underwear') }] } } });
    const result = await lookupShopifyArticleByHandle('cotton-vs-ice-silk-underwear');
    expect(result.status).toBe('found');
    expect(result.status === 'found' && result.article.handle).toBe('cotton-vs-ice-silk-underwear');
  });

  it('reports not-found only when Shopify answered and the article is not public', async () => {
    mockStorefront({
      data: {
        articles: {
          edges: [
            { node: articleNode('intimate-itch-which-doctor') },
            { node: articleNode('draft-article', ['草稿']) },
          ],
        },
      },
    });
    expect(await lookupShopifyArticleByHandle('no-such-article')).toEqual({ status: 'not-found' });
    expect(await lookupShopifyArticleByHandle('draft-article')).toEqual({ status: 'not-found' });
  });

  it('reports unavailable, not not-found, when the Storefront request fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    failStorefront();
    expect(await lookupShopifyArticleByHandle('cotton-vs-ice-silk-underwear')).toEqual({ status: 'unavailable' });
  });

  it('reports unavailable when Storefront returns GraphQL errors or no articles field', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorefront({ errors: { message: 'Throttled' } });
    expect(await lookupShopifyArticleByHandle('cotton-vs-ice-silk-underwear')).toEqual({ status: 'unavailable' });

    mockStorefront({ data: {} });
    expect(await lookupShopifyArticleByHandle('cotton-vs-ice-silk-underwear')).toEqual({ status: 'unavailable' });
  });

  it('still serves curated articles when Shopify fails or has no public articles', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    failStorefront();
    expect((await lookupShopifyArticleByHandle('daily-feminine-care-guide')).status).toBe('found');

    mockStorefront({ data: { articles: { edges: [] } } });
    expect((await lookupShopifyArticleByHandle('daily-feminine-care-guide')).status).toBe('found');
    // Shopify answered (with no public articles) and the handle is not curated: confirmed missing
    expect(await lookupShopifyArticleByHandle('no-such-article')).toEqual({ status: 'not-found' });
  });

  it('keeps getShopifyArticleByHandle returning the article or null', async () => {
    mockStorefront({ data: { articles: { edges: [{ node: articleNode('period-underwear-guide') }] } } });
    expect((await getShopifyArticleByHandle('period-underwear-guide'))?.handle).toBe('period-underwear-guide');
    expect(await getShopifyArticleByHandle('no-such-article')).toBeNull();
    expect(await getShopifyArticleByHandle('')).toBeNull();
  });
});
