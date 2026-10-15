export interface SearchableProduct {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  productType?: string;
  vendor?: string;
  price: number;
  originalPrice?: number;
  reviews?: number;
  isBest?: boolean;
  isNew?: boolean;
}

export interface CheckoutItemInput {
  id: string;
  variantId?: string;
  quantity: number;
}

export interface ShopifyCheckoutLine {
  merchandiseId: string;
  quantity: number;
}

export interface CatalogSignalInput {
  reviews?: unknown;
  isBest?: unknown;
  isNew?: unknown;
  tags?: unknown;
}

export interface CatalogSignals {
  reviews: number;
  isBest: boolean;
  isNew: boolean;
}

export interface PaginationResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
}

export type CheckoutLineResult =
  | { ready: true; lines: ShopifyCheckoutLine[] }
  | { ready: false; reason: 'empty_cart'; missingItemIds: [] }
  | { ready: false; reason: 'missing_variant'; missingItemIds: string[] };

export const getCartLineKey = (item: { id: string; variantId?: string }) =>
  `${item.id}:${item.variantId ?? 'unresolved'}`;

export function deriveCatalogSignals(product: CatalogSignalInput): CatalogSignals {
  const tags = Array.isArray(product.tags)
    ? product.tags.filter((tag): tag is string => typeof tag === 'string').map(normalizeText)
    : [];
  const reviewCount = typeof product.reviews === 'number' && Number.isFinite(product.reviews)
    ? Math.max(0, Math.floor(product.reviews))
    : 0;

  return {
    reviews: reviewCount,
    isBest: product.isBest === true || tags.some((tag) => ['best', 'featured', '精選'].includes(tag)),
    isNew: product.isNew === true || tags.some((tag) => ['new', 'new-arrival', '新品'].includes(tag)),
  };
}

export interface AvailabilityInput {
  availableForSale?: boolean;
  variants?: Array<{ availableForSale?: boolean }>;
}

// 商品層級標記為不可售，或所有規格都不可售時，視為售完
export function isProductSoldOut(product: AvailabilityInput): boolean {
  if (product.availableForSale === false) return true;
  return Array.isArray(product.variants)
    && product.variants.length > 0
    && product.variants.every((variant) => variant.availableForSale === false);
}

// 穩定排序：有貨商品在前、售完商品在後，各自維持原本順序
export function sortAvailableFirst<T extends AvailabilityInput>(products: T[]): T[] {
  return products
    .map((product, index) => ({ product, index, soldOut: isProductSoldOut(product) }))
    .sort((a, b) => Number(a.soldOut) - Number(b.soldOut) || a.index - b.index)
    .map(({ product }) => product);
}

// 商品頁預設規格：第一個可售規格；全部售完時才退回第一個規格
export function pickInitialVariant<T extends { availableForSale?: boolean }>(variants: T[]): T | undefined {
  return variants.find((variant) => variant.availableForSale !== false) ?? variants[0];
}

export interface VariantOptionInput {
  selectedOptions?: Array<{ name: string; value: string }>;
}

const VARIANT_OPTION_NAMES = {
  size: /尺寸|尺碼|size/i,
  color: /顏色|色系|colou?r/i,
} as const;

// 依 Shopify 規格選項篩選：尺寸比對選項值開頭的尺碼代號（「L (適合體重…)」→ L），
// 顏色去掉「色」字後比對（「白色」可對到「雪紗白」），不再用商品名稱做字串比對。
export function matchesVariantOption(
  variants: VariantOptionInput[] | undefined,
  kind: keyof typeof VARIANT_OPTION_NAMES,
  wanted: string,
): boolean {
  const target = wanted.trim().toLowerCase();
  if (!target || !Array.isArray(variants)) return false;
  const colorStem = target.replace(/色$/, '');
  return variants.some((variant) =>
    (variant.selectedOptions ?? []).some((option) => {
      if (!VARIANT_OPTION_NAMES[kind].test(option.name)) return false;
      const value = option.value.trim().toLowerCase();
      if (kind === 'size') {
        const code = value.split(/[\s(（]/)[0];
        return code === target || value === target;
      }
      return Boolean(colorStem) && value.includes(colorStem);
    }),
  );
}

export function paginateItems<T>(items: T[], requestedPage: number, requestedPageSize = 12): PaginationResult<T> {
  const pageSize = Math.max(1, Math.floor(requestedPageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1));
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    pageCount,
    totalItems: items.length,
  };
}

