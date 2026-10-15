# 項目狀態

更新日期：2026-10-16（Asia/Taipei）。最新工作為免運門檻統一（PR #35）；其下依序為 UX 審視修正（PR #30）、CI 修復（PR #31，皆已合併）與同日較早的 Git 同步紀錄。

## 2026-10-16 免運門檻統一為 NT$1,499（分支 `claude/guest-checkout-free-ship`，PR #35）

營運決定全站免運門檻為 NT$1,499、客服先只用 Email、訪客結帳開放（實作待發票設計）。

### 程式碼設定

- 新增 `src/domain/shipping.ts`：`DEFAULT_FREE_SHIPPING_THRESHOLD = 1499`、`DEFAULT_SHIPPING_FEE = 80`；`CartSidebar`、`src/lib/promotions.ts`（FREESHIP 後備改名「滿額免運」）、`api/shopify/discounts.ts`、後台 `SiteSettings` 共用此常數。
- 新增 migration `supabase/migrations/20261016000001_unify_free_shipping_threshold.sql`：把 `site_settings.free_shipping_threshold` 由舊初始值 1500 改為 1499，並把 `promotions` 的 FREESHIP 標題由「初夏免運專案」改為「滿額免運」。API 優先採用資料庫值，所以只改程式碼預設值不會改變顧客看到的門檻。

### 正式服務狀態（2026-10-16 查詢）

| 項目 | 狀態 |
| --- | --- |
| Supabase `tmqzkagkrzhioftvwbqo` 的 `free_shipping_threshold` | 已是 1499（10/15 由後台設定，非本 migration） |
| Supabase FREESHIP 促銷標題 | 仍為「初夏免運專案 - 滿額免運費」，本 migration 尚未套用到正式資料庫 |
| Shopify 運費規則 | 已顯示「滿 $1499.00 免費」；但 Shopify 運費為 $146，與網站 `default_shipping_fee` 80 不一致，待確認 |

### 本次驗證

| 檢查 | 結果 |
| --- | --- |
| `npm test -- --run` | 367 測試全部通過（含新增 `src/domain/shipping.test.ts`） |
| `npm run verify:supabase` | 靜態基線通過（未對資料庫執行 migration） |
| `node scripts/verify-public-content.mjs` | 通過 |

### 同日 Shopify 後台修改（非程式碼）

- SAENGAK 凝膠、慕斯、濕巾、噴霧四件商品的副標、重點、規格成分、使用方式、圖文卡與說明，已依 NAS 原廠文件改寫並以 Storefront API 逐欄回讀一致；移除專利、純素、Dermatest 最高等級等無文件宣稱，慕斯 pH 改為 5.5、無香料。
- 20 件商品的「春季特別企劃」活動標籤已清除；涼感冰絲無痕內褲（7811043393603）副標改為中腰。
- 仍待處理：16 件內褲文案仍含「抗菌／權威機構／低敏」；舊版凝膠商品 7811130785859 仍寫「專利／低敏」。

## 2026-10-15 UX 審視修正（分支 `claude/website-design-ux-review-4438d6`）

提交 `f8013f4`，PR #30；2026-10-16 合併含 CI 修復的 `main`（`261a4d3`）後重新驗證。審視結果與進度畫板：https://claude.ai/artifact/FHj7kF1B3SL7VJEPceY2Eh （私人連結）。

### 程式碼變更

- 顧客可見的「確認中」文案、IG 假貼文分頁移除；客服頁、隱私、AdChoices、退換貨改以 `Company@lucissi.com` 說明（`src/content/site.ts` 的 `supportContact`）。退換貨「以 Email 受理」的流程描述待營運確認。
- 停用預設賣點、假促銷、★4.9、全標 NEW、預設尺寸表／版型值與 mock 商品後備；`ShopifyDescriptionViewer` 的成分、產地、檢驗、授權只呈現 Shopify 資料，缺資料的區塊隱藏。
- 有貨優先排序、商品頁預設有貨規格、尺寸／顏色篩選改用規格選項、搜尋標籤錯誤修正（`src/domain/algorithms.ts` 新增 `isProductSoldOut`、`sortAvailableFirst`、`pickInitialVariant`、`matchesVariantOption`）。
- `/order-status` 改為訂單查詢頁；`/product-preview` 只在開發環境載入。
- 手機商品頁固定購買列、規格樣式分開、購物車發票收合、清空需確認、搜尋頁窄版橫幅、首頁重複精選區移除、每頁分頁標題（`src/lib/pageTitle.ts`）。
- `scripts/verify-public-content.mjs` 加入「確認中」、假促銷、Dermatest／韓國授權等回歸字串。

