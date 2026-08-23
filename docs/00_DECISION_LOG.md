# SAENGAK 決策狀態總表 (Authoritative Decision Log)

> 更新日期：2026-08-22 (補記 2026-08-21 結帳架構第三次變動之決策記錄，見 §3.3；規格書全面對齊)
> 本表為所有規格書的最高權威。任一子文件與本表衝突時，以本表為準。

## 1. 已定案架構決策 (2026-08-17)

| 主題 | 定案 (ADOPTED) | 廢棄 (DEPRECATED) | 權威文件 |
| --- | --- | --- | --- |
| 階段策略 | **第 1 階段聚焦「商品展示與部署上線」**，結帳交易保留至第 2 階段 | 全流程一次性混雜上線 | MAIN_SPECIFICATION |
| 庫存權威與聯動 | **SiteGiant ERP 透過 Shopify App 聯動雙向同步**；Shopify 為前端即時庫存門戶 | Vercel API 直連 SiteGiant 進行 2PC (Reserve/Commit) 鎖定 | CHECKOUT_PAYMENT_SPEC |
| 物流模式 | **Shopify 內建 ShipAny App 進行門市選單與履約** (自建物流 API 列為備用) | 自建複雜門市選單 API 與履約狀態機 | LOGISTICS_INVOICE |
| 結帳方式 | **Shopify Checkout 跳轉 (老闆指示由第2階段退回)** | 自建 React Checkout (Option B) [已廢棄] | CHECKOUT_PAYMENT_SPEC |
| 後端中樞 | Vercel Serverless API (`api/*`) | Supabase Edge Functions | VERCEL_MIGRATION_SPEC |
| 金流模式 | **TapPay Shopify Payment App (隨 Shopify Checkout 跳轉)** | TapPay Direct Pay SDK (已廢棄) | CHECKOUT_PAYMENT_SPEC |
| 付款方式 | 僅支援線上刷卡 | 貨到付款 (COD) | CHECKOUT_PAYMENT_SPEC |
| 品牌文案常數 | 品牌資料集中於 `src/content/site.ts` | 散落於各頁面硬編碼 | MAIN_SPECIFICATION / site.ts |
| 電子發票 | 光貿電子發票 [第 2 階段推進] | Waaship 發票 | LOGISTICS_INVOICE |
| Storefront API 客戶端 | **全面純前端直連 Storefront GraphQL API** (官方 `@shopify/storefront-api-client` SDK，零中介、純前端安全公開憑證模式) | 經由 Supabase Edge Functions 中轉或自建原生 fetch 與私密憑證回退模式 | MAIN_SPECIFICATION / 00_DECISION_LOG |
| CSP 允許清單治理 (2026-08-19 新增) | **`vercel.json` 為 CSP 唯一事實來源；新增/變更任一外部網域時，必須同步更新 `scripts/production-surface-lib.mjs` 之 `REQUIRED_CSP_DIRECTIVES`，使 `npm test`（讀取 `vercel.json`）與 `npm run verify:production`（線上實測）雙重強制驗證** | 僅憑規格書文字宣稱「已放行」／「已完成」，而未有自動化測試對照實際 `vercel.json` 內容 | 00_DECISION_LOG §3.1 / MAIN_SPECIFICATION §1.2.6 / `scripts/production-surface-lib.mjs` |
| 靜默降級可觀測性治理 (2026-08-19 新增) | **任何「抓取失敗 → 退回 mock/展示假資料」的 `catch` 區塊，必須同時呼叫 `src/lib/sentry.ts` 之 `captureExceptionSafe(err, { source, fallback })`，並在 Code Review 中列為必查項** | 僅寫 `console.warn`／`console.error`（或完全無日誌的 `catch {}`）即視為已處理錯誤，導致降級狀態無法被監控系統偵測 | 00_DECISION_LOG §3.1 / `src/lib/sentry.ts` |

## 2. 權威資料源 (Source of Truth) 對照

