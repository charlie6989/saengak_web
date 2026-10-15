-- =============================================================================
-- Migration: 全站免運門檻統一為 NT$1,499（2026-10-16 營運決定）
-- 1. site_settings.free_shipping_threshold：舊初始值 1500 改為 1499，
--    與 src/domain/shipping.ts 的 DEFAULT_FREE_SHIPPING_THRESHOLD 一致。
-- 2. promotions.FREESHIP：移除過期季節字（初夏），標題改為「滿額免運」，門檻同為 1499。
-- Shopify 後台運費規則需另外設定，不在此 migration 範圍。
-- =============================================================================

begin;

update public.site_settings
set value = '1499'::jsonb,
    updated_at = now()
where key = 'free_shipping_threshold'
  and value is distinct from '1499'::jsonb;

update public.promotions
set title = '滿額免運',
    min_spend = 1499
where code = 'FREESHIP'
  and (title is distinct from '滿額免運' or min_spend is distinct from 1499);

commit;
