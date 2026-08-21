-- SAENGAK Database Migration: 建立全站系統設定表 (site_settings)
-- 規範來源: docs/00_DECISION_LOG.md & docs/CHECKOUT_PAYMENT_SPEC.md

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

-- 建立 site_settings 表
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- 觸發器：更新 updated_at
drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at
before update on public.site_settings
for each row execute function private.touch_updated_at();

-- 啟用 Row Level Security
alter table public.site_settings enable row level security;

-- 權限重置
revoke all on table public.site_settings from public, anon, authenticated;

-- 權限指派：
-- 1. 匿名使用者 (anon) 與 登入會員 (authenticated) 具備 SELECT 權限 (由 RLS policy 限制僅能查閱 is_public = true)
grant select on table public.site_settings to anon, authenticated;

-- 2. 登入會員具備 INSERT, UPDATE, DELETE 表格權限 (由 RLS policy 嚴格限制僅 admin 角色可執行)
grant insert, update, delete on table public.site_settings to authenticated;

-- 3. 後端 service_role 具備完全管理權限
grant select, insert, update, delete on table public.site_settings to service_role;

-- RLS Policies:
-- 政策 1: 公開設定唯讀 (anon 與 authenticated 僅能讀取 is_public = true 之紀錄)
drop policy if exists site_settings_select_public on public.site_settings;
create policy site_settings_select_public
on public.site_settings for select
to anon, authenticated
using (is_public = true);

-- 政策 2: 管理員具備所有操作權限 (由 JWT app_metadata.role = 'admin' 鑑權)
drop policy if exists site_settings_admin_all on public.site_settings;
create policy site_settings_admin_all
on public.site_settings for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 插入全站初始系統設定 (免運門檻、維護模式)
insert into public.site_settings (key, value, is_public, description)
values
  ('free_shipping_threshold', '1500'::jsonb, true, '全站免運門檻金額 (TWD)'),
  ('maintenance_mode', 'false'::jsonb, true, '全站維護模式開關')
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    description = excluded.description,
    updated_at = now();

commit;
