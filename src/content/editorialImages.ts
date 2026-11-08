/** Article previews and full-page banners have distinct compositions for the same topic. */
const covers: Record<string, string> = {
  'daily-feminine-care-guide': 'care',
  'how-to-choose-seamless-underwear': 'wear',
  'how-we-review-products-and-content': 'standards',
};
export function editorialImage(handle?: string, supplied?: string | null, placement: 'preview' | 'hero' = 'preview'): string {
  const image = handle ? covers[handle] : undefined;
  const prefix = placement === 'hero' ? 'article' : 'thumb';
  return image ? `/images/lucissi-v5/${prefix}-${image}.webp` : supplied || `/images/lucissi-v5/${prefix}-standards.webp`;
}

/** 社群分享預覽用的 1200×630 JPG（部分平台不支援 WebP）；沒有對應主題時回傳 undefined。 */
export function editorialShareImage(handle?: string): string | undefined {
  const image = handle ? covers[handle] : undefined;
  return image ? `/images/lucissi-v5/share-${image}.jpg` : undefined;
}
