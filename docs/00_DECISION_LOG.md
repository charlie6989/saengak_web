# SAENGAK 決策狀態總表 (Authoritative Decision Log)

> 更新日期：2026-08-17 (架構簡化與階段聚焦修訂)
> 本表為所有規格書的最高權威。任一子文件與本表衝突時，以本表為準。

## 1. 已定案架構決策 (2026-08-17)

| 主題 | 定案 (ADOPTED) | 廢棄 (DEPRECATED) | 權威文件 |
| --- | --- | --- | --- |
| 階段策略 | **第 1 階段聚焦「商品展示與部署上線」**，結帳交易保留至第 2 階段 | 全流程一次性混雜上線 | MAIN_SPECIFICATION |
| 庫存權威與聯動 | **SiteGiant ERP 透過 Shopify App 聯動雙向同步**；Shopify 為前端即時庫存門戶 | Vercel API 直連 SiteGiant 進行 2PC (Reserve/Commit) 鎖定 | CHECKOUT_PAYMENT_SPEC |
| 物流模式 | **Shopify 內建 ShipAny App 進行門市選單與履約** (自建物流 API 列為備用) | 自建複雜門市選單 API 與履約狀態機 | LOGISTICS_INVOICE |
| 結帳方式 | 自建 React Checkout (Option B) [第 2 階段推進] | Shopify Checkout 跳轉 | CHECKOUT_PAYMENT_SPEC |
| 後端中樞 | Vercel Serverless API (`api/*`) | Supabase Edge Functions | VERCEL_MIGRATION_SPEC |
| 金流模式 | TapPay Direct Pay SDK (卡號零落地 Zero-Card-Storage) [第 2 階段推進] | TapPay Shopify Payment App / 後端卡號落地 | CHECKOUT_PAYMENT_SPEC |
| 付款方式 | 首版禁用 COD (僅支援 TapPay 線上刷卡) [第 2 階段] | 貨到付款 (COD) | CHECKOUT_PAYMENT_SPEC |
| 品牌文案常數 | 品牌資料集中於 `src/content/site.ts` | 散落於各頁面硬編碼 | MAIN_SPECIFICATION / site.ts |
| 電子發票 | 光貿電子發票 [第 2 階段推進] | Waaship 發票 | LOGISTICS_INVOICE |
| Storefront API 客戶端 | **全面純前端直連 Storefront GraphQL API** (官方 `@shopify/storefront-api-client` SDK，零中介、純前端安全公開憑證模式) | 經由 Supabase Edge Functions 中轉或自建原生 fetch 與私密憑證回退模式 | MAIN_SPECIFICATION / 00_DECISION_LOG |

## 2. 權威資料源 (Source of Truth) 對照

| 資料領域 | 權威系統 | 說明 |
| --- | --- | --- |
| 商品售價、規格、實體庫存 | **SiteGiant ERP** | 實體商品與庫存主檔，透過 SiteGiant Shopify App 與 Shopify 自動雙向同步 |
| 前端商品目錄與即時可售量 | **Shopify Storefront** | 前端讀取商品、分類 (Collections)、規格 (Variants) 與即時 `availableForSale` 之直接門戶 |
| 訂單主檔 (第 2 階段) | **Shopify Order** | 訂單主檔；由結帳流程建立後回讀並同步至 SiteGiant ERP |
| 付款結果 (第 2 階段) | **TapPay + Transaction_Logs** | 以 Vercel 端交易日誌為對帳權威 |
| 發票狀態 (第 2 階段) | **光貿回讀事件** | 「已付款」不等於「已開立」；未回讀維持 `awaiting-provider` |
| 會員/收藏/投影 | **Supabase** | RLS 以 `auth.uid()` 隔離 |

## 3. 規格與現況修正記錄

> 2026-08-17 首次校對發現規格書「宣稱已完成」與實際程式碼不符，修正為待辦；同日稍後複查確認以下三項已由開發補齊，狀態更新如下（權威狀態以此為準）：