| 資料領域 | 權威系統 | 說明 |
| --- | --- | --- |
| 商品售價、規格、實體庫存 | **SiteGiant ERP** | 實體商品與庫存主檔，透過 SiteGiant Shopify App 與 Shopify 自動雙向同步 |
| 前端商品目錄與即時可售量 | **Shopify Storefront** | 前端讀取商品、分類 (Collections)、規格 (Variants) 與即時 `availableForSale` 之直接門戶 |
| 訂單主檔 (第 2 階段) | **Shopify Order** | 訂單主檔；由結帳流程建立後回讀並同步至 SiteGiant ERP |
| 付款結果 | **Shopify Order + TapPay Shopify Payment App** | TapPay 於 Shopify Checkout 頁面內完成扣款，非自建 Vercel 交易中樞；付款結果隨 Shopify 簽章 Webhook 投影至 Supabase `orders`／`order_items`（見 §3.3） |
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

### 3.1 CSP 允許清單回歸事故與強制驗證決策 (2026-08-19)

**事故現象**：使用者反映 `localhost:3000`（本機開發）顯示真實 Shopify 商品，但正式站 `https://saengak.com.tw` 卻持續顯示展示用假資料（`src/mocks/products.ts`），且期間 Sentry 未收到任何相關錯誤事件。使用者已排除「Vercel／GitHub 專案設定錯誤」的可能性（曾重新刪除並建立兩邊專案，問題依舊存在）。

**根本原因**：
1. 正式站部署所用之 `vercel.json` 其 `Content-Security-Policy` 的 `connect-src` **未放行 `https://gh2xgs-zf.myshopify.com`**，導致瀏覽器封鎖所有 Shopify Storefront GraphQL 請求（`get-products` 前端直連查詢）。
2. `src/pages/home/components/ProductSection.tsx` 與 `src/lib/shopify.ts` 的抓取失敗處理採**靜默降級**（`console.warn` 後退回 `mockProducts` / 精選文章 fallback），因此正式站外觀正常、無錯誤畫面，只是內容全數為假資料，故障被完全掩蓋。
3. 同一份 CSP 之 `style-src` / `font-src` 僅放行 `cdnjs.cloudflare.com`，但 `index.html` 實際引用的 Remix Icon 圖示 CDN 為 `https://cdn.jsdelivr.net`（`cdnjs.cloudflare.com` 對該版本回傳 404），導致正式站圖示同樣長期未渲染。
4. `docs/MAIN_SPECIFICATION.md` §1.2.6 與 `docs/LAUNCH_CHECKLIST.md` §3 皆已將「CSP 放行 Shopify／Sentry／HSTS」標記為「✅ 已完成」，但 `scripts/production-surface-lib.mjs` 的 `REQUIRED_CSP_DIRECTIVES` 當時**未包含這些網域**，導致 `npm test`（CI 於每次 push main 皆執行）與 `npm run verify:production`（線上實測腳本）均無法偵測此落差 —— **規格宣稱與自動化驗證之間出現斷鏈**，才使問題得以在未察覺的情況下留在正式站。

**修復內容**：
- `vercel.json`：`connect-src` 補回 `https://gh2xgs-zf.myshopify.com`、`https://*.ingest.sentry.io`、`https://*.ingest.us.sentry.io`；`style-src` / `font-src` 補 `https://cdn.jsdelivr.net`；同時補回文件宣稱已完成但實際遺失的 HSTS 標頭。
- `scripts/production-surface-lib.mjs`：`REQUIRED_CSP_DIRECTIVES` 新增上述網域，使其成為 `npm test` 與 `npm run verify:production` 的**強制斷言項目**，而非僅止於文件敘述。
- `.vercel/repo.json`：更正殘留之已刪除舊專案 ID，改為現行 `saengak-web-d2ux`（`prj_ZgDfZyy7zQB0ngJzCzsIhD88mw5E`）。

**新增治理決策（見 §1 表）**：`vercel.json` 為 CSP 唯一事實來源；任何新增或變更的外部網域，**必須同步更新 `REQUIRED_CSP_DIRECTIVES` 並通過 `npm test`**，否則不得於規格書中標記「已完成」。規格書的「✅ 已完成」標記僅作狀態說明，實際合規性一律以自動化測試結果為準。

**殘留風險修復（2026-08-19 補完）**：原「已知殘留風險」段落所列之靜默 fallback 路徑已全數補上 `captureExceptionSafe()` 回報，涵蓋：`ProductSection.tsx`、`SolutionSection.tsx`、`ReviewSection.tsx`（後兩者原為完全無日誌的 `catch {}`，連 `console.warn` 都沒有）、`search/page.tsx`、`product/page.tsx`、以及 `shopify.ts` 之 `getShopifyArticles()` / `getShopifyArticleByHandle()`。每處呼叫皆附上 `{ source, fallback: 'mockProducts' }` 形式的 context，供 Sentry 端依來源與降級類型篩選、告警。`npm test`（147/147）通過。**部署後仍須依 LAUNCH_CHECKLIST §5 實測一筆降級事件確實送達 Sentry**，程式碼複查無法確認實際送達。

