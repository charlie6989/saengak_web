begin;

alter table public.orders
  add column if not exists shopify_created_at timestamptz,
  add column if not exists shopify_updated_at timestamptz;

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check check (
    payment_status in (
      'pending',
      'authorized',
      'partially_paid',
      'paid',
      'partially_refunded',
      'refunded',
      'failed',
      'voided'
    )
  );

create table if not exists public.shopify_checkout_links (
  id uuid primary key default gen_random_uuid(),
  shopify_store_domain text not null,
  shopify_cart_token text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  converted_order_gid text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_checkout_links_domain_check check (
    shopify_store_domain ~ '^[a-z0-9][a-z0-9.-]*\.myshopify\.com$'
  ),
  constraint shopify_checkout_links_cart_token_check check (
    length(shopify_cart_token) between 8 and 255
  ),
  unique (shopify_store_domain, shopify_cart_token)
);

alter table public.shopify_checkout_links enable row level security;

drop trigger if exists shopify_checkout_links_touch_updated_at
  on public.shopify_checkout_links;
create trigger shopify_checkout_links_touch_updated_at
before update on public.shopify_checkout_links
for each row execute function private.touch_updated_at();

revoke all on table public.shopify_checkout_links from public, anon, authenticated;
grant select, insert, update, delete on table public.shopify_checkout_links to service_role;

create table if not exists private.shopify_webhook_receipts (
  webhook_id text primary key,
  topic text not null,
  shopify_store_domain text not null,
  shopify_order_gid text,
  triggered_at timestamptz,
  result text not null default 'received' check (
    result in ('received', 'applied', 'duplicate', 'stale', 'unlinked', 'invalid')
  ),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

revoke all on table private.shopify_webhook_receipts from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on table private.shopify_webhook_receipts to service_role;

create or replace function public.sync_shopify_order_webhook(
  p_webhook_id text,
  p_topic text,
  p_shopify_store_domain text,
  p_shopify_order_gid text,
  p_shopify_cart_token text,
  p_order_number text,
  p_total_amount numeric,
  p_currency_code text,
  p_status text,
  p_payment_status text,
  p_shopify_created_at timestamptz,
  p_shopify_updated_at timestamptz,
  p_triggered_at timestamptz,
  p_line_items jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_order_id uuid;
  v_inserted boolean;
begin
  insert into private.shopify_webhook_receipts (
    webhook_id,
    topic,
    shopify_store_domain,
    shopify_order_gid,
    triggered_at
  )
  values (
    p_webhook_id,
    p_topic,
    p_shopify_store_domain,
    p_shopify_order_gid,
    p_triggered_at
  )
  on conflict (webhook_id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return 'duplicate';
  end if;

  select link.user_id
  into v_user_id
  from public.shopify_checkout_links as link
  where link.shopify_store_domain = p_shopify_store_domain
    and link.shopify_cart_token = p_shopify_cart_token
    and link.expires_at >= coalesce(p_shopify_created_at, now())
  limit 1;

  if v_user_id is null then
    update private.shopify_webhook_receipts
    set result = 'unlinked', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'unlinked';
  end if;

  insert into public.orders (
    user_id,
    order_number,
    shopify_order_gid,
    shopify_store_domain,
    total_amount,
    currency_code,
    status,
    payment_status,
    shopify_created_at,
    shopify_updated_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_order_number,
    p_shopify_order_gid,
    p_shopify_store_domain,
    p_total_amount,
    p_currency_code,
    p_status,
    p_payment_status,
    p_shopify_created_at,
    p_shopify_updated_at,
    coalesce(p_shopify_created_at, now()),
    now()
  )
  on conflict (shopify_order_gid) do update
  set
    order_number = excluded.order_number,
    total_amount = excluded.total_amount,
    currency_code = excluded.currency_code,
    status = excluded.status,
    payment_status = excluded.payment_status,
    shopify_updated_at = excluded.shopify_updated_at,
    updated_at = now()
  where excluded.shopify_store_domain = public.orders.shopify_store_domain
    and excluded.user_id = public.orders.user_id
    and excluded.shopify_updated_at >= public.orders.shopify_updated_at
  returning id into v_order_id;

  if v_order_id is null then
    update private.shopify_webhook_receipts
    set result = 'stale', processed_at = now()
    where webhook_id = p_webhook_id;
    return 'stale';
  end if;

  delete from public.order_items where order_id = v_order_id;

  insert into public.order_items (
    order_id,
    shopify_line_item_gid,
    product_id,
    product_variant_gid,
    product_name,
    quantity,
    price,
    image_url
  )
  select
    v_order_id,
    item ->> 'shopifyLineItemGid',
    item ->> 'productId',
    nullif(item ->> 'productVariantGid', ''),
    item ->> 'productName',
    (item ->> 'quantity')::integer,
    (item ->> 'price')::numeric,
    nullif(item ->> 'imageUrl', '')
  from jsonb_array_elements(p_line_items) as item;

  update public.shopify_checkout_links
  set converted_order_gid = p_shopify_order_gid
  where shopify_store_domain = p_shopify_store_domain
    and shopify_cart_token = p_shopify_cart_token;

  update private.shopify_webhook_receipts
  set result = 'applied', processed_at = now()
  where webhook_id = p_webhook_id;

  return 'applied';
exception
  when others then
    update private.shopify_webhook_receipts
    set result = 'invalid', processed_at = now()
    where webhook_id = p_webhook_id;
    raise;
end;
$$;

revoke all on function public.sync_shopify_order_webhook(
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb
) from public, anon, authenticated;

grant execute on function public.sync_shopify_order_webhook(
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb
) to service_role;

commit;
