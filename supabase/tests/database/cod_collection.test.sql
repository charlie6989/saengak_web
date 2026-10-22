begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email,raw_app_meta_data) values
 ('99999999-9999-4999-8999-999999999981','cod-admin@example.test','{"role":"admin"}'),
 ('99999999-9999-4999-8999-999999999982','cod-member@example.test','{"role":"member"}');
insert into public.shopify_checkout_links(shopify_store_domain,shopify_cart_token,user_id,checkout_kind,expires_at)
select 'gh2xgs-zf.myshopify.com','cod-dispatch-cart-'||n,'99999999-9999-4999-8999-999999999982','member',now()+interval '1 year'
from generate_series(1,31) n;
create function pg_temp.sync(n int, extra jsonb default '{}') returns text language sql as $$
select public.sync_shopify_order_webhook(
 p_webhook_id=>coalesce(extra->>'event', 'dispatch-event-'||n), p_topic=>coalesce(extra->>'topic','orders/create'),
 p_shopify_store_domain=>'gh2xgs-zf.myshopify.com', p_shopify_order_gid=>'gid://shopify/Order/82000'||n,
 p_shopify_cart_token=>'cod-dispatch-cart-'||n, p_order_number=>'#COD'||n,
 p_total_amount=>coalesce((extra->>'total')::numeric,826), p_currency_code=>coalesce(extra->>'currency','TWD'),
 p_status=>coalesce(extra->>'status','processing'), p_payment_status=>coalesce(extra->>'payment','pending'),
 p_shipping_method=>'標準', p_fulfillment_status=>coalesce(extra->>'fulfillment','fulfilled'),
 p_shopify_created_at=>now(), p_shopify_updated_at=>now()+coalesce((extra->>'seconds')::int,0)*interval '1 second',
 p_triggered_at=>now()+coalesce((extra->>'seconds')::int,0)*interval '1 second',
 p_line_items=>replace('[{"shopifyLineItemGid":"gid://shopify/LineItem/82","productId":"gid://shopify/Product/83","productName":"Fixture","quantity":1,"price":"680","imageUrl":""}]', 'LineItem/82', 'LineItem/82'||n)::jsonb,
 p_fulfillments=>'[]', p_shipping_amount=>146,
 p_invoice_context=>coalesce(extra->'context','{"paymentKind":"cod","test":false}'::jsonb));
$$;
create function pg_temp.collect(n int, extra jsonb default '{}') returns uuid language sql as $$
select public.record_cod_collection('gid://shopify/Order/82000'||n, snapshot-'contactEmail',
 jsonb_build_object('source','shopify_admin_shipany_delivered','contract','shipany-black-cat-cod-2026-10-22',
 'amountBasis','contract_inferred','currency','TWD','amount',826,'fingerprint',repeat('a',64),
 'fulfillmentId','gid://shopify/Fulfillment/83000'||n,'serviceId','gid://shopify/FulfillmentService/1',
 'trackingNumber','12345678'||lpad(n::text,4,'0'),'trackingCompany','Black Cat Fixture','shippingCode','fixture-cod',
 'deliveredAt','2026-10-20T00:00:00Z') || extra)
 from private.cod_order_context c join public.orders o on o.id=c.order_id
 where o.shopify_order_gid='gid://shopify/Order/82000'||n;
$$;
set local role service_role;
select public.save_checkout_invoice_preference('gh2xgs-zf.myshopify.com','cod-dispatch-cart-'||n,
 '{"kind":"personal","notificationEmail":"cod@example.test","carrier":"mobile","carrierId":"/ABC1234"}') from generate_series(1,31) n;
