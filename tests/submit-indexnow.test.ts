import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sitemapPageUrls } from '../scripts/submit-indexnow.mjs';

describe('submit-indexnow', () => {
  it('takes page URLs from the sitemap and ignores image URLs', () => {
    const xml = `<urlset><url><loc>https://lucissicare.com/</loc></url>
      <url><loc>https://lucissicare.com/blog/a</loc><lastmod>2026-11-14</lastmod><image:image><image:loc>https://lucissicare.com/images/talk/a.webp</image:loc></image:image></url>
      <url><loc>https://lucissicare.com/blog/a</loc></url>
      <url><loc>https://example.com/x</loc></url></urlset>`;
    expect(sitemapPageUrls(xml)).toEqual(['https://lucissicare.com/', 'https://lucissicare.com/blog/a']);
  });

  it('ships the key file whose content is the key', () => {
    const key = readFileSync('scripts/submit-indexnow.mjs', 'utf8').match(/const KEY = '([0-9a-f]{32})'/)?.[1];
    expect(key).toBeTruthy();
    expect(readFileSync(`public/${key}.txt`, 'utf8')).toBe(key);
  });
});
