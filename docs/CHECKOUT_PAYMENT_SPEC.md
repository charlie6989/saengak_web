# 結帳與交易安全性規格書 (Checkout & Payment Spec)

> 版本日期：2026-08-17 (架構簡化與 Phase 2 保留規格)
> 本規格書為 **第 2 階段 (Phase 2)** 啟用自建結帳與線上支付時之權威規範。當前第 1 階段專注於商品展示與 Vercel 部署。

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
  4. 若 Shopify 建單或開票失敗，觸發自動退款與補償機制（見 §5）。

## 3. 3D Secure (3DS) 流程

TapPay Direct Pay 走 3DS 驗證時：
1. `api/checkout.ts` 呼叫 TapPay 後，若回傳需要 3DS，回傳 `payment_url` 與交易識別給前端。
2. 前端導向銀行 3DS 頁面，完成後銀行 redirect 至 `https://saengak.com.tw/checkout/3ds-callback`。
3. Callback 頁面帶 rec_trade_id 回呼 `api/checkout/confirm.ts`，後端向 TapPay 查詢最終結果，再續行「建單 → 開票」。

## 4. 冪等性 (Idempotency)

- 前端每次結帳產生唯一 `Idempotency-Key` (UUID v4)，隨 header 送出。
- **Key 必須綁定 Payload**：`api/checkout.ts` 首次受理時，將請求 body 之 SHA-256 hash 與 key 一併寫入 `transaction_logs`。同一 key 再次進入時：
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

- 定期掃描 `transaction_logs` 中停留於中間態超過門檻（如 15 分鐘）的交易並補償。
- ⚠️ **Vercel Free Tier 限制**：Cron 頻率與 function 最長執行時間（Free Tier 約 10 秒）可能不足以完成「扣款→建單→開票」串行外部呼叫。需評估：
  - 升級 Vercel 方案 (更長 timeout)，或
  - 拆分為非同步事件 + queue（扣款成功後以事件觸發 `api/invoice/guangmao.ts`），或
  - 引入外部 Cron（如 Supabase pg_cron / QStash）。

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

### 7.2 Rate Limit（盜刷測卡防護，實作前必須定案儲存方案）
- `api/checkout.ts` 與 `api/checkout/confirm.ts` 為測卡高風險端點，必須有跨實例共享的計數儲存。Vercel Serverless 無狀態，**不得**以函式記憶體實作。候選方案（擇一定案後回填本節）：
  1. Upstash Redis（`@upstash/ratelimit`，滑動視窗）— 建議首選；
  2. Vercel WAF / Firewall 規則；
  3. Supabase 資料表計數（成本低但延遲高，僅作備援）。
- 建議初始閾值：同一 IP 每分鐘 ≤ 5 次結帳嘗試、同一會員每小時 ≤ 10 次；超限回 429 並記錄告警。
- 監控指標：單卡多筆小額、同 IP 多卡、高失敗率突升——任一觸發即進入 CAPTCHA 流程。

### 7.3 CAPTCHA 觸發條件
- 平時不顯示（不增加正常顧客摩擦）；當 §7.2 任一異常指標觸發，該 IP/會員之後續結帳要求附帶 CAPTCHA token（建議 Cloudflare Turnstile，隱私成本最低），後端驗證通過方受理。

### 7.4 來源與 CSRF 防護
- 結帳相關 API 一律驗證 `Origin` header 必須等於 `https://saengak.com.tw`（比照 `api/test-access.mjs` 既有做法）；非白名單來源回 403。
- 不設定寬鬆 CORS；結帳 API 僅供同源前端呼叫，不回應 `Access-Control-Allow-Origin: *`。
- Session cookie（若有）一律 `HttpOnly; Secure; SameSite=Strict`。

### 7.5 3DS Callback 防護
- `api/checkout/confirm.ts` 收到 `rec_trade_id` 後：(a) 必須先查 `transaction_logs` 確認該 `rec_trade_id` 屬於既有進行中交易，否則拒絕；(b) 最終付款結果**只信任後端向 TapPay Record API 的查詢結果**，不信任前端 callback 帶入的任何狀態欄位；(c) 本端點同樣納入 §7.2 Rate Limit。

### 7.6 對帳排程端點防護
- 若對帳 Job（§5.2）以 Vercel Cron 觸發，其 endpoint 為公開 URL：必須驗證 `Authorization: Bearer ${CRON_SECRET}`（Vercel Cron 自動附帶），驗證失敗回 401，且該 secret 納入 SECRET_HANDOFF_GUIDE 輪替清單。

### 7.7 結帳身分政策（開放決策，Phase 2 開工前必須定案）
- 選項 A（**建議首版採用**）：結帳強制登入會員——RLS 歸屬清晰、退款與訂單查詢有明確身分邊界。
- 選項 B：開放訪客結帳——須另訂訪客訂單歸屬（email 綁定 + 簽名查詢連結）、`transaction_logs` 身分識別與事後轉會員機制，安全複雜度顯著較高。
- 未定案前，所有規格以選項 A 為預設假定。定案後回填 `00_DECISION_LOG.md`。

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
