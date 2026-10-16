# 訪客結帳設計方案

日期：2026-10-16（Asia/Taipei）。狀態：步驟 1–3（§9）已在分支 `claude/guest-checkout-backend` 實作並通過本機測試（`npm test`、本機 Supabase `npm run test:db`）；**尚未套用到任何遠端 Supabase、尚未部署**，`guest_checkout_enabled` 預設關閉。步驟 4（前端）已在分支 `claude/guest-checkout-frontend` 實作並通過 `npm test`（§9.2）；步驟 5 起（端到端驗證）未開始。

營運決策（2026-10-16）：開放訪客結帳；登入改為「會員優惠」的入口；客服只用 Email。本文件說明訪客訂單如何儲存、開立發票、查詢，以及之後註冊時如何併入會員帳號。內容依 `main`（`bd93ea0`）的程式碼整理，正式服務的設定在「待確認」一節另列。

## 1. 現況與阻塞點

結帳路徑：`CartSidebar` → `createShopifyCheckout`（`src/lib/shopifyCheckout.ts`）→ `POST /api/create-shopify-cart` → Shopify Storefront `cartCreate` → Shopify Checkout（TapPay）→ Shopify webhook → `sync_shopify_order_webhook`（最新定義在 `supabase/migrations/20260904000002_add_order_discounts_and_coupon_lifecycle.sql`）→ `private.amego_invoice_jobs` → `api/invoice/guangmao.ts` 派送光貿。

| 位置 | 目前行為 | 對訪客的影響 |
| --- | --- | --- |
| `api/create-shopify-cart.ts` | 沒有 `Authorization` 就回 401 `MEMBER_LOGIN_REQUIRED` | 訪客無法建立購物車 |
| `public.shopify_checkout_links.user_id` | `not null` | 無法記錄訪客購物車 |
| `public.orders.user_id` | `not null` | 無法儲存訪客訂單 |
| `sync_shopify_order_webhook` | 用 `_saengak_member_link_token` 找 link；找不到 user 就回 `unlinked` 並**提早結束** | 不寫 orders、不建立發票工作 → **不會開發票** |
| 同上 upsert 條件 | `excluded.user_id = public.orders.user_id` | 若 `user_id` 為 null，`null = null` 不成立，後續 `orders/paid`、`orders/updated` 全被判為 `stale` |
| `sync_shopify_refund_webhook` | 找不到 orders 就回 `unlinked` | 訪客退款無法建立折讓 |
| webhook 解析器 `parseShopifyOrderWebhook` | 不解析 `email`／`contact_email` | 沒有可比對訪客的欄位 |

已可沿用、不需改動的部分：

- 發票偏好以購物車 token 為鍵存在 `private.checkout_invoice_preferences`（`save_checkout_invoice_preference`），與會員身分無關。
- `private.amego_invoice_jobs.order_id` 本來就可為 null；`complete_amego_invoice_job` 在 `order_id` 為 null 時只是不寫 `order_invoices`。
- 光貿派送（`supabase/functions/amego-invoice-dispatch/amego.ts`）只讀 job 的 payload，不讀會員資料。
- RLS：`orders`、`order_items`、`order_fulfillments`、`order_invoices`、`order_invoice_allowances` 的會員政策都是 `auth.uid() = orders.user_id`，`user_id` 為 null 的列任何會員都讀不到；`anon` 沒有任何 grant。管理員政策（`20260822000001`）不依賴 `user_id`。

結論：只改介面不夠；最少要改 schema、webhook RPC、解析器和結帳 API。

## 2. 資料模型

新增一支 migration（additive，對既有會員訂單向後相容）：

```sql
-- 1) 結帳 link 可記錄訪客
alter table public.shopify_checkout_links
  alter column user_id drop not null,
  add column checkout_kind text not null default 'member'
    check (checkout_kind in ('member', 'guest')),
  add constraint shopify_checkout_links_member_user_check
    check (checkout_kind = 'guest' or user_id is not null);

-- 2) 訂單可沒有會員
alter table public.orders
  alter column user_id drop not null,
  add column checkout_kind text not null default 'member'
    check (checkout_kind in ('member', 'guest')),
  add column guest_claimed_at timestamptz,
  add constraint orders_member_user_check
    check (checkout_kind = 'guest' or user_id is not null);

-- 3) 訪客聯絡 Email 放在 private（PostgREST 不曝露）
create table private.guest_order_contacts (
  order_id uuid primary key references public.orders (id) on delete cascade,
  email_normalized text not null check (email_normalized = lower(btrim(email_normalized))),
  created_at timestamptz not null default now()
);
create index guest_order_contacts_email_idx on private.guest_order_contacts (email_normalized);
```

