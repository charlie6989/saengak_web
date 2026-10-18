// 全站免運門檻的程式預設值（正式值存在 Supabase site_settings.free_shipping_threshold）。
// 2026-10-17 營運決定比照 LUCISSI 母站改為 NT$1,500（原 1,499），Shopify 運費規則與 FREESHIP 免運折扣須同步。
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 1500;
// 未達門檻的基本運費（正式值存在 Supabase site_settings.default_shipping_fee）。
// 2026-10-16 依 LUCISSI 同款黑貓宅急便常溫宅配統一為 NT$146，與 Shopify 結帳運費一致。
export const DEFAULT_SHIPPING_FEE = 146;

export type FreeShippingGap =
  | { status: 'already-free'; remaining: 0 }
  | { status: 'free-after-add'; remaining: 0 }
  | { status: 'short'; remaining: number };

/**
 * 商品頁價格下方的免運提示：購物車小計加上這次要加入的金額，還差多少達到免運門檻。
 * 實際運費仍以 Shopify 結帳頁計算為準。
 */
export function computeFreeShippingGap(cartSubtotal: number, addAmount: number, threshold: number): FreeShippingGap {
  if (cartSubtotal >= threshold) return { status: 'already-free', remaining: 0 };
  const remaining = threshold - cartSubtotal - Math.max(0, addAmount);
  if (remaining <= 0) return { status: 'free-after-add', remaining: 0 };
  return { status: 'short', remaining };
}
