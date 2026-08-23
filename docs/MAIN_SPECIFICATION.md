# SAENGAK 正式主要規格書 (Main Specification)

> 版本日期：2026-08-22 (對齊 00_DECISION_LOG §3.3：結帳架構回歸 Shopify Checkout；後台管理系統路由與權限守衛已接線)
> 專案網域：`https://saengak.com.tw`
> 專案狀態：**第 1 階段商品展示完成並朝向 Vercel 部署上線推進；結帳交易已改由 Shopify Checkout 全權處理（TapPay Shopify Payment App），原自建結帳中樞已廢棄**
> 權威索引：本文件與各子規格衝突時，以 `00_DECISION_LOG.md` 為最高權威。

## 1. 專案背景與架構策略目標

本專案採用現代化無頭式電商 (Headless Commerce) 架構：
- **前端視圖層**：基於 React 19 + Vite 7 + Tailwind CSS / Vanilla CSS，提供極致流暢之商品目錄、規格切換、多語系與響應式體驗。
- **商品與即時庫存門戶**：Shopify Storefront API（由 SiteGiant ERP 透過 Shopify 官方應用程式進行後台雙向庫存同步，消解前端/Serverless 直連 ERP 的 2PC 分散式交易負擔）。
- **物流履約**：Shopify 內建之 ShipAny 應用程式進行超商選店與配送履行（自建物流 API 列為備用）。
- **階段策略**：
  - **第 1 階段 (當前聚焦)**：高質感商品展示 (Catalog & Product Details)、多語系切換、SEO 結構化標記與 Vercel 部署上線。
  - **第 2 階段 (後續推進)**：跳轉 Shopify Checkout、TapPay Shopify Payment App 線上刷卡、光貿電子發票自動化開立（原自建 React 結帳頁面／TapPay Direct Pay SDK／交易狀態機已於 2026-08-21 廢棄，見 `00_DECISION_LOG.md` §3.3）。

### 1.1 系統與商店識別
- **前端與 API 部署**：Vercel (`saengak-web-d2ux`)
- **資料庫 (投影)**：Supabase (`tmqzkagkrzhioftvwbqo`)
- **訂單與商品引擎**：Shopify (`gh2xgs-zf.myshopify.com`)
- **ERP 與實體庫存權威**：SiteGiant (透過 Shopify App 與 Shopify 同步)
- **金流服務 (第 2 階段)**：TapPay (Shopify Payment App)
- **物流服務**：ShipAny (Shopify App 整合，自建 API 備用)
- **電子發票 (第 2 階段)**：光貿電子發票
- **異常監控**：Sentry — **前端已接線**：`@sentry/react` 已安裝並於 `src/main.tsx` 初始化，掛載 `src/lib/sentry.ts` 之 `sanitizeEvent`/`sanitizeBreadcrumb` 脫敏 Hook，`vite.config.ts` 已配置 `@sentry/vite-plugin` 上傳 sourcemap 後刪除。**後端 `@sentry/node` 尚未安裝**，隨 Phase 2 API 層 (`api/*`) 一併落地。**治理規則（2026-08-19 新增，見 `00_DECISION_LOG.md` §1／§3.1）**：任何「抓取失敗 → 退回 mock/展示假資料」的 `catch` 區塊，一律須同時呼叫 `captureExceptionSafe(err, { source, fallback })`，僅寫 `console.warn`／`console.error` 不視為合規（曾因此發生正式站長期靜默顯示假商品卻無告警的事故）。

### 1.2 技術層架構與技術棧規格 (Technical Layer & Stack Architecture)