**本次事故延伸出的通用除錯觀念（列入 §1 治理決策，往後所有新增降級路徑一律適用）**：任何「失敗後靜默退回展示/快取/假資料」的容錯設計，若只寫 `console.warn`／`console.error` 而不回報監控系統，其風險等同於沒有錯誤處理——因為使用者體驗完全正常、頁面不會顯示任何錯誤，故障只會停留在瀏覽器本機 console，永遠不會被任何人看見，可能無限期地留在正式環境而無人察覺（本次事故即為實例）。**優雅降級（Graceful Degradation）與可觀測性（Observability）必須同時具備**：`catch` 區塊在退回 fallback 資料前，除既有的 `console.warn`／`console.error` 之外，必須同時呼叫 `src/lib/sentry.ts` 之 `captureExceptionSafe(err, { source, fallback })`，兩者缺一不可。Code Review 時應將此列為檢查項：任何新增的 `catch` 區塊若接著設定 fallback/mock 資料卻未回報 Sentry，應視為缺陷退回。

### 3.2 Phase 2 後端中樞落地稽核與修正 (2026-08-20)

**背景**：Phase 2 後端中樞（結帳交易、TapPay 金流、發票 Outbox、Webhook 投影、對帳排程）程式碼首版落地後，以「報告聲稱 vs 實際程式碼」逐項稽核。表層指標（檔案存在、`npm test`/`typecheck`/`build` 通過）屬實，但發現以下缺陷並全數修正：

| 嚴重度 | 發現 | 修正 |
| --- | --- | --- |
| Critical | `enqueueAmegoInvoiceJob` 以 `.from('amego_invoice_jobs')` 直寫，但該表位於 `private` schema（PostgREST 不曝露），寫入必然失敗且被 `catch {}` 靜默吞掉退回記憶體——Serverless instance 回收後發票工作遺失，**發票實質不會開立** | 新增 `public.enqueue_amego_invoice_job` RPC（migration `20260820000003`，冪等 upsert、僅 service_role），程式改走 RPC；pgTAP 測試 `enqueue_amego_invoice_job.test.sql` |
| High | 三處安全檢查 Fail-Open：缺 `Origin` header 放行、`SHOPIFY_WEBHOOK_SECRET` 未設定跳過 HMAC、`CRON_SECRET`/`AmegoDispatchToken` 未設定放行任意呼叫者觸發退款 | 全數改 Fail-Closed（缺 Origin → 403；密鑰缺失 → 500 拒絕 + 告警日誌），新增 CHECKOUT_PAYMENT_SPEC §7.8 鐵則與 4 項迴歸測試 |
| High | `api/cron/reconcile.ts` 僅有端點、`vercel.json` 無 `crons` 宣告，對帳排程從未真正被排程 | `vercel.json` 補 `crons`：reconcile 每 15 分鐘、guangmao 發票 Worker 每 5 分鐘 |
| Medium | 存在兩套限流實作：端點誤接固定視窗、無 Sentry 回報的弱版；真滑動視窗版 (`api/_lib/ratelimit.ts`) 反而是死碼 | 刪除弱版，端點統一接回 `ratelimit.ts`（Upstash Lua 滑動視窗 + in-memory 降級 + Sentry 回報） |
| Medium | 測試覆蓋誇大：`checkoutHandler` 主線（扣款成功→建單→補償）無整合測試；Supabase 整合層完全未被測試觸及 | 補 Happy Path 與補償退款整合測試、發票偏好竄改 422 測試；`run-db-tests.mjs` 補列 `transaction_logs.test.sql`（原先漏排從未執行）與新 RPC 測試 |
| Low | 冪等 Payload Hash 未含 `invoicePreference`，同 key 換發票抬頭/統編不會觸發 422 | Hash 納入發票偏好，補測試 |

**驗證數據 (2026-08-20 修正後)**：`npm test` 360/360、`npm run typecheck` 零錯誤、`npm run build` 通過。**未驗證**：SQL migration 與 pgTAP（本機無 Docker，`npm run test:db` 待補跑）；Vercel 部署與 TapPay 沙盒實單未執行。

