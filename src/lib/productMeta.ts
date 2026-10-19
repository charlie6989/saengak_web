import { formatPageTitle } from './pageTitle';

/**
 * 商品頁的分頁標題與 meta description。
 * 優先使用 Shopify 後台「搜尋引擎清單」的 SEO 標題／說明，沒填時退回商品名稱與說明摘要。
 */

const DESCRIPTION_MAX = 120;

interface ProductMetaSource {
  name: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export function summarizeText(text: string | undefined, max = DESCRIPTION_MAX): string {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function productPageTitle(product: ProductMetaSource): string {
  return formatPageTitle(product.seoTitle?.trim() || product.name);
}

export function productMetaDescription(product: ProductMetaSource): string {
  return summarizeText(product.seoDescription?.trim() || product.description);
}

/** 設定 meta description（含 og:description），回傳還原為原內容的函式 */
export function applyMetaDescription(content: string): () => void {
  const targets = [
    document.querySelector('meta[name="description"]'),
    document.querySelector('meta[property="og:description"]'),
  ].filter((el): el is Element => el !== null);
  if (!content || targets.length === 0) return () => {};

  const previous = targets.map((el) => el.getAttribute('content'));
  targets.forEach((el) => el.setAttribute('content', content));
  return () => {
    targets.forEach((el, idx) => {
      const value = previous[idx];
      if (value === null) el.removeAttribute('content');
      else el.setAttribute('content', value);
    });
  };
}
