import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMetaDescription, productMetaDescription, productPageTitle, summarizeText } from '../src/lib/productMeta';

afterEach(() => vi.unstubAllGlobals());

describe('product page meta', () => {
  it('uses the Shopify SEO title when it is filled in', () => {
    expect(productPageTitle({ name: '冰絲無痕中腰三角褲', seoTitle: '冰絲無痕中腰三角褲 無痕切邊 涼感' })).toBe(
      '冰絲無痕中腰三角褲 無痕切邊 涼感｜LUCISSI CARE',
    );
  });

  it('falls back to the product name when the SEO title is empty', () => {
    expect(productPageTitle({ name: '冰絲無痕中腰三角褲', seoTitle: '  ' })).toBe('冰絲無痕中腰三角褲｜LUCISSI CARE');
    expect(productPageTitle({ name: '冰絲無痕中腰三角褲' })).toBe('冰絲無痕中腰三角褲｜LUCISSI CARE');
  });

  it('prefers the SEO description and otherwise summarises the product description', () => {
    expect(productMetaDescription({ name: 'x', seoDescription: '中腰冰絲女三角褲。', description: '說明' })).toBe('中腰冰絲女三角褲。');
    expect(productMetaDescription({ name: 'x', description: '第一段，\n  第二段。' })).toBe('第一段， 第二段。');
    expect(summarizeText('字'.repeat(200))).toHaveLength(120);
  });

  it('sets the description tags and restores the previous content', () => {
    const tags = new Map<string, { content: string | null }>([
      ['meta[name="description"]', { content: '網站預設說明' }],
      ['meta[property="og:description"]', { content: '網站預設說明' }],
    ]);
    const elements = new Map(
      [...tags].map(([selector, state]) => [
        selector,
        {
          getAttribute: () => state.content,
          setAttribute: (_: string, value: string) => {
            state.content = value;
          },
          removeAttribute: () => {
            state.content = null;
          },
        },
      ]),
    );
    vi.stubGlobal('document', { querySelector: (selector: string) => elements.get(selector) ?? null });

    const restore = applyMetaDescription('商品說明');
    expect(tags.get('meta[name="description"]')?.content).toBe('商品說明');
    expect(tags.get('meta[property="og:description"]')?.content).toBe('商品說明');

    restore();
    expect(tags.get('meta[name="description"]')?.content).toBe('網站預設說明');
    expect(tags.get('meta[property="og:description"]')?.content).toBe('網站預設說明');
  });

  it('leaves the tags alone when there is no description', () => {
    const setAttribute = vi.fn();
    vi.stubGlobal('document', { querySelector: () => ({ getAttribute: () => 'x', setAttribute, removeAttribute: vi.fn() }) });
    applyMetaDescription('')();
    expect(setAttribute).not.toHaveBeenCalled();
  });
});