- `checkout_kind` 記錄來源；訪客訂單被會員認領後仍保留 `'guest'`，另以 `guest_claimed_at` 標示，方便稽核。
- 訪客 Email 不放在 `public.orders`：避免任何 select 政策、`select *`（例如 `src/pages/admin/OrderList.tsx`）或日後新增的政策誤帶出。比對只做 `lower(btrim(email))`，不做 Gmail 句點等推測式正規化。
- `shopify_checkout_links` 目前沒有清除機制；同一支 migration 在 `purge_expired_invoice_data()` 中加上刪除「已過期且未轉換」的 link（訪客 link 不帶會員 id，量會比會員多）。

## 3. 訪客結帳流程

### 3.1 `POST /api/create-shopify-cart`

| 請求 | 行為 |
| --- | --- |
| 有 `Authorization` 且有效 | 與現在相同（會員流程、可用折扣碼） |
| 有 `Authorization` 但無效／過期 | 仍回 401 `MEMBER_SESSION_INVALID`，**不**自動降級為訪客（會員以為有優惠卻沒有，是更糟的結果） |
| 沒有 `Authorization` 且 `site_settings.guest_checkout_enabled` 不是 `true` | 仍回 401 `MEMBER_LOGIN_REQUIRED`（上線開關，預設關閉） |
| 沒有 `Authorization` 且開關開啟 | 走訪客流程（下列） |

訪客流程：

1. 驗證 Cloudflare Turnstile token（伺服器端呼叫 siteverify；需新增 `TURNSTILE_SECRET_KEY`，未設定時 fail-closed 回 503）。目前 Turnstile 只交給 Supabase Auth 驗證，API 端沒有現成驗證程式。
2. `discountCodes` 非空 → 回 400 `GUEST_DISCOUNT_REQUIRES_LOGIN`。
3. 需要 `guestEmail`（必填，格式同 `emailPattern`）：用於 `buyerIdentity.email` 預填，並作為發票通知 Email 的後備（見 §4）。
4. 產生 link token、照舊保存發票偏好，寫入 `shopify_checkout_links`（`user_id = null`、`checkout_kind = 'guest'`）。
5. 不查 `profiles`、不預填地址。
6. 回應 `orderTrackingLinked: false`、`checkoutKind: 'guest'`。前端 `assertMemberOrderTracking` 只在會員流程檢查。

### 3.2 前端

- `CartSidebar`：未登入時顯示兩個動作——「登入結帳（使用會員優惠）」與「訪客結帳」。訪客結帳展開 Email 欄位與 Turnstile，隱藏優惠券選擇並提示「登入後可使用會員優惠」。
- `src/lib/shopifyCheckout.ts`：`createShopifyCheckout` 改為可在沒有 session 時送出訪客請求；錯誤訊息補上新 code。
- 感謝頁（`/order-status?order_id=`）：訪客顯示「以同一 Email 註冊會員，即可在會員中心看到這筆訂單」。

## 4. 訂單同步與發票

在新 migration 中重建 `sync_shopify_order_webhook`，新增參數 `p_contact_email text default ''`（預設值讓既有呼叫端相容）；解析器 `parseShopifyOrderWebhook` 依序取 `payload.email`、`payload.contact_email`、`payload.customer.email`，只接受符合格式且長度 ≤ 254 的值。Vercel（`api/webhooks/shopify.ts`）與 Edge Function（`shopify-orders-webhook`）共用同一個解析器，兩者都要重新部署。

RPC 變更：

