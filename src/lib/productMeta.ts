import { summarizeText } from './seo';
import {
  breadcrumbJsonLd,
  buildProductJsonLd,
  productBreadcrumbs,
  productCanonicalUrl,
  productMetaDescription,
  productPageTitle,
  type ProductSeoSource,
} from './structuredData';
import { replaceStructuredData, setPageMeta } from './documentMeta';

/**
 * 商品頁的分頁標題、meta description、canonical 與 JSON-LD。
 * 規則在 src/lib/structuredData.ts，與 middleware 產生的第一份 HTML 共用。
 * 優先使用 Shopify 後台「搜尋引擎清單」的 SEO 標題／說明，沒填時退回商品名稱與說明摘要。
 */
export { buildProductJsonLd, productCanonicalUrl, productMetaDescription, productPageTitle, summarizeText };

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

/**
 * 寫入標題、說明、canonical（更新全站唯一的那個 link）與 JSON-LD，回傳離開商品時移除 JSON-LD 的函式。
 * 標題與說明不還原：換頁時 ScrollToTop 會依新路由重設。
 */
export function applyProductSeo(product: ProductSeoSource): () => void {
  setPageMeta({
    title: productPageTitle(product),
    description: productMetaDescription(product) || undefined,
    canonicalUrl: productCanonicalUrl(product.id),
  });
  const jsonLd = buildProductJsonLd(product);
  return replaceStructuredData(jsonLd ? [jsonLd, breadcrumbJsonLd(productBreadcrumbs(product))] : []);
}
