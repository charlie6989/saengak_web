/**
 * Shopify 文章仍保留舊商店名稱 SAENGAK 的店層級文案；網站與社群分享預覽共用這份改寫規則，
 * 只改寫店層級字句，不動 SAENGAK 商品品牌與文章標籤。
 */
const LEGACY_STOREFRONT_NAME = 'SAENGAK';
const CURRENT_STOREFRONT_NAME = 'LUCISSI CARE';
const LEGACY_STOREFRONT_COPY_REPLACEMENTS = [
  [`${LEGACY_STOREFRONT_NAME} 韓國質感生活選品`, `${CURRENT_STOREFRONT_NAME} 韓國質感生活選品`],
  [`${LEGACY_STOREFRONT_NAME} 質感生活選品`, `${CURRENT_STOREFRONT_NAME} 質感生活選品`],
  [`${LEGACY_STOREFRONT_NAME} 編輯團隊`, `${CURRENT_STOREFRONT_NAME} 編輯團隊`],
  [`${LEGACY_STOREFRONT_NAME} 官方客服`, `${CURRENT_STOREFRONT_NAME} 官方客服`],
  [`${LEGACY_STOREFRONT_NAME} 商店開立`, `${CURRENT_STOREFRONT_NAME} 商店開立`],
  [`${LEGACY_STOREFRONT_NAME} 品牌編輯標準`, `${CURRENT_STOREFRONT_NAME} 品牌編輯標準`],
  [`${LEGACY_STOREFRONT_NAME} 會員`, `${CURRENT_STOREFRONT_NAME} 會員`],
  [`${LEGACY_STOREFRONT_NAME} Shopify`, `${CURRENT_STOREFRONT_NAME} Shopify`],
  [`${LEGACY_STOREFRONT_NAME} Talk`, 'LUCISSI Talk'],
  [`${LEGACY_STOREFRONT_NAME} 的編輯守則`, `${CURRENT_STOREFRONT_NAME} 的編輯守則`],
  [`${LEGACY_STOREFRONT_NAME} 堅持`, `${CURRENT_STOREFRONT_NAME} 堅持`],
  [`${LEGACY_STOREFRONT_NAME} 期待成為`, `${CURRENT_STOREFRONT_NAME} 期待成為`],
  [`${LEGACY_STOREFRONT_NAME} 現階段`, `${CURRENT_STOREFRONT_NAME} 現階段`],
] as const;

export function normalizeLegacyStorefrontCopy(value: unknown): string {
  if (typeof value !== 'string') return '';

  return LEGACY_STOREFRONT_COPY_REPLACEMENTS.reduce(
    (normalized, [legacyText, currentText]) => normalized.replaceAll(legacyText, currentText),
    value,
  );
}

/** 只有帶公開標籤的 Shopify 文章才會出現在網站上。 */
export function hasPublicArticleTag(tags: readonly string[] | null | undefined): boolean {
  return (tags || []).some((tag) => /^(saengak|lucissi care|公開|public)$/i.test(tag.trim()));
}
