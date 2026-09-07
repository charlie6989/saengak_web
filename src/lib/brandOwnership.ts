/**
 * SAENGAK 品牌歸屬判斷共用模組 (Brand Ownership Guard)
 *
 * 依據 AGENTS.md §5「品牌歸屬與標籤防禦鐵律 (P0 級 - 絕對不可再犯)」：
 * SAENGAK 品牌僅限韓國原裝女性私密保養護理品；所有內褲、生理褲、安全褲、無痕內著等
 * 「舒適穿著」商品，以及除毛刀、護衣袋、洗衣袋等周邊配件，絕對不是 SAENGAK 品牌。
 * 前端程式碼、卡片元件與批次腳本中，嚴禁使用 `vendor || 'SAENGAK'` 等無差別強制 fallback
 * 寫法；若商品無合法 vendor 應留空或直接隱藏，切勿擅自掛上 SAENGAK 品牌。
 *
 * 稽核背景：全站曾至少有 5 處（`src/lib/shopify.ts`、`ProductCard.tsx`、
 * `SolutionSection.tsx`、`pages/product/page.tsx`、`ShopifyDescriptionViewer.tsx`）
 * 各自複製一份「是否為內著／周邊」判斷正則，寫法互不一致；其中
 * `pages/admin/ProductList.tsx` 更完全沒有守衛，一律 `vendor || 'SAENGAK'`，
 * 導致內褲、生理褲等商品在後台被誤標為 SAENGAK 品牌。
 *
 * 本模組將「分類判斷」與「安全解析顯示用品牌名稱」集中為單一權威實作，
 * 全站一律改為呼叫本模組，嚴禁再各自複製正則字面值。
 */

/** Shopify 對未設定 vendor 商品給的預設佔位店名，不具備任何品牌意義，一律視同無 vendor。 */
export const SHOPIFY_PLACEHOLDER_VENDOR = 'My Store 7';

/**
 * 「非 SAENGAK 自有品牌」關鍵字清單：涵蓋內褲、生理褲、安全褲等「舒適穿著」衣物，
 * 以及除毛刀、護衣袋、洗衣袋等周邊配件。品項名稱／類別／標籤命中任一關鍵字，
 * 即代表此商品並非 SAENGAK 自有保養品類，絕對不可標註 SAENGAK 品牌。
 */
export const NON_SAENGAK_OWN_BRAND_KEYWORDS = [
  '內褲',
  '內著',
  '生理褲',
  '安全褲',
  '三角褲',
  '平口褲',
  '丁字褲',
  '除毛刀',
  '刮毛',
  '護衣袋',
  '洗衣袋',
  '清洗袋',
] as const;

const NON_SAENGAK_OWN_BRAND_PATTERN = new RegExp(
  `(?:${NON_SAENGAK_OWN_BRAND_KEYWORDS.join('|')})`,
  'i'
);

/** 舒適穿著（內著／衣物）商品在 Shopify 的 productType 字面值。 */
const COMFORT_WEAR_PRODUCT_TYPE = '舒適穿著';

/**
 * 分類與品牌名稱解析共用的商品欄位子集。
 * 刻意寬鬆（皆為選填），以相容全站各處互不相同的 Product / ShopifyProduct 型別定義。
 */
export interface BrandOwnershipCandidate {
  /** Shopify productType（如「舒適穿著」）。*/
  productType?: string | null;
  /** 商品標題（多對應 ShopifyProduct.title）。*/
  title?: string | null;
  /** 商品名稱（多對應前端 Product.name，通常與 title 相同）。*/
  name?: string | null;
  /** 商品標籤。並非所有呼叫端都會提供；未提供時分類判斷僅依據 title / name / productType。*/
  tags?: string[] | null;
  /** Shopify vendor 原始欄位。*/
  vendor?: string | null;
}