**新增治理決策（列入 §1 精神，與「靜默降級可觀測性治理」同源）**：
1. **密鑰缺失 Fail-Closed 鐵則**：任何以密鑰為前提的安全檢查（HMAC、Bearer Token），密鑰未設定必須拒絕請求，嚴禁「有設定才驗證」——密鑰漏設是部署常態風險，防護不得隱性消失（權威：CHECKOUT_PAYMENT_SPEC §7.8）。
2. **Private Schema 存取鐵則**：`private` schema 資料表一律經 `public.*` RPC 存取，後端程式嚴禁 `.from()` 直寫；新增 RPC 必須附 pgTAP 權限測試（權威：CHECKOUT_PAYMENT_SPEC §5.3）。
3. **限流模組唯一性**：全站限流唯一實作為 `api/_lib/ratelimit.ts`，嚴禁另建平行模組（權威：CHECKOUT_PAYMENT_SPEC §7.2）。

### 3.3 結帳架構第三次變動：回歸 Shopify Checkout (2026-08-21)

**背景**：本專案結帳架構歷經三次變動：(1) 最初採跳轉 Shopify Checkout；(2) 2026-08-17 改為自建 React Checkout (Option B) + TapPay Direct Pay SDK + Vercel 交易中樞（`api/checkout.ts`），理由是唯有自建才能在扣款前鎖定 SiteGiant ERP 庫存；(3) **2026-08-21，經負責人指示，改回跳轉 Shopify Checkout**，TapPay 以 Shopify Payment App 身分於 Shopify 頁面內完成扣款。本節補記此決策，修正先前遺漏未獨立記錄的缺口。

**決策內容**：
- 自建結帳中樞全數廢棄：`api/checkout.ts`、`api/checkout/confirm.ts`、`api/checkout/status.ts`、`api/cron/reconcile.ts`、`transaction_logs` 交易狀態機（migration `20260820000001`）、TapPay Direct Pay SDK 前端整合、3DS callback 頁面。**2026-08-23 更新**：上述檔案與其專屬支援函式庫（`api/_lib/tappay.ts`、`api/_lib/shopify-admin.ts`、`api/_lib/ratelimit.ts`）、對應測試（`tests/checkout-backend.test.ts`、`tests/checkout-frontend.test.tsx`、`tests/ratelimit.test.ts`）、前端 `src/pages/_deprecated_checkout/` 整包，以及 `vercel.json` 中呼叫 `api/cron/reconcile` 的 cron 排程，已**實際從 repo 中移除**（僅存於 Git 歷史可追溯，不再是「檔案仍在但不得部署」的狀態）。`api/_lib/supabase-admin.ts` 中僅供這批舊碼使用的 `createTransactionLog`／`findStaleTransactions` 亦一併移除；`getTransactionLog`／`updateTransactionLog` 因 `api/invoice/guangmao.ts` 仍在使用而保留。
- 現行結帳流程權威文件改為 [`TAPPAY_SHOPIFY.md`](TAPPAY_SHOPIFY.md)：購物車在側邊欄 (Cart Drawer) 收集發票資訊後，呼叫 `create-shopify-cart` 建立 Shopify Cart 並取得 `checkoutUrl`，導向 Shopify Checkout；TapPay 以 Shopify Payment App 身分於該頁完成授權扣款；ShipAny 於同頁提供超商/宅配選擇；付款確認後由 Shopify 簽章 Webhook 回寫並投影至 Supabase `orders`／`order_items`。
- `create-shopify-cart` 同期由 Supabase Edge Function 遷移至 Vercel `api/create-shopify-cart.ts`（git commit `79e6486`）。
- **不受本次變動影響、仍為現行權威**：光貿 (Amego) 電子發票之 Outbox 派送模式（`enqueue_amego_invoice_job` RPC → `api/invoice/guangmao.ts` → 回讀 `invoice_status=99`）、SiteGiant ERP 透過 Shopify App 雙向同步、admin 角色一律以 `app_metadata.role='admin'` 判定之規則。