#### 1. 前端視圖與互動層 (Frontend View & Interactive Layer — Phase 1 Core)
- **核心框架**：React 19 (`react` / `react-dom`) + TypeScript 5.8
- **建置與打包**：Vite 7.3 (`@vitejs/plugin-react-swc`)
- **路由管理**：React Router DOM v7 (`react-router-dom`)
- **樣式與 UI 系統**：Vanilla CSS / Tailwind CSS v3 (`tailwindcss` + `autoprefixer` + `postcss`)
- **微動畫體驗**：Framer Motion 12 (`framer-motion`)
- **多國語言 (i18n)**：`i18next` + `react-i18next` + `i18next-browser-languagedetector`
- **前端異常防護**：分層 Error Boundary (`ErrorBoundary.tsx` / `CheckoutErrorFallback.tsx`) 已落地；`@sentry/react` 上報**已接線**並掛載脫敏 Hook（`src/main.tsx`）

#### 2. 後端中樞 API 層 (Backend Serverless API Layer)
- **執行環境**：Vercel Serverless Functions (Node.js ES Modules, `type: module`)
- **現行 API 路由（結帳已改回 Shopify Checkout，見 00_DECISION_LOG §3.3）**：`api/create-shopify-cart.ts`（建立 Shopify Cart 並回傳 `checkoutUrl`，取代已廢棄之 `api/checkout.ts` 自建交易中樞）、`api/webhooks/shopify.ts`（訂單簽章 Webhook 投影至 `orders`／`order_items`）、`api/invoice/guangmao.ts`（光貿發票 Outbox Worker）
- **已廢棄，2026-08-23 起已從 repo 實際刪除（僅存於 Git 歷史）**：`api/checkout.ts`、`api/checkout/confirm.ts`、`api/checkout/status.ts`、`api/cron/reconcile.ts`（原自建 TapPay Direct Pay + `transaction_logs` 交易狀態機中樞）；`src/pages/_deprecated_checkout/` 前端整包同步刪除。
- **共用函式庫**：`api/_lib/security.ts`（Origin/Hash/timing-safe 工具，現行 `api/create-shopify-cart.ts` 仍在用）、`api/_lib/supabase-admin.ts`（發票 Outbox RPC 與 site_settings 查詢）；原僅服務於已廢棄自建結帳中樞的 `api/_lib/tappay.ts`、`api/_lib/shopify-admin.ts`、`api/_lib/ratelimit.ts` 已於 2026-08-23 一併刪除
- **核心防禦機制**：
  - **HMAC 驗證**：Shopify Webhook SHA256 數位簽名檢查（raw body + `timingSafeEqual`；密鑰缺失 Fail-Closed）
  - **全站維護模式防護**：`api/create-shopify-cart.ts` 已整合 `site_settings.maintenance_mode` 檢查，全站維護時回傳 503（見 00_DECISION_LOG §3.3）。原規劃之 `checkout_release_enabled` 上線閘門因無 UI/無預設值、且邏輯方向與 Fail-Closed 原則相反，已於 2026-08-23 判定形同虛設並直接移除，不再作為現行防護機制之一
  - **個資/卡號脫敏**：SAENGAK 前端與後端皆不經手完整卡號，TapPay 於 Shopify Checkout 頁面內獨立處理

#### 3. 資料庫與狀態機持久層 (Database & Persistence Layer)
- **資料庫**：Supabase PostgreSQL 15 (正式專屬 Reference `tmqzkagkrzhioftvwbqo`)
- **個資防禦隔離**：全資料表啟用 Row Level Security (RLS)，強制以 `auth.uid()` 為存取邊界
- **訂單投影**：`orders`／`order_items` 由 Shopify 簽章 Webhook 投影寫入，為會員與後台唯讀查詢之資料來源；`transaction_logs` 有限狀態機 (migration `20260820000001`) 屬已廢棄自建結帳中樞之殘留，未部署至現行流程

