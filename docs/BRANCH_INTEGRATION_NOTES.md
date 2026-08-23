# 分支整合與衝突風險備註 (Branch Integration & Conflict Notes)

> **更新日期**：2026-08-23（全面對齊 `00_DECISION_LOG.md` §3.3 最新架構與 Selective Sync 現況）  
> **最高責任原則**：**嚴禁直接將歷史分支 `origin/codex/saengak-recovery-security-review-20260813` (Commit `bac0bd8`) 合併 (Merge/Rebase) 至 `main`**

---

## 1. 背景與分支衝突深度評估

### 1.1 相關分支對照
- **目標生產分支 (`main`)**：
  - 承載 Phase 1 完整官方 Shopify Storefront SDK 純前端直連模式、多語系支援、安全脫敏與 ErrorBoundary 穩定性。
  - 承載 2026-08-21 結帳架構第三次變動（Shopify Checkout 跳轉 + TapPay Shopify Payment App + Vercel Serverless `create-shopify-cart`）。
  - 承載 Sentry 可觀測性監控與 CSP/HSTS 自動化雙重驗證。
- **審查分支 (`origin/codex/saengak-recovery-security-review-20260813`)**：
  - Commit 基準：`bac0bd8`。
  - 本質為安全審查與後端發票/資料庫修復實驗分支，但前端夾帶早期未完善的精簡骨架程式碼。

### 1.2 模擬合併致命衝突評估 (Merge Collision Audit ⚠️)
在隔離環境進行 `git merge` 模擬測試時，該分支與 `main` 產生 **超過 35 個檔案之致命衝突 (Merge Conflicts)**：
- **受衝擊核心前端**：
  - `src/pages/product/page.tsx`
  - `src/pages/home/page.tsx`
  - `src/pages/search/page.tsx`
  - `src/components/feature/Header.tsx`
  - `src/components/feature/Footer.tsx`
  - `src/lib/shopify.ts` 與各頁面 Section 元件。
- **衝突主因與破壞性**：
  該分支的前端採用早期精簡骨架版代碼。若直接合併，將會徹底覆蓋並破壞目前已修復的商品即時展示、變體價格計算、粘性滾動、錯誤邊界防護與已完成之 SEO / CDN 整合。

---

## 2. 處置與移植矩陣 (Selective Sync Matrix)

為確保前端穩定性不受破壞，並完整保留後端修復與資料庫遷移成果，本專案採取 **「單向挑選移植 (Selective Sync)」** 策略。

### 2.1 ✅ 已安全移植並對齊至 `main` 之項目

| 領域 | 項目 / 檔案 | 狀態與說明 |
| --- | --- | --- |
| **電子發票微服務 (Phase 2)** | `supabase/functions/amego-invoice-dispatch/index.ts`<br>`supabase/functions/amego-invoice-dispatch/amego.ts` & `.test.ts`<br>`supabase/functions/amego-invoice-dispatch/allowance.ts` & `.test.ts` | 已完成。光貿 (Amego) 發票派送與折讓微服務已完整納入。 |
| **資料庫 Migration 腳本** | `supabase/migrations/20260813045204_add_amego_invoice_outbox.sql`<br>`supabase/migrations/20260813070648_add_amego_allowance_lifecycle.sql`<br>`supabase/migrations/20260820000003_amego_invoice_rpc.sql` | 已完成。發票 Outbox 表、折讓生命週期與 `public.enqueue_amego_invoice_job` RPC 皆已建置。 |
| **架構與部署文檔** | `docs/SUPABASE_DEPLOYMENT.md`<br>`docs/TAPPAY_SHOPIFY.md`<br>`docs/SECRET_HANDOFF_GUIDE.md` | 已完成。已根據 2026-08-21 決策全面更新為 Shopify Checkout 與 TapPay Payment App 規格。 |
| **後端 Serverless 整合** | `api/create-shopify-cart.ts`<br>`api/invoice/guangmao.ts` | 已完成。依據 VERCEL_MIGRATION_SPEC 遷移至 Vercel，且通過 Fail-Closed 密鑰防護測試。`api/_lib/ratelimit.ts` 從未被這兩支現行端點使用，僅服務於已於 2026-08-23 刪除之舊結帳中樞，已一併移出此表（見下方 2.2）。 |

### 2.2 🚫 嚴格隔離禁區 (Strictly Isolated Area)

- **前端展示與互動層**：
  任何 `src/pages/*`、`src/components/*`、`src/lib/*` **完全以 `main` 分支最新實作為唯一事實基準**，嚴禁由該歷史分支進行任何覆蓋或混洗。
- **廢棄自建結帳中樞 (Option B)**：
  原自建 `api/checkout.ts`、TapPay Direct Pay SDK 流程已依 2026-08-21 決策全面廢棄，並於 **2026-08-23 從 repo 實際刪除**（含 `api/checkout/confirm.ts`、`api/checkout/status.ts`、`api/cron/reconcile.ts`、專屬支援函式庫 `api/_lib/{tappay,shopify-admin,ratelimit}.ts` 與前端 `src/pages/_deprecated_checkout/`）。不得因該分支的歷史代碼而重新啟用，亦不得從該分支 cherry-pick 這批已刪除的檔案。

---

## 3. 架構對齊與防護鐵則 (Architecture Guardrails)

所有開發者與 AI Agent 在處理分支、PR 或程式碼更新時，必須遵守以下鐵則：

1. **查閱最高權威**：所有邏輯必須對齊 [`docs/00_DECISION_LOG.md`](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md)。
2. **密鑰 Fail-Closed 防護**：任何安全端點（Webhook HMAC、CRON Bearer Token）在環境變數缺失時必須嚴格拒絕請求（403/500），嚴禁 Fail-Open。
3. **可觀測性保證**：任何 catch 區塊退回 fallback/mock 資料時，必須呼叫 `src/lib/sentry.ts` 之 `captureExceptionSafe(err, { source, fallback })`。
4. **CSP 唯一事實來源**：`vercel.json` 為 CSP 唯一來源，變更必須同步更新 `scripts/production-surface-lib.mjs` 並通過 `npm test`。

---

## 4. 自動化驗證矩陣 (Verification Matrix)

在任何變更提交前，必須在本機驗證以下測試套件：

| 驗證項目 | 執行指令 | 預期結果 |
| --- | --- | --- |
| **單元與整合測試** | `npm test` | 全數通過 (0 失敗)；確切檔案/測試數量隨程式碼演進變動，以當次執行結果為準，不可依賴此處寫死的數字 |
| **型別安全檢查** | `npm run typecheck` | TypeScript 零錯誤 (`tsc --noEmit`) |
| **前端打包編譯** | `npm run build` | Vite 生產構建成功無遺漏 |
| **生產環境表面驗證** | `npm run verify:production` | CSP / HSTS / 安全標頭全數合規 |

---

## 5. 分支生命週期維護指引

1. **封存與標記**：建議對 `origin/codex/saengak-recovery-security-review-20260813` 建立標籤 `archive/codex-security-review-20260813` 後封存，避免團隊成員誤合。
2. **獨立 Cherry-Pick**：未來若需檢索該歷史分支之特定後端工具函式，必須以單一 commit 形式 cherry-pick，並嚴格排除任何 `src/` 目錄變更。
