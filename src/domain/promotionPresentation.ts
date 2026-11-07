/**
 * /promotion 的公開呈現規則。前台與 api/shopify/discounts 共用，Shopify 或 Supabase 資料過時也不會誤導顧客。
 * 這裡只決定「網站怎麼顯示」，不會更動 Shopify 折扣本身。
 */

/**
 * 初始種子折扣，店主確認前不公開列出，也不能經網站領券；既有代碼是否仍可在結帳使用由 Shopify 決定。
 * 重新開放：店主確認文案與條件後，把代碼從這份清單移除。
 */
export const HIDDEN_PROMOTION_CODES: ReadonlySet<string> = new Set(['SAVE15', 'SPECIAL30']);

/**
 * Shopify 上的標題與副標過時時，由網站覆寫顯示。
 * 移除條件：店主更新 Shopify 的折扣標題與 custom.subtitle metafield 之後，刪除對應項目。
 */
const COPY_OVERRIDES: Readonly<Record<string, { title: string; badge_text: string }>> = {
  FREESHIP: { title: '滿額免運', badge_text: '滿額免運' },
};

export function isPublicPromotionCode(code: string | null | undefined): boolean {
  return !HIDDEN_PROMOTION_CODES.has((code || '').trim().toUpperCase());
}

export interface PromotionTerms {
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  min_spend: number;
  min_quantity?: number | null;
}

const twd = (amount: number) => `NT$ ${amount.toLocaleString('en-US')}`;

function formatDiscountLabel(discountType: PromotionTerms['discount_type'], value: number): string {
  if (discountType === 'free_shipping') return '免運費';
  if (discountType === 'fixed_amount') return `現折 ${twd(value)}`;
  // 15% off 在中文是 85 折；30% off 是 7 折
  const remaining = 100 - value;
  return `享 ${remaining % 10 === 0 ? remaining / 10 : remaining} 折`;
}

/** 由折扣的結構化條件產生中文副標，取代 Shopify 自動產生的英文 summary。 */
export function buildPromotionSubtitle(terms: PromotionTerms): string {
  const label = formatDiscountLabel(terms.discount_type, terms.discount_value);
  if (terms.discount_type === 'free_shipping') {
    return terms.min_spend > 0 ? `黑貓宅配滿 ${twd(terms.min_spend)} ${label}` : `黑貓宅配${label}`;
  }
  if (terms.min_spend > 0) return `滿 ${twd(terms.min_spend)} ${label}`;
  if (terms.min_quantity && terms.min_quantity > 0) return `滿 ${terms.min_quantity} 件${label}`;
  return `全館${label}`;
}

const HAS_CHINESE = /[\u4e00-\u9fff]/;
/** Supabase 舊資料的說明開頭，內部用語不對顧客顯示。 */
const STORED_DESCRIPTION_PREFIX = 'Shopify 官方活動，';

/**
 * 三個資料來源共用的文案處理：
 * - 有覆寫的代碼，標題用覆寫值，副標由實際條件產生。
 * - 其他代碼的副標若完全沒有中文（Supabase 舊資料可能存著 Shopify 的英文 summary），同樣改由實際條件產生。
 * - 移除舊資料說明開頭的內部用語。
 */
export function applyPromotionCopy<T extends PromotionTerms & { code: string; title: string; subtitle?: string; description?: string; badge_text?: string }>(promotion: T): T {
  const override = COPY_OVERRIDES[promotion.code.trim().toUpperCase()];
  const staleDescription = promotion.description?.startsWith(STORED_DESCRIPTION_PREFIX);
  const englishSubtitle = promotion.subtitle && !HAS_CHINESE.test(promotion.subtitle);
  if (!override && !staleDescription && !englishSubtitle) return promotion;
  return {
    ...promotion,
    ...override,
    ...(override || englishSubtitle ? { subtitle: buildPromotionSubtitle(promotion) } : {}),
    ...(staleDescription ? { description: promotion.description!.slice(STORED_DESCRIPTION_PREFIX.length) } : {}),
  };
}
