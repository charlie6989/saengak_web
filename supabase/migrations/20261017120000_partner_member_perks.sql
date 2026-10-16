-- =============================================================================
-- Migration: LUCISSI ↔ LUCISSI CARE 會員資格互認（第 1 階段）
-- 1. public.partner_member_exists(email)：供 /api/partner/member-status 以 service_role 查詢
--    「此 Email 是否為已驗證的 CARE 會員」，只回傳布林值，不開放 anon／authenticated。
-- 2. public.partner_member_perks：LUCISSI 會員首單免運的領取紀錄（每位會員一筆）。
--    狀態 pending → issued → used／expired；只由伺服器（service_role）寫入，會員只能讀自己的那筆。
-- =============================================================================

begin;

create or replace function public.partner_member_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
      and u.email_confirmed_at is not null
      and u.deleted_at is null
  );
$$;

revoke all on function public.partner_member_exists(text) from public, anon, authenticated;
grant execute on function public.partner_member_exists(text) to service_role;

create table if not exists public.partner_member_perks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_normalized text not null,
  partner text not null default 'lucissi' check (partner in ('lucissi')),
  perk text not null default 'first_order_free_shipping' check (perk in ('first_order_free_shipping')),
  coupon_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'issued', 'used', 'expired')),
  shopify_discount_id text,
  expires_at timestamptz,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- webhook 依 Email 找出尚未使用的權益
create index if not exists idx_partner_member_perks_email_status
  on public.partner_member_perks (email_normalized, status);

alter table public.partner_member_perks enable row level security;

revoke all on table public.partner_member_perks from anon, authenticated;
grant select on table public.partner_member_perks to authenticated;
grant all on table public.partner_member_perks to service_role;

drop policy if exists partner_member_perks_select_own on public.partner_member_perks;
create policy partner_member_perks_select_own
  on public.partner_member_perks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