**✅ 殘留風險已處置（2026-08-23 複查與修正）**：先前記錄的 `CheckoutReleaseEnabled` 結帳總開關風險已重新查證，結論分兩部分：
- `maintenance_mode`：`api/create-shopify-cart.ts` 已正式補上 `site_settings.maintenance_mode`（含環境變數回退）檢查邏輯，全站維護時端點即時回傳 503 (`MAINTENANCE_MODE_ACTIVE`)；`20260820000002_create_site_settings.sql` 已 seed 預設值，`src/pages/admin/SiteSettings.tsx` 有對應 UI 可切換，`tests/create-shopify-cart.test.ts` 有測試覆蓋。此半部為端到端可用，視為已修復。
- `checkout_release_enabled`：複查發現這個檢查**沒有 migration seed 預設值、`SiteSettings.tsx` 也沒有對應 UI**（該頁面明文寫「本頁不再管理結帳釋出開關」），且新邏輯是 fail-open（找不到設定值就放行結帳），與舊 Supabase Edge Function「未精確設為 `true` 一律拒絕」的 fail-closed 精神相反，形同虛設。既然結帳已正式回歸 Shopify Checkout 上線，不再需要這種上線前置閘門，**已於 2026-08-23 直接從 `api/create-shopify-cart.ts` 與 `tests/create-shopify-cart.test.ts` 移除這段檢查**，不再假裝它是可控管的防護機制。

**新增治理決策**：本次變動後，`MAIN_SPECIFICATION.md`、`MODULES.md`、`CHECKOUT_PAYMENT_SPEC.md`（已加頂端 DEPRECATED 警告）、`VERCEL_MIGRATION_SPEC.md`、`docs/agents/domain-docs.md` 已於 2026-08-22 同步修正，移除或標註已廢棄之自建結帳架構敘述；`docs/decisions/CHECKOUT_ARCHITECTURE_DECISION.md` 與 `docs/decisions/VERCEL_SERVERLESS_DECISION.md` 屬歷史決策紀錄，保留原始論述並僅追加修正附註，不覆寫歷史脈絡。

## 4. 開放項目與階段開發狀態 (OPEN & STAGED DEVELOPMENTS)

- [x] **第 1 階段 (商品展示與部署上線 — 當前聚焦)**：
  - 前端全站靜態與商品展示頁面、分類瀏覽 (Collections)、商品規格選擇 (Variants)、圖片 Gallery。
  - 多語系 (i18n)、微動畫體驗 (Framer Motion)、Web Vitals 效能優化。SEO 結構化標記已備妥，惟 `vercel.json` 現仍設定 `X-Robots-Tag: noindex, nofollow`（測試期防收錄），**正式上線須依 LAUNCH_CHECKLIST §2 解除**方能被搜尋引擎索引。
  - Vite 生產環境打包與 `vercel.json` 全域安全標頭 (CSP, COOP, HSTS) 通過測試，具備正式部署能力；HSTS 補齊與 Sentry 前端監控接線**已完成**（見上表），LAUNCH_CHECKLIST 僅剩測試閘門移除與 SEO 解封為上線阻擋項。
- [ ] **第 2 階段 (原自建結帳已廢棄，改由 Shopify Checkout 接管)**：
  - [x] 原自建結帳交易中樞程式碼已廢棄 (2026-08-21 決策)。
  - [x] 發票收集移至側邊欄 (Cart Drawer)，結帳全數跳轉回 Shopify Checkout。
  - [x] 光貿電子發票 Outbox Worker 程式碼（`enqueue_amego_invoice_job` RPC + `api/invoice/guangmao.ts` 回讀 99）。
  - [ ] Vercel 部署、環境變數/Secrets 配置、Supabase migration 套用與 `npm run test:db` 驗證。
  - [ ] Shopify 內建 ShipAny App 超商選店聯動 (自建 API 作為備用)。
  - [ ] 後端 `@sentry/node` 接線；TapPay 沙盒實單與端到端商業驗收 (`verify:commerce`)。

## 5. 分支管理與衝突隔離決策 (2026-08-18)

- **審查結論**：遠端分支 `origin/codex/saengak-recovery-security-review-20260813` 包含 Phase 2 後端微服務與 Migration，但其前端為早期骨架版本，直接 `git merge` 會產生 35+ 處嚴重衝突並破壞 Phase 1 前端穩定性。
- **處置原則**：**嚴禁直接合併**。一律採 Selective Sync（挑選移植）方式將後端與 Migration 單向移植至 `main`，詳見 [分支整合備註 BRANCH_INTEGRATION_NOTES.md](BRANCH_INTEGRATION_NOTES.md)。


