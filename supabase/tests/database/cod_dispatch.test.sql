begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email,raw_app_meta_data) values
 ('99999999-9999-4999-8999-999999999981','cod-admin@example.test','{"role":"admin"}'),
 ('99999999-9999-4999-8999-999999999982','cod-member@example.test','{"role":"member"}');
insert into public.shopify_checkout_links(shopify_store_domain,shopify_cart_token,user_id,checkout_kind,expires_at)
select 'gh2xgs-zf.myshopify.com','cod-dispatch-cart-'||n,'99999999-9999-4999-8999-999999999982','member',now()+interval '1 year'
from generate_series(1,20) n;
create function pg_temp.sync(n int, extra jsonb default '{}') returns text language sql as $$
select public.sync_shopify_order_webhook(
 p_webhook_id=>coalesce(extra->>'event', 'dispatch-event-'||n), p_topic=>coalesce(extra->>'topic','orders/create'),
 p_shopify_store_domain=>'gh2xgs-zf.myshopify.com', p_shopify_order_gid=>'gid://shopify/Order/82000'||n,
 p_shopify_cart_token=>'cod-dispatch-cart-'||n, p_order_number=>'#COD'||n,
 p_total_amount=>coalesce((extra->>'total')::numeric,826), p_currency_code=>coalesce(extra->>'currency','TWD'),
 p_status=>coalesce(extra->>'status','processing'), p_payment_status=>coalesce(extra->>'payment','pending'),
 p_shipping_method=>'標準', p_fulfillment_status=>coalesce(extra->>'fulfillment','unfulfilled'),
 p_shopify_created_at=>now(), p_shopify_updated_at=>now()+coalesce((extra->>'seconds')::int,0)*interval '1 second',
 p_triggered_at=>now()+coalesce((extra->>'seconds')::int,0)*interval '1 second',
 p_line_items=>replace('[{"shopifyLineItemGid":"gid://shopify/LineItem/82","productId":"gid://shopify/Product/83","productName":"Fixture","quantity":1,"price":"680","imageUrl":""}]', 'LineItem/82', 'LineItem/82'||n)::jsonb,
 p_fulfillments=>'[]', p_shipping_amount=>146,
 p_invoice_context=>coalesce(extra->'context','{"paymentKind":"cod","test":false}'::jsonb));
$$;
create function pg_temp.confirm(n int, tracking text default '123456789012') returns uuid language sql as $$
select public.confirm_cod_dispatch('gid://shopify/Order/82000'||n,
 ('88888888-8888-4888-8888-'||lpad(n::text,12,'0'))::uuid,'99999999-9999-4999-8999-999999999981',
 now(),826,tracking,'black_cat_ambient',true);
$$;
set local role service_role;
select public.save_checkout_invoice_preference('gh2xgs-zf.myshopify.com','cod-dispatch-cart-'||n,
 '{"kind":"personal","notificationEmail":"cod@example.test","carrier":"mobile","carrierId":"/ABC1234"}') from generate_series(1,20) n;
