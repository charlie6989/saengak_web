// 全站免運門檻的程式預設值（正式值存在 Supabase site_settings.free_shipping_threshold）。
// 2026-10-17 營運決定比照 LUCISSI 母站改為 NT$1,500（原 1,499），Shopify 運費規則與 FREESHIP 免運折扣須同步。
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 1500;
// 未達門檻的基本運費（正式值存在 Supabase site_settings.default_shipping_fee）。
// 2026-10-16 依 LUCISSI 同款黑貓宅急便常溫宅配統一為 NT$146，與 Shopify 結帳運費一致。
export const DEFAULT_SHIPPING_FEE = 146;
