-- 貨到付款拒收停權，2026-11-17 店主決定比照 LUCISSI（LUCISSI_website 20261012234735_order_refusal_blocks.sql）。
-- 客服在 Shopify 訂單加上「拒收」或「未取件」標籤；訂單 webhook 把標籤同步到這裡，
-- 同一位 Shopify 顧客累計達門檻（程式設定 2 筆）後，之後的新訂單未付款自動取消、已付款轉人工。
-- 與 LUCISSI 不同：CARE 的訂單不保存 Shopify 顧客 ID，所以另存訂單 Email（小寫），
-- 讓建立結帳時能以會員或訪客的 Email 先擋下（customer_purchase_block_by_email）。
begin;

create table public.order_refusals (
  shopify_order_id text primary key check (shopify_order_id ~ '^gid://shopify/Order/[1-9][0-9]*$'),
  shopify_customer_id text not null check (shopify_customer_id ~ '^gid://shopify/Customer/[1-9][0-9]*$'),
  customer_email text check (customer_email is null or (char_length(customer_email) <= 254 and customer_email = lower(customer_email))),
  recorded_at timestamptz not null default now()
);
create index order_refusals_customer_idx on public.order_refusals (shopify_customer_id, recorded_at);
create index order_refusals_email_idx on public.order_refusals (customer_email, recorded_at) where customer_email is not null;

