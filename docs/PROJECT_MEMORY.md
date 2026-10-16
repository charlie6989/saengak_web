# 項目記憶

更新日期：2026-10-15（Asia/Taipei）。本文件依 repository 與本次同步可查證資料整理；不包含聊天紀錄或外部服務資料的完整備份。

## 品牌與網域

- 商店品牌為 **LUCISSI CARE**；SAENGAK 仍是商品品牌，不能把商品品牌歸屬一律替換成商店名稱。`src/lib/brandOwnership.ts` 負責品牌歸屬判斷，`src/content/site.ts` 保存商店公開資料。
- 主要網域設定為 `lucissicare.com`，repository 名稱仍為 `saengak_web`。
- `vercel.json` 將 `saengak.com.tw` 與 `www.saengak.com.tw` 一般頁面永久轉址至新網域；排除 `/api`、`/auth/confirm`、`/reset-password`，以保留服務回呼。修改時須一起檢查相關測試、CSP、Origin 白名單、sitemap 與 robots。

## 架構與整合

- 前端：React 19、TypeScript、Vite 7、React Router、Tailwind CSS 4（`@tailwindcss/postcss`，主題在 `src/index.css` 的 `@theme`，沒有 `tailwind.config`）；入口與頁面位於 `src/`。
- `src/index.css` 的 Tailwind v3 相容設定是刻意保留的：預設邊框／placeholder／按鈕游標／表單底色、v3 預設色票與 rem 行高、`space-x/y` 舊選擇器，以及把網站自訂樣式放在 `@layer utilities` 末端（維持 v3 的 cascade）。刪除前須逐頁比對畫面。全站採扁平設計（`* { border-radius: 0 !important }`、`.shadow-*` 為 none），新增陰影名稱時要同步更新該清單。
- `api/` 是 Vercel API，包含管理員、購物車、優惠券、Shopify webhook 及光貿發票入口。
- Shopify 提供商品、分類、文章與 Checkout；主要客戶端在 `src/lib/shopify.ts`，結帳與導頁另有專用模組及測試。
- Supabase 承載會員、訂單、評價／問答、優惠券、發票投影與相關授權；`supabase/migrations/`、`supabase/functions/`、`supabase/tests/database/` 保存 schema 變更、Edge Functions 及資料庫測試。
- 光貿發票採 outbox／派送流程；缺少必要憑證時拒絕處理。不可為了讓測試通過而補入正式憑證或取消防護。
- ShipAny 由 Shopify 後台管理；`.env.example` 明確記載網站／Supabase 不另持有 ShipAny API key。
- Sentry 的事件處理與資料清理在 `src/lib/sentry.ts`。
- Vercel CLI 不再是 devDependency（其 `@vercel/*` → ts-morph → fast-glob 會帶入沒有修補版本的 `braces`，最新 64.x 仍是如此）；`npm run dev:vercel` 以 `npx --yes vercel@64 dev` 執行。原本只為 Vercel CLI 依賴樹存在的 `overrides` 已全部移除。
- 若之後需要 `overrides`，必須同時被 npm 10（CI 的 Node 22）與 npm 11 的 `npm ci` 接受：npm 10 對部分以版本為鍵的 override 會誤判 lock 不同步。修改後以乾淨目錄的 `npx npm@10.9.4 ci --ignore-scripts` 與 `npm ci` 驗證，不要用 npm 10 重建 lock。
- CI 稽核目前分為正式依賴 moderate 與全部依賴 critical 兩段；開發依賴剩餘問題見 `PROJECT_STATUS.md`。

## 既有商品與介面決策

- 保留新版 LUCISSI CARE 視覺、首頁主題與各頁 EditorialHero。
- 精選商品支援 Shopify featured 等標籤，核心護理商品包含舒緩凝膠。
- 首頁 Solution 支援超值組合、經典單品、全部分類；商品細節依 Shopify 資料呈現。
- 圖片在 `public/images/`。`editorial-v2`、`lucissi-v3`、`lucissi-v4`、`lucissi-v5` 是既有版本目錄，不能未查引用就刪除。

## 商品資訊與宣稱原則（2026-10-15）

- 商品頁的成分、產地、檢驗、認證、專利與品牌授權只能來自 Shopify 實際填寫的資料；程式碼不得補預設宣稱、評分、NEW 標籤或 mock 商品。回歸字串列在 `scripts/verify-public-content.mjs`。
- SAENGAK 原廠文件（產品說明書、CPNP/SCPN 與安全評估含成分表、純素／Halal／MOCRA、ISO 22716）存放在公司 NAS 的 `saengak_kr` 共用資料夾，不在 Git。內褲類目前沒有檢測報告。
- 2026-10-15 比對結果：Made in Korea 有依據；Dermatest 僅見於原廠說明書（濕巾 Excellent、泡沫潔淨露 confirmed）；純素證書效期至 2026-03-19；凝膠與慕斯在 Shopify 的成分及慕斯 pH 與原廠不符；無專利文件。
- 列表與推薦一律有貨優先；商品頁預設第一個有貨規格。

## 營運決策（2026-10-16）

- 全站免運門檻為 NT$1,499。程式碼預設值在 `src/domain/shipping.ts`（`DEFAULT_FREE_SHIPPING_THRESHOLD`），但 API 與購物車優先採用 Supabase `site_settings.free_shipping_threshold`；三處（程式碼、Supabase、Shopify 運費規則）必須一起改。
- 客服暫時只用 Email（`Company@lucissi.com`）。
- 訪客結帳已決定開放；登入改為會員優惠入口。設計見 `docs/GUEST_CHECKOUT_PLAN.md`。後端（migration、webhook 解析器、`create-shopify-cart` 訪客分支）在分支 `claude/guest-checkout-backend` 實作，未套用到遠端、未部署；正式環境仍是「未登入訂單不寫入、不開發票」，直到 migration 套用並開啟 `site_settings.guest_checkout_enabled`。部署時 migration 必須先於 webhook 程式。

## 素材製作記憶

- `creative/` 保存提示詞、manifest、provenance 與改版說明；現在納入 Git。
- `creative/hero-image-review.md` 是 2026-09-08 的歷史工作紀錄，包含當時檢查結果，不能視為本次或目前正式環境驗證。
- `scripts/hero-image-api.mjs` 保存既有 Gemini／Photoroom 製圖流程；金鑰由本機環境取得，工作輸出寫入 `.tmp/image-audit/`。
- 來源紀錄中的歷史本機路徑只是製作出處；對應原始工作檔可能未包含在 Git，不能保證所有圖片可僅憑 repository 完整重製。
- 商品圖應保留真實包裝、標籤、比例，公開網站不可使用 Sandbox 浮水印輸出；具體歷史規格見素材紀錄。

## Git 與交接

- 遠端：`https://github.com/charlie6989/saengak_web.git`；主分支：`main`。
- 本次先保存本機快照 `d485e99`，再以 `c93b89e` 合併遠端 `dc54236`；雙方歷史均保留。
- 合併後 `src/`、`api/`、`tests/` 與當時遠端一致；本次新增保存的主要內容是素材製作紀錄、製圖腳本及交接文件。
- 過去 `.gitignore` 排除專案文件與素材紀錄，本次移除相關排除規則；保留金鑰與本機暫存排除。
- `.vercelignore` 仍排除素材工作紀錄等部署不需要的內容；Git 保存範圍與部署上傳範圍不同。
- Git 不包含正式資料庫內容、Shopify 商店資料、DNS、Vercel/Supabase secrets 或完整聊天歷史。後續進度以 `PROJECT_STATUS.md` 與提交歷史更新。
