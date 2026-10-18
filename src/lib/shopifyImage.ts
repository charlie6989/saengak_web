/**
 * Shopify CDN 圖片尺寸參數。
 *
 * 商品相簿有 4167px 原始檔，直接載入會讓商品頁縮圖空白數秒（2026-10-18 實測一頁約 3.9 MB）。
 * Shopify CDN 支援 `width` 參數依需求縮圖；非 Shopify 的網址（本站 /images、data: 等）原樣回傳。
 */
const SHOPIFY_IMAGE_HOST = /(^|\.)cdn\.shopify\.com$|\.myshopify\.com$/i;

export function shopifyImageUrl(url: string | undefined | null, width: number): string {
  if (!url) return '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!SHOPIFY_IMAGE_HOST.test(parsed.hostname)) return url;
  parsed.searchParams.set('width', String(Math.round(width)));
  return parsed.toString();
}
