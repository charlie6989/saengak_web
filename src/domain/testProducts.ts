/** 內部驗收用商品（例如金流測試）不對顧客顯示，也不列入 sitemap。 */
const TEST_PRODUCT_PATTERN = /驗收測試|請勿購買|測試商品|payment\s*test|test\s*product/i;

export function hasTestProductMarker(fields: Array<string | null | undefined>): boolean {
  return TEST_PRODUCT_PATTERN.test(fields.filter(Boolean).join(' '));
}
