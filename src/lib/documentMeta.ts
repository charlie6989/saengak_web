import { canonicalUrlFor, seoForLocation } from './seo';
import { siteJsonLd, type JsonLd } from './structuredData';

/**
 * 瀏覽器端更新 head：與 middleware 產生的第一份 HTML 使用相同的標籤，換頁時只更新、不重複新增。
 * canonical 全站只有一個 <link rel="canonical">；結構化資料一律是 script[data-seo-jsonld]。
 */

const JSON_LD_SELECTOR = 'script[type="application/ld+json"][data-seo-jsonld]';

function setMeta(attribute: 'name' | 'property', key: string, content: string | undefined) {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function setCanonical(url: string | undefined) {
  if (!url) return;
  const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
  const [link = document.createElement('link'), ...extra] = links;
  extra.forEach((element) => element.remove());
  link.rel = 'canonical';
  link.href = url;
  if (!link.isConnected) document.head.appendChild(link);
}

export interface PageMeta {
  title?: string;
  description?: string;
  robots?: string;
  canonicalUrl?: string;
  type?: string;
}

/** 更新標題、說明（含 og／twitter）、robots、canonical 與 og:url；沒給的欄位保持原狀。 */
export function setPageMeta({ title, description, robots, canonicalUrl, type }: PageMeta) {
  if (title) document.title = title;
  setMeta('property', 'og:title', title);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'description', description);
  setMeta('property', 'og:description', description);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'robots', robots);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:url', canonicalUrl);
  setCanonical(canonicalUrl);
}

/** 以新的結構化資料取代頁面上所有 JSON-LD，回傳移除這次新增項目的函式。 */
export function replaceStructuredData(items: JsonLd[]): () => void {
  document.head.querySelectorAll(JSON_LD_SELECTOR).forEach((element) => element.remove());
  const added = items.map((item) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', '');
    script.textContent = JSON.stringify(item);
    document.head.appendChild(script);
    return script;
  });
  return () => added.forEach((element) => element.remove());
}

/**
 * 換頁時依路由表套用 head。第一次載入時伺服器已寫好商品／文章的結構化資料，
 * 這裡不移除，等頁面載入資料後再以相同內容取代。
 */
export function applyRouteSeo(pathname: string, search: string, { initial = false } = {}) {
  const route = seoForLocation(pathname, search);
  setPageMeta({
    title: route.title,
    description: route.description,
    robots: route.robots,
    canonicalUrl: canonicalUrlFor(route),
    type: route.type,
  });
  if (!initial || route.page === 'home') replaceStructuredData(route.page === 'home' ? siteJsonLd() : []);
}
