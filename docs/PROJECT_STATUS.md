# 項目狀態

更新日期：2026-10-16（Asia/Taipei）。最新一項工作為 Tailwind CSS 4 遷移並恢復完整依賴稽核；其下保留 2026-10-15 的 CI 修復與 Git 同步紀錄。

## Tailwind CSS 4 遷移與完整稽核（2026-10-16，分支 `claude/tailwind4-full-audit`）

接續 CI 修復分支，移除剩餘 25 項開發依賴稽核問題，CI 恢復為單一 `npm audit --audit-level=moderate`。

1. **Tailwind CSS 3.4 → 4.3**：以官方 `@tailwindcss/upgrade` 轉換後人工修正。`tailwind.config.ts` 併入 `src/index.css` 的 `@theme`；PostCSS 改用 `@tailwindcss/postcss`，移除 `autoprefixer`。
   - 升級工具誤改的非 class 值已還原：Google 按鈕 `theme: 'outline'`、`Button` 的 `variant: 'outline'`。
   - 為維持 v3 畫面而加入的相容設定（皆在 `src/index.css`，含註解）：預設邊框色、placeholder 色、按鈕 pointer、表單欄位底色；v3 預設色票（使用到的色系）與 rem 行高；`space-x/y` 的 v3 選擇器；網站自訂樣式放到 `@layer utilities` 末端以保留 v3 cascade；漸層加 `/srgb` 保持 v3 的 sRGB 插值。
   - 刪除 `index.css` 中與 Tailwind 主題重複的 `.bg-brand`、`.bg-brand-ink`、`.text-brand`、`.border-brand`（升級工具把 `text-[#5B3D48]` 等改成 `text-brand`，重複定義會蓋過 `border-t-transparent` 等設定）。
   - 移除在 v3 中不存在、v4 才會生效的 class（`shadow-xs`／`shadow-2xs`、`backdrop-blur-xs`、`drop-shadow-xs`、`scrollbar-none`），以免新增原本沒有的陰影、模糊或隱藏捲軸；`.shadow-xs`（v3 的 `shadow-sm`）加入扁平設計的去陰影清單。
   - 26 組「基礎 `leading-*` 搭配響應式 `md:text-*`」補上 v3 等效的 `md:leading-*`（v4 中 `leading-*` 會優先於 `text-*` 的行高）。
   - 保留 promotion 頁 spinner 的 `border-3`：v3 下此 class 無效、spinner 沒有邊框而不可見，v4 讓它顯示；這是唯一刻意的畫面變更。
2. **Vercel CLI**：最新 64.2.0 仍經 `@vercel/*` → ts-morph → fast-glob → micromatch 帶入 `braces`（無修補版本），因此不升級而是移除 devDependency；`dev:vercel` 改為 `npx --yes vercel@64 dev`。原本只為 Vercel CLI 依賴樹存在的 `overrides` 全部移除，lock 中其他套件版本未變。

### 本次本機驗證

Node.js v26.3.1、npm 11.16.0；另以 `npx npm@10.9.4` 模擬 CI 的 npm 10。

| 檢查 | 結果 |
| --- | --- |
| 乾淨目錄 `npx npm@10.9.4 ci --ignore-scripts`（lock 未被改寫）與 `npm ci`（npm 11） | 通過 |
| `npm audit --audit-level=moderate`（npm 11 與 npm 10） | 0 項 |
| `npm run typecheck` | 通過 |
| `npx tsc -p tsconfig.app.json --noEmit` | 27 項錯誤，與遷移前逐項相同（既有問題，見待處理 3） |
| `npm test -- --run` | 40 個檔案、356 個測試全部通過 |
| `npm run build` | 通過；仍有主 chunk 超過 500 kB 的警告 |
| `npm run verify:content` | 通過，檢查 158 個檔案 |
| `npm run verify:supabase` | 靜態基線通過 |
| 畫面比對：遷移前（v3）與遷移後（v4）dev server，本機 Chrome headless，1440×900 與 375×812；首頁、商品頁、商品列表、搜尋、購物車側欄、登入、註冊、會員（未登入）、優惠活動 | 18 組整頁截圖逐像素比對皆 0 差異；逐元素 computed style 僅剩等效表示差異（漸層顯式 stop 位置、透明 ring 層） |

未比對：已登入會員頁、管理後台、hover／focus 等互動狀態。GitHub Actions 在 Node 22 上的結果以 PR 的 CI 執行為準。

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
2. ~~依賴稽核剩餘 25 項開發依賴問題~~：已由 Tailwind CSS 4 遷移與移除 Vercel CLI devDependency 解決，CI 恢復完整 `npm audit --audit-level=moderate`。
3. 現有 typecheck script 應評估是否完整檢查 referenced projects。
4. 主 bundle 大於 500 kB；後續可評估拆分，不影響本次成功建置。
5. `src/content/site.ts` 仍記載正式客服電話、電子郵件與官方 LINE 尚待營運確認，應由營運核實。

## 尚未驗證

本次沒有執行資料庫整合測試、真實付款／發票、瀏覽器完整回歸、正式 DNS／OAuth／webhook 或部署健康檢查；也未確認推送後平台自動部署的結果。歷史素材文件中的測試紀錄屬當時結果。