1. 查 link 時一併取出 `checkout_kind`。**找不到 link 仍回 `unlinked`**：不經網站建立的 Shopify 訂單（後台手動、其他通路）維持現狀，不在本案自動進入發票 outbox（見 §8 待確認）。
2. 會員 link：行為不變。
3. 訪客 link：以 `user_id = null`、`checkout_kind = 'guest'` 寫入 orders；`p_contact_email` 有效時 upsert `private.guest_order_contacts`。
4. upsert 衝突條件改為 `excluded.user_id is not distinct from public.orders.user_id`，否則訪客訂單的後續事件全部變成 `stale`。
5. 建立發票工作時，若偏好是個人、`notificationEmail` 為空，就以訂單 Email 補上（訪客與會員都適用；目前會員留空時光貿收到空的 `BuyerEmailAddress`）。`expected_buyer_identifier` 等其他邏輯不變。
6. 優惠券生命週期：`user_coupons` 更新以 `user_id = v_user_id` 為條件，訪客時自然不影響；保留原樣。
7. `sync_shopify_refund_webhook` 不需修改：訪客訂單有 orders 列後即可照常建立折讓工作。

發票偏好（載具／捐贈／統編）沿用現有表單與驗證（`parseInvoicePreference`，統編含檢查碼）。統編、載具、捐贈碼仍只存在 `private.checkout_invoice_preferences`（30 天）與 job payload（開立後清空）。

## 5. 訂單查詢（`/order-status`）

第一階段：訪客依 Shopify 訂單確認信中的「訂單狀態」連結查看（Shopify 原生功能，不需本站帳號）；`/order-status` 補上這段說明。

第二階段：本站查詢表單。

- `POST /api/order-lookup`，輸入：訂單編號（`#1001` 或 `1001`）、Email、Turnstile token。
- 以 service role 呼叫 `public.lookup_guest_order(p_order_number, p_email)`（`security invoker`，只 grant 給 `service_role`），僅在訂單編號與 `guest_order_contacts.email_normalized` 同時相符時回傳。
- 回傳欄位限縮：訂單狀態、付款狀態、出貨狀態、物流公司／追蹤號碼／追蹤連結、品項名稱與數量、金額、發票狀態與號碼。不回傳地址、電話、Email、統編或載具。
- 不論訂單不存在或 Email 不符，一律回同一個 404 訊息與相近的回應時間。
- 防暴力：Turnstile；Vercel Firewall 對 `/api/order-lookup` 設 IP 速率限制；資料庫端 `private.order_lookup_attempts` 依訂單編號計數，1 小時內失敗 5 次即暫停該訂單編號的查詢（防止針對已知訂單編號猜 Email）。
- 已被會員認領的訂單仍可用此方式查詢（與 Shopify 行為一致），或改提示登入；由營運決定。

## 6. 註冊後併入會員

新增 `public.claim_guest_orders()`：

- `security definer`、`set search_path = ''`，只 grant 給 `authenticated`，以 `auth.uid()` 為對象，不接受任何參數。
- 從 `auth.users` 讀取該使用者的 `email` 與 `email_confirmed_at`；**`email_confirmed_at` 為 null 就不認領**。否則任何人都能用別人的 Email 註冊並取得對方的訂單。Google 登入的 Email 通常由 Supabase 標為已驗證；Facebook 帳號的 Email 不一定經過驗證，需實測 `email_confirmed_at` 是否被設定。
- 在同一交易中：`orders.user_id = auth.uid()`、`guest_claimed_at = now()`，條件 `checkout_kind = 'guest' and user_id is null` 且 Email 相符；同時更新對應 `shopify_checkout_links.user_id`（以 `converted_order_gid` 對應），讓之後的 webhook 事件在 §4 的衝突條件下仍能套用。
- 只認領 `user_id is null` 的列，不會改動其他會員的訂單；回傳認領筆數。
- 呼叫時機：`AuthContext` 的 `SIGNED_IN`（含 Email 驗證完成後首次登入），以及會員中心「我的訂單」載入前；重複呼叫是冪等的。
- 不回溯套用會員優惠或點數；訂單金額以 Shopify 為準。

Email 變更：Supabase 的 Email 變更需要確認，`claim_guest_orders` 只看目前已確認的 Email；已認領的訂單不因之後改 Email 而移轉。

## 7. 濫用與隱私

