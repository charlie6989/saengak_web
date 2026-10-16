-- =============================================================================
-- Migration: 免運門檻比照 LUCISSI 母站改為 NT$1,500（2026-10-17 營運決定）
-- 1. site_settings.free_shipping_threshold：1499 改為 1500，
--    與 src/domain/shipping.ts 的 DEFAULT_FREE_SHIPPING_THRESHOLD 一致。
-- 2. promotions.FREESHIP：門檻與說明文字同步改為 1500。
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
    description = '消費滿 NT$ 1,500 即可享免運費優惠，結帳時直接折抵運費。'
where code = 'FREESHIP'
  and (min_spend is distinct from 1500
       or description is distinct from '消費滿 NT$ 1,500 即可享免運費優惠，結帳時直接折抵運費。');

commit;
