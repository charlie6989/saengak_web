import { isProductSoldOut } from '../domain/algorithms.js';
import { isSealedCareProduct } from '../domain/returnPolicy.js';
import { structuredDataShippingRate } from '../domain/structuredDataShipping.js';
import { ARTICLE_EDITORIAL_AUTHOR, normalizeLegacyStorefrontCopy } from '../domain/storefrontCopy.js';
import { classifyCarePillar, getCarePillar, isPeriodCareProduct } from '../content/carePillars.js';
import { editorialImageAlt, editorialShareImage, editorialStructuredImages } from '../content/editorialImages.js';
import { siteContent } from '../content/site.js';
import { resolveDisplayVendor } from './brandOwnership.js';
import { DEFAULT_SHARE_IMAGE, SITE_LOGO_URL, SITE_NAME, SITE_URL, absoluteUrl, formatPageTitle, summarizeText } from './seo.js';

/**
 * 商品、文章與首頁的標題、說明與 schema.org 結構化資料。
 * 伺服器（middleware 產生的第一份 HTML）與瀏覽器（商品頁、文章頁）呼叫同一組函式，輸出必須相同。
 * 只放頁面上已公開的資料；不放評分，因為目前沒有經驗證的評價來源。
 * middleware 直接載入本檔，import 一律寫 .js 副檔名。
 */

export type JsonLd = Record<string, unknown>;
export interface Crumb {
  name: string;
  /** 站內路徑；最後一層（頁面本身）不加連結。 */
  url?: string;
}

const JSON_LD_MAX_IMAGES = 5;
export const HOME_CRUMB: Crumb = { name: '首頁', url: '/' };
export const ARTICLES_CRUMB: Crumb = { name: 'LUCISSI Talk', url: '/community' };

export interface ProductMetaSource {
  name: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ProductSeoSource extends ProductMetaSource {
  id: string;
  price: number;
  image?: string;
  images?: { url: string }[];
  vendor?: string;
  productType?: string;
  tags?: string[];
  availableForSale?: boolean;
  variants?: { availableForSale?: boolean; sku?: string; price?: number }[];
}

export function productPageTitle(product: ProductMetaSource): string {
  return formatPageTitle(product.seoTitle?.trim() || product.name);
}

export function productMetaDescription(product: ProductMetaSource): string {
  return summarizeText(product.seoDescription?.trim() || product.description);
}

/** 商品的標準網址一律用數字 ID，避免 gid 或 handle 網址被當成重複頁面。無法解析時回傳 undefined。 */
export function productCanonicalUrl(id: string | undefined): string | undefined {
  const numericId = (id || '').match(/(\d{1,20})$/)?.[1];
  return numericId ? `${SITE_URL}/product/${numericId}` : undefined;
}

/** 商品所屬的照護入口（私密保養、舒適內搭；兩者都不是時才看生理期照護）。 */
export function productCategoryCrumb(product: Pick<ProductSeoSource, 'name' | 'productType' | 'tags'>): Crumb | undefined {
  const source = { name: product.name, productType: product.productType, tags: product.tags };
  const id = classifyCarePillar(source) ?? (isPeriodCareProduct(source) ? 'period' : undefined);
  if (!id) return undefined;
  const pillar = getCarePillar(id);
  return { name: pillar.name, url: `/products?${new URLSearchParams({ category: pillar.name })}` };
}

export function productBreadcrumbs(product: Pick<ProductSeoSource, 'name' | 'productType' | 'tags'>): Crumb[] {
  const category = productCategoryCrumb(product);
  return [HOME_CRUMB, ...(category ? [category] : []), { name: product.name }];
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.url ? { item: absoluteUrl(crumb.url) } : {}),
    })),
  };
}

// 與退換貨說明頁一致：到貨隔日起 7 天，退貨運費由本店負擔
const RETURN_POLICY: JsonLd = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'TW',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
  returnFees: 'https://schema.org/FreeReturn',
  returnMethod: 'https://schema.org/ReturnByMail',
};

// 與配送說明一致（src/domain/shippingMethods.ts 的 DISPATCH_PROMISE／TRANSIT_PROMISE）：
// 1 個工作天內出貨（週末與國定假日不出貨），出貨後一般 1–2 個工作天送達。
const WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => `https://schema.org/${day}`);
const DELIVERY_TIME: JsonLd = {
  '@type': 'ShippingDeliveryTime',
  businessDays: { '@type': 'OpeningHoursSpecification', dayOfWeek: WORKING_DAYS },
  handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
  transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
};

function shippingDetails(price: number): JsonLd {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: structuredDataShippingRate(price), currency: 'TWD' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'TW' },
    deliveryTime: DELIVERY_TIME,
  };
}

/**
 * schema.org Product。這是資料區塊，以 textContent（瀏覽器）或跳脫後的 JSON（伺服器）寫入，不會被當成腳本執行。
 */
