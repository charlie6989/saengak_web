import { isProductSoldOut } from '../domain/algorithms';
import { resolveDisplayVendor } from './brandOwnership';
import { formatPageTitle } from './pageTitle';

/**
 * 商品頁的分頁標題與 meta description。
 * 優先使用 Shopify 後台「搜尋引擎清單」的 SEO 標題／說明，沒填時退回商品名稱與說明摘要。
 */

const DESCRIPTION_MAX = 120;
const SITE_URL = 'https://lucissicare.com';
const SEO_ELEMENT_ATTRIBUTE = 'data-product-seo';
const JSON_LD_MAX_IMAGES = 5;

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

interface ProductSeoSource extends ProductMetaSource {
  id: string;
  price: number;
  image?: string;
  images?: { url: string }[];
  vendor?: string;
  productType?: string;
  availableForSale?: boolean;
  variants?: { availableForSale?: boolean; sku?: string; price?: number }[];
}

/** 商品的標準網址一律用數字 ID，避免 gid 或 handle 網址被當成重複頁面。無法解析時回傳 undefined。 */
export function productCanonicalUrl(id: string | undefined): string | undefined {
  const numericId = (id || '').match(/(\d{1,20})$/)?.[1];
  return numericId ? `${SITE_URL}/product/${numericId}` : undefined;
}

/**
 * schema.org Product。只放商品頁已公開的資料；不放評分，因為目前沒有經驗證的評價來源。
 * 這是資料區塊，由 applyProductSeo 以 textContent 寫入，不會被當成腳本執行。
 */
export function buildProductJsonLd(product: ProductSeoSource): Record<string, unknown> | undefined {
  const url = productCanonicalUrl(product.id);
  if (!url || !product.name || !(product.price > 0)) return undefined;

  const images = product.images?.length ? product.images.map((image) => image.url) : [product.image];
  const brand = resolveDisplayVendor(
    { productType: product.productType, name: product.name, vendor: product.vendor },
    { allowSaengakFallbackForOwnBrand: false },
  );
  const skus = (product.variants ?? []).map((variant) => variant.sku).filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url,
    image: images.filter(Boolean).slice(0, JSON_LD_MAX_IMAGES),
    ...(productMetaDescription(product) ? { description: productMetaDescription(product) } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    // 多規格商品的 SKU 各不相同，商品層級不標示單一 SKU
    ...(skus.length === 1 ? { sku: skus[0] } : {}),
    offers: buildOffers(product, url),
  };
}

/**
 * 各規格同價時標示單一 Offer；規格價格不同時改用 AggregateOffer 的最低／最高價，
 * 避免結構化資料只寫最低價、與商品頁預設規格的售價不一致。
 */
function buildOffers(product: ProductSeoSource, url: string): Record<string, unknown> {
  const availability = isProductSoldOut(product) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
  const prices = (product.variants ?? [])
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === 'number' && price > 0);
  const low = prices.length ? Math.min(...prices) : product.price;
  const high = prices.length ? Math.max(...prices) : product.price;
  if (high > low) {
    return {
      '@type': 'AggregateOffer',
      url,
      lowPrice: low,
      highPrice: high,
      offerCount: prices.length,
      priceCurrency: 'TWD',
      availability,
      itemCondition: 'https://schema.org/NewCondition',
    };
  }
  return {
    '@type': 'Offer',
    url,
    price: low,
    priceCurrency: 'TWD',
    availability,
    itemCondition: 'https://schema.org/NewCondition',
  };
}

/** 寫入 canonical 與 JSON-LD，回傳離開商品頁時移除它們的函式。 */
export function applyProductSeo(product: ProductSeoSource): () => void {
  const canonicalUrl = productCanonicalUrl(product.id);
  const jsonLd = buildProductJsonLd(product);
  const added: Element[] = [];

  if (canonicalUrl) {
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalUrl;
    added.push(link);
  }
  if (jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    added.push(script);
  }
  added.forEach((element) => {
    element.setAttribute(SEO_ELEMENT_ATTRIBUTE, '');
    document.head.appendChild(element);
  });
  return () => added.forEach((element) => element.remove());
}
