-- =============================================================================
-- Migration: 基本運費統一為 NT$146（2026-10-16 營運決定）
-- 參照 LUCISSI 同款黑貓宅急便常溫宅配；Shopify 結帳本來就收 $146，
-- 網站 site_settings.default_shipping_fee 舊初始值 80 與實際結帳不一致。
-- 與 src/domain/shipping.ts 的 DEFAULT_SHIPPING_FEE 一致。
-- =============================================================================

begin;

update public.site_settings
set value = '146'::jsonb,
    updated_at = now()
where key = 'default_shipping_fee'
  and value is distinct from '146'::jsonb;

commit;
