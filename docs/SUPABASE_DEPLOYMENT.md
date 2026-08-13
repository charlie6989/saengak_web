# SAENGAK Supabase 部署與驗證

更新日期：2026-08-13

## 資料責任

| 資料表 | 寫入來源 | 瀏覽器權限 |
| --- | --- | --- |
| `profiles` | 新會員 trigger、會員本人 | 會員只能讀、新增、更新自己的列 |
| `orders` | Shopify webhook／受信任後端 | 會員只能讀自己的訂單，不能自行建立或修改 |
| `order_items` | Shopify webhook／受信任後端 | 會員只能透過自己的訂單讀取明細，不能自行寫入 |
| `order_fulfillments` | Shopify 簽章 webhook／受信任後端 | 會員只能透過自己的訂單讀取配送方式、承運商與追蹤資料，不能自行寫入 |
| `order_invoices` | 發票供應商 webhook／受信任後端 | 會員只能透過自己的訂單讀取供應商確認的開立／作廢／折讓狀態，不能自行寫入 |
| `order_invoice_allowances` | Shopify 簽章退款 webhook建立審核工作，Amego worker 只投影 provider status 99 的結果 | 會員只能透過自己的訂單讀取已確認的折讓／折讓作廢狀態，不能自行寫入 |
| `user_favorites` | 會員本人 | 會員只能讀寫自己的收藏 |
| `shopify_checkout_links` | `create-shopify-cart` 受信任後端 | 瀏覽器完全不可讀寫；用 Shopify cart token 將付款後訂單連回已驗證會員 |

正式訂單狀態與金額必須由 Shopify／TapPay 對帳結果寫入；瀏覽器 localStorage、表單或展示目錄不得成為訂單權威來源。

## 已建立基線

- Migration：`supabase/migrations/20260719032409_saengak_membership_orders.sql`
- 訂單同步 Migration：`supabase/migrations/20260719035302_shopify_order_sync.sql`
- 物流商中立出貨投影 Migration：`supabase/migrations/20260719042534_add_provider_neutral_fulfillment_projection.sql`
- Checkout link 外鍵索引 Migration：`supabase/migrations/20260719181240_add_checkout_links_user_index.sql`
- 發票商中立投影 Migration：`supabase/migrations/20260719195708_add_provider_neutral_invoice_projection.sql`
- Amego 私有偏好／transactional outbox／worker RPC Migration：`supabase/migrations/20260813045204_add_amego_invoice_outbox.sql`
- Amego 折讓／折讓作廢 lifecycle Migration：`supabase/migrations/20260813070648_add_amego_allowance_lifecycle.sql`
- RLS 測試：`supabase/tests/database/saengak_membership_rls.test.sql`
- Shopify 訂單同步測試：`supabase/tests/database/shopify_order_sync.test.sql`
- 靜態結構檢查：`npm run verify:supabase`
- 真實本機 PostgreSQL 測試：先啟動 `supabase start`，再執行 `npm run test:db`
- 整套包含會員／RLS 27 項、發票投影 12 項、Shopify 訂單／物流 25 項、Amego 發票 outbox 43 項與折讓 lifecycle 34 項，合計 141 assertions；正式部署前須先啟動 Docker 並執行 `npm run test:db` 全數通過。

## 遠端部署狀態

以下 2026-07-20 的數量是正式環境歷史回讀；2026-08-13 新增的兩個 Amego migrations、`amego-invoice-dispatch` 與退款版 `shopify-orders-webhook` 尚未部署，因此不得用本機測試結果宣稱正式發票／折讓已啟用。