-- 每筆訂單最後套用的 webhook 版本（Shopify updated_at）。晚到或重送的舊快照不得新增或移除拒收，
-- 否則客服移除的拒收可能被舊快照加回，或舊快照把新加的拒收刪掉而解除停權。
create table public.order_refusal_versions (
  shopify_order_id text primary key check (shopify_order_id ~ '^gid://shopify/Order/[1-9][0-9]*$'),
  source_updated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.blocked_order_actions (
  shopify_order_id text primary key check (shopify_order_id ~ '^gid://shopify/Order/[1-9][0-9]*$'),
  shopify_customer_id text not null check (shopify_customer_id ~ '^gid://shopify/Customer/[1-9][0-9]*$'),
  action text not null check (action in ('cancel_pending', 'cancelled', 'manual_review', 'cancel_failed')),
  detail text check (char_length(detail) <= 300),
  updated_at timestamptz not null default now()
);

alter table public.order_refusals enable row level security;
alter table public.order_refusal_versions enable row level security;
alter table public.blocked_order_actions enable row level security;
revoke all on public.order_refusals, public.order_refusal_versions, public.blocked_order_actions from public, anon, authenticated;
grant select on public.order_refusals, public.order_refusal_versions, public.blocked_order_actions to service_role;

-- 同步一筆訂單的拒收標籤並回傳這位顧客的狀態。blockedSince 是第 p_threshold 筆拒收的記錄時間，
-- 早於這個時間的訂單永遠不會被當成停權後下的單。
-- p_source_updated_at 比這筆訂單已套用的版本舊時不改拒收紀錄，回傳 stale=true（呼叫端不得依舊快照取消訂單）。
-- 同版本可重送（同一次更新可能有 orders/updated 與 orders/paid 等多個主題）。
create function public.sync_order_refusal(p_order_id text, p_customer_id text, p_refused boolean, p_threshold integer, p_source_updated_at timestamptz, p_customer_email text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  refusal_count integer;
  blocked_since timestamptz;
  accepted boolean;
begin
  if p_order_id !~ '^gid://shopify/Order/[1-9][0-9]*$' or p_customer_id !~ '^gid://shopify/Customer/[1-9][0-9]*$'
    or p_refused is null or p_threshold is null or p_threshold < 1 or p_source_updated_at is null then
    raise exception 'Invalid order refusal input.';
  end if;
  -- upsert 會鎖住這筆訂單的版本列到交易結束，同一訂單的並行 webhook 依序處理
  insert into public.order_refusal_versions (shopify_order_id, source_updated_at)
  values (p_order_id, p_source_updated_at)
  on conflict (shopify_order_id) do update
    set source_updated_at = excluded.source_updated_at, updated_at = now()
    where excluded.source_updated_at >= public.order_refusal_versions.source_updated_at
  returning true into accepted;
  if not coalesce(accepted, false) then
    null;
  elsif p_refused then
    insert into public.order_refusals (shopify_order_id, shopify_customer_id, customer_email)
    values (p_order_id, p_customer_id, nullif(lower(btrim(left(coalesce(p_customer_email, ''), 254))), ''))
    on conflict (shopify_order_id) do update
      set customer_email = coalesce(public.order_refusals.customer_email, excluded.customer_email);
  else
    delete from public.order_refusals where shopify_order_id = p_order_id;
  end if;
  select count(*) into refusal_count from public.order_refusals where shopify_customer_id = p_customer_id;
  select recorded_at into blocked_since from public.order_refusals
   where shopify_customer_id = p_customer_id order by recorded_at, shopify_order_id offset p_threshold - 1 limit 1;
  return jsonb_build_object('refusals', refusal_count, 'blockedSince', blocked_since, 'stale', not coalesce(accepted, false));
end;
$$;

create function public.customer_purchase_block(p_customer_id text, p_threshold integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'refusals', (select count(*) from public.order_refusals where shopify_customer_id = p_customer_id),
    'blockedSince', (select recorded_at from public.order_refusals where shopify_customer_id = p_customer_id
      order by recorded_at, shopify_order_id offset greatest(p_threshold, 1) - 1 limit 1));
$$;

-- 建立結帳前的檢查：同一個 Email 的拒收（可能跨多個 Shopify 顧客）達門檻就視為停權。
create function public.customer_purchase_block_by_email(p_email text, p_threshold integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'refusals', (select count(*) from public.order_refusals where customer_email = lower(btrim(p_email))),
    'blockedSince', (select recorded_at from public.order_refusals where customer_email = lower(btrim(p_email))
      order by recorded_at, shopify_order_id offset greatest(p_threshold, 1) - 1 limit 1));
$$;

-- 已確認取消的紀錄不會被改回；送出取消（cancel_pending）或取消失敗的，之後可改成已取消或人工處理。
-- 只有在訂單 webhook 看到訂單確實已取消（cancelled_at）時才記 cancelled；Shopify 接受取消只代表背景工作已排入。
-- 若已取消的 webhook 比 cancel_pending 先寫入，cancelled 不會被 cancel_pending 蓋掉。
create function public.record_blocked_order_action(p_order_id text, p_customer_id text, p_action text, p_detail text default null)
returns text language plpgsql security invoker set search_path = '' as $$
declare stored text;
begin
  if p_action not in ('cancel_pending', 'cancelled', 'manual_review', 'cancel_failed') then raise exception 'Invalid blocked order action.'; end if;
  insert into public.blocked_order_actions (shopify_order_id, shopify_customer_id, action, detail)
  values (p_order_id, p_customer_id, p_action, left(p_detail, 300))
  on conflict (shopify_order_id) do update set
    action = case when public.blocked_order_actions.action = 'cancelled' then 'cancelled' else excluded.action end,
    detail = case when public.blocked_order_actions.action = 'cancelled' then public.blocked_order_actions.detail else excluded.detail end,
    updated_at = now()
  returning action into stored;
  return stored;
end;
$$;

revoke all on function public.sync_order_refusal(text, text, boolean, integer, timestamptz, text) from public, anon, authenticated;
revoke all on function public.customer_purchase_block_by_email(text, integer) from public, anon, authenticated;
revoke all on function public.customer_purchase_block(text, integer) from public, anon, authenticated;
revoke all on function public.record_blocked_order_action(text, text, text, text) from public, anon, authenticated;
grant execute on function public.sync_order_refusal(text, text, boolean, integer, timestamptz, text) to service_role;
grant execute on function public.customer_purchase_block_by_email(text, integer) to service_role;
grant execute on function public.customer_purchase_block(text, integer) to service_role;
grant execute on function public.record_blocked_order_action(text, text, text, text) to service_role;
grant insert, update, delete on public.order_refusals to service_role;
grant insert, update on public.order_refusal_versions to service_role;
grant insert, update on public.blocked_order_actions to service_role;
commit;
