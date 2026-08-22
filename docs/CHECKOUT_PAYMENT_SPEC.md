# 結帳與交易安全性規格書 (Checkout & Payment Spec)

> ## ⚠️ DEPRECATED（2026-08-21 起已廢棄，僅供歷史參考）
> 本規格書所述之**自建 React Checkout (Option B) + TapPay Direct Pay SDK + Vercel 交易中樞**架構，已於 2026-08-21 經負責人指示廢棄，改回跳轉 Shopify Checkout（TapPay 以 Shopify Payment App 身分於 Shopify 頁面內扣款）。權威決策記錄見 [`00_DECISION_LOG.md` §3.3](00_DECISION_LOG.md#33-結帳架構第三次變動回歸-shopify-checkout-2026-08-21)；**現行結帳流程權威文件為 [`TAPPAY_SHOPIFY.md`](TAPPAY_SHOPIFY.md)**。
>
> 本文件下述之 `api/checkout.ts`、`api/checkout/confirm.ts`、`api/checkout/status.ts`、`api/cron/reconcile.ts`、`transaction_logs` 交易狀態機、Idempotency-Key 機制**皆已停止部署**，程式碼僅保留於 Git 歷史供追溯，**不得視為現行系統行為**。以下內容原樣保留（不逐段刪改），僅供理解當初的資安設計考量與日後若需重新評估自建結帳時的參考基準。
>
> 版本日期：2026-08-20 (Phase 2 後端中樞程式碼落地 + 稽核修正定版；前版：2026-08-17 架構簡化) —— **此版本日期後之架構已被 2026-08-21 決策取代**
> 本規格書為 **第 2 階段 (Phase 2)** 啟用自建結帳與線上支付時之權威規範。
> **落地狀態 (2026-08-20)**：本規格所述之後端中樞程式碼已落地於 `api/`（詳見 §9 實作對照表），並通過單元/整合測試 (`npm test` 360/360)、`npm run typecheck` 與 `npm run build`。**尚未完成**：Vercel 部署、環境變數/Secrets 配置、TapPay 沙盒實單與端到端商業驗收 (`verify:commerce`)。依 00_DECISION_LOG §1 治理決策，本文件之「已落地」標記僅作狀態說明，實際合規性一律以自動化測試結果為準。

## 1. 核心結帳流程與支付政策 (自建 Checkout - Phase 2)

本專案廢棄跳轉至 Shopify Checkout 的做法，改為在前端完全自建 React 結帳頁面，由 Vercel Serverless API 作為交易中樞。

### 1.1 付款方式與物流規範 (首版禁用 COD)
- **首版支付模式**：**首版禁用貨到付款 (COD)**。結帳頁面僅提供 **TapPay Direct Pay 線上刷卡**。任何 COD 選項均予以隱藏/禁用，杜絕未付款棄單與庫存卡死風險。
- **物流方式**：整合 **ShipAny**，透過 Shopify ShipAny App 進行履行與門市選單（自建 API 備用）。所有物流訂單均須完成線上刷卡授權後方可出貨。

### 1.2 卡號零落地政策 (Zero-Card-Storage Policy)
- **PCI-DSS SAQ A-EP 合規**：前端使用 TapPay Hosted SDK (TPDirect)，信用卡敏感資訊（卡號 PAN、安全碼 CVV/CVC、有效期限 Expiry）直接在 TapPay 加密 iframe 內處理，由 TapPay 生成一次性 Token (Prime)。
- **零卡號落地**：React 前端狀態、Vercel Serverless API、Supabase 資料庫、日誌系統與 Sentry **絕不接收、傳遞或儲存** 完整卡號與 CVV。

### 1.3 結帳交易發起步驟
1. **前端資料收集**：顧客選取物流 (ShipAny 超商/宅配)、填寫收件資訊與發票 (光貿載具/捐贈/統編)。
2. **TapPay SDK 授權**：前端呼叫 TapPay Direct Pay SDK (`TPDirect.card.getPrime`) 取得 Prime。
3. **發起交易**：前端將 TapPay Prime、購物車內容（**僅商品 Variant ID 與數量，不含價格**）、物流資訊、發票載具與 **Idempotency-Key** 送至 `api/checkout.ts`。

### 1.4 金額權威與後端重算 (Server-Side Price Authority)

> **鐵則：前端傳入的任何金額欄位一律視為不可信，僅供顯示比對。**

- `api/checkout.ts` 收到購物車後，必須以 **Shopify Admin/Storefront API 的當前價格**逐項重算商品小計，再加上後端規則計算之運費與折扣，得出**唯一權威總額**。
- TapPay 扣款金額**只能**使用後端重算之總額；嚴禁直接採用前端提交的金額（防改價攻擊）。
- 重算結果與前端顯示金額不一致時（例如結帳期間價格變動），拒絕交易並回傳明確錯誤碼，由前端提示顧客刷新購物車。
- 折扣碼、免運門檻等優惠邏輯一律於後端驗證與計價，前端僅做預覽。

## 2. 庫存聯動與防超賣機制 (SiteGiant ERP <-> Shopify App)

> 定案：實體庫存權威為 **SiteGiant ERP**，透過 **SiteGiant 官方 Shopify App** 自動進行雙向同步。廢棄由 Vercel API 直連 SiteGiant 進行 2PC (Reserve/Commit) 的做法，消除 Serverless 10 秒逾時與中間態卡死問題。

- **前端庫存查核**：React 前端直接透過 Shopify Storefront API 讀取即時 `availableForSale` 與規格庫存量，若售罄則前端按鈕自動停用。
- **後端訂單建立與庫存扣減**：
  1. `api/checkout.ts` 先執行 **冪等性檢查**（見 §4）。
  2. 進行 TapPay 授權扣款（含 3DS，見 §3）。
  3. 扣款成功後立即呼叫 Shopify Admin API 建立訂單，Shopify 扣減庫存；SiteGiant Shopify App 自動接收訂單並扣減 ERP 實體庫存。
  4. **防誤出貨保護 (Anti-Fulfillment Guard)**：為防止測試環境建立的訂單觸發物流商出貨，當系統處於沙盒模式（`COMMERCE_SANDBOX_MODE=true`）時，建立的訂單必須自動注入 `TEST_ORDER, DO_NOT_SHIP, DO_NOT_FULFILL` 標籤，收件資訊與 note_attributes 也必須明確標示為測試訂單。
  5. 若 Shopify 建單或開票失敗，觸發自動退款與補償機制（見 §5）。

## 3. 3D Secure (3DS) 流程

TapPay Direct Pay 走 3DS 驗證時：
1. `api/checkout.ts` 呼叫 TapPay 後，若回傳需要 3DS，回傳 `payment_url` 與交易識別給前端。
2. 前端導向銀行 3DS 頁面，完成後銀行 redirect 至 `https://saengak.com.tw/checkout/3ds-callback`。
3. Callback 頁面帶 rec_trade_id 回呼 `api/checkout/confirm.ts`，後端向 TapPay 查詢最終結果，再續行「建單 → 開票」。

## 4. 冪等性 (Idempotency)

- 前端每次結帳產生唯一 `Idempotency-Key` (UUID v4)，隨 header 送出。
- **Key 必須綁定 Payload**：`api/checkout.ts` 首次受理時，將請求 body 之 SHA-256 hash 與 key 一併寫入 `transaction_logs`。同一 key 再次進入時：
  - **Hash 涵蓋範圍（2026-08-20 稽核修正定版）**：商品項目 (Variant ID + 數量)、顧客 Email、收件地址關鍵欄位、物流方式代碼、**發票偏好 (`invoicePreference`，含抬頭/統編/載具)**。發票偏好列入 hash 是為了防止同 key 竄改發票資訊重放（原實作遺漏此欄位，已修正並補測試）。
  - Payload hash 相同且為終態 → 直接回傳既有結果（防止重複扣款）。
  - Payload hash 相同且處理中 → 回傳 409 / 前端輪詢（輪詢一律經由後端查詢端點，前端不得直讀 `transaction_logs`，見 SUPABASE_DEPLOYMENT §3）。
  - **Payload hash 不同 → 一律拒絕 (422)**，防止同 key 挾帶不同內容重放。
  - 不存在 → 建立日誌並繼續。
- **Key 必須綁定身分**：key 與會員 `auth.uid()`（或訪客 session 識別）關聯，禁止跨身分重用他人 key 探測交易結果。
- 防止使用者連點、網路重送造成重複扣款或重複建單。

## 5. 分散式交易與補償機制

交易跨越 TapPay (金流)、Shopify (訂單)、光貿 (發票)，必須有強健狀態紀錄，避免「客扣款成功但系統沒訂單」。


### 5.1 Transaction_Logs 資料表 (狀態機)

於 Supabase 建立 `transaction_logs`，欄位含 `idempotency_key`, `payload_hash`, `status`, `tappay_rec_trade_id`, `shopify_order_id`, `invoice_id`, `amount`, `payload`, `updated_at`。

> **已落地 (2026-08-20)**：migration `supabase/migrations/20260820000001_create_transaction_logs.sql`。資料表建於 `public` schema 以供 Service Role 經 PostgREST 直接存取；RLS 啟用且對 `public`/`anon`/`authenticated` 全數 revoke（Deny All），僅 `service_role` 可讀寫。pgTAP 測試：`supabase/tests/database/transaction_logs.test.sql`（已納入 `npm run test:db` 執行清單）。

> **`payload` 欄位個資最小化（呼應 SUPABASE_DEPLOYMENT §5「不複製原則」）**：落庫前必須經欄位白名單過濾——僅保留 Variant ID、數量、金額、物流方式代碼、發票類型代碼與去識別化之必要對帳欄位；**不得**寫入完整收件人姓名、電話、地址、Email、載具號碼與任何 TapPay Prime/卡號資訊。收件資訊由 Shopify Order 為唯一權威。

**狀態列舉與補償動作（2026-08-17 起適用；已隨 2PC 廢棄移除 `INVENTORY_RESERVED`，庫存扣減由 Shopify 建單自動觸發、SiteGiant App 同步）：**

| 狀態 | 意義 | 若卡住的補償動作 |
| --- | --- | --- |
| `INITIATED` | 已接單，冪等檢查通過 | 逾時直接失效 |
| `PAYMENT_CAPTURED` | TapPay 扣款成功 | 若後續建單失敗 → 觸發自動 Refund |
| `ORDER_CREATED` | Shopify 已建單（庫存於此扣減） | 若開票失敗 → 重試開票，不影響訂單 |
| `INVOICE_ISSUED` | 光貿已開立 | 終態 (成功) |
| `COMPLETED` | 全流程完成 | 終態 |
| `PAYMENT_FAILED` | 扣款失敗 | 直接終態，無庫存需回補 |
| `ORDER_FAILED` | 建單失敗 | **自動 TapPay Refund** |
| `COMPENSATED` | 已完成補償 | 終態 |

### 5.2 對帳排程 (Reconciliation Job)

- 定期掃描 `transaction_logs` 中停留於中間態超過門檻（15 分鐘）的交易並補償。

> **已落地 (2026-08-20)**：`api/cron/reconcile.ts` 掃描逾時之 `INITIATED` / `PAYMENT_CAPTURED` / `ORDER_FAILED` 交易——有扣款但無訂單者自動 TapPay Refund 並標記 `COMPENSATED`；無扣款之逾時交易標記 `PAYMENT_FAILED` 關閉。排程已寫入 `vercel.json` 之 `crons`：對帳 `/api/cron/reconcile` **每 15 分鐘**、發票 Outbox Worker `/api/invoice/guangmao` **每 5 分鐘**（此前僅有端點而無排程宣告，Vercel 不會自動呼叫，2026-08-20 稽核補上）。

- ⚠️ **Vercel Free Tier 限制**：Cron 頻率與 function 最長執行時間（Free Tier 約 10 秒）可能不足以完成「扣款→建單→開票」串行外部呼叫。需評估：
  - 升級 Vercel 方案 (更長 timeout)，或
  - 拆分為非同步事件 + queue（扣款成功後以事件觸發 `api/invoice/guangmao.ts`），或
  - 引入外部 Cron（如 Supabase pg_cron / QStash）。

### 5.3 發票 Outbox 寫入路徑 (2026-08-20 稽核修正定版)

> **鐵則：`private.amego_invoice_jobs` 位於 `private` schema，未曝露於 PostgREST；任何後端程式碼嚴禁以 `.from('amego_invoice_jobs')` 直接存取，一律透過 RPC。**

- **寫入 (Enqueue)**：結帳成功建單後（`api/checkout.ts` 直接扣款分支與 `api/checkout/confirm.ts` 3DS 分支），一律呼叫 `public.enqueue_amego_invoice_job` RPC（migration `20260820000003_add_enqueue_amego_invoice_job_rpc.sql`）寫入 Outbox；RPC 以 `shopify_order_gid` 為衝突鍵做冪等 upsert，終態工作（issued/voided/cancelled 等）不被覆寫。僅 `service_role` 具 EXECUTE 權限。pgTAP 測試：`supabase/tests/database/enqueue_amego_invoice_job.test.sql`。
- **稽核背景**：原實作誤用 `.from('amego_invoice_jobs')` 直寫，因 `public` schema 不存在該表而必然失敗，且錯誤被靜默吞掉退回記憶體暫存——Serverless instance 回收後發票工作即遺失，發票實質不會開立。此為本次稽核之 Critical 發現，已修正。
- **消化 (Claim/Complete)**：維持既有 `public.claim_amego_invoice_job` / `public.mark_amego_invoice_mutation_started` / `public.complete_amego_invoice_job` RPC 租約機制（見 LOGISTICS_INVOICE 與 migration `20260813045204`），由 `api/invoice/guangmao.ts` Worker 認領派送並嚴格回讀 `invoice_status=99`。
- **雙寫來源並存**：Shopify Webhook 投影路徑 (`sync_shopify_order_webhook`) 亦會於 `paid` 訂單寫入同一 Outbox；兩路徑以 `shopify_order_gid` 冪等去重，不會重複開票。

## 6. 逆向流程 (退款 / 取消 / 發票作廢)

| 情境 | 順序 |
| --- | --- |
| 扣款成功但建單失敗 | TapPay Refund → 記 `COMPENSATED`（未建單即未扣庫存，無需回補） |
| 顧客取消未出貨訂單 | Shopify 取消（庫存自動回補，SiteGiant App 同步）→ TapPay Refund → 光貿作廢/折讓 |
| 已出貨退貨 | 收退貨確認 → 光貿折讓 → Shopify 退貨入庫（SiteGiant App 同步回補）→ TapPay Refund |

- **退款授權控管**：TapPay Refund 僅允許兩種觸發來源——(a) 補償狀態機依 §5.1 規則自動觸發；(b) 管理員於後台以 `app_metadata.role` 授權操作並留審計紀錄。不開放任何前端顧客端點直接觸發退款。

- 發票作廢/折讓一律以光貿回讀事件為準寫回 `order_invoices`。

## 7. 安全性

### 7.1 基本原則
- 卡號與 TapPay Partner Key **不進入** 前端或 Supabase；Partner Key 僅存 Vercel 平台 secret。
- PCI 合規：自建結帳 + TapPay Fields 屬 **SAQ A-EP** 範圍，需依此完成自評。
- 金額一律後端重算（見 §1.4）；冪等 key 綁定 payload 與身分（見 §4）。
- **公開環境變數規範**：前端 `PaymentForm` 載入 TapPay SDK 時，其 `appId` 與 `appKey` 必須相容並優先讀取 Vite 專用公開變數前綴（`VITE_PUBLIC_TAPPAY_APP_ID` 與 `VITE_PUBLIC_TAPPAY_APP_KEY`）。

### 7.2 Rate Limit（盜刷測卡防護）
- **定案方案**：採用 **Upstash Redis REST + Lua Script 原子滑動視窗**（`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD`），Redis 未配置或連線異常時平滑降級至 in-memory sliding window，**且每次降級必須呼叫 `captureExceptionSafe` 回報 Sentry**（呼應 00_DECISION_LOG「靜默降級可觀測性治理」）。
- **唯一實作**：`api/_lib/ratelimit.ts`（測試：`tests/ratelimit.test.ts`）。**嚴禁另建平行的限流模組**——2026-08-20 稽核發現曾同時存在一支固定視窗、無 Sentry 回報的重複實作且被端點誤接，已刪除並統一接回本模組。
- 已落地閾值：同一 IP 每分鐘 ≤ 5 次結帳 (`api/checkout.ts`)、3DS confirm 每分鐘 ≤ 10 次、狀態輪詢每分鐘 ≤ 20 次；會員層每小時 ≤ 10 次 (`checkUserRateLimit`)；超限回 429 並附 `Retry-After`。
- 監控指標：單卡多筆小額、同 IP 多卡、高失敗率突升——任一觸發即進入 CAPTCHA 流程。

### 7.3 CAPTCHA 觸發條件
- 平時不顯示（不增加正常顧客摩擦）；當 §7.2 任一異常指標觸發，該 IP/會員之後續結帳要求附帶 CAPTCHA token（建議 Cloudflare Turnstile，隱私成本最低），後端驗證通過方受理。

### 7.4 來源與 CSRF 防護
- 結帳相關 API 一律驗證 `Origin` header 必須等於 `https://saengak.com.tw`（比照 `api/test-access.mjs` 既有做法）；非白名單來源回 403。
- **缺少 `Origin` header 一律拒絕 (403)**（2026-08-20 稽核修正）：原實作將「無 Origin」視為同源放行，等同讓非瀏覽器之伺服器對伺服器/腳本呼叫繞過整個白名單；已改為 Fail-Closed，並以迴歸測試鎖定（`tests/checkout-backend.test.ts` §9）。
- 不設定寬鬆 CORS；結帳 API 僅供同源前端呼叫，不回應 `Access-Control-Allow-Origin: *`。
- Session cookie（若有）一律 `HttpOnly; Secure; SameSite=Strict`。

### 7.5 3DS Callback 防護
- `api/checkout/confirm.ts` 收到 `rec_trade_id` 後：(a) 必須先查 `transaction_logs` 確認該 `rec_trade_id` 屬於既有進行中交易，否則拒絕；(b) 最終付款結果**只信任後端向 TapPay Record API 的查詢結果**，不信任前端 callback 帶入的任何狀態欄位；(c) 本端點同樣納入 §7.2 Rate Limit。

### 7.6 對帳排程端點防護
- 若對帳 Job（§5.2）以 Vercel Cron 觸發，其 endpoint 為公開 URL：必須驗證 `Authorization: Bearer ${CRON_SECRET}`（Vercel Cron 自動附帶），驗證失敗回 401，且該 secret 納入 SECRET_HANDOFF_GUIDE 輪替清單。
- **`CRON_SECRET` 未設定時一律回 500 拒絕**（2026-08-20 稽核修正）：原實作在密鑰未設定時跳過驗證直接放行，等同任何匿名呼叫者皆可觸發對帳與自動退款；已改為 Fail-Closed（見 §7.8）。發票 Worker (`api/invoice/guangmao.ts`) 之 `AmegoDispatchToken` / `CRON_SECRET` 同規則。
- Token 比對一律使用 timing-safe 比較（`timingSafeStringEqual`），不得用 `===`。

### 7.7 結帳身分政策（已定案）
- **定案方案：混合模式 (Email OTP 歸戶)**。
- 優先鼓勵會員登入結帳。同時開放訪客免登入結帳，並以「手機號碼」作為跨訂單關聯依據。
- **資安防護 (交集比對)**：為防止惡意人士以他人手機號碼窮舉歷史訂單，訪客查詢訂單時需在畫面上同時輸入「手機號碼」與「Email」。系統確認兩者在過去訂單有交集後，將透過 Supabase 發送 Email 驗證碼 (OTP/Magic Link) 至該信箱。驗證通過後即可查看該歸戶之訂單並轉化為正式會員。

### 7.8 密鑰缺失 Fail-Closed 鐵則 (2026-08-20 稽核新增)

> **鐵則：任何以密鑰/秘密為前提的安全檢查（HMAC 簽章、Bearer Token、Origin 白名單環境變數），密鑰未設定時必須直接拒絕請求（500，附伺服器端告警日誌），嚴禁「有設定才驗證、沒設定就放行」。**

- 稽核背景：Phase 2 首版實作在 `SHOPIFY_WEBHOOK_SECRET`、`CRON_SECRET`、`AmegoDispatchToken` 未設定時均採 `if (secret) { verify }` 模式靜默跳過驗證——一旦 Vercel 環境變數漏設，防護即隱性消失且不會報錯。此模式與 MAIN_SPECIFICATION §5.2 安全不變量第 1 條「預設封閉 (Fail-Closed)」直接牴觸，已全數修正。
- 涵蓋端點與迴歸測試：`api/webhooks/shopify.ts`（HMAC）、`api/cron/reconcile.ts`（CRON_SECRET）、`api/invoice/guangmao.ts`（AmegoDispatchToken/CRON_SECRET）、`api/_lib/security.ts` 之 `isOriginAllowed`（缺 Origin 拒絕）。四項均以 `tests/checkout-backend.test.ts` §9「Fail-Closed 迴歸測試」鎖定，任何回退至 fail-open 的改動將使 `npm test` 失敗。

## 8. 前端異常防護與監控 (Sentry `@sentry/react` & Error Boundary)

### 8.1 分層 Error Boundary 與復原 UI (Recovery UX)
- **分層包裹**:
  - 全站層 (`App.tsx`) 包裹全域 Error Boundary。
  - 結帳區塊 (`CheckoutForm.tsx`) 獨立包裹專屬 Error Boundary；結帳元件發生 Exception 時不影響 Header/Footer/導覽列。
- **購物車狀態持久化保護**:
  - 購物車 items 存於 `localStorage` / React Context。即使結帳 UI 崩潰重置，顧客選購之商品與數量**絕對保留不遺失**。
- **親和降級介面 (`CheckoutErrorFallback.tsx`)**:
  - 顯示親和警示：「結帳區域發生臨時異常，您的購物車商品已安全保存」。
  - 提供兩大復原按鈕：
    1. 🔄 **【重試結帳】**: 執行 `resetError()` 清除 Boundary 錯誤狀態並原位重新載入。
    2. 🛒 **【回到購物車 / 首頁】**: 安全切換頁面。
  - **客服追蹤短碼**: 介面顯示本地產生之 6 碼追蹤短碼（例如: `錯誤追蹤碼: #a8f92d`，由 `generateShortEventId()` 產生並以 `safeEventId` tag 附掛至 Sentry 事件），供顧客向客服回報時快速精確定位。

### 8.2 Sentry 前端捕捉與個資/卡號脫敏規章 (Sanitizer)

> **現況**：Sentry SDK 尚未安裝與初始化（見 `LAUNCH_CHECKLIST.md` §5）；脫敏工具庫已落地於 `src/lib/sentry.ts` 並有測試 `tests/sentry-sanitizer.test.ts`。

- **捕捉範圍**: 自動捕獲 Uncaught Exceptions、Uncaught Promise Rejections、React 渲染崩潰與 UI 點擊軌跡 (Breadcrumbs)。
- **全域脫敏演算法 (`beforeSend` & `beforeBreadcrumb`)**:
  - 拒收與遮蔽鍵值清單以 **`src/lib/sentry.ts` 之 `DENIED_KEYS` / `PII_KEYS` 常數為唯一權威**（本文件不再複寫清單，避免兩處漂移）；新增敏感欄位時直接修改程式碼常數並補測試。
  - `DENIED_KEYS` 命中者強制替換為 `[REDACTED_SENSITIVE]`；`PII_KEYS` 命中者依型別做首尾遮蔽（如 `張*明`）或 `[REDACTED_PII]`。
  - 字串內容另以正則深掃卡號、JWT、Bearer Token 與 TapPay Prime。
  - SDK 設定 `sendDefaultPii: false`，確保 PCI-DSS SAQ A-EP 與個資防禦零漏洞。

## 9. Phase 2 實作對照表 (2026-08-20)

| 規格章節 | 實作檔案 | 測試 |
| --- | --- | --- |
| §1.3–1.4 結帳中樞、金額權威重算 | `api/checkout.ts`、`api/_lib/shopify-admin.ts` | `tests/checkout-backend.test.ts` 第 2–3 節（含 Happy Path 建單與補償退款整合測試） |
| §3 / §7.5 3DS Callback 二次查核 | `api/checkout/confirm.ts`、`api/_lib/tappay.ts` | 同上第 1、4 節 |
| §4 冪等性 | `api/checkout.ts` + `transaction_logs` | 同上第 3 節（422 竄改防護含發票偏好） |
| §5.1 狀態機資料表 | `supabase/migrations/20260820000001` | `supabase/tests/database/transaction_logs.test.sql` |
| §5.2 對帳補償排程 | `api/cron/reconcile.ts` + `vercel.json` crons | 同上第 8 節 |
| §5.3 發票 Outbox | `api/_lib/supabase-admin.ts` (`enqueueAmegoInvoiceJob` → RPC)、`supabase/migrations/20260820000003` | `supabase/tests/database/enqueue_amego_invoice_job.test.sql` |
| §6 逆向補償 | `api/_lib/tappay.ts` (`refundTransaction`) | 同上第 1、3、8 節 |
| §7.2 Rate Limit | `api/_lib/ratelimit.ts` | `tests/ratelimit.test.ts` |
| §7.4 / §7.6 / §7.8 Fail-Closed | `api/_lib/security.ts`、各端點 | 同上第 9 節「Fail-Closed 迴歸測試」 |
| 狀態輪詢（前端不直讀 DB） | `api/checkout/status.ts` | 同上第 5 節 |
| Webhook 投影 | `api/webhooks/shopify.ts` | 同上第 7 節 |
| 發票 Worker | `api/invoice/guangmao.ts` | 同上第 6 節 |

> **注意**：SQL migration 與 pgTAP 測試（`npm run test:db`）需本地 Supabase (Docker) 環境執行，2026-08-20 稽核當日環境無 Docker，尚未對真實 Postgres 驗證，部署前必須補跑。
> **測試覆蓋已知缺口（如實記錄）**：`api/invoice/guangmao.ts` 之「派送並回讀 99」與 `api/webhooks/shopify.ts` 之「合法簽章→完整投影」兩條主線尚無整合測試，僅有授權/簽章/網域防護之單元測試；列為部署前補強項目。