select pg_temp.sync(n) from generate_series(1,31) n;
-- END COD COLLECTION FIXTURE SETUP
select throws_ok($$select pg_temp.collect(1)$$,'P0001','COD_COLLECTION_DISABLED','default disabled refuses evidence');
select throws_ok($$select public.confirm_cod_dispatch('gid://shopify/Order/820001',extensions.gen_random_uuid(),'99999999-9999-4999-8999-999999999981',now(),826,'123456789012','black_cat_ambient',true)$$,'P0001','COD_DISPATCH_RETIRED','old manual approval is retired');
update private.cod_invoice_policy set collection_enabled=true,starts_at=now()-interval '1 day';
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid like 'gid://shopify/Order/82000%'),0,'COD orders do not invoice from financial status alone');
select lives_ok($$select pg_temp.collect(1)$$,'validated whole-order evidence enqueues invoice');
select is((select payment_status from public.orders where shopify_order_gid='gid://shopify/Order/820001'),'pending','invoice evidence does not mutate Shopify payment projection');
select is((select request_payload->'preference'->>'carrierId' from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820001'),'/ABC1234','original carrier preference preserved');
select is((select count(*)::int from private.checkout_invoice_preferences where shopify_cart_token='cod-dispatch-cart-1'),0,'preference removed only after durable snapshot');
select lives_ok($$select pg_temp.collect(1)$$,'duplicate evidence idempotent');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820001'),1,'one order one invoice');
select throws_ok($$select pg_temp.collect(1,'{"trackingNumber":"999999999999"}')$$,'P0001','COD_COLLECTION_EVIDENCE_CHANGED','evidence identity immutable');
select pg_temp.sync(1,'{"event":"paid-1","payment":"paid","status":"paid","seconds":1}');
select lives_ok($$select pg_temp.collect(1)$$,'paid projection does not invalidate collection evidence');
select is((select request_payload->>'issueBasis' from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820001'),'cod_collection','paid webhook cannot overwrite evidence');
select pg_temp.sync(2,'{"event":"paid-2","payment":"paid","seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/820002'),0,'paid without delivery evidence never invoices');
select pg_temp.sync(3,'{"event":"partial-3","fulfillment":"partial","seconds":1}');
select throws_ok($$select pg_temp.collect(3)$$,'P0001','COD_COLLECTION_ORDER_INELIGIBLE','partial shipment blocked');
select pg_temp.sync(4,'{"event":"test-4","context":{"paymentKind":"cod","test":true},"seconds":1}');
select throws_ok($$select pg_temp.collect(4)$$,'P0001','COD_COLLECTION_ORDER_INELIGIBLE','test order blocked');
select pg_temp.sync(5,'{"event":"unknown-5","context":{},"seconds":1}');
select throws_ok($$select pg_temp.collect(5)$$,'P0001','COD_COLLECTION_ORDER_INELIGIBLE','missing classification blocked');
select pg_temp.sync(6,'{"event":"mixed-6","context":{"paymentKind":"mixed","test":false},"seconds":1}');
select throws_ok($$select pg_temp.collect(6)$$,'P0001','COD_COLLECTION_ORDER_INELIGIBLE','mixed payment blocked');
select throws_ok($$select pg_temp.collect(7,'{"amount":825}')$$,'P0001','COD_COLLECTION_EVIDENCE_REQUIRED','wrong collection amount blocked');
delete from private.checkout_invoice_preferences where shopify_cart_token='cod-dispatch-cart-8';
select throws_ok($$select pg_temp.collect(8)$$,'P0001','COD_COLLECTION_PREFERENCE_REQUIRED','missing invoice preference does not downgrade silently');
select throws_ok($$select public.enqueue_amego_invoice_job('gid://shopify/Order/820009','S820009','{}','hash',826)$$,'P0001','COD_COLLECTION_EVIDENCE_REQUIRED','legacy enqueue cannot bypass evidence');
select pg_temp.sync(10,'{"event":"cancel-10","status":"cancelled","seconds":1}');
select throws_ok($$select pg_temp.collect(10)$$,'P0001','COD_COLLECTION_ORDER_INELIGIBLE','cancelled order blocked');
select pg_temp.collect(11);
select pg_temp.sync(11,'{"event":"cancel-11","status":"cancelled","seconds":1}');
select is((select status from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200011'),'cancelled','cancel after evidence cancels pending invoice');
select pg_temp.collect(12);
select public.claim_amego_invoice_job('gid://shopify/Order/8200012');
select lives_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200012'$$,'fresh evidence permits one mutation');
select throws_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200012'$$,'P0001','Amego mutation lease is not claimable','second mutation denied');
select pg_temp.collect(13);
update private.cod_collection_evidence set verified_at=now()-interval '2 minutes' where order_id=(select id from public.orders where shopify_order_gid='gid://shopify/Order/8200013');
select public.claim_amego_invoice_job('gid://shopify/Order/8200013');
select throws_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200013'$$,'P0001','COD_COLLECTION_REVIEW_REQUIRED','stale live verification blocks mutation');
select lives_ok($$select pg_temp.collect(13)$$,'same immutable evidence can refresh verification');
select lives_ok($$select public.mark_amego_invoice_mutation_started(id,lease_token) from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200013'$$,'fresh revalidation permits retry without manual approval');
select pg_temp.collect(14);
select pg_temp.sync(14,'{"event":"edit-14","total":900,"seconds":1}');
select pg_temp.sync(14,'{"event":"restore-14","seconds":2}');
select throws_ok($$select pg_temp.collect(14)$$,'P0001','COD_COLLECTION_EVIDENCE_CHANGED','edit then revert remains sticky review');
select pg_temp.sync(15,'{"event":"card-15","payment":"paid","status":"paid","context":{"paymentKind":"other","test":false},"seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200015'),1,'non-COD paid flow retained');
update private.cod_invoice_policy set collection_enabled=false;
select pg_temp.sync(16,'{"event":"paused-16","payment":"paid","seconds":1}');
select is((select count(*)::int from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200016'),0,'pause does not fall back to paid invoice');
update private.cod_invoice_policy set collection_enabled=true;
select is(public.get_cod_dispatch_status('gid://shopify/Order/820001')->>'settlementStatus','external_reconciliation_required','bank payout remains separate');
select is(pg_temp.sync(17),'duplicate','duplicate order webhook idempotent');
select is(pg_temp.sync(17,'{"event":"stale-17","seconds":-1}'),'stale','old webhook cannot replace snapshot');
select pg_temp.sync(17,'{"event":"partialpay-17","payment":"partially_paid","seconds":1}');
select throws_ok($$select pg_temp.collect(17)$$,'P0001','COD_COLLECTION_ORDER_INELIGIBLE','partial payment blocked');
select is(public.receive_cod_fulfillment_event('delivery-delete-18','gid://shopify/Order/8200018','gid://shopify/Fulfillment/8300018','18','delivered',true),'recorded','delete before create persists tombstone');
select is(public.receive_cod_fulfillment_event('delivery-create-18','gid://shopify/Order/8200018','gid://shopify/Fulfillment/8300018','18','delivered',false),'recorded','out of order create accepted without resurrection');
select throws_ok($$select pg_temp.collect(18)$$,'P0001','COD_COLLECTION_EVENT_DELETED','stale Admin delivery cannot override tombstone');
select is(public.receive_cod_fulfillment_event('delivery-create-18','gid://shopify/Order/8200018','gid://shopify/Fulfillment/8300018','18','delivered',false),'duplicate','receipt replay idempotent');
select pg_temp.collect(19);
select public.receive_cod_fulfillment_event('delivery-delete-19','gid://shopify/Order/8200019','gid://shopify/Fulfillment/8300019','19','delivered',true);
select is(public.get_cod_dispatch_status('gid://shopify/Order/8200019')->>'reviewReason','COD_COLLECTION_EVENT_DELETED','withdrawn delivery flags existing evidence');
select pg_temp.collect(20);
create temporary table payment_claim as select public.claim_cod_payment_projection('gid://shopify/Order/8200020') token;
select ok((select token is not null from payment_claim),'payment projection lease acquired');
select is(public.claim_cod_payment_projection('gid://shopify/Order/8200020'),null::uuid,'second payment worker cannot acquire live lease');
select lives_ok($$select public.authorize_cod_payment_projection('gid://shopify/Order/8200020',token) from payment_claim$$,'payment has final local fence');
select public.complete_cod_payment_projection('gid://shopify/Order/8200020',token,false,'COD_COLLECTION_PAYMENT_UNCONFIRMED') from payment_claim;
select is(public.get_cod_dispatch_status('gid://shopify/Order/8200020')->>'paymentProjection','retry','unknown payment result retries independently');
update payment_claim set token=public.claim_cod_payment_projection('gid://shopify/Order/8200020');
select public.finish_cod_collection_check('gid://shopify/Order/8200020','COD_COLLECTION_ORDER_CHANGED',true);
select throws_ok($$select public.authorize_cod_payment_projection('gid://shopify/Order/8200020',token) from payment_claim$$,'P0001','COD_COLLECTION_REVIEW_REQUIRED','review before payment mutation fences it');
select is((select request_payload->>'issueBasis' from private.amego_invoice_jobs where shopify_order_gid='gid://shopify/Order/8200020'),'cod_collection','payment retry retains independent invoice work');
select is(public.receive_cod_fulfillment_event('early-event','gid://shopify/Order/999888','gid://shopify/Fulfillment/999888','999888','delivered',false),'recorded','delivery before order projection is durable');
select ok(public.claim_cod_collection_check() is not null,'scheduled catchup finds due order');
reset role;
select ok(not has_function_privilege('authenticated','public.record_cod_collection(text,jsonb,jsonb)','execute'),'members cannot fabricate collection evidence');
select ok(not has_function_privilege('anon','public.receive_cod_fulfillment_event(text,text,text,text,text,boolean)','execute'),'anonymous cannot forge logistics inbox');
select ok(not has_table_privilege('authenticated','private.cod_collection_evidence','select'),'members cannot read private collection snapshots');
select * from finish();
rollback;