/**
 * 判斷商品是否屬於「非 SAENGAK 自有品牌」分類。
 *
 * 命中條件（符合其一即為 true）：
 * 1. `productType` 精確等於「舒適穿著」。
 * 2. 商品標題／名稱／類別／標籤中，包含任一內著、生理褲、安全褲，
 *    或除毛刀、護衣袋、洗衣袋等周邊關鍵字（見 {@link NON_SAENGAK_OWN_BRAND_KEYWORDS}）。
 *
 * 回傳 true 時，該商品「絕對不可」顯示或標註為 SAENGAK 品牌
 * （AGENTS.md §5 P0 鐵律）；呼叫端應改為顯示合法第三方 vendor、通用文案，或直接隱藏該欄位。
 */
export function isNonSaengakOwnBrandProduct(product: BrandOwnershipCandidate): boolean {
  if ((product.productType || '').trim() === COMFORT_WEAR_PRODUCT_TYPE) {
    return true;
  }

  const tags = Array.isArray(product.tags) ? product.tags : [];
  const haystack = [product.title, product.name, product.productType, ...tags]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return NON_SAENGAK_OWN_BRAND_PATTERN.test(haystack);
}

/** 判斷 vendor 字串是否為「空白」或 Shopify 預設佔位店名，兩者皆視同無 vendor。 */
function isBlankOrPlaceholderVendor(trimmedVendor: string): boolean {
  return !trimmedVendor || trimmedVendor === SHOPIFY_PLACEHOLDER_VENDOR;
}

export interface ResolveDisplayVendorOptions {
  /**
   * SAENGAK 自有保養品類在缺少合法 vendor 時，是否允許以 `'SAENGAK'` 作為顯示用預設值。
   * 預設 `true`（沿用既有合理行為：自有保養品無 vendor 時可安全顯示為 SAENGAK，
   * 這不違反鐵律——鐵律禁止的是「無差別」套用，並非禁止在真正自有品類上使用此 fallback）。
   *
   * 設為 `false` 時，無 vendor 一律回傳空字串，交由呼叫端自行決定顯示文案
   * （例如 `src/lib/shopify.ts` 對 `ShopifyProduct.vendor` 欄位的資料正規化，
   * 只需乾淨的原始 vendor 值，SAENGAK fallback 交由各展示元件自行決定）。
   *
   * 注意：此選項僅影響「SAENGAK 自有品類」分支；非自有品類分支永遠不會回傳 `'SAENGAK'`。
   */
  allowSaengakFallbackForOwnBrand?: boolean;
}

/**
 * 安全解析商品「顯示用」品牌名稱。
 *
 * - **非 SAENGAK 自有品類**（內著／生理褲／安全褲／除毛刀／護衣袋等，見
 *   {@link isNonSaengakOwnBrandProduct}）：僅在商品具備合法第三方 vendor
 *   （非空、非 Shopify 佔位店名 `'My Store 7'`、且不等於 `'SAENGAK'`）時才回傳該 vendor；
 *   否則一律回傳空字串 `''`，**絕對不可回傳 `'SAENGAK'`**，交由呼叫端決定顯示通用文案
 *   或直接隱藏該欄位。
 * - **SAENGAK 自有保養品類**：優先原樣回傳實際 vendor（即使該 vendor 剛好也叫
 *   `'SAENGAK'`，因為這是真實、正確的品牌歸屬）；若無合法 vendor，依
 *   `options.allowSaengakFallbackForOwnBrand`（預設 `true`）回傳 `'SAENGAK'` 或空字串。
 */
export function resolveDisplayVendor(
  product: BrandOwnershipCandidate,
  options: ResolveDisplayVendorOptions = {}
): string {
  const { allowSaengakFallbackForOwnBrand = true } = options;
  const trimmedVendor = (product.vendor || '').trim();
  const isBlankVendor = isBlankOrPlaceholderVendor(trimmedVendor);

  if (isNonSaengakOwnBrandProduct(product)) {
    if (!isBlankVendor && trimmedVendor.toUpperCase() !== 'SAENGAK') {
      return trimmedVendor;
    }
    return '';
  }

  if (!isBlankVendor) {
    return trimmedVendor;
  }
  return allowSaengakFallbackForOwnBrand ? 'SAENGAK' : '';
}
