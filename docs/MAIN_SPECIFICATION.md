# SAENGAK 正式主要規格書 (Main Specification)

> 版本日期：2026-08-17 (架構簡化與階段聚焦修訂)
> 專案網域：`https://saengak.com.tw`
> 專案狀態：**第 1 階段商品展示完成並朝向 Vercel 部署上線推進；第 2 階段結帳金物流規格保留待續**
> 權威索引：本文件與各子規格衝突時，以 `00_DECISION_LOG.md` 為最高權威。

## 1. 專案背景與架構策略目標

本專案採用現代化無頭式電商 (Headless Commerce) 架構：
- **前端視圖層**：基於 React 19 + Vite 7 + Tailwind CSS / Vanilla CSS，提供極致流暢之商品目錄、規格切換、多語系與響應式體驗。
- **商品與即時庫存門戶**：Shopify Storefront API（由 SiteGiant ERP 透過 Shopify 官方應用程式進行後台雙向庫存同步，消解前端/Serverless 直連 ERP 的 2PC 分散式交易負擔）。
- **物流履約**：Shopify 內建之 ShipAny 應用程式進行超商選店與配送履行（自建物流 API 列為備用）。
- **階段策略**：
  - **第 1 階段 (當前聚焦)**：高質感商品展示 (Catalog & Product Details)、多語系切換、SEO 結構化標記與 Vercel 部署上線。
  - **第 2 階段 (後續推進)**：自建 React 結帳頁面 (Option B)、TapPay Direct Pay 線上刷卡、光貿電子發票與交易狀態機。

### 1.1 系統與商店識別
- **前端與 API 部署**：Vercel (`saengak-web-d2ux`)
- **資料庫 (投影)**：Supabase (`tmqzkagkrzhioftvwbqo`)
- **訂單與商品引擎**：Shopify (`gh2xgs-zf.myshopify.com`)
- **ERP 與實體庫存權威**：SiteGiant (透過 Shopify App 與 Shopify 同步)
- **金流服務 (第 2 階段)**：TapPay (Direct Pay SDK)
- **物流服務**：ShipAny (Shopify App 整合，自建 API 備用)
- **電子發票 (第 2 階段)**：光貿電子發票
- **異常監控**：Sentry — **前端已接線**：`@sentry/react` 已安裝並於 `src/main.tsx` 初始化，掛載 `src/lib/sentry.ts` 之 `sanitizeEvent`/`sanitizeBreadcrumb` 脫敏 Hook，`vite.config.ts` 已配置 `@sentry/vite-plugin` 上傳 sourcemap 後刪除。**後端 `@sentry/node` 尚未安裝**，隨 Phase 2 API 層 (`api/*`) 一併落地。

### 1.2 技術層架構與技術棧規格 (Technical Layer & Stack Architecture)

#### 1. 前端視圖與互動層 (Frontend View & Interactive Layer — Phase 1 Core)
- **核心框架**：React 19 (`react` / `react-dom`) + TypeScript 5.8
- **建置與打包**：Vite 7.3 (`@vitejs/plugin-react-swc`)
- **路由管理**：React Router DOM v7 (`react-router-dom`)
- **樣式與 UI 系統**：Vanilla CSS / Tailwind CSS v3 (`tailwindcss` + `autoprefixer` + `postcss`)
- **微動畫體驗**：Framer Motion 12 (`framer-motion`)
- **多國語言 (i18n)**：`i18next` + `react-i18next` + `i18next-browser-languagedetector`
- **前端異常防護**：分層 Error Boundary (`ErrorBoundary.tsx` / `CheckoutErrorFallback.tsx`) 已落地；`@sentry/react` 上報**已接線**並掛載脫敏 Hook（`src/main.tsx`）

#### 2. 後端中樞 API 層 (Backend Serverless API Layer — Phase 2)
- **執行環境**：Vercel Serverless Functions (Node.js ES Modules, `type: module`)
- **API 路由結構**：專案根目錄 `api/*.ts`（如 `api/checkout.ts`, `api/webhooks/shopify.ts`）
- **伺服器端套件**：`@vercel/functions`
- **核心防禦機制**：
  - **HMAC 驗證**：Shopify / 金物流 Webhook SHA256 數位簽名檢查
  - **冪等性 (Idempotency)**：`Idempotency-Key` (UUID v4) 防重複提交與連點
  - **個資/卡號脫敏**：`@sentry/node` 洗淨器強制過濾 Prime 碼、卡號與金鑰 Secrets

#### 3. 資料庫與狀態機持久層 (Database & Persistence Layer)
- **資料庫**：Supabase PostgreSQL 15 (正式專屬 Reference `tmqzkagkrzhioftvwbqo`)
- **個資防禦隔離**：全資料表啟用 Row Level Security (RLS)，強制以 `auth.uid()` 為存取邊界
- **交易狀態機 (第 2 階段)**：`transaction_logs` 有限狀態機 (`INITIATED` → `PAYMENT_CAPTURED` → `ORDER_CREATED` → `INVOICE_ISSUED` → `COMPLETED`)

