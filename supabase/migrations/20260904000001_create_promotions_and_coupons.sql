-- SAENGAK Database Migration: 建立促銷活動 (promotions) 與會員優惠券歸戶 (user_coupons) 資料表
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
-- 1. 促銷活動與優惠券主表 (promotions)
-- =============================================================================
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  subtitle text,
  description text,
  category text not null default 'all' check (category in ('all', 'welcome', 'discount', 'shipping', 'member')),
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount', 'free_shipping')),
  discount_value numeric not null default 0,
  min_spend numeric not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  badge_text text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 自動更新 updated_at 觸發器
drop trigger if exists promotions_touch_updated_at on public.promotions;
create trigger promotions_touch_updated_at
before update on public.promotions
for each row execute function private.touch_updated_at();

-- 建立索引
create index if not exists idx_promotions_active
  on public.promotions (is_active, category);

create index if not exists idx_promotions_code
  on public.promotions (code);

-- 啟用 Row Level Security
alter table public.promotions enable row level security;

-- 權限重置與指派
revoke all on table public.promotions from anon, authenticated;
grant select on table public.promotions to anon, authenticated;
grant insert, update, delete on table public.promotions to authenticated;

-- RLS 策略 (公開讀取有效活動，管理員全權管理)
drop policy if exists "promotions_public_read_active" on public.promotions;
create policy "promotions_public_read_active"
  on public.promotions
  for select
  to anon, authenticated
  using (is_active = true or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "promotions_admin_manage" on public.promotions;
create policy "promotions_admin_manage"
  on public.promotions
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- =============================================================================
-- 2. 會員優惠券歸戶表 (user_coupons)
-- =============================================================================
create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  coupon_code text not null,
  status text not null default 'available' check (status in ('available', 'used', 'expired')),
  claimed_at timestamptz not null default now(),
  used_at timestamptz,
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_promotion unique (user_id, promotion_id)
);

-- 自動更新 updated_at 觸發器
drop trigger if exists user_coupons_touch_updated_at on public.user_coupons;
create trigger user_coupons_touch_updated_at
before update on public.user_coupons
for each row execute function private.touch_updated_at();

-- 建立索引
create index if not exists idx_user_coupons_user_status
  on public.user_coupons (user_id, status);

create index if not exists idx_user_coupons_code
  on public.user_coupons (coupon_code);

-- 啟用 Row Level Security
alter table public.user_coupons enable row level security;

-- 權限重置與指派
revoke all on table public.user_coupons from anon, authenticated;
grant select, insert, update on table public.user_coupons to authenticated;
grant delete on table public.user_coupons to authenticated;

-- RLS 策略 (會員僅限自身歸戶與查詢)
drop policy if exists "user_coupons_select_own" on public.user_coupons;
create policy "user_coupons_select_own"
  on public.user_coupons
  for select
  to authenticated
  using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "user_coupons_insert_own" on public.user_coupons;
create policy "user_coupons_insert_own"
  on public.user_coupons
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_coupons_update_own" on public.user_coupons;
create policy "user_coupons_update_own"
  on public.user_coupons
  for update
  to authenticated
  using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =============================================================================
-- 3. 注入預設種子促銷資料 (Seed Promotions)
-- =============================================================================
insert into public.promotions (code, title, subtitle, description, category, discount_type, discount_value, min_spend, starts_at, ends_at, badge_text, image_url, is_active)
values
  (
    'WELCOME100',
    '新會員見面禮',
    '首次加入會員專享折抵',
    '全館消費滿 NT$ 1,500 現折 NT$ 100。每位會員限用乙次。',
    'welcome',
    'fixed_amount',
    100,
    1500,
    now() - interval '1 day',
    now() + interval '90 days',
    '新客專享',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
    true
  ),
  (
    'SAVE15',
    'VIP 專屬回饋',
    '質感選品全品項 85 折',
    '全館消費滿 NT$ 3,000 享結帳 85 折優惠（最高折抵 NT$ 600）。',
    'discount',
    'percentage',
    15,
    3000,
    now() - interval '1 day',
    now() + interval '30 days',
    '15% OFF',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
    true
  ),
  (
    'FREESHIP',
    '初夏免運專案',
    '超商與宅配滿額免運費',
    '消費滿 NT$ 1,499 即可享免運費優惠，結帳時直接折抵運費。',
    'shipping',
    'free_shipping',
    0,
    1499,
    now() - interval '1 day',
    now() + interval '60 days',
    '全館免運',
    'https://cdn.shopify.com/s/files/1/0701/6454/5603/files/freeship_promo_summer.jpg?v=1788511527',
    true
  ),
  (
    'SPECIAL30',
    '限時會員日狂歡',
    '指定熱銷組合 7 折特惠',
    '單筆訂單滿 NT$ 5,250 即享 7 折專屬特惠，數量有限送完為止。',
    'member',
    'percentage',
    30,
    5250,
    now() - interval '1 day',
    now() + interval '14 days',
    '30% OFF',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
    true
  )
on conflict (code) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  category = excluded.category,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  min_spend = excluded.min_spend,
  badge_text = excluded.badge_text,
  image_url = excluded.image_url,
  is_active = excluded.is_active;

commit;