#### 4. 第三方服務整合層 (External Integration Layer)
- **實體庫存與 ERP**：SiteGiant ERP (透過 Shopify App 與 Shopify 後台保持自動同步)
- **商品型錄與即時可售**：**全面純前端直連 Shopify Storefront GraphQL API**（採用官方 `@shopify/storefront-api-client` SDK，零後端中介、純前端安全公開憑證模式，涵蓋商品目錄、分類 Collections、標籤 Tags、規格 Variants、即時庫存與部落格文章 Articles）
- **超商物流**：Shopify 內建 ShipAny App (7-11 / 全家便利商店電子地圖選店與托運單；自建 API 備用)
- **金流串接**：TapPay Shopify Payment App，於 Shopify Checkout 頁面內完成授權扣款；原 TapPay Direct Pay SDK (Pay-by-Prime + 3DS Callback) 前端整合已廢棄
- **電子發票 (第 2 階段)**：光貿電子發票 API (自動開立、作廢與折讓)

#### 5. 部署與 DevOps 基建層 (Deployment & Infrastructure Layer)
- **部署平台**：Vercel (`saengak-web-d2ux`)，配置全域安全標頭（`vercel.json`：CSP、COOP、Permissions-Policy、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、**HSTS 均已就位**）
- **代碼智庫與關係圖譜**：CodeGraph CLI (`.codegraph/` 索引與符號依賴分析)
- **原始碼資安防護（已落地）**：`vite.config.ts` 使用 `build.sourcemap: 'hidden'` 搭配 `@sentry/vite-plugin` 自動上傳並刪除實體 `.map` 檔。

#### 6. CSP 網域放行對照表 (CSP Allowlist by Integration)

CSP 為預設拒絕；每接入一個外部服務，必須依下表更新 `vercel.json`，**並同步更新 `scripts/production-surface-lib.mjs` 之 `REQUIRED_CSP_DIRECTIVES`** 使 `npm test` 與 `npm run verify:production` 能強制驗證，才可標記為「已放行」。**禁止以放寬萬用字元的方式便宜行事，亦禁止僅修改本表文字而不同步更新自動化驗證。**

