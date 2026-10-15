# 項目記憶

更新日期：2026-10-15（Asia/Taipei）。本文件依 repository 與本次同步可查證資料整理；不包含聊天紀錄或外部服務資料的完整備份。

## 品牌與網域

- 商店品牌為 **LUCISSI CARE**；SAENGAK 仍是商品品牌，不能把商品品牌歸屬一律替換成商店名稱。`src/lib/brandOwnership.ts` 負責品牌歸屬判斷，`src/content/site.ts` 保存商店公開資料。
- 主要網域設定為 `lucissicare.com`，repository 名稱仍為 `saengak_web`。
- `vercel.json` 將 `saengak.com.tw` 與 `www.saengak.com.tw` 一般頁面永久轉址至新網域；排除 `/api`、`/auth/confirm`、`/reset-password`，以保留服務回呼。修改時須一起檢查相關測試、CSP、Origin 白名單、sitemap 與 robots。

## 架構與整合

- 前端：React 19、TypeScript、Vite 7、React Router、Tailwind CSS；入口與頁面位於 `src/`。
- `api/` 是 Vercel API，包含管理員、購物車、優惠券、Shopify webhook 及光貿發票入口。
- Shopify 提供商品、分類、文章與 Checkout；主要客戶端在 `src/lib/shopify.ts`，結帳與導頁另有專用模組及測試。
- Supabase 承載會員、訂單、評價／問答、優惠券、發票投影與相關授權；`supabase/migrations/`、`supabase/functions/`、`supabase/tests/database/` 保存 schema 變更、Edge Functions 及資料庫測試。
- 光貿發票採 outbox／派送流程；缺少必要憑證時拒絕處理。不可為了讓測試通過而補入正式憑證或取消防護。
- ShipAny 由 Shopify 後台管理；`.env.example` 明確記載網站／Supabase 不另持有 ShipAny API key。
- Sentry 的事件處理與資料清理在 `src/lib/sentry.ts`。
- 依賴 `overrides` 必須同時被 npm 10（CI 的 Node 22）與 npm 11 的 `npm ci` 接受。npm 10 對部分以版本為鍵的 override（例如 `undici@5.29.0`）會誤判 lock 不同步；`undici` 因此巢狀在 `vercel` 下並對 `@vercel/sandbox` 保留 7.x。修改 overrides 後以 `npx npm@10.9.4 ci --ignore-scripts --dry-run` 與 `npm ci --dry-run` 驗證，不要用 npm 10 重建 lock（會帶回有漏洞的版本）。
- CI 稽核目前分為正式依賴 moderate 與全部依賴 critical 兩段；開發依賴剩餘問題見 `PROJECT_STATUS.md`。

## 既有商品與介面決策

- 保留新版 LUCISSI CARE 視覺、首頁主題與各頁 EditorialHero。
- 精選商品支援 Shopify featured 等標籤，核心護理商品包含舒緩凝膠。
- 首頁 Solution 支援超值組合、經典單品、全部分類；商品細節依 Shopify 資料呈現。
- 圖片在 `public/images/`。`editorial-v2`、`lucissi-v3`、`lucissi-v4`、`lucissi-v5` 是既有版本目錄，不能未查引用就刪除。

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
