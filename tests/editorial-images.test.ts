import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  editorialImage,
  editorialImageAlt,
  editorialShareImage,
  editorialStructuredImages,
} from '../src/content/editorialImages';
import { articleMeta, buildArticleJsonLd } from '../src/lib/structuredData';
import { renderSitemap } from '../src/domain/sitemap';

/** 2026-11 Shopify 上公開的 LUCISSI Talk 文章（care-talk 部落格）。 */
const TALK_HANDLES = [
  'vaginal-discharge-normal-changes',
  'recurrent-intimate-discomfort-follow-up',
  'intimate-cleansing-less-irritation',
  'intimate-products-purpose-guide',
  'intimate-care-trial-fatigue',
  'intimate-odor-without-shame',
];
const CURATED_HANDLES = ['daily-feminine-care-guide', 'how-to-choose-seamless-underwear', 'how-we-review-products-and-content'];

const publicFile = (path: string) => `public${path}`;

describe('editorial images', () => {
  it('gives every published article its own preview, hero and share image', () => {
    for (const placement of ['preview', 'hero'] as const) {
      const urls = [...TALK_HANDLES, ...CURATED_HANDLES].map((handle) => editorialImage(handle, null, placement));
      expect(new Set(urls).size).toBe(urls.length);
    }
    const shares = [...TALK_HANDLES, ...CURATED_HANDLES].map((handle) => editorialShareImage(handle));
    expect(shares.every(Boolean)).toBe(true);
    expect(new Set(shares).size).toBe(shares.length);
  });

  it('only references image files that exist', () => {
    for (const handle of [...TALK_HANDLES, ...CURATED_HANDLES]) {
      const paths = [
        editorialImage(handle),
        editorialImage(handle, null, 'hero'),
        editorialShareImage(handle)!,
        ...editorialStructuredImages(handle),
      ];
      for (const path of paths) expect(existsSync(publicFile(path)), path).toBe(true);
    }
  });

  it('describes the picture in alt text instead of repeating the title', () => {
    const alts = TALK_HANDLES.map((handle) => editorialImageAlt(handle, null, 'title'));
    expect(new Set(alts).size).toBe(alts.length);
    for (const alt of alts) expect(alt.length).toBeGreaterThan(12);
    expect(editorialImageAlt('unknown', ' Shopify 圖片說明 ', '標題')).toBe('Shopify 圖片說明');
    expect(editorialImageAlt('unknown', null, '標題')).toBe('標題');
  });

  it('keeps the Shopify image, then the generic cover, for unregistered articles', () => {
    expect(editorialImage('new-article', 'https://cdn.shopify.com/a.jpg')).toBe('https://cdn.shopify.com/a.jpg');
    expect(editorialImage('new-article')).toBe('/images/lucissi-v5/thumb-standards.webp');
    expect(editorialShareImage('new-article')).toBeUndefined();
    expect(editorialStructuredImages('new-article')).toEqual([]);
  });

  it('feeds og:image alt and the 16:9, 4:3 and 1:1 BlogPosting images', () => {
    const article = { title: '白帶有時透明、有時乳白，正常嗎？', handle: 'vaginal-discharge-normal-changes', publishedAt: '2026-11-14T23:16:41Z' };
    expect(articleMeta(article).image).toEqual({
      url: 'https://lucissicare.com/images/talk/share-discharge-cycle.jpg',
      width: 1200,
      height: 630,
      alt: editorialImageAlt(article.handle),
    });
    expect(buildArticleJsonLd(article).image).toEqual([
      'https://lucissicare.com/images/talk/share-discharge-cycle.jpg',
      'https://lucissicare.com/images/talk/thumb-discharge-cycle.webp',
      'https://lucissicare.com/images/talk/card-discharge-cycle.webp',
      'https://lucissicare.com/images/talk/square-discharge-cycle.webp',
    ]);
  });

  it('lists article images in the sitemap', () => {
    const xml = renderSitemap([], [{ handle: 'intimate-odor-without-shame' }, { handle: 'new-article' }]);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain('<image:loc>https://lucissicare.com/images/talk/article-odor-without-shame.webp</image:loc>');
    expect(xml).toContain('<image:loc>https://lucissicare.com/images/talk/thumb-odor-without-shame.webp</image:loc>');
    expect(xml).toContain('<url><loc>https://lucissicare.com/blog/new-article</loc></url>');
  });
});
