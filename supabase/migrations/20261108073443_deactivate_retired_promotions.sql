-- SAVE15、SPECIAL30 已於 Shopify 停用且過期（2026-11-07 店主要求停用），資料庫同步標為停用；保留資料列供紀錄。
update public.promotions set is_active = false where code in ('SAVE15', 'SPECIAL30') and is_active = true;
