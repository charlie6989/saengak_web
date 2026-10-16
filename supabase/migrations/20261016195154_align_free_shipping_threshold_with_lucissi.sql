-- =============================================================================
-- Migration: 免運門檻比照 LUCISSI 母站改為 NT$1,500（2026-10-17 營運決定）
-- 1. site_settings.free_shipping_threshold：1499 改為 1500，
--    與 src/domain/shipping.ts 的 DEFAULT_FREE_SHIPPING_THRESHOLD 一致。
-- 2. promotions.FREESHIP：門檻改為 1500；說明只替換金額，保留「每位顧客限用一次」等既有規則文字。
-- Shopify 後台運費規則（滿額免運）與 FREESHIP 折扣門檻需另外設定，不在此 migration 範圍。
-- =============================================================================

begin;

update public.site_settings
set value = '1500'::jsonb,
    updated_at = now()
where key = 'free_shipping_threshold'
  and value is distinct from '1500'::jsonb;

update public.promotions
set min_spend = 1500,
    description = replace(replace(description, 'NT$ 1,499', 'NT$ 1,500'), 'NT$1,499', 'NT$1,500')
where code = 'FREESHIP'
  and (min_spend is distinct from 1500
       or description like '%1,499%');

commit;