### 本次驗證（合併後）

| 檢查 | 結果 |
| --- | --- |
| `npm test -- --run`（合併 CI 修復後） | 41 檔案、365 測試全部通過 |
| `npx tsc --noEmit -p tsconfig.app.json` | 27 個既有錯誤，與修改前基準相同，未新增 |
| `npm run build` | 通過 |
| `node scripts/verify-public-content.mjs` | 通過，157 個檔案 |
| 本機預覽（Vite dev，真實 Shopify Storefront 資料） | 桌機與 375px 手機檢查列表排序、預設規格、篩選、搜尋標籤、訂單查詢、購物車、手機購買列、分頁標題；`/api/*` 需 `vercel dev`，Vite 下回傳 500 屬環境限制 |

### 待處理（非程式碼）

- Shopify 商品文案需依原廠文件修正：凝膠與慕斯成分不符原廠成分表、慕斯 pH（原廠 5.5）、「專利」無文件、純素證書已於 2026-03-19 到期、內褲「低敏檢測／抗菌／拉伸測試」無檢測報告、15 件商品仍顯示「春季特別企劃」。
- ~~待決策：訪客結帳、全站唯一免運門檻、客服~~：2026-10-16 已決定（見最上方 PR #35 段落）；退換貨流程細節仍待營運確認。

## CI 修復（2026-10-15，分支 `claude/fix-ci-validate`）

GitHub Actions「Validate repository」自 2026-09-09 起在 `main` 與各 dependabot 分支皆失敗，本分支修復三個原因：

1. **`npm ci` 在 Node 22／npm 10 失敗**（`Missing: @tootallnate/once@2.0.0, smol-toml@1.5.2, undici@5.29.0, @fastify/busboy@2.1.1 from lock file`）。npm 10 無法正確套用部分以版本為鍵的 overrides。改為：`@tootallnate/once`、`smol-toml` 使用名稱鍵（各自只有 Vercel CLI 相關的消費者）；`undici` 改為巢狀於 `vercel` 之下，並對 `@vercel/sandbox` 保留 `^7.27.1`，避免把它降回 6.x。其餘仍可被 npm 10 接受的版本鍵 overrides 維持不變。已確認 lock 內仍是修補版本。
2. **`tests/invoice-guangmao-api.test.ts` 7 個失敗**：測試 `beforeEach` 補上僅供測試的假 `AmegoSellerTaxId`／`AmegoAppKey`／`AmegoIssuerNote`。`api/invoice/guangmao.ts` 的 Fail-Closed 憑證防護未修改，SEC-6 測試仍逐一刪除憑證並驗證回 500。未加入任何真實憑證。
3. **`npm audit`**：在不升級主版本的前提下修補——vitest 4.1.10→4.1.12、sharp 0.35.5、undici 6.29.1／7.30.1、smol-toml 1.9.1、js-yaml 4.3.2、brace-expansion、fast-uri、source-map-js。結果由 39 項降為 25 項（2 moderate、23 high），**正式（production）依賴為 0 項**。剩餘全部屬開發工具：
   - `braces`（GHSA-vfj7-8cjw-p6xm）目前沒有修補版本，經由 Tailwind CSS 3（chokidar、micromatch、fast-glob）及 Vercel CLI（`@vercel/*` → ts-morph → fast-glob）引入；
   - `postcss-selector-parser` <7.1.6，Tailwind CSS 3／postcss-nested 6 固定使用 6.x。
   修復需要 Tailwind CSS 4 遷移與 Vercel CLI 主版本更新，未執行 `npm audit fix --force`。
   因此 CI 稽核改為兩段：`npm audit --omit=dev --audit-level=moderate`（正式依賴）與 `npm audit --audit-level=critical`（全部依賴）。這是 CI 閘門的放寬，應在 Tailwind／Vercel CLI 升級後恢復完整 moderate 稽核。

