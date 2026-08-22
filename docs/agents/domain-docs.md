# Domain Documentation & Architecture Index (專案領域文件索引)

本文件完整涵蓋 `docs/` 下的所有規格書與 ADR 架構決策，供 AI Agent 開發、重構與 Code Review 時參考。

> [!IMPORTANT]
> **最高權威聲明**：所有開發作業必須以 [`00_DECISION_LOG.md`](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md) 為最高權威原則。若其他文件或註解與其衝突，以 `00_DECISION_LOG.md` 為準。

---

## 1. 核心規格書與權威日誌 (Authoritative Specifications)

* **[最高權威決策總表 (00_DECISION_LOG.md)](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md)**
  * **路徑**: `docs/00_DECISION_LOG.md`
  * **說明**: 規範定案架構（Phase 1 商品展示與部署聚焦、SiteGiant Shopify App 庫存雙向同步、ShipAny Shopify App 物流履行、Shopify Checkout 跳轉與 TapPay Shopify Payment App，見 §3.3 結帳架構第三次變動）。
* **[正式主要規格書 (MAIN_SPECIFICATION.md)](file:///c:/Projects/saengak_web/docs/MAIN_SPECIFICATION.md)**
  * **路徑**: `docs/MAIN_SPECIFICATION.md`
  * **說明**: 系統與商店識別、整體 Headless Commerce 數據流向與 Phase 1 / Phase 2 階段清單。
* **[現階段模塊與算法基線 (MODULES.md)](file:///c:/Projects/saengak_web/docs/MODULES.md)**
  * **路徑**: `docs/MODULES.md`
  * **說明**: 商品目錄、搜尋與篩選演算法、購物車/結帳、會員 Auth (Supabase)、物流/發票與內容守門規則。
* **[TapPay × Shopify 串接基線 (TAPPAY_SHOPIFY.md)](file:///c:/Projects/saengak_web/docs/TAPPAY_SHOPIFY.md)**
  * **路徑**: `docs/TAPPAY_SHOPIFY.md`
  * **說明**: 現行結帳流程權威文件——Shopify Checkout 跳轉、TapPay Shopify Payment App、`create-shopify-cart` 串接細節與管理端設定清單。
* **[結帳與交易安全性規格書 (CHECKOUT_PAYMENT_SPEC.md)](file:///c:/Projects/saengak_web/docs/CHECKOUT_PAYMENT_SPEC.md)** ⚠️ **已廢棄**
  * **路徑**: `docs/CHECKOUT_PAYMENT_SPEC.md`
  * **說明**: 描述已於 2026-08-21 廢棄之自建 Checkout、TapPay Direct Pay SDK、卡號零落地 PCI-DSS 規範與 `transaction_logs` 補償機制，僅供歷史參考，現行規範見 `TAPPAY_SHOPIFY.md`。
* **[物流與發票整合規格書 (LOGISTICS_INVOICE.md)](file:///c:/Projects/saengak_web/docs/LOGISTICS_INVOICE.md)**
  * **路徑**: `docs/LOGISTICS_INVOICE.md`
  * **說明**: Shopify ShipAny App 物流（自建 API 備用）與光貿電子發票自動化開立/作廢/折讓。
* **[Supabase 資料庫部署與 RLS (SUPABASE_DEPLOYMENT.md)](file:///c:/Projects/saengak_web/docs/SUPABASE_DEPLOYMENT.md)**
  * **路徑**: `docs/SUPABASE_DEPLOYMENT.md`
  * **說明**: Supabase 專案識別 (`tmqzkagkrzhioftvwbqo`)、投影資料表、會員 RLS 隔離與最小化個資原則。
* **[Vercel Serverless 遷移規格書 (VERCEL_MIGRATION_SPEC.md)](file:///c:/Projects/saengak_web/docs/VERCEL_MIGRATION_SPEC.md)**
  * **路徑**: `docs/VERCEL_MIGRATION_SPEC.md`
  * **說明**: API 路由規範（現行 `api/create-shopify-cart.ts`、`api/webhooks/shopify.ts`、`api/invoice/guangmao.ts`；`api/checkout.ts` 系列已廢棄）、HMAC 驗證與 Rate Limiting 策略。
* **[安全與威脅模型政策 (SECURITY.md)](file:///c:/Projects/saengak_web/docs/SECURITY.md)**
  * **路徑**: `docs/SECURITY.md`
  * **說明**: 規範全站統一的安全通報與防護政策，以及威脅模型與信任邊界規範。
* **[交接與金鑰管理指南 (SECRET_HANDOFF_GUIDE.md)](file:///c:/Projects/saengak_web/docs/SECRET_HANDOFF_GUIDE.md)**
  * **路徑**: `docs/SECRET_HANDOFF_GUIDE.md`
  * **說明**: 環境變數配置、Shopify API 憑證、TapPay Portal 密鑰、平台帳號安全基線與敏感資料交接規範。
* **[上線切換清單 (LAUNCH_CHECKLIST.md)](file:///c:/Projects/saengak_web/docs/LAUNCH_CHECKLIST.md)**
  * **路徑**: `docs/LAUNCH_CHECKLIST.md`
  * **說明**: 測試閘門移除、SEO 解封、CSP/HSTS 定版、硬編碼 URL 清理與 Sentry 接線之上線當日權威清單；任一項未完成不得宣稱正式上線。

---

## 2. 架構決策記錄 (Architecture Decision Records - ADRs)

* **[結帳頁面架構決策 (CHECKOUT_ARCHITECTURE_DECISION.md)](file:///c:/Projects/saengak_web/docs/decisions/CHECKOUT_ARCHITECTURE_DECISION.md)** ⚠️ **歷史紀錄，決策已被取代**
  * **路徑**: `docs/decisions/CHECKOUT_ARCHITECTURE_DECISION.md`
  * **決策**: 曾採「自建結帳頁面 (Option B)」，將商業邏輯與交易協同集中於 Vercel Serverless 中樞；此決策已於 2026-08-21 由負責人指示回歸 Shopify Checkout（見 `00_DECISION_LOG.md` §3.3），本文件保留原始論述作歷史脈絡紀錄。
* **[Vercel Serverless 轉移決策 (VERCEL_SERVERLESS_DECISION.md)](file:///c:/Projects/saengak_web/docs/decisions/VERCEL_SERVERLESS_DECISION.md)**
  * **路徑**: `docs/decisions/VERCEL_SERVERLESS_DECISION.md`
  * **決策**: 廢棄 Supabase Edge Functions，改由 Vercel Serverless API 統一處理 API 整合。

---

## 3. Agent 執行準則 (Agent Operating Guidelines)

1. **查閱最高權威**: 任何開發、修改或重構前，Agent 必須讀取 [`00_DECISION_LOG.md`](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md) 與目標子規格書。
2. **完整性與不降級**: 嚴禁抹去既有測試、回傳 Fake Data 或私自降低 RLS 資安門檻。
3. **安全規範**: 嚴禁在程式碼中硬編碼密鑰，全數金鑰必須通過環境變數注入與安全驗證。
