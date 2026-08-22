-- SAENGAK Database Migration: 後台管理員唯讀存取真實訂單／發票資料 + 補齊 site_settings 營運參數
-- 規範來源: docs/00_DECISION_LOG.md（app_metadata.role='admin' 為唯一權威角色判定）
--
-- 背景：orders / order_items / order_invoices 目前只有「擁有者本人可讀」的 RLS policy，
-- 沒有任何 admin 例外，導致後台管理介面即使改接真實查詢，管理員帳號也讀不到任何其他顧客的訂單。
-- 本 migration 比照 20260820000002_create_site_settings.sql 的 site_settings_admin_all 判斷方式，
-- 僅新增「唯讀」的 admin SELECT policy，不修改既有 policy、不開放寫入
-- （退款／作廢等變更仍須經過既有受限 RPC，不可由後台直接寫表）。

begin;

-- 1. orders：管理員唯讀所有訂單
drop policy if exists orders_admin_select on public.orders;
create policy orders_admin_select
on public.orders for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2. order_items：管理員唯讀所有訂單品項
drop policy if exists order_items_admin_select on public.order_items;
create policy order_items_admin_select
on public.order_items for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 3. order_invoices：管理員唯讀所有發票投影（光貿 Amego 回讀狀態）
drop policy if exists order_invoices_admin_select on public.order_invoices;
create policy order_invoices_admin_select
on public.order_invoices for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 4. 補齊 site_settings 全域營運參數（原後台頁面僅本地 state、無資料庫實體的欄位）
insert into public.site_settings (key, value, is_public, description)
values
  ('default_shipping_fee', '80'::jsonb, true, '未達免運門檻時之基本預設運費 (TWD)'),
  ('low_stock_threshold', '5'::jsonb, false, '單一 Variant 可售庫存低於此數值時於商品看板標註警示'),
  ('contact_email', '"service@saengak.com.tw"'::jsonb, true, '全站客服聯絡信箱'),
  ('support_phone', '"尚待營運確認"'::jsonb, true, '全站客服聯絡電話')
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    description = excluded.description,
    updated_at = now();

commit;