### 本次本機驗證

Node.js v26.3.1、npm 11.16.0；另以 `npx npm@10.9.4` 模擬 CI 的 npm 10。

| 檢查 | 結果 |
| --- | --- |
| `npm ci`（npm 11）與乾淨目錄 `npm@10.9.4 ci --ignore-scripts`、`npm ls --all` | 通過 |
| `npm run typecheck` | 通過 |
| `npm test -- --run` | 40 個檔案、356 個測試全部通過 |
| `npm run build` | 通過；仍有主 chunk 超過 500 kB 的警告 |
| `npm run verify:content` | 通過，檢查 158 個檔案 |
| `npm run verify:supabase` | 靜態基線通過 |
| `npm audit --omit=dev --audit-level=moderate` | 0 項 |
| `npm audit --audit-level=critical` | 通過（25 項 moderate／high 皆為開發依賴，無 critical） |

GitHub Actions 在 Node 22 上的結果以 PR 的 CI 執行為準。

## 先前同步紀錄（2026-10-15）

### 同步內容

- 將原本未提交的本機網站改版、圖片與製圖工作紀錄保存為 `d485e99`。
- 合併遠端 `main` 的 5 個更新提交，最新基準為 `dc54236`，整合提交為 `c93b89e`；保留新版品牌、精選商品、超值組合與網域／回呼設定。
- 整合後應用程式、API 與測試內容和 `dc54236` 一致；沒有為此次備份改寫業務邏輯。
- 新增 README、AGENTS、項目記憶與本文件；素材提示詞、來源紀錄和製圖腳本一併保存。
- 修正 `.gitignore`，讓專案文件與 creative 資料可持續追蹤；`.env.local`、依賴、建置輸出、服務工作階段及本機診斷仍排除。
- 本次不包含正式資料庫、Shopify 後台資料或完整對話歷史的匯出；Git push 的最終結果以遠端提交與交接回覆為準。

### 當時驗證

本機 Node.js v24.14.0、npm 11.9.0；使用既有安裝依賴執行。CI 使用 Node.js 22，本次未另外重裝依賴。

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 指令通過；現有 script 是根目錄 `tsc --noEmit`，根 tsconfig 使用空 files 與 project references，不等同另外逐個 referenced project 執行完整型別檢查 |
| `npm test -- --run` | 40 個檔案：39 通過、1 失敗；356 個測試：349 通過、7 失敗 |
| `npm run build` | 通過；965 modules，主 chunk 約 510.15 kB，有超過 500 kB 的警告 |
| `npm run verify:content` | 通過，檢查 158 個檔案 |
| `npm run verify:supabase` | 靜態基線通過；不代表實際資料庫測試已執行 |
| `npm audit --audit-level=moderate` | 未通過：37 項（5 moderate、32 high） |
| 候選檔案金鑰檢查 | 未發現本機環境金鑰值或所檢查的常見 credential pattern；不是完整安全稽核 |
| `git diff --check` | 通過 |

## 已知待處理

1. ~~`tests/invoice-guangmao-api.test.ts` 的 7 個案例失敗~~：已於 CI 修復分支補上假憑證 fixture。
2. 依賴稽核剩餘 25 項開發依賴問題（`braces` 無修補版本、Tailwind CSS 3、Vercel CLI 相關）；需 Tailwind CSS 4 遷移與 Vercel CLI 主版本更新後，將 CI 稽核恢復為完整 `npm audit --audit-level=moderate`。
3. 現有 typecheck script 應評估是否完整檢查 referenced projects。
4. 主 bundle 大於 500 kB；後續可評估拆分，不影響本次成功建置。
5. ~~`src/content/site.ts` 客服待確認文案~~：已於 UX 修正改為 Email 管道；電話與官方 LINE 仍待營運決定。

## 尚未驗證

本次沒有執行資料庫整合測試、真實付款／發票、瀏覽器完整回歸、正式 DNS／OAuth／webhook 或部署健康檢查；也未確認推送後平台自動部署的結果。歷史素材文件中的測試紀錄屬當時結果。
