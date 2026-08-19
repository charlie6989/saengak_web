# 分支整合與衝突風險備註 (Branch Integration & Conflict Notes)

> 記錄日期：2026-08-18  
> 責任原則：**嚴禁直接合併 `origin/codex/saengak-recovery-security-review-20260813` 到 `main`**

---

## 1. 分支審查與衝突分析

### 相關分支
- **目標生產分支**：`main`（包含 Phase 1 完整前端、官方 Shopify Storefront SDK、多語系、安全脫敏與 ErrorBoundary 修復）。
- **審查分支**：`origin/codex/saengak-recovery-security-review-20260813`（Commit `bac0bd8`）。

### 衝突評估結果（嚴重衝突 ⚠️）
在隔離環境進行 `git merge` 模擬測試時，該分支與 `main` 產生 **超過 35 個檔案之致命衝突 (Merge Conflicts)**：
- **受衝擊核心前端**：`src/pages/product/page.tsx`、`src/pages/home/page.tsx`、`src/pages/search/page.tsx`、`src/components/feature/Header.tsx`、`src/components/feature/Footer.tsx` 等。
- **衝突主因**：該分支採用早期精簡骨架版的前端代碼，直接合併會徹底覆蓋並破壞目前已修復的商品展示、價格計算、粘性滾動與 ErrorBoundary 穩定性。

---

## 2. 處置與移植策略（Selective Sync 已完成）

為保護前端穩定性並保留後端成果，本專案採取 **「單向挑選移植 (Selective Sync)」**：

### ✅ 已移植至 `main` 之項目：
1. **後端電子發票微服務 (Phase 2)**：
   - `supabase/functions/amego-invoice-dispatch/index.ts`
   - `supabase/functions/amego-invoice-dispatch/amego.ts` & `.test.ts`
   - `supabase/functions/amego-invoice-dispatch/allowance.ts` & `.test.ts`
2. **資料庫 Migration 腳本**：
   - `supabase/migrations/20260813045204_add_amego_invoice_outbox.sql`
   - `supabase/migrations/20260813070648_add_amego_allowance_lifecycle.sql`
   - 以及所有前置會員與訂單同步 SQL。
3. **架構與部署文檔**：
   - `docs/SUPABASE_DEPLOYMENT.md`
   - `docs/TAPPAY_SHOPIFY.md`

### 🚫 嚴格隔離之項目：
- 任何 `src/pages/*` 與 `src/components/*` **完全維持 `main` 分支最新實作**，不得由該分支進行任何覆蓋。
