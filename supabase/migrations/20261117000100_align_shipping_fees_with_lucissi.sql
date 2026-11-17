-- 運費比照 LUCISSI，2026-11-17 店主決定。須與 Shopify 運費同時切換（見 docs/LOGISTICS_PAYMENTS_PLAN.md 最新一節）：
-- 超商取貨 NT$60 → NT$69（7-11取貨、全家取貨、萊爾富取貨），新增順豐宅配 NT$130；黑貓宅配維持 NT$146、免運門檻 NT$1,500。
begin;

update public.site_settings
   set value = '69'::jsonb,
       description = '超商取貨運費（7-11取貨、全家取貨、萊爾富取貨；新台幣，達免運門檻免運）'
 where key = 'pickup_shipping_fee';

insert into public.site_settings (key, value, is_public, description)
values ('sf_home_shipping_fee', '130'::jsonb, true, '順豐宅配運費（新台幣，達免運門檻免運）')
on conflict (key) do nothing;

commit;
