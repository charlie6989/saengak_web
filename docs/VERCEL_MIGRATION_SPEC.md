# Vercel Serverless 遷移規格書 (Vercel Migration Spec)

> 版本日期：2026-08-17 (補強 HMAC 實作細節、Cron 授權與 Sentry 現況修正)

## 1. 遷移背景與目標

後端中樞從 Supabase Edge Functions 轉移至 Vercel Serverless API，作為 API Orchestration 核心。

## 2. API 路由與結構映射

所有後端邏輯以 Node.js / TypeScript 改寫，置於專案根 `api/` 資料夾，由 Vercel 自動部署。

| 舊架構 (Edge Functions) | 新架構 (Vercel API) | 職責與重構要點 |
| --- | --- | --- |
| `create-shopify-cart` | `api/checkout.ts` | 大幅改寫：接收 TapPay Token、SiteGiant 保留、扣款、建單。不再只回 checkoutUrl。 |
| (3DS 新增) | `api/checkout/confirm.ts` | 接收 3DS callback，向 TapPay 查最終結果並續行。 |
| `shopify-orders-webhook` | `api/webhooks/shopify.ts` | 驗證 HMAC，寫入 orders / order_items / order_fulfillments 投影。 |
| (原交 Waaship) | `api/invoice/guangmao.ts` | 新增：接收成功扣款事件，呼叫光貿開票並寫 order_invoices。 |
| `get-products` 等 | `api/catalog/*.ts` | 遷移查詢邏輯，加 Cache-Control。 |

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
- 交易端點 `api/checkout.ts`、`api/checkout/confirm.ts` 需 Rate Limit（儲存方案見 CHECKOUT_PAYMENT_SPEC §7.2）、idempotency（§4）、Origin 檢查與 CORS 限制（§7.4）。
- `api/invoice/guangmao.ts` 等內部服務對服務端點，若對外暴露亦須比照驗證來源（不對外暴露則以 Vercel 內部呼叫限制之）。

### 4.1.1 對帳排程端點授權
- 見 CHECKOUT_PAYMENT_SPEC §7.6：Cron 觸發端點須驗證 `CRON_SECRET`。

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