1. 2026-07-20 已建立免費的 `SAENGAK Production`，project ref 為 `tmqzkagkrzhioftvwbqo`、region 為 Tokyo；目前回讀為 `ACTIVE_HEALTHY`、Postgres 17.6。不得使用 `dhktmpcvtoxcicqkwgpn`。`npm run verify:binding:supabase` 專門阻擋錯誤的 Supabase CLI link；`npm run verify:binding:vercel` 可獨立驗證前端部署目標，不能用前端驗證結果冒充 Supabase 已重新 link。
2. 五個基線 migration 已部署（含 `add_provider_neutral_invoice_projection`）；七個 Edge Functions 已為 `ACTIVE`。2026-07-20 管理 API 回讀：`create-shopify-cart` 與五個目錄／搜尋 Functions 為 v4，`shopify-orders-webhook` 為 v3。
3. Vercel production 已設定新專案 URL 與 publishable key，並已重新部署及確認 production bundle 只包含新專案 ref。
4. Supabase Auth Site URL 已保存為 `https://saengak.com.tw`；2026-07-20 正式後台回讀的 redirect allow list 為 `https://saengak.com.tw/auth/confirm` 與 `https://saengak.com.tw/reset-password` 兩條。文件不保存一次性 signed query 或密鑰。
5. 2026-07-20 已在正式資料庫以兩個暫時 auth user 執行跨帳號交易測試：會員自己的 profile／order／item／fulfillment／favorite 可見，跨帳號 profile 更新與 favorite 新增、瀏覽器訂單新增、checkout link 讀取及匿名 profile 讀取均被阻擋，結果 11/11；交易最後 rollback，回讀測試 user／order／favorite 殘留皆為 0。
6. `private.shopify_webhook_receipts` 位於未暴露的 private schema，已撤銷 public／anon／authenticated 權限。2026-07-20 最新 security advisor 沒有再列此表；唯一 INFO 是 `shopify_checkout_links` 已啟用 RLS 但沒有 client policy。這是刻意的 service-only deny-by-default 設計：該表沒有 anon／authenticated grants，只有 service role 可讀寫，因此不為消除 INFO 而增加瀏覽器 policy。
7. SAENGAK 專用 Shopify domain `gh2xgs-zf.myshopify.com`、Storefront API `2026-07` 與兩個公開 Origin 已編譯為安全預設值。結帳固定只允許此商店，避免舊的 `ShopifyDomain` secret 將顧客導向不同商店。2026-07-30 唯讀 probe 已到達 Shopify，並由上游回覆 `Online Store channel is locked`。
8. 六個瀏覽器可呼叫的 Storefront Functions 皆設為 `verify_jwt=false`，並在函式內核對 Supabase `apikey`；缺 key 回覆 401、錯誤 Origin 回覆 403。這是為了相容現行 publishable key，不代表匿名放行。
9. `StorefrontAccessToken` 只在商品 tags／受限庫存欄位需要；`get-products-by-tag` 缺 token 時安全回覆 503。`ShopifyWebhookSecret` 已保存於 Edge Function Secrets；webhook v2 未簽章 probe 由原本 503 改為 401。以同一 secret 產生的有效 HMAC 可通過驗簽，無效空 payload 於解析階段回覆 400 且沒有資料寫入。
10. 正式 Auth `/auth/v1/settings` 已以 production bundle 的 publishable key 唯讀回讀：email provider 開啟、signup 允許、email confirmation 必須完成，Google／Facebook／Apple 與其他 OAuth providers 皆為關閉。公開登入／註冊頁因此只顯示電子郵件流程。
11. 2026-07-20 再以 Supabase 管理連線回讀：五個遠端 migration 名稱與本地基線一致、七個 Edge Functions 全部為 `ACTIVE`；公開七表均啟用 RLS，anon 無任何 table grant，authenticated 只取得各模組需要的 SELECT／profile 與 favorite 自管權限，public schema 沒有 `SECURITY DEFINER` function。
12. `order_invoices` 已完成正式跨帳號 transaction 測試：會員本人可讀、另一會員不可讀、匿名不可讀、會員不能 INSERT、service role 可寫；測試 invoice 與兩個暫時 auth user 在 rollback 後殘留皆為 0。會員中心已查詢此 provider-neutral projection，沒有供應商回讀時明示不從付款狀態推測發票。
13. 會員中心發票查詢已部署至 Vercel production 並綁定 `saengak.com.tw`；正式 entry 的 lazy bundle 已回讀包含 `order_invoices` 查詢及發票來源提示。
14. 2026-07-20 最新 Vercel production 為 `dpl_GymaDrHXPzoDyAA2ZHcaCJHx94dy`。正式站已加入 CSP、禁止第三方 frame、MIME sniffing 防護、Referrer Policy、Permissions Policy 與安全 opener policy；`npm run verify:production` 對 7 條正式路由、同源 JS／CSS bundle、6 類安全標頭及 7 個 Edge Function 未授權探針共 23/23 通過。

會員資料隔離已完成遠端驗證；會員正式驗收尚需完成真實註冊信、確認連結、重設密碼與登入後收藏／訂單頁的端到端回歸。