- **購物車建立濫用**：訪客請求不需帳號，可被大量呼叫以產生 Shopify 購物車與資料列。以 Turnstile、Vercel Firewall 速率限制、上線開關與過期 link 清除控制。
- **會員折扣外流**：`promotions.code` 是全站共用的 Shopify 折扣碼。API 拒絕訪客帶折扣碼，但 Shopify Checkout 頁本身仍有折扣碼欄位，知道代碼的人仍可輸入。要真正做到「登入才有優惠」，會員優惠需改成每位會員獨立的兌換碼（Shopify `discountRedeemCodeBulkAdd`），或使用 Shopify 客戶資格限制（需要 Shopify 顧客身分）。此問題目前會員流程也存在（未領券的會員也能輸入），建議另案處理。
- **RLS**：不新增任何 `anon` grant 或政策；訪客資料只經 service role API 讀取。新增 pgTAP 測試確保 `anon`／其他會員讀不到訪客訂單、`guest_order_contacts` 不可經 PostgREST 存取。
- **個資**：新增保存訪客 Email（用於查詢與認領）。隱私權政策需補上用途與保存期間；建議訂單完成後一定期間（例如 2 年，依會計保存需求由營運決定）清除未認領訂單的 `guest_order_contacts`。
- **日誌**：新 API 不得記錄 Email、訂單編號以外的查詢輸入；沿用 `sanitizeTransactionPayload` 與 Sentry 清理。

## 8. 待確認（正式服務，需在上線前查證）

1. Supabase `tmqzkagkrzhioftvwbqo` 的 Auth 是否開啟 Email 確認（`claim_guest_orders` 的安全性依賴此設定）。本 repository 的 `supabase/config.toml` 未設定 `enable_confirmations`。
2. Shopify Checkout 設定的顧客聯絡方式：建議設為「僅 Email」，否則訪客可能只留手機，無法查詢與認領。
3. 實際註冊在 Shopify 的 webhook 端點是 Vercel `api/webhooks/shopify` 還是 Edge Function `shopify-orders-webhook`。
4. 不經網站建立的 Shopify 訂單（`unlinked`）目前不會開立發票；這是既有缺口，與訪客結帳分開決定。
5. 個人發票未選載具（`carrier: 'none'`）時目前送出空的 `CarrierType`，即紙本發票；是否改以光貿 Email 載具為預設，需會計確認。
6. 訪客訂單在後台（`OrderList`）的顯示方式與客服依 Email 查訂單的需求。

## 9. 實作順序與測試

| 步驟 | 內容 | 測試 |
| --- | --- | --- |
| 1 | migration：§2 schema、§4 RPC、§6 `claim_guest_orders`、過期 link 清除 | pgTAP（`supabase/tests/database/`）：訪客訂單寫入與 `user_id` null、後續事件不被判 stale、發票工作建立與 Email 後備、會員流程不變、認領需已驗證 Email、不可認領他人訂單、`anon` 不可呼叫、RLS 隔離 |
| 2 | webhook 解析器 `p_contact_email` | `webhook.test.ts`、`tests/shopify-webhook-api.test.ts` |
| 3 | `create-shopify-cart` 訪客分支（開關關閉時行為不變）、Turnstile 驗證 | `tests/create-shopify-cart-api.test.ts`：開關關閉仍 401、無效 token 仍 401、缺 Turnstile 400、帶折扣碼 400、link 以 null user 寫入 |
| 4 | 前端：`CartSidebar`、`shopifyCheckout.ts`、感謝頁、`AuthContext` 呼叫認領 | 元件測試 |
| 5 | Shopify 測試訂單 + 光貿測試模式端到端驗證，再開啟 `guest_checkout_enabled` | 手動 |
| 6 | 第二階段：`/api/order-lookup` 與查詢表單 | API 測試、速率限制測試 |

步驟 1–3 可先部署且保持開關關閉；開關是 `site_settings` 的一個值，可在後台即時關閉。

### 9.1 步驟 1–3 實作紀錄（2026-10-16）