select pg_temp.sync(n) from generate_series(1,20) n;
select throws_ok($$select pg_temp.confirm(1)$$,'P0001','COD_DISPATCH_DISABLED','default policy refuses dispatch');
update private.cod_invoice_policy set enabled=true, starts_at=now()-interval '1 day';
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid like 'gid://shopify/Order/82000%'),0,'draft orders do not invoice');
select lives_ok($$select pg_temp.confirm(1)$$,'whole unpaid order can be approved');
select is((select payment_status from public.orders where shopify_order_gid='gid://shopify/Order/820001'),'pending','approval does not mark payment');
select is((select request_payload->'preference'->>'carrierId' from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820001'),'/ABC1234','carrier survives into immutable invoice');
select is((select count(*)::int from private.checkout_invoice_preferences where shopify_cart_token='cod-dispatch-cart-1'),0,'preference removed only after approval snapshot');
select lives_ok($$select pg_temp.confirm(1)$$,'same approval is idempotent');
select throws_ok($$select pg_temp.confirm(1,'999999999999')$$,'P0001','COD_CONFIRMATION_CONFLICT','tracking cannot change on retry');
select pg_temp.sync(1,'{"event":"paid-1","topic":"orders/paid","payment":"paid","status":"paid","seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820001'),1,'paid event does not duplicate invoice');
select is((select request_payload->>'issueBasis' from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820001'),'cod_dispatch','paid event does not replace approval snapshot');
select pg_temp.sync(2,'{"event":"paid-2","topic":"orders/paid","payment":"paid","status":"paid","seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820002'),0,'paid COD without dispatch never silently invoices');
select throws_ok($$select pg_temp.confirm(2)$$,'P0001','COD_WHOLE_ORDER_REQUIRED','already paid order goes to manual review');
select pg_temp.sync(3,'{"event":"partial-3","fulfillment":"partial","seconds":1}');
select throws_ok($$select pg_temp.confirm(3)$$,'P0001','COD_WHOLE_ORDER_REQUIRED','partial fulfillment refused');
select pg_temp.sync(4,'{"event":"test-4","context":{"paymentKind":"cod","test":true},"seconds":1}');
select throws_ok($$select pg_temp.confirm(4)$$,'P0001','COD_EVIDENCE_REQUIRED','test order refused');
select pg_temp.sync(5,'{"event":"unknown-5","context":{},"seconds":1}');
select throws_ok($$select pg_temp.confirm(5)$$,'P0001','COD_EVIDENCE_REQUIRED','missing evidence refused');
select pg_temp.sync(6,'{"event":"mixed-6","context":{"paymentKind":"mixed","test":false},"seconds":1}');
select throws_ok($$select pg_temp.confirm(6)$$,'P0001','COD_EVIDENCE_REQUIRED','mixed payment refused');
select pg_temp.sync(7,'{"event":"edited-7","total":900,"seconds":1}');
select throws_ok($$select pg_temp.confirm(7)$$,'P0001','COD_SNAPSHOT_CHANGED','changed order requires reload');
delete from private.checkout_invoice_preferences where shopify_cart_token='cod-dispatch-cart-8';
select throws_ok($$select pg_temp.confirm(8)$$,'P0001','COD_INVOICE_PREFERENCE_REQUIRED','missing preference cannot silently downgrade');
select throws_ok($$select public.confirm_cod_dispatch('gid://shopify/Order/820009','88888888-8888-4888-8888-000000000009','99999999-9999-4999-8999-999999999982',now(),826,'123456789012','black_cat_ambient',true)$$,'P0001','COD_ADMIN_REQUIRED','member cannot approve via forged actor');
select throws_ok($$select public.enqueue_amego_invoice_job('gid://shopify/Order/820009','S820009','{}','hash',826)$$,'P0001','COD_DISPATCH_CONFIRMATION_REQUIRED','legacy enqueue cannot bypass approval');
select pg_temp.sync(10,'{"event":"cancel-10","status":"cancelled","seconds":1}');
select throws_ok($$select pg_temp.confirm(10)$$,'P0001','COD_WHOLE_ORDER_REQUIRED','cancelled order refused even orders/updated');
select pg_temp.confirm(11);
select pg_temp.sync(11,'{"event":"cancel-11","status":"cancelled","seconds":1}');
select is((select status from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200011'),'cancelled','cancel after approval blocks pending job');
select pg_temp.confirm(12);
select public.claim_amego_invoice_job('gid://shopify/Order/8200012');
select lives_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200012'$$,'valid approved mutation can proceed');
select throws_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200012'$$,'P0001','Amego mutation lease is not claimable','mutation fence is at most once');
select pg_temp.confirm(13);
update private.cod_dispatch_confirmations set confirmed_at=now()-interval '11 minutes' where order_id=(select id from public.orders where shopify_order_gid='gid://shopify/Order/8200013');
select public.claim_amego_invoice_job('gid://shopify/Order/8200013');
select throws_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200013'$$,'P0001','COD_DISPATCH_REVIEW_REQUIRED','expired approval cannot issue next morning');
select pg_temp.confirm(14);
select pg_temp.sync(14,'{"event":"edit-14","total":900,"seconds":1}');
select public.claim_amego_invoice_job('gid://shopify/Order/8200014');
select throws_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200014'$$,'P0001','COD_DISPATCH_REVIEW_REQUIRED','post-approval amount change fenced');
select pg_temp.sync(15,'{"event":"card-15","payment":"paid","status":"paid","context":{"paymentKind":"other","test":false},"seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200015'),1,'non-COD paid flow retained');
update private.cod_invoice_policy set enabled=false;
select pg_temp.sync(16,'{"event":"paused-16","payment":"paid","status":"paid","seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200016'),0,'pause does not revert managed COD to paid invoicing');
select is((public.get_cod_dispatch_status('gid://shopify/Order/820001')->>'settlementStatus'),'external_reconciliation_required','invoice does not claim bank reconciliation');
update private.cod_invoice_policy set enabled=true;
select is(pg_temp.sync(17), 'duplicate', 'duplicate webhook stays idempotent');
select is(pg_temp.sync(17,'{"event":"stale-17","seconds":-1}'), 'stale', 'older event cannot replace dispatch snapshot');
select pg_temp.sync(17,'{"event":"partialpay-17","payment":"partially_paid","seconds":1}');
select throws_ok($$select pg_temp.confirm(17)$$,'P0001','COD_WHOLE_ORDER_REQUIRED','partial payment refused');
select pg_temp.sync(18,'{"event":"currency-18","currency":"USD","seconds":1}');
select throws_ok($$select pg_temp.confirm(18)$$,'P0001','COD_WHOLE_ORDER_REQUIRED','foreign currency refused');
select pg_temp.sync(19,'{"event":"amount-19","total":900,"seconds":1}');
select throws_ok($$select public.confirm_cod_dispatch('gid://shopify/Order/8200019','88888888-8888-4888-8888-000000000019','99999999-9999-4999-8999-999999999981',now()+interval '1 second',900,'123456789012','black_cat_ambient',true)$$,'P0001','COD_AMOUNT_MISMATCH','known total still must reconcile with lines and shipping');
select pg_temp.sync(20,'{"event":"testpaid-20","payment":"paid","status":"paid","context":{"paymentKind":"cod","test":true},"seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200020'),0,'test paid COD cannot enqueue');
select throws_ok($$select public.confirm_cod_dispatch('gid://shopify/Order/820009','88888888-8888-4888-8888-000000000009','99999999-9999-4999-8999-999999999981',now(),826,'123456789012','familymart',true)$$,'P0001','COD_WHOLE_ORDER_REQUIRED','FamilyMart cannot use Black Cat dispatch');
select throws_ok($$select public.enqueue_amego_invoice_job('gid://shopify/Order/9998200','S9998200','{}','hash',826)$$,'P0001','COD_ORDER_CONTEXT_REQUIRED','unlinked legacy job requires order evidence after cutover');
reset role;
select ok(not has_function_privilege('authenticated','public.confirm_cod_dispatch(text,uuid,uuid,timestamptz,numeric,text,text,boolean)','EXECUTE'),'authenticated clients cannot call service RPC');
select ok(not has_table_privilege('anon','private.cod_dispatch_confirmations','SELECT'),'anonymous cannot read approvals');
select * from finish();
rollback;