| 項目 | 原規格宣稱 (首次校對前) | 現況 (2026-08-17 複查) | 權威文件 |
| --- | --- | --- | --- |
| Sentry 前端監控 | 已完成 (`@sentry/react`/`@sentry/node`) | **已完成**：`@sentry/react` 與 `vite.config.ts` sourcemap 上傳已配置；脫敏工具 `src/lib/sentry.ts` 已掛載 | LAUNCH_CHECKLIST §5 |
| HSTS 安全標頭 | `vercel.json` 已含 HSTS | **已完成**：`vercel.json` 已補齊 HSTS | LAUNCH_CHECKLIST §3 |
| Supabase 呼叫來源 | 僅 `tmqzkagkrzhioftvwbqo` | **已完成**：硬編碼清理完畢，無非授權專案呼叫 | LAUNCH_CHECKLIST §4 |
| 庫存鎖定機制 (Phase 2) | 部分子文件仍寫 SiteGiant Reserve/Commit/Release 2PC | 已廢棄，改 Shopify App 自動雙向同步 | CHECKOUT_PAYMENT_SPEC §5、MODULES.md |

新增權威文件：**[上線切換清單 LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)**，收斂測試閘門移除、SEO 解封、CSP/HSTS 定版、硬編碼清理與監控接線。
**最新決策 (2026-08-17)**：第 1 階段目前採 **預覽部署 (Preview Deployment)**，維持測試存取閘門 (`middleware.js`) 與 SEO 封鎖 (`noindex`)，待內部團隊與特定客戶驗收後，再執行最終的「公開上線切換」以移除閘門。（目前僅剩「測試閘門移除」與「SEO 解封」兩大類尚未完成，見該文件）。

## 4. 開放項目與階段開發狀態 (OPEN & STAGED DEVELOPMENTS)

- [x] **第 1 階段 (商品展示與部署上線 — 當前聚焦)**：
  - 前端全站靜態與商品展示頁面、分類瀏覽 (Collections)、商品規格選擇 (Variants)、圖片 Gallery。
  - 多語系 (i18n)、微動畫體驗 (Framer Motion)、Web Vitals 效能優化。SEO 結構化標記已備妥，惟 `vercel.json` 現仍設定 `X-Robots-Tag: noindex, nofollow`（測試期防收錄），**正式上線須依 LAUNCH_CHECKLIST §2 解除**方能被搜尋引擎索引。
  - Vite 生產環境打包與 `vercel.json` 全域安全標頭 (CSP, COOP, HSTS) 通過測試，具備正式部署能力；HSTS 補齊與 Sentry 前端監控接線**已完成**（見上表），LAUNCH_CHECKLIST 僅剩測試閘門移除與 SEO 解封為上線阻擋項。
- [ ] **第 2 階段 (結帳中樞、金物流與發票串接 — 待後續啟動)**：
  - 自建結帳交易中樞 (`api/checkout.ts` 冪等性去重 + Supabase `transaction_logs` 狀態機)。
  - TapPay Direct Pay SDK 後端授權扣款與 3DS callback 流程。
  - Shopify 內建 ShipAny App 超商選店聯動 (自建 API 作為備用)。
  - 光貿電子發票 API 自動開立/作廢/折讓與對帳排程。

## 5. 分支管理與衝突隔離決策 (2026-08-18)

- **審查結論**：遠端分支 `origin/codex/saengak-recovery-security-review-20260813` 包含 Phase 2 後端微服務與 Migration，但其前端為早期骨架版本，直接 `git merge` 會產生 35+ 處嚴重衝突並破壞 Phase 1 前端穩定性。
- **處置原則**：**嚴禁直接合併**。一律採 Selective Sync（挑選移植）方式將後端與 Migration 單向移植至 `main`，詳見 [分支整合備註 BRANCH_INTEGRATION_NOTES.md](BRANCH_INTEGRATION_NOTES.md)。