- Migration `supabase/migrations/20261016120000_allow_guest_checkout_orders.sql`：§2 schema、§4 RPC（21 個參數，`p_contact_email` 預設 `''`）、§6 `claim_guest_orders()`、過期 link 清除、`site_settings.guest_checkout_enabled = false`（`is_public = true`，`on conflict do nothing` 不覆寫後台值）。
- 與設計稿的差異：
  - 另加 `orders_guest_claim_check`：`guest_claimed_at` 只能出現在已有 `user_id` 的訪客訂單。
  - 過期 link 清除保留 7 天緩衝（`expires_at < now() - 7 days` 且未轉換），避免到期前建立、稍晚才送達的 webhook 變成 `unlinked`。
  - 通知 Email 後備只套用在個人發票（依 §4.5）；公司發票未填通知 Email 時維持原狀。
  - `claim_guest_orders()` 未登入呼叫會丟 `42501`；`service_role` 也沒有執行權限。
  - 認領競態：webhook 讀到 link（`user_id` 仍為 null）之後、upsert 之前，`claim_guest_orders` 才提交。upsert 條件因此另外接受「訂單為訪客、事件 `user_id` 為 null」，且不覆寫已認領的 `user_id`；否則該事件會被判為 `stale`、watermark 已前進，`orders/paid` 的發票工作就此遺失（PR #37 審查）。
- 解析器：`parseShopifyOrderWebhook` 依序取 `email`、`contact_email`、`customer.email`，只回傳格式正確且 ≤ 254 字元的值（DB 端再做 `lower(btrim())`）。兩個呼叫端都經 `callOrderSyncRpc`：`p_contact_email` 為空就不送；PostgREST 回 `PGRST202`（找不到函式簽章）時不帶它重試一次。
- Turnstile：除了 `success`，`hostname` 必須在允許清單（預設 `lucissicare.com`、`www.lucissicare.com`、`localhost`；`TURNSTILE_ALLOWED_HOSTNAMES` 以逗號分隔取代預設，例如 Vercel Preview）；回傳 `action` 時必須是 `guest_checkout`，前端 widget 需傳同一個 action。沒有 action 時放行（Cloudflare 測試金鑰）。
- `api/create-shopify-cart.ts`：訪客分支（§3.1）＋ `api/_lib/turnstile.ts`。錯誤碼：`TURNSTILE_UNAVAILABLE`（503，未設定 secret 或 siteverify 無法連線）、`TURNSTILE_TOKEN_REQUIRED`（400）、`TURNSTILE_VERIFICATION_FAILED`（403）、`GUEST_DISCOUNT_REQUIRES_LOGIN`（400）、`GUEST_EMAIL_REQUIRED`（400）、`GUEST_ORDER_LINK_UNAVAILABLE`（503）、`GUEST_ORDER_LINK_FAILED`（502）。請求欄位：`guestEmail`、`turnstileToken`；回應新增 `checkoutKind`。
- **部署順序**：合併前必須先把 migration 套用到正式 Supabase，再部署 Vercel（`api/webhooks/shopify.ts`）與 Edge Function（`shopify-orders-webhook`）。呼叫端的 `PGRST202` 退回只是保險：在舊 RPC 上訂單仍會同步，但訪客訂單仍是 `unlinked`，也不會記錄訂單 Email。Migration 本身對舊解析器相容（預設值）。
- 既有 pgTAP 測試的修正（與本案無關、`main` 上原本就跑不完）：`saengak_membership_rls`（管理員政策加入後政策數量）、`shopify_order_sync`（20260904 後函式簽章）、`transaction_logs`（plan 數量與公開設定數量）、`enqueue_amego_invoice_job`（63 字元的 SHA-256 字串）。

### 9.2 步驟 4 前端實作紀錄（2026-10-16）

