begin;

alter table public.orders
  add column if not exists shipping_method text,
  add column if not exists fulfillment_status text not null default 'unfulfilled';

alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

alter table public.orders
  add constraint orders_fulfillment_status_check check (
    fulfillment_status in ('unfulfilled', 'partial', 'fulfilled', 'restocked')
  );

create table if not exists public.order_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  shopify_fulfillment_gid text not null unique,
  status text not null check (status ~ '^[a-z][a-z_]{0,39}$'),
  tracking_company text,
  tracking_numbers text[] not null default '{}',
  tracking_urls text[] not null default '{}',
  shopify_created_at timestamptz not null,
  shopify_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_fulfillments_gid_check check (
    shopify_fulfillment_gid ~ '^gid://shopify/Fulfillment/[0-9]+$'
  )
);

create index if not exists order_fulfillments_order_id_idx
  on public.order_fulfillments (order_id);

alter table public.order_fulfillments enable row level security;

drop policy if exists order_fulfillments_select_own on public.order_fulfillments;
create policy order_fulfillments_select_own
on public.order_fulfillments for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_fulfillments.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

revoke all on table public.order_fulfillments from public, anon, authenticated;
grant select on table public.order_fulfillments to authenticated;
grant select, insert, update, delete on table public.order_fulfillments to service_role;

drop function if exists public.sync_shopify_order_webhook(
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
);

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
  p_shipping_method text,
  p_fulfillment_status text,
  p_shopify_created_at timestamptz,
  p_shopify_updated_at timestamptz,
  p_triggered_at timestamptz,
  p_line_items jsonb,
  p_fulfillments jsonb
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
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_typeof(p_fulfillments) <> 'array' then
    raise exception 'line items and fulfillments must be arrays';
  end if;

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
    shipping_method,
    fulfillment_status,
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
    nullif(p_shipping_method, ''),
    p_fulfillment_status,
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
    shipping_method = excluded.shipping_method,
    fulfillment_status = excluded.fulfillment_status,
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

  delete from public.order_fulfillments where order_id = v_order_id;

  insert into public.order_fulfillments (
    order_id,
    shopify_fulfillment_gid,
    status,
    tracking_company,
    tracking_numbers,
    tracking_urls,
    shopify_created_at,
    shopify_updated_at,
    updated_at
  )
  select
    v_order_id,
    fulfillment ->> 'shopifyFulfillmentGid',
    fulfillment ->> 'status',
    nullif(fulfillment ->> 'trackingCompany', ''),
    array(
      select jsonb_array_elements_text(fulfillment -> 'trackingNumbers')
    ),
    array(
      select jsonb_array_elements_text(fulfillment -> 'trackingUrls')
    ),
    (fulfillment ->> 'createdAt')::timestamptz,
    (fulfillment ->> 'updatedAt')::timestamptz,
    now()
  from jsonb_array_elements(p_fulfillments) as fulfillment;

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
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb,
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
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb,
  jsonb
) to service_role;

commit;
