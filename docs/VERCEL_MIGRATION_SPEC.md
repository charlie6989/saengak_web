# Vercel Serverless 遷移規格書 (Vercel Migration Spec)

> 版本日期：2026-08-22 (對齊 00_DECISION_LOG §3.3：結帳架構回歸 Shopify Checkout，`api/checkout.ts` 系列自建交易中樞已廢棄；前版：2026-08-20 Phase 2 API 層程式碼落地與稽核修正)

## 1. 遷移背景與目標

後端中樞從 Supabase Edge Functions 轉移至 Vercel Serverless API，作為 API Orchestration 核心。

## 2. API 路由與結構映射

所有後端邏輯以 Node.js / TypeScript 改寫，置於專案根 `api/` 資料夾，由 Vercel 自動部署。

| 舊架構 / 前身 | 現行 Vercel API | 職責與重構要點 | 現況 (2026-08-22) |
| --- | --- | --- | --- |
| `create-shopify-cart` (Supabase Edge Function) | `api/create-shopify-cart.ts` | ✅ **現行結帳入口**：建立 Shopify Cart、回傳 `checkoutUrl`，導向 Shopify Checkout；已登入會員驗證 Bearer session 並寫入 `shopify_checkout_links`。金額、庫存與扣款一律由 Shopify／TapPay Shopify Payment App 於其自有頁面權威處理，本函式不重算金額、不接觸卡號。 | ✅ 現行（git commit `79e6486`） |
| (Phase 2 自建，已廢棄) | ~~`api/checkout.ts`~~ | ~~接收 TapPay Prime、金額權威重算、扣款、建單、發票 Outbox~~ | ❌ **已廢棄，不得部署**（2026-08-21，見 00_DECISION_LOG §3.3） |
| (Phase 2 自建，已廢棄) | ~~`api/checkout/confirm.ts`~~ | ~~接收 3DS callback，後端二次向 TapPay Record API 查最終結果~~ | ❌ **已廢棄，不得部署** |
| (Phase 2 自建，已廢棄) | ~~`api/checkout/status.ts`~~ | ~~前端以 `idempotency_key` 輪詢交易進度~~ | ❌ **已廢棄，不得部署** |
| (Phase 2 自建，已廢棄) | ~~`api/cron/reconcile.ts`~~ | ~~掃描逾時中間態交易，自動 Refund 補償或關閉~~ | ❌ **已廢棄，不得部署** |
| `shopify-orders-webhook` | `api/webhooks/shopify.ts` | 驗證 HMAC，寫入 orders / order_items / order_fulfillments 投影。不受結帳架構回歸影響。 | 程式碼存在（雙軌期，Shopify Webhook 訂閱實際指向哪個端點待現場確認） |
| (原交 Waaship) | `api/invoice/guangmao.ts` | 光貿 Amego 發票 Outbox Worker：Claim → 派送 f0401 → 回讀 99 → 投影 order_invoices。不受結帳架構回歸影響。 | ✅ 程式碼已落地 |
| (共用函式庫) | `api/_lib/{supabase-admin,security}.ts` | Supabase Service Role、Origin/Hash/timing-safe 工具，`api/create-shopify-cart.ts` 現行使用中。 | ✅ 現行 |
| (共用函式庫，已廢棄) | ~~`api/_lib/{tappay,shopify-admin,ratelimit}.ts`~~ | ~~TapPay SDK、Shopify Admin 權威計價建單、滑動視窗限流~~，主要服務於已廢棄之 `api/checkout.ts` 系列 | ❌ 僅存於 Git 歷史 |
| `get-products` 等 | `api/catalog/*.ts` | ~~遷移查詢邏輯~~ 已改採前端直連 Storefront API（見 00_DECISION_LOG §1），本項不再需要。 | — 已由架構決策取代 |

> 「✅ 現行」表示程式碼與 00_DECISION_LOG §3.3 之現行架構一致；**不代表**已完成 Vercel 環境變數/Secrets 全面配置或端到端商業驗收 (`verify:commerce`)。「❌ 已廢棄」項目之程式碼仍保留於 Git 歷史供追溯，但不得部署或視為現行系統行為。

## 3. Edge Functions 下線與切換計畫 (新增)

> 消解與 MODULES.md「Edge Functions 已部署」之衝突。

1. **雙軌期**：新舊 webhook endpoint 並存，透過 Webhook ID 去重，確保不重複建投影。
2. **切換**：Shopify webhook subscription endpoint 由 Edge Function URL 改指向 `api/webhooks/shopify.ts`，回讀確認。
3. **下線**：確認 Vercel 端連續穩定回讀後，停用 `create-shopify-cart`、`shopify-orders-webhook` 等 Edge Functions。
4. **Secret 遷移**：原 Edge Function secrets（ShopifyWebhookSecret 等）改存 Vercel 平台 secret（見 SECRET_HANDOFF_GUIDE）。

## 4. 防禦機制與可靠性設計