const SYNONYMS: Record<string, string[]> = {
  私密: ['女性護理', '私密護理', '呵護'],
  清潔: ['清洗', '潔淨', '洗護'],
  生理: ['月經', '經期', '生理褲'],
  內褲: ['底褲', '內衣褲'],
  敏感: ['溫和', '舒緩'],
  抗菌: ['抑菌', '防菌'],
  無痕: ['無縫', 'seamless'],
};

export function normalizeText(value = ''): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-TW').trim();
}

export function expandSearchQuery(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];

  const terms = new Set(normalized.split(/\s+/).filter(Boolean));
  for (const term of [...terms]) {
    for (const [key, synonyms] of Object.entries(SYNONYMS)) {
      if (key.includes(term) || synonyms.some((synonym) => synonym.includes(term))) {
        terms.add(key);
        synonyms.forEach((synonym) => terms.add(synonym));
      }
    }
  }
  return [...terms];
}

export function calculateSearchScore(product: SearchableProduct, query: string): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 1;

  const name = normalizeText(product.name);
  const description = normalizeText(product.description);
  const tags = (product.tags ?? []).map(normalizeText);
  const productType = normalizeText(product.productType);
  const vendor = normalizeText(product.vendor);
  let score = 0;

  if (name === normalizedQuery) score += 120;
  else if (name.startsWith(normalizedQuery)) score += 90;
  else if (name.includes(normalizedQuery)) score += 70;

  for (const term of expandSearchQuery(normalizedQuery)) {
    if (name.includes(term)) score += term === normalizedQuery ? 30 : 18;
    if (tags.some((tag) => tag === term)) score += 55;
    else if (tags.some((tag) => tag.includes(term))) score += 32;
    if (productType.includes(term)) score += 35;
    if (vendor.includes(term)) score += 20;
    if (description.includes(term)) score += 12;
  }

  return score;
}

export function rankProducts<T extends SearchableProduct>(products: T[], query: string): T[] {
  return products
    .map((product, index) => ({ product, index, score: calculateSearchScore(product, query) }))
    .filter(({ score }) => !normalizeText(query) || score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ product }) => product);
}

export function calculateEditorialScore(product: SearchableProduct): number {
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.min(30, ((product.originalPrice - product.price) / product.originalPrice) * 30)
    : 0;
  const reviewEvidence = Math.min(35, Math.log10(Math.max(1, product.reviews ?? 0) + 1) * 14);
  const editorialSignal = product.isBest ? 25 : 0;
  const freshnessSignal = product.isNew ? 10 : 0;
  return Number((editorialSignal + freshnessSignal + reviewEvidence + discount).toFixed(2));
}

export function rankEditorialProducts<T extends SearchableProduct>(products: T[]): T[] {
  return [...products].sort((a, b) => calculateEditorialScore(b) - calculateEditorialScore(a));
}

export function estimateReadingMinutes(htmlOrText: string): number {
  const text = htmlOrText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const cjkCharacters = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = text.replace(/[\u3400-\u9fff]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjkCharacters / 400 + latinWords / 200));
}

export function clampCartQuantity(value: number, max = 99): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function isShopifyVariantId(value?: string): value is string {
  return Boolean(value?.startsWith('gid://shopify/ProductVariant/'));
}

export function buildShopifyCheckoutLines(items: CheckoutItemInput[]): CheckoutLineResult {
  if (items.length === 0) {
    return { ready: false, reason: 'empty_cart', missingItemIds: [] };
  }

  const missingItemIds = items
    .filter((item) => !isShopifyVariantId(item.variantId))
    .map((item) => item.id);

  if (missingItemIds.length > 0) {
    return { ready: false, reason: 'missing_variant', missingItemIds };
  }

  const quantities = new Map<string, number>();
  for (const item of items) {
    const merchandiseId = item.variantId as string;
    quantities.set(
      merchandiseId,
      clampCartQuantity((quantities.get(merchandiseId) ?? 0) + item.quantity),
    );
  }

  return {
    ready: true,
    lines: [...quantities].map(([merchandiseId, quantity]) => ({ merchandiseId, quantity })),
  };
}

export function formatTwd(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(amount);
}