- `src/components/feature/SignedOutCheckoutActions.tsx`：未登入、`guest_checkout_enabled` 為 `true`，且前端有 `VITE_PUBLIC_TURNSTILE_SITE_KEY` 時，購物車顯示「登入結帳（使用會員優惠）」與「訪客結帳」。選擇訪客後展開必填 Email、既有 `AuthCaptcha`（Turnstile）與「登入後可使用會員優惠」提示；優惠券區塊隱藏，已選的折扣碼清除且不送出。沒有 Turnstile site key 時不顯示訪客選項（伺服器必定回 `TURNSTILE_TOKEN_REQUIRED`）。
- `CartSidebar`：開關以 `fetchGuestCheckoutEnabled()` 直接讀公開的 `site_settings`，讀取失敗視為關閉。訪客送出後不論成敗都重設 Turnstile（token 只能用一次）。是否開啟登入視窗改依錯誤碼判斷（`MEMBER_LOGIN_REQUIRED`、`MEMBER_SESSION_INVALID`、`GUEST_DISCOUNT_REQUIRES_LOGIN`），避免訪客錯誤訊息含「登入」字樣時誤開。
- `src/lib/shopifyCheckout.ts`：`createShopifyCheckout` 第 4 個參數 `guest`（`email`、`turnstileToken`）；訪客請求不帶 `Authorization`、不送折扣碼，`assertMemberOrderTracking` 只檢查會員。§9.1 的 7 個錯誤碼皆有繁中訊息；錯誤以 `ShopifyCheckoutError` 帶出 `code`。
- 認領：`src/lib/guestOrders.ts` 的 `claimGuestOrders()` 呼叫 `claim_guest_orders`，錯誤只記錄不拋出（`PGRST202`、`42501` 不回報 Sentry）。`AuthContext` 在 `SIGNED_IN` 時以 `setTimeout` 移出 auth 回呼後呼叫，同一使用者每次頁面載入只呼叫一次；會員中心 `loadOrders` 先認領再查詢。
- 感謝頁 `/order-status?order_id=`：auth 狀態確定且未登入時視為訪客訂單（會員結帳必須登入），說明 Shopify 確認信中的「訂單狀態」連結，以及用同一 Email 註冊並驗證後可在「我的訂單」看到；按鈕改為前往 `/register`。已登入但以訪客身分結帳的少數情況仍顯示會員版文字。
- 審查修正（PR #38 瀏覽器測試後）：購物車頁尾限制 `max-h-[65dvh]` 並可獨立捲動，375×667 與 390×844 都能捲到「以訪客身分前往結帳」（本機以 stub Supabase 與 Cloudflare 測試 site key 驗證）。感謝頁訪客說明改為只在開關開啟時顯示，文字為「若以訪客身分結帳…」，並附註冊與登入連結；開關關閉時頁面與 `main` 相同。Turnstile 帶 `action: 'guest_checkout'`，取得 token 後隱藏提示，元件卸載、關閉購物車或登入狀態改變時清除 token；訪客請求收到 `MEMBER_LOGIN_REQUIRED`／`TURNSTILE_UNAVAILABLE` 時收起訪客選項；可預期的顧客端錯誤碼不送 Sentry。Email 欄位：展開時取得焦點、錯誤顯示在欄位旁並設定 `aria-invalid`／`aria-describedby`、手機 16px 字級。訪客模式的結帳訊息（含伺服器拒絕）改顯示在送出按鈕正上方（`role="status"`），並在出現時捲入可視範圍；原本頁尾上方的訊息在手機上會捲到免運條後面看不到。
- 測試環境注意：Cloudflare Turnstile 測試金鑰的 siteverify 一律回傳 `hostname: "example.com"`，而 #37 的伺服器端會比對 hostname。本機或 Vercel preview 用測試金鑰時，`TURNSTILE_ALLOWED_HOSTNAMES` 需包含 `example.com`；或改用正式金鑰並把 preview 網域加入允許清單。
- 測試：`tests/guest-checkout-client.test.ts`（請求內容、錯誤碼、開關讀取、認領）、`tests/guest-checkout-ui.test.tsx`（按鈕區、驗證、感謝頁、`SIGNED_IN` 認領排程）。專案沒有 DOM 測試環境，元件以 `renderToStaticMarkup` 驗證；`CartSidebar` 內的狀態切換未有自動化測試，需在步驟 5 手動驗證。

## 10. 為何最初只交付設計

本案會重建正式訂單同步的核心 RPC（`sync_shopify_order_webhook`），新增不需登入的公開 API，並依賴三項尚未查證的正式設定（§8 第 1–3 項）。資料庫行為需要本機 Supabase 的 pgTAP 測試（`npm run test:db`）才能驗證，單靠 `npm test` 無法覆蓋。因此本次只交付設計，實作留待確認 §8 後另開分支。
