-- Fresh hosted branches do not necessarily inherit the production project's
-- default table grants. Checkout APIs and the invoker-rights Shopify sync RPC
-- need explicit access to promotions and coupon state, including cancellation.
begin;

grant select, insert, update, delete
  on public.promotions, public.user_coupons to service_role;

commit;