> ⚠️ **治理決策 (2026-08-19，詳見 [`00_DECISION_LOG.md` §3.1](00_DECISION_LOG.md#31-csp-允許清單回歸事故與強制驗證決策-2026-08-19))**：`vercel.json` 一度遺漏 Shopify 與 Sentry 網域，導致正式站前端請求被瀏覽器 CSP 封鎖後靜默退回展示假資料，且規格書當時仍標記「已放行」。事故起因是自動化測試未涵蓋這些網域，才使規格宣稱與實際部署脫鉤。本表所有「已放行」標記現已對應 `REQUIRED_CSP_DIRECTIVES` 之強制斷言，非僅文字宣告。

| 整合服務 | 階段 | 需放行的 CSP 指令 |
| --- | --- | --- |
| Supabase (`tmqzkagkrzhioftvwbqo`) | Phase 1 | `connect-src https://tmqzkagkrzhioftvwbqo.supabase.co wss://tmqzkagkrzhioftvwbqo.supabase.co`（建議由 `*.supabase.co` 收斂為專案專屬網域，防止誤連他人專案） |
| Shopify Storefront API | Phase 1 | `connect-src https://gh2xgs-zf.myshopify.com`（**已放行，並已列入 `REQUIRED_CSP_DIRECTIVES` 強制驗證**） |
| Sentry 事件上報 | Phase 1（已接線） | `connect-src https://*.ingest.sentry.io https://*.ingest.us.sentry.io`（**已放行，並已列入 `REQUIRED_CSP_DIRECTIVES` 強制驗證**） |
| Remix Icon 圖示庫 (`index.html` CDN) | Phase 1 | `style-src`／`font-src https://cdn.jsdelivr.net`（**已放行，並已列入 `REQUIRED_CSP_DIRECTIVES` 強制驗證**；`cdnjs.cloudflare.com` 為早期殘留放行、目前程式碼未實際引用，保留不影響安全性） |
| TapPay SDK 網域 | 現行於 `vercel.json` | `script-src`／`frame-src https://js.tappaysdk.com`、`connect-src`／`frame-src https://sand-pay.tappaysdk.com https://pay.tappaysdk.com`（**已放行，並已列入 `REQUIRED_CSP_DIRECTIVES` 強制驗證**）。⚠️ 2026-08-21 結帳改回 Shopify Checkout 後，TapPay 已改為 Shopify Payment App、於 Shopify 網域內運作，本專案網域是否仍需放行這些指令待重新確認，本表暫不逕自移除 |
| Cloudflare Turnstile (CAPTCHA) | Phase 2 | `script-src`／`frame-src`／`connect-src https://challenges.cloudflare.com`（**已放行，並已列入 `REQUIRED_CSP_DIRECTIVES` 強制驗證，2026-08-20**） |
| ShipAny 門市地圖（若前端嵌入） | Phase 2 | 依屆時官方文件另訂，並回填本表 |


## 2. 核心系統架構與資料流圖

```mermaid
flowchart TD
    subgraph ERP與庫存同步
        SG["SiteGiant ERP (實體庫存主檔)"] <-->|Shopify 官方 App 雙向同步| SP["Shopify Admin (商品與庫存門戶)"]
    end

    subgraph 前端視圖 (SAENGAK React App - Phase 1)
        UI["SAENGAK 前端 (React / Vite)"] -->|GraphQL 查詢商品與即時庫存| SF["Shopify Storefront API"]
        SF -->|回傳商品型錄、規格、價格與 availableForSale| UI
    end

    subgraph 結帳與交易流程 (Phase 2 現行規格 - Shopify Checkout)
        UI -.->|1. 顧客提交購物車| VC["Vercel API (api/create-shopify-cart)"]
        VC -.->|2. 建立 Cart 取得 checkoutUrl| SP
        VC -.->|3. 導向| SC["Shopify Checkout"]
        SC -.->|4. 頁內授權扣款| TP["TapPay Shopify Payment App"]
        SC -.->|5. 開立發票| GM["光貿電子發票 API"]
        SP -.->|6. 簽章 Webhook 回寫| SB["Supabase (orders / order_items 投影)"]
    end

    subgraph 物流履行 (Logistics Fulfillment)
        SP -->|訂單履行與托運單| SA["Shopify 內建 ShipAny App"]
        SA -->|超商門市/宅配配送| CUST["顧客收到包裹"]
    end
```

## 3. 子規格書索引 (Sub-Specifications)

0. **[決策狀態總表](00_DECISION_LOG.md)**：最高權威，記錄所有架構定案與開放項目。
1. **[TapPay × Shopify 串接基線](TAPPAY_SHOPIFY.md)**：現行結帳流程權威文件——跳轉 Shopify Checkout、TapPay Shopify Payment App、`create-shopify-cart` 串接與管理端設定清單。
1a. **[結帳與交易安全性規格書](CHECKOUT_PAYMENT_SPEC.md)** ⚠️ **已廢棄**：描述已於 2026-08-21 廢棄之自建 Checkout、TapPay Direct Pay SDK、Transaction_Logs 狀態機，僅供歷史參考。
2. **[Vercel Serverless 遷移規格書](VERCEL_MIGRATION_SPEC.md)**：API 路由設計、HMAC 驗證、Edge Functions 下線計畫、Cache-Control 與 Rate Limit。
3. **[物流與發票整合規格書](LOGISTICS_INVOICE.md)**：Shopify ShipAny App 物流（自建 API 備用）與光貿發票自動化開立。
4. **[Supabase 資料庫部署與 RLS](SUPABASE_DEPLOYMENT.md)**：會員資料隔離與各項投影資料表存取控制。
5. **[上線切換清單](LAUNCH_CHECKLIST.md)**：測試閘門移除、SEO 解封、安全標頭定版、硬編碼清理與監控接線之上線當日權威清單。

## 4. 階段開發計畫與驗收標準 (Phase Roadmap)

### 4.1 第 1 階段：商品展示與部署上線 (Phase 1 — 當前聚焦與就緒)
- [x] **商品展示與型錄瀏覽**：
  - 首頁 Hero、精選系列、商品列表頁 (`/products`)、商品詳情頁 (`/products/:id`)。
  - 商品規格選擇器 (Color/Size Variants)、即時庫存售罄提示、圖片縮圖與圖庫輪播。
- [x] **使用者體驗與基礎設施**：
  - 完整多國語言切換 (`i18n` 支援繁中/英文)。
  - 響應式排版 (Mobile/Desktop 雙端最佳化) 與 Framer Motion 轉場動效。
  - Error Boundary 容錯降級（`ErrorBoundary.tsx` / `CheckoutErrorFallback.tsx`）。
- [x] **部署與建置驗證**：
  - Vite Production Bundle 編譯零錯誤。
  - `vercel.json` 安全標頭（CSP、COOP、Permissions-Policy 等）與 SPA 重定向路由。
  - 單元與整合測試通過。
- [x] **Phase 1 內部預覽部署就緒**：
  - Sentry 前端監控接線（SDK 安裝、初始化、脫敏 Hook 掛載、sourcemap 流程）已完成。
  - `vercel.json` 補 HSTS；CSP 放行 Shopify Storefront 與 Sentry 網域已完成。
  - 移除硬編碼之非授權 Supabase 與 Shopify URL 已完成。
- [ ] **Phase 1 最終對外公開 (Cutover) 待辦（詳見 `LAUNCH_CHECKLIST.md`）**：
  - 移除 TestAccessGate (`middleware.js`)、測試環境變數與測試登入 API（註：目前機制為本地開發端 localhost 直通，僅發布至雲端的環境需要測試者帳密閘門）。
  - 解封 SEO：移除 `X-Robots-Tag: noindex`。

### 4.2 第 2 階段：Shopify Checkout 結帳與金物流串接 (Phase 2)

> 2026-08-21 結帳架構第三次變動，改回跳轉 Shopify Checkout（詳見 `00_DECISION_LOG.md` §3.3）。原自建結帳中樞（`api/checkout.ts` 與 `transaction_logs` 狀態機等）之開發紀錄已移至下方「已廢棄」段落，不再列為本階段進行中工作。

- [x] **Shopify Checkout 結帳流程 (`api/create-shopify-cart.ts`)**
  - 購物車側邊欄收集發票偏好，呼叫 Vercel API 建立 Shopify Cart 並取得 `checkoutUrl`，導向 Shopify Checkout；TapPay 以 Shopify Payment App 身分於該頁完成授權扣款。
  - Origin 檢查、cart line 驗證、已登入會員 `cart_token -> user_id` 綁定（`shopify_checkout_links` 表）。
  - ⚠️ `CheckoutReleaseEnabled` 總開關檢查現況未確認，見 `00_DECISION_LOG.md` §3.3 已知風險。
- [x] **訂單投影 (`api/webhooks/shopify.ts`)**：Shopify 訂單簽章 Webhook 驗證後投影至 Supabase `orders`／`order_items`，供會員與後台唯讀查詢。
- [x] **光貿電子發票 Outbox Worker 程式碼 (`api/invoice/guangmao.ts`)**
  - 經 `public.enqueue_amego_invoice_job` RPC 寫入 `private.amego_invoice_jobs`（migration `20260820000003`），Worker 認領派送並回讀 `invoice_status=99` 投影 `order_invoices`。
- [x] **營運後台 (`/admin/*`)**：路由已接上 `AdminGuard`／`AdminLayout`，並完成 Dashboard、商品、訂單、系統參數 (`site_settings`)、前台會員管理 (`/admin/members`) 以及後台管理員管理 (`/admin/admins`) 模塊，已於第 1 層導覽列明確分流。Supabase RLS 已補齊 admin 對 `orders`／`order_items`／`order_invoices` 之唯讀權限、`site_settings` 之讀寫權限，以及 `profiles` 之管理權限。
- [ ] **部署與環境配置**：Vercel 環境變數/Secrets（TapPay Shopify 商家設定、`SHOPIFY_WEBHOOK_SECRET`、`AmegoDispatchToken`）、`npm run test:db` 對真實 Postgres 驗證。
- [ ] **Shopify 訂單與 ShipAny 物流 App 串接**
  - 結帳後自動建立 Shopify 訂單，觸發 ShipAny App 進行門市取貨標籤印製。
- [ ] **後端 `@sentry/node` 監控接線**（Serverless API 層異常上報）。
- [ ] **端到端商業驗收 (`verify:commerce`)**：TapPay 沙盒實單 success／failed／cancelled 三案例跨系統一致性。

#### 已廢棄（2026-08-21 起不得部署，僅存於 Git 歷史）

- ~~自建結帳中樞程式碼 (`api/checkout.ts`、`api/checkout/confirm.ts`、`api/checkout/status.ts`、`api/cron/reconcile.ts` 與 `api/_lib/{tappay,shopify-admin,ratelimit}.ts`)~~
- ~~Idempotency Key 冪等性去重與 Supabase `transaction_logs` 交易狀態機（migration `20260820000001`）~~
- ~~TapPay Prime 前端 Direct Pay SDK 整合、3DS callback 頁面、對帳補償排程~~

## 5. 系統資安防護與信任邊界規範 (Security Invariants)

本節收錄自全站統一的安全通報與防護政策，作為前後台與 API 開發的強制性防禦準則。漏洞通報流程請參閱同目錄下的 [`SECURITY.md`](SECURITY.md)。

### 5.1 威脅模型與信任邊界 (Threat Model and Trust Boundaries)
- **不可信輸入**：公開瀏覽器、公開 API body/header/route/query 與 deployment configuration 都視為不可信輸入。
- **公鑰限制**：Supabase public/publishable key 並非 secret，**絕對不可**單獨授權任何敏感的資料庫 mutation（必須配合 RLS 與 Auth Token）。
- **Webhook 驗證**：Shopify / TapPay webhook 必須在原始 body HMAC 簽名、shop domain、topic 及 payload 一致性全部通過後，才可視為可信。
- **機密零落地**：Service-role、Shopify Admin token、Webhook secret 與 TapPay server credential 只能存在於受控的伺服器端環境變數 (Server-side Secrets) 中，**嚴禁進入前端 Bundle**。
- **多權威系統對帳**：Shopify、TapPay、Supabase、物流及發票為不同的權威系統；前端的 `localStorage`、成功跳轉頁、Email、toast 或文件聲明**皆不代表交易真相**，一切以伺服器端驗證與回讀為準。

### 5.2 安全不變量 (Security Invariants)
任何開發與架構更動，必須維持下列防護性質：
1. **預設封閉 (Fail-Closed)**：上線前或發生未預期錯誤時，結帳與狀態變更應直接拒絕；`CheckoutReleaseEnabled` 未精確設為 `true` 時不得建立交易。
2. **後端強制驗證**：敏感資料的修改 (Mutation) 必須在可信後端 (Vercel API / Supabase) 完成授權，絕對不依賴 UI 隱藏按鈕或前端的 client-side gate 來防堵。
3. **輸入防禦**：所有外部輸入必須有嚴格的格式、長度、數量與資源消耗上限（Rate Limiting）。
4. **URL 與跳轉防護**：使用者可點擊的 URL 必須限制為可接受的公開 HTTPS 目的地；Checkout 必須固定跳轉至受控網域。
5. **Webhook 防護**：必須具備驗簽、Idempotency 去重機制，並防止舊狀態覆蓋新狀態 (Race Condition 防禦)。
6. **個資邊界 (RLS)**：Supabase Row Level Security 必須確保會員只能讀寫自己的資料，後台與參數操作必須透過權限標記 (`role: 'admin'`) 進行驗證。
7. **機密防外洩**：原始碼、Build Assets、Sentry 日誌 (Logs) 與測試證據中，嚴禁包含 Secrets、個資或真實的付款卡號。
