-- SAENGAK Database Migration: 建立商品評價 (product_reviews) 與商品問答 (product_questions) 資料表
-- 規範來源: docs/00_DECISION_LOG.md & 繁體中文開發規範
-- 權威判定: app_metadata.role = 'admin' 為唯一管理員角色判定；前台會員遵循 auth.uid() 隔離。

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- 確保 touch_updated_at 函式存在
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

-- =============================================================================
-- 1. 商品評價表 (product_reviews)
-- =============================================================================
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  shopify_product_id text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_order_item_review unique (order_item_id)
);

-- 自動更新 updated_at 觸發器
drop trigger if exists product_reviews_touch_updated_at on public.product_reviews;
create trigger product_reviews_touch_updated_at
before update on public.product_reviews
for each row execute function private.touch_updated_at();

-- 建立索引
create index if not exists idx_reviews_product
  on public.product_reviews (shopify_product_id, status);

create index if not exists idx_reviews_user
  on public.product_reviews (user_id);

-- 啟用 Row Level Security
alter table public.product_reviews enable row level security;

-- 權限重置與指派
revoke all on table public.product_reviews from anon, authenticated;
grant select on table public.product_reviews to anon, authenticated;
grant insert, update, delete on table public.product_reviews to authenticated;
grant select, insert, update, delete on table public.product_reviews to service_role;

-- RLS Policies:
-- 1.1 SELECT: 前台大眾可讀取已發布評價 (status = 'published')
drop policy if exists reviews_select_public on public.product_reviews;
create policy reviews_select_public
on public.product_reviews for select
to anon, authenticated
using (status = 'published');

-- 1.2 SELECT: 會員可讀取自己的評價 (包含 pending/published/hidden)
drop policy if exists reviews_select_own on public.product_reviews;
create policy reviews_select_own
on public.product_reviews for select
to authenticated
using ((select auth.uid()) = user_id);

-- 1.3 SELECT: 管理員可讀取全部評價
drop policy if exists reviews_select_admin on public.product_reviews;
create policy reviews_select_admin
on public.product_reviews for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 1.4 INSERT: 登入會員可新增評價 (限自己的 user_id)
drop policy if exists reviews_insert_authenticated on public.product_reviews;
create policy reviews_insert_authenticated
on public.product_reviews for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- 1.5 UPDATE: 僅限管理員修改評價狀態與內容
drop policy if exists reviews_update_admin on public.product_reviews;
create policy reviews_update_admin
on public.product_reviews for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 1.6 DELETE: 僅限管理員刪除評價
drop policy if exists reviews_delete_admin on public.product_reviews;
create policy reviews_delete_admin
on public.product_reviews for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =============================================================================
-- 2. 商品問答表 (product_questions)
-- =============================================================================
create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shopify_product_id text not null,
  question text not null,
  answer text,
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'answered', 'hidden', 'deleted')),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 自動更新 updated_at 觸發器
drop trigger if exists product_questions_touch_updated_at on public.product_questions;
create trigger product_questions_touch_updated_at
before update on public.product_questions
for each row execute function private.touch_updated_at();

-- 建立索引
create index if not exists idx_questions_product
  on public.product_questions (shopify_product_id, status, is_public);

create index if not exists idx_questions_user
  on public.product_questions (user_id);

-- 啟用 Row Level Security
alter table public.product_questions enable row level security;

-- 權限重置與指派
revoke all on table public.product_questions from anon, authenticated;
grant select on table public.product_questions to anon, authenticated;
grant insert, update, delete on table public.product_questions to authenticated;
grant select, insert, update, delete on table public.product_questions to service_role;

-- RLS Policies:
-- 2.1 SELECT: 前台大眾可讀取已回答且公開的問答 (status = 'answered' AND is_public = true)
drop policy if exists questions_select_public on public.product_questions;
create policy questions_select_public
on public.product_questions for select
to anon, authenticated
using (status = 'answered' and is_public = true);

-- 2.2 SELECT: 提問會員可讀取自己的問答
drop policy if exists questions_select_own on public.product_questions;
create policy questions_select_own
on public.product_questions for select
to authenticated
using ((select auth.uid()) = user_id);

-- 2.3 SELECT: 管理員可讀取全部問答
drop policy if exists questions_select_admin on public.product_questions;
create policy questions_select_admin
on public.product_questions for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2.4 INSERT: 登入會員可提出問題 (限自己的 user_id)
drop policy if exists questions_insert_authenticated on public.product_questions;
create policy questions_insert_authenticated
on public.product_questions for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- 2.5 UPDATE: 僅限管理員回覆與變更問答狀態
drop policy if exists questions_update_admin on public.product_questions;
create policy questions_update_admin
on public.product_questions for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2.6 DELETE: 僅限管理員刪除問答
drop policy if exists questions_delete_admin on public.product_questions;
create policy questions_delete_admin
on public.product_questions for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =============================================================================
-- 3. 全站系統設定初始化 (site_settings)
-- =============================================================================
insert into public.site_settings (key, value, is_public, description)
values
  ('allow_product_qa', 'true'::jsonb, true, '前台商品問答表單開放開關'),
  ('line_oa_url', '"https://line.me/R/ti/p/@saengak"'::jsonb, true, '官方 LINE 客服連結')
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    description = excluded.description,
    updated_at = now();

commit;
