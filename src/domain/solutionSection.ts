import { isProductSoldOut, type AvailabilityInput } from './algorithms';

export type SolutionTab = 'bundles' | 'singles' | 'all';

interface SolutionCandidate extends AvailabilityInput {
  name?: string;
  tags?: string[];
}

export function isBundleProduct(product: SolutionCandidate): boolean {
  const title = (product.name || '').toLowerCase();
  const tags = (product.tags || []).map((tag) => tag.toLowerCase());
  return (
    title.includes('組') ||
    title.includes('套裝') ||
    tags.includes('超值組合') ||
    tags.includes('shopify bundles') ||
    tags.includes('組合包')
  );
}

/**
 * 首頁「超值組合」區塊只放買得到的商品，補貨後自動恢復。
 * 組合全部售完時改以單品呈現，不再標示「超值組合」；兩類都有貨才需要分頁。
 */
export function selectSolutionView<T extends SolutionCandidate>(items: T[], activeTab: SolutionTab) {
  const products = items.filter((product) => !isProductSoldOut(product));
  const bundles = products.filter(isBundleProduct);
  const singles = products.filter((product) => !isBundleProduct(product));
  const showTabs = bundles.length > 0 && singles.length > 0;

  let displayed = products;
  if (showTabs && activeTab === 'bundles') displayed = bundles;
  if (showTabs && activeTab === 'singles') displayed = singles;

  let label = '✨ 官方推薦特惠組合';
  if (bundles.length === 0 || (showTabs && activeTab === 'singles')) label = '🌿 日常基礎護理單品';
  else if (showTabs && activeTab === 'all') label = '全系列私密護理品項';

  return {
    products,
    bundles,
    singles,
    displayed,
    showTabs,
    label,
    heading: bundles.length > 0 ? '超值組合' : '日常私密護理',
  };
}
