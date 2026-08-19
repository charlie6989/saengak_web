begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default '',
  phone text,
  address text,
  birth_date date,
  gender text,
  instagram text,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists name text not null default '',
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists instagram text,
  add column if not exists avatar text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  order_number text not null,
  shopify_order_gid text unique,
  shopify_store_domain text,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  currency_code text not null default 'TWD' check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'processing' check (
    status in ('processing', 'paid', 'shipped', 'completed', 'cancelled', 'refunded', 'payment_failed')
  ),
  payment_status text not null default 'pending' check (
    payment_status in ('pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'voided')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists user_id uuid references auth.users (id) on delete restrict,
  add column if not exists order_number text,
  add column if not exists shopify_order_gid text,
  add column if not exists shopify_store_domain text,
  add column if not exists total_amount numeric(12, 2),
  add column if not exists currency_code text not null default 'TWD',
  add column if not exists status text not null default 'processing',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists orders_shopify_order_gid_unique
  on public.orders (shopify_order_gid)
  where shopify_order_gid is not null;

create index if not exists orders_user_created_at_idx
  on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  shopify_line_item_gid text,
  product_id text,
  product_variant_gid text,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  price numeric(12, 2) not null check (price >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.order_items
  add column if not exists order_id uuid references public.orders (id) on delete cascade,
  add column if not exists shopify_line_item_gid text,
  add column if not exists product_id text,
  add column if not exists product_variant_gid text,
  add column if not exists product_name text,
  add column if not exists quantity integer,
  add column if not exists price numeric(12, 2),
  add column if not exists image_url text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists order_items_shopify_line_item_gid_unique
  on public.order_items (shopify_line_item_gid)
  where shopify_line_item_gid is not null;

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  product_variant_gid text,
  product_name text not null,
  product_price numeric(12, 2) not null check (product_price >= 0),
  product_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_favorites
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists product_id text,
  add column if not exists product_variant_gid text,
  add column if not exists product_name text,
  add column if not exists product_price numeric(12, 2),
  add column if not exists product_image text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists user_favorites_product_variant_unique
  on public.user_favorites (user_id, product_id, coalesce(product_variant_gid, ''));

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

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function private.touch_updated_at();

drop trigger if exists user_favorites_touch_updated_at on public.user_favorites;
create trigger user_favorites_touch_updated_at
before update on public.user_favorites
for each row execute function private.touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.user_favorites enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
on public.orders for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
on public.order_items for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_items.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

drop policy if exists user_favorites_select_own on public.user_favorites;
create policy user_favorites_select_own
on public.user_favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_favorites_insert_own on public.user_favorites;
create policy user_favorites_insert_own
on public.user_favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists user_favorites_update_own on public.user_favorites;
create policy user_favorites_update_own
on public.user_favorites for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_favorites_delete_own on public.user_favorites;
create policy user_favorites_delete_own
on public.user_favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.user_favorites from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select, insert, update, delete on table public.user_favorites to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.orders to service_role;
grant select, insert, update, delete on table public.order_items to service_role;
grant select, insert, update, delete on table public.user_favorites to service_role;

commit;