#### 4. 第三方服務整合層 (External Integration Layer)
- **實體庫存與 ERP**：SiteGiant ERP (透過 Shopify App 與 Shopify 後台保持自動同步)
- **商品型錄與即時可售**：**全面純前端直連 Shopify Storefront GraphQL API**（採用官方 `@shopify/storefront-api-client` SDK，零後端中介、純前端安全公開憑證模式，涵蓋商品目錄、分類 Collections、標籤 Tags、規格 Variants、即時庫存與部落格文章 Articles）
- **超商物流**：Shopify 內建 ShipAny App (7-11 / 全家便利商店電子地圖選店與托運單；自建 API 備用)
- **金流串接 (第 2 階段)**：TapPay Direct Pay SDK (Pay-by-Prime 零卡號落地 + 3DS Callback)
- **電子發票 (第 2 階段)**：光貿電子發票 API (自動開立、作廢與折讓)

#### 5. 部署與 DevOps 基建層 (Deployment & Infrastructure Layer)
- **部署平台**：Vercel (`saengak-web-d2ux`)，配置全域安全標頭（`vercel.json`：CSP、COOP、Permissions-Policy、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、**HSTS 均已就位**）
- **代碼智庫與關係圖譜**：CodeGraph CLI (`.codegraph/` 索引與符號依賴分析)
- **原始碼資安防護（已落地）**：`vite.config.ts` 使用 `build.sourcemap: 'hidden'` 搭配 `@sentry/vite-plugin` 自動上傳並刪除實體 `.map` 檔。

#### 6. CSP 網域放行對照表 (CSP Allowlist by Integration)

CSP 為預設拒絕；每接入一個外部服務，必須依下表更新 `vercel.json` 並重新驗收。**禁止以放寬萬用字元的方式便宜行事。**

| 整合服務 | 階段 | 需放行的 CSP 指令 |
| --- | --- | --- |
| Supabase (`tmqzkagkrzhioftvwbqo`) | Phase 1 | `connect-src https://tmqzkagkrzhioftvwbqo.supabase.co wss://tmqzkagkrzhioftvwbqo.supabase.co`（建議由 `*.supabase.co` 收斂為專案專屬網域，防止誤連他人專案） |
| Shopify Storefront API | Phase 1 | `connect-src https://gh2xgs-zf.myshopify.com`（**已放行**） |
| Sentry 事件上報 | Phase 1（已接線） | `connect-src https://*.ingest.sentry.io https://*.ingest.us.sentry.io`（**已放行**） |
| TapPay Direct Pay SDK | Phase 2 | `script-src https://js.tappaysdk.com`、`frame-src https://js.tappaysdk.com`、`connect-src`（依 TapPay 官方文件之 sandbox/prod 網域）；3DS 為整頁跳轉不需 `frame-src` 放行銀行網域 |
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

    subgraph 結帳與交易流程 (Phase 2 保留規格)
        UI -.->|1. 顧客提交結帳與 Prime| VC["Vercel Serverless API (api/checkout)"]
        VC -.->|2. 授權扣款| TP["TapPay Direct Pay SDK"]
        VC -.->|3. 建立訂單| SP
        VC -.->|4. 開立發票| GM["光貿電子發票 API"]
        VC -.->|5. 交易狀態記錄| SB["Supabase (Transaction Logs)"]
    end

    subgraph 物流履行 (Logistics Fulfillment)
        SP -->|訂單履行與托運單| SA["Shopify 內建 ShipAny App"]
        SA -->|超商門市/宅配配送| CUST["顧客收到包裹"]
    end
```

## 3. 子規格書索引 (Sub-Specifications)

0. **[決策狀態總表](00_DECISION_LOG.md)**：最高權威，記錄所有架構定案與開放項目。
1. **[結帳與交易安全性規格書](CHECKOUT_PAYMENT_SPEC.md)**：自建 Checkout、TapPay SDK、Shopify App 庫存聯動、Transaction_Logs 狀態機 (Phase 2)。
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
  - 移除 TestAccessGate (`middleware.js`)、測試環境變數與測試登入 API。
  - 解封 SEO：移除 `X-Robots-Tag: noindex`。

### 4.2 第 2 階段：自建結帳與金物流串接 (Phase 2 — 規格保留待續)
- [ ] **自建結帳中樞 (`api/checkout.ts`)**
  - Idempotency Key 冪等性去重與 Supabase `transaction_logs` 交易狀態機。
  - TapPay Prime 傳入、3DS callback 頁面 (`/checkout/3ds-callback`) 與後端授權扣款。
- [ ] **Shopify 訂單與 ShipAny 物流 App 串接**
  - 結帳後自動建立 Shopify 訂單，觸發 ShipAny App 進行門市取貨標籤印製。
- [ ] **光貿電子發票自動開立**
  - 光貿電子發票 API 自動開立/作廢/折讓與 Supabase `order_invoices` 投影回讀。
- [ ] **端到端商業驗收 (`verify:commerce`)**