export function buildProductJsonLd(product: ProductSeoSource): JsonLd | undefined {
  const url = productCanonicalUrl(product.id);
  if (!url || !product.name || !(product.price > 0)) return undefined;

  const images = product.images?.length ? product.images.map((image) => image.url) : [product.image];
  const brand = resolveDisplayVendor(
    { productType: product.productType, name: product.name, vendor: product.vendor },
    { allowSaengakFallbackForOwnBrand: false },
  ) || SITE_NAME;
  const skus = (product.variants ?? []).map((variant) => variant.sku).filter(Boolean);
  const description = productMetaDescription(product);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url,
    image: images.filter(Boolean).slice(0, JSON_LD_MAX_IMAGES),
    ...(description ? { description } : {}),
    brand: { '@type': 'Brand', name: brand },
    // 多規格商品的 SKU 各不相同，商品層級不標示單一 SKU
    ...(skus.length === 1 ? { sku: skus[0] } : {}),
    offers: buildOffers(product, url),
  };
}

/**
 * 各規格同價時標示單一 Offer；規格價格不同時改用 AggregateOffer 的最低／最高價，
 * 避免結構化資料只寫最低價、與商品頁預設規格的售價不一致。
 * 密封的個人衛生用品拆封後不適用 7 日解除權（src/domain/returnPolicy.ts），所以不標示退貨政策。
 */
function buildOffers(product: ProductSeoSource, url: string): JsonLd {
  const availability = isProductSoldOut(product) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
  const prices = (product.variants ?? [])
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === 'number' && price > 0);
  const low = prices.length ? Math.min(...prices) : product.price;
  const high = prices.length ? Math.max(...prices) : product.price;
  const common: JsonLd = {
    url,
    priceCurrency: 'TWD',
    availability,
    itemCondition: 'https://schema.org/NewCondition',
    shippingDetails: shippingDetails(low),
    ...(isSealedCareProduct(product.name) ? {} : { hasMerchantReturnPolicy: RETURN_POLICY }),
  };
  if (high > low) {
    return { '@type': 'AggregateOffer', lowPrice: low, highPrice: high, offerCount: prices.length, ...common };
  }
  return { '@type': 'Offer', price: low, ...common };
}

/** 首頁的商店身分：公司名稱、標誌、聯絡信箱與 LINE 官方帳號。 */
export function siteJsonLd(): JsonLd[] {
  const home = absoluteUrl('/');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${home}#organization`,
      name: SITE_NAME,
      legalName: siteContent.legalName,
      url: home,
      logo: SITE_LOGO_URL,
      email: siteContent.companyEmail,
      sameAs: [siteContent.lineAddFriendUrl],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${home}#website`,
      name: SITE_NAME,
      url: home,
      inLanguage: 'zh-TW',
      publisher: { '@id': `${home}#organization` },
    },
  ];
}

export interface ArticleSeoSource {
  title: string;
  handle: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  image?: { url: string; altText?: string } | null;
}

export interface ArticleMeta {
  title: string;
  heading: string;
  description: string;
  canonicalUrl: string;
  image?: { url: string; width?: number; height?: number; alt: string };
}

/** 文章頁的標題、說明與分享圖：店層級舊名稱改寫成 LUCISSI CARE，優先使用 SEO 欄位與網站的編輯圖。 */
export function articleMeta(article: ArticleSeoSource): ArticleMeta {
  const heading = normalizeLegacyStorefrontCopy(article.title);
  const title = normalizeLegacyStorefrontCopy(article.seoTitle?.trim() || article.title);
  const editorial = editorialShareImage(article.handle);
  const image = editorial
    ? { url: absoluteUrl(editorial), width: 1200, height: 630, alt: editorialImageAlt(article.handle, null, title) }
    : article.image?.url
      ? { url: absoluteUrl(article.image.url), alt: normalizeLegacyStorefrontCopy(article.image.altText) || title }
      : undefined;
  return {
    title: formatPageTitle(title),
    heading,
    description: summarizeText(normalizeLegacyStorefrontCopy(article.seoDescription?.trim() || article.excerpt || '')),
    canonicalUrl: absoluteUrl(`/blog/${article.handle}`),
    image,
  };
}

export function articleBreadcrumbs(article: Pick<ArticleSeoSource, 'title'>): Crumb[] {
  return [HOME_CRUMB, ARTICLES_CRUMB, { name: normalizeLegacyStorefrontCopy(article.title) }];
}

const validDate = (value?: string) => (value && !Number.isNaN(Date.parse(value)) ? value : undefined);

export function buildArticleJsonLd(article: ArticleSeoSource): JsonLd {
  const meta = articleMeta(article);
  const published = validDate(article.publishedAt);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta.heading,
    ...(meta.description ? { description: meta.description } : {}),
    // 第一張與 og:image 相同（文章沒有圖片時用網站分享圖），再加上 Google 建議的 16:9、4:3、1:1 版本
    image: [(meta.image ?? DEFAULT_SHARE_IMAGE).url, ...editorialStructuredImages(article.handle).map(absoluteUrl)],
    ...(published ? { datePublished: published, dateModified: published } : {}),
    inLanguage: 'zh-TW',
    url: meta.canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': meta.canonicalUrl },
    author: { '@type': 'Organization', name: ARTICLE_EDITORIAL_AUTHOR, url: absoluteUrl('/about') },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: SITE_LOGO_URL },
    },
  };
}
