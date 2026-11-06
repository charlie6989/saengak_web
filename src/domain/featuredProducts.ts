import { isProductSoldOut, type AvailabilityInput } from './algorithms';

/** 精選區最少要填滿的位置數（桌機一列四張卡片）。 */
export const FEATURED_MIN_SLOTS = 4;

/** 沒有 featured 標籤的情況下，依此順序補上核心保養商品。 */
export const CORE_FEATURED_KEYWORDS = [
  '深層修護私密清潔露',
  '私密雙層修護精華噴霧',
  '益生菌私密養膚濕巾',
  '平衡調理私密潔淨慕斯',
  '益生菌私密舒緩凝膠',
];

interface FeaturedCandidate extends AvailabilityInput {
  id: string;
  name?: string;
  title?: string;
}

const coreRank = (product: FeaturedCandidate): number => {
  const name = product.name || product.title || '';
  return CORE_FEATURED_KEYWORDS.findIndex((keyword) => name.includes(keyword));
};

/**
 * 精選版位優先放有貨商品：標籤精選 → 核心商品 → 其他有貨商品（維持商品池順序）。
 * 有貨商品足以填滿版位時完全不放售完商品；整體有貨數量不足時，才以精選／核心的售完商品補位，並排在最後。
 */
export function selectFeaturedProducts<T extends FeaturedCandidate>(
  items: T[],
  isTagged: (product: T) => boolean,
  minSlots: number = FEATURED_MIN_SLOTS,
): T[] {
  const tagged = items.filter(isTagged);
  const core = items
    .filter((product) => !isTagged(product) && coreRank(product) !== -1)
    .sort((a, b) => coreRank(a) - coreRank(b));
  const ranked = [...tagged, ...core];

  const featuredInStock = ranked.filter((product) => !isProductSoldOut(product));
  if (featuredInStock.length >= minSlots) return featuredInStock;

  const rankedIds = new Set(ranked.map((product) => product.id));
  const otherInStock = items.filter((product) => !rankedIds.has(product.id) && !isProductSoldOut(product));
  const inStock = [...featuredInStock, ...otherInStock].slice(0, minSlots);
  if (inStock.length >= minSlots) return inStock;

  const soldOut = ranked.filter((product) => isProductSoldOut(product));
  return [...inStock, ...soldOut].slice(0, minSlots);
}
