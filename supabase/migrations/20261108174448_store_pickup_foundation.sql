-- 超商取貨（全家、7-11、萊爾富）基礎設定，2026-11-09。
-- 1. site_settings.store_pickup_enabled：上線開關，預設 false（不覆寫既有值）。
-- 2. site_settings.pickup_shipping_fee：超商取貨運費，店主決定 NT$60。
-- 3. private.shipany_api_tokens：ShipAny merchant token。refresh token 每次使用都會輪替且只能用一次，
--    必須保存最新一組；token 由 API 以 AES-256-GCM 加密後才寫入（欄位存密文），只允許 service_role 透過 RPC 讀寫。
begin;

insert into public.site_settings (key, value, is_public, description)
values
  ('store_pickup_enabled', 'false'::jsonb, true, '超商取貨開關（全家、7-11、萊爾富門市取件）'),
  ('pickup_shipping_fee', '60'::jsonb, true, '超商取貨運費（新台幣，達免運門檻免運）')
on conflict (key) do nothing;

create table if not exists private.shipany_api_tokens (
  id smallint primary key default 1 check (id = 1),
  access_token text,
  access_expires_at timestamptz,
  refresh_token text not null check (length(refresh_token) between 1 and 8192),
  updated_at timestamptz not null default now()
);

alter table private.shipany_api_tokens enable row level security;
revoke all on table private.shipany_api_tokens from public, anon, authenticated;
grant select, insert, update on table private.shipany_api_tokens to service_role;

create or replace function public.get_shipany_api_tokens()
returns table (access_token text, access_expires_at timestamptz, refresh_token text)
language sql
security definer
set search_path = ''
as $$
  select t.access_token, t.access_expires_at, t.refresh_token
  from private.shipany_api_tokens as t
  where t.id = 1;
$$;

-- 以「上一組 refresh token」為條件更新，避免兩個請求同時輪替時互相覆蓋：
-- 只有持有目前 refresh token 的一方能寫入；p_previous_refresh 為 null 時只在尚無資料時建立第一筆。
create or replace function public.rotate_shipany_api_tokens(
  p_previous_refresh text,
  p_access_token text,
  p_access_expires_at timestamptz,
  p_refresh_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_refresh_token is null or length(p_refresh_token) not between 1 and 8192 then
    raise exception 'SHIPANY_REFRESH_TOKEN_INVALID';
  end if;

  if p_previous_refresh is null then
    insert into private.shipany_api_tokens (id, access_token, access_expires_at, refresh_token)
    values (1, p_access_token, p_access_expires_at, p_refresh_token)
    on conflict (id) do nothing;
  else
    update private.shipany_api_tokens
    set access_token = p_access_token,
        access_expires_at = p_access_expires_at,
        refresh_token = p_refresh_token,
        updated_at = now()
    where id = 1
      and refresh_token = p_previous_refresh;
  end if;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.get_shipany_api_tokens() from public, anon, authenticated;
revoke all on function public.rotate_shipany_api_tokens(text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_shipany_api_tokens() to service_role;
grant execute on function public.rotate_shipany_api_tokens(text, text, timestamptz, text) to service_role;

commit;