### 4.1 安全性驗證 (Security & HMAC)
- 所有 Webhook (`api/webhooks/*`) 必須驗證 Shopify HMAC，並做 Webhook ID 去重與事件時間戳防倒退。實作時須注意：
  - HMAC 必須對**原始 request body（raw bytes）**計算；Vercel Node runtime 預設可能已做 body parsing，需以 `export const config = { api: { bodyParser: false } }`（或等效設定）取得原始 body 後再驗證，否則簽章必定不符或被繞過。
  - 比對計算出的 HMAC 與 `X-Shopify-Hmac-Sha256` header 時使用 timing-safe 比較（如 Node `crypto.timingSafeEqual`），不得用 `===`。
  - 額外驗證 `X-Shopify-Shop-Domain` header 等於本站唯一授權商店 `gh2xgs-zf.myshopify.com`，防止他店 webhook 或偽造請求誤植資料。
  - HMAC 驗證失敗一律回 401 並記錄告警，不得靜默丟棄。
  - **`SHOPIFY_WEBHOOK_SECRET` 未設定時一律回 500 拒絕**（2026-08-20 稽核修正）：原實作在密鑰缺失時整段跳過驗證、未簽章請求直接被當合法處理；已改為 Fail-Closed 並以迴歸測試鎖定（見 CHECKOUT_PAYMENT_SPEC §7.8）。
- ~~交易端點 `api/checkout.ts`、`api/checkout/confirm.ts` 需 Rate Limit...~~ 此段落原描述已廢棄之自建結帳中樞，不適用於現行架構。現行 `api/create-shopify-cart.ts` 具備 Origin 檢查（`api/_lib/security.ts`），Rate Limit 目前未見獨立實作。
- `api/invoice/guangmao.ts` 對外暴露（Vercel Cron 觸發），須驗證 `Authorization: Bearer ${AmegoDispatchToken 或 CRON_SECRET}`；密鑰未設定一律 500 拒絕。

### 4.1.1 對帳排程端點授權與 Cron 排程
- 見 CHECKOUT_PAYMENT_SPEC §7.6：Cron 觸發端點須驗證 `CRON_SECRET`（timing-safe 比對；密鑰未設定一律 500 拒絕）。
- **排程已宣告於 `vercel.json` `crons`**（2026-08-22 複查：因 Vercel Hobby 方案僅支援每日排程，實際頻率已由原規劃之每 15/5 分鐘下修為每日一次，見 git commit `27c11aa`）：
  - `/api/cron/reconcile` — `0 0 * * *`（每日一次；⚠️ 呼叫已廢棄之自建結帳中樞對帳邏輯，`transaction_logs` 現行無資料寫入，此排程目前實質為 no-op，可評估自 `vercel.json` 移除）
  - `/api/invoice/guangmao` — `0 1 * * *`（每日一次，消化光貿發票 Outbox；不受結帳架構回歸影響，仍為現行必要排程）

### 4.2 Cache-Control
- `api/catalog/*` 商品查詢加 `Cache-Control: s-maxage` 利用 Vercel Edge Cache。
- 交易與會員端點一律 `no-store`。

### 4.3 Timeout 與 Cron 限制
- Free Tier function timeout 有限，串行外部呼叫需評估升級或非同步化（見 CHECKOUT_PAYMENT_SPEC §5.2）。

### 4.4 後端異常監控與 Source Maps 安全處理 (Sentry `@sentry/node` & `@sentry/vite-plugin`)

> **現況**：`@sentry/node`、`@sentry/react`、`@sentry/vite-plugin` 均**尚未安裝**於 `package.json`；本節為接線規格，非現況描述。接線步驟與驗收見 `LAUNCH_CHECKLIST.md` §5。

- **Serverless API 監控**: 所有 Vercel Serverless API (`api/*`) 統一導入 `@sentry/node` 初始化監控，自動捕獲 Serverless Runtime 崩潰、第三方 API Timeout (504) 及 HTTP 500 異常。
- **Source Maps 建置保護與自動清理**:
  - `vite.config.ts` 配置 `build.sourcemap: 'hidden'`（生成解譯 Map 但不安裝 `//# sourceMappingURL=` 標頭）。
  - 配置 `@sentry/vite-plugin`，在 Vercel `vite build` 部署建置時將 Source Maps 加密上傳至 Sentry 團隊專屬後台。
  - 設定 `filesToDeleteAfterUpload: ['./dist/**/*.map']`：**上傳完畢後立即全數刪除 dist/ 目錄下的 .map 實體檔案**，確保公開 Vercel CDN 站台完全不殘留源碼檔。
- **後端請求/回應與 API Secrets 脫敏 (Sanitizer)**:
  - 於 Sentry `beforeSend` Hook 設定全域過濾器，強制遮蔽 `TAPPAY_PARTNER_KEY`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SITEGIANT_CLIENT_SECRET`, `GUANGMAO_API_KEY`, `prime`, `card_number`, `cvv` 及顧客個資。
