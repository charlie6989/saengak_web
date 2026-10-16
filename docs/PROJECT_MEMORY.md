# 項目記憶

更新日期：2026-10-17（Asia/Taipei）。本文件依 repository 與本次同步可查證資料整理；不包含聊天紀錄或外部服務資料的完整備份。

## 正式服務補充（2026-10-17）

- 正式 SMTP 已獨立驗證可寄送：Resend `smtp.resend.com:465`、寄件地址 `noreply@auth.saengak.com.tw`，正式 site_url／回跳白名單為 lucissicare.com。顯示名稱已從 SAENGAK 更新為 LUCISSI CARE；未更換正式 SMTP key。實際驗證信 HTTP 200、Resend Delivered；使用者確認收信且成功回到正式站，正式 Auth 回讀 Email 已驗證、最後登入為 2026-10-17 01:33:40（Asia/Taipei）。
- TapPay Shopify 設定仍為測試模式；TapPay Portal 與光貿登入待使用者完成。Vercel Amego sensitive 欄位存在但不可解密讀回，不能把存在當成正式配置驗收。
- 正式 outbox 的 #1006、#1007 已由正確 Shopify 商店 API 確認為 test=true。已將兩筆發票工作由 pending 改為 manual_review，標記 SHOPIFY_TEST_ORDER，回讀 attempts=0／未開票；排除自動派送，未變更 Shopify 訂單或退款。
- Vercel 發票 release gate 必須與 Edge Function 一致，只有字串 `true` 才可派送；缺值／其他值不得默認啟用。b26667a 已部署正式並回讀 alias，CI 通過；本輪回讀訪客開關仍為 false。

## 品牌與網域

- 商店品牌為 **LUCISSI CARE**；SAENGAK 仍是商品品牌，不能把商品品牌歸屬一律替換成商店名稱。`src/lib/brandOwnership.ts` 負責品牌歸屬判斷，`src/content/site.ts` 保存商店公開資料。
- 主要網域設定為 `lucissicare.com`，repository 名稱仍為 `saengak_web`。
- `vercel.json` 將 `saengak.com.tw` 與 `www.saengak.com.tw` 一般頁面永久轉址至新網域；排除 `/api`、`/auth/confirm`、`/reset-password`，以保留服務回呼。修改時須一起檢查相關測試、CSP、Origin 白名單、sitemap 與 robots。

- **子品牌定位（2026-10-17 使用者確認，同日收斂）**：LUCISSI CARE 是「LUCISSI 的日常照護系列」，主張「貼近身體的日常照護」。導覽為私密保養、舒適內搭兩個核心面向，加跨分類的「生理期照護」；身體保養商品併入私密保養，運動內衣併入舒適內搭，肌膚保養與輕盈運動不做分類（理由：沒有或只有 1 件商品、母站 lucissi.com 已有對應分類、台灣臉部保養與女性運動服市場擁擠、PIF 自 2026-07-01 全面實施）。設定集中在 `src/content/carePillars.ts`。不承接情趣與性健康品類。重新加回面向的條件：至少 6–8 件非母站同款商品、能用貼身照護說清楚的角度、化粧品已完成 PIF。待決：與母站重疊品類的分工、會員互通的階段與權益、新照片。
- **Logo（2026-10-17）**：已選定方向 A「家族字標」（LUCISSI 沿用母站 Cormorant Garamond 400、字距 0.32em，下方細線夾 CARE，單色 plum #5B3D48）。規格與設計師需求在設計系統 artifact（https://claude.ai/artifact/LuJEPWJzPNbHwEe5UgDaKp）；SVG 交付前網站續用 `lucissi-care-logo.png`。

- **母站 lucissi.com（2026-10-17 唯讀檢視 `~/Documents/GitHub/LUCISSI_website`）**：與本站完全分開——Shopify `j97kr5-7b`、Supabase `dhktmpcvtoxcicqkwgpn`、Vercel `lucissi-website`；會員以 Supabase Auth 為準（程式中保留已關閉的 Shopify 客戶帳號登入，正式站實際使用哪一套未驗證）；點數／等級已寫好但未啟用，且綁 LUCISSI 的 Shopify 客戶編號；免運滿 NT$1,500、運費 NT$146。母站程式與測試刻意拒絕使用本站的商店與資料庫。使用者已決定需要會員互通，建議分階段（Email 權益互認 → 以 LUCISSI 帳號登入 → 共用點數），不合併資料庫或商店；品類分工與會員方案見設計系統「母站分工與會員互通」，尚待使用者決定。

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
- CI 已恢復完整 `npm audit --audit-level=moderate`；2026-10-16 本機乾淨安裝回報 0 項漏洞，見 `PROJECT_STATUS.md`。

## 既有商品與介面決策

- 保留新版 LUCISSI CARE 視覺、首頁主題與各頁 EditorialHero。
- 文字色最淺用 `gray-500`（#655859）；`gray-400` 只用於圖示與停用狀態。商品價格顯示 `NT$`，商品標籤用品牌紫底。首頁區塊以底色交替區隔，不放空白間隔 section。（2026-10-17）
- 精選商品支援 Shopify featured 等標籤，核心護理商品包含舒緩凝膠。
- 首頁 Solution 支援超值組合、經典單品、全部分類；商品細節依 Shopify 資料呈現。
- 圖片在 `public/images/`。`editorial-v2`、`lucissi-v3`、`lucissi-v4`、`lucissi-v5` 是既有版本目錄，不能未查引用就刪除。

## 商品資訊與宣稱原則（2026-10-15）

- 商品頁的成分、產地、檢驗、認證、專利與品牌授權只能來自 Shopify 實際填寫的資料；程式碼不得補預設宣稱、評分、NEW 標籤或 mock 商品。回歸字串列在 `scripts/verify-public-content.mjs`。
- SAENGAK 原廠文件（產品說明書、CPNP/SCPN 與安全評估含成分表、純素／Halal／MOCRA、ISO 22716）存放在公司 NAS 的 `saengak_kr` 共用資料夾，不在 Git。內褲類目前沒有檢測報告。
- 2026-10-15 比對結果：Made in Korea 有依據；Dermatest 僅見於原廠說明書（濕巾 Excellent、泡沫潔淨露 confirmed）；純素證書效期至 2026-03-19；凝膠與慕斯在 Shopify 的成分及慕斯 pH 與原廠不符；無專利文件。
- 列表與推薦一律有貨優先；商品頁預設第一個有貨規格。

## 營運決策（2026-10-16）

- 全站免運門檻為 NT$1,500（2026-10-17 決定比照 LUCISSI 母站，原為 NT$1,499；migration `20261017030000` 與 Shopify 運費規則／FREESHIP 門檻需一起上線）。程式碼預設值在 `src/domain/shipping.ts`（`DEFAULT_FREE_SHIPPING_THRESHOLD`），但 API 與購物車優先採用 Supabase `site_settings.free_shipping_threshold`；三處（程式碼、Supabase、Shopify 運費規則）必須一起改。
- 未達門檻的基本運費為 NT$146（黑貓宅急便常溫宅配，參照 LUCISSI 網站）。`DEFAULT_SHIPPING_FEE` 只是後備值，顧客看到的是 Supabase `site_settings.default_shipping_fee`；改運費時程式碼、Supabase、Shopify 運費三處一起改。
- 客服暫時只用 Email（`Company@lucissi.com`）。
- 訪客結帳已決定開放；登入改為會員優惠入口。前後端已隨 PR #37／#38 合併至 `main`，2026-10-16 正式 Vercel API 確認 `530b2c3` 為 Production／Ready／Current，綁定 `lucissicare.com`。正式 Supabase 已存在 migration `20261016024415`，但當日回讀 `guest_checkout_enabled=false`，尚未對外開放。
- 2026-10-16 已建立正式 Turnstile widget 並設定訪客專用 `VITE_PUBLIC_GUEST_CHECKOUT_TURNSTILE_SITE_KEY`／`TURNSTILE_SECRET_KEY`；會員 CAPTCHA 的 `VITE_PUBLIC_TURNSTILE_SITE_KEY` 必須與 Supabase Auth 獨立配置，避免訪客設定誤影響登入。自動瀏覽器出現 300030，仍待真人成功與端到端驗收。
- 正確 app 的六項實際 webhook 已由舊 `www.saengak.com.tw` 原地更新至 `https://lucissicare.com/api/webhooks/shopify`，ID 不變、無重複；新舊端點簽章 smoke 通過。該 app 不使用舊 Supabase Edge Function v8，本次未更新該函式；不能推論所有其他來源均停用它。
- Vercel Firewall 已發布結帳 API 每 IP 每 60 秒 10 次限速；完整付款／發票／認領與營運規則完成前，正式訪客開關維持 false。
- 當日確認 Supabase Auth `mailer_autoconfirm=false`；正確 Shopify 商店 `gh2xgs-zf` 後台的聯絡方式為 Email，且不要求登入結帳。Shopify connector 當時連到另一間 `j97kr5-7b`，不可用該 connector 的結果代替本店設定。完整查核與剩餘步驟見 `docs/GUEST_CHECKOUT_LAUNCH_CHECKLIST.md`。

## 隔離訪客驗收（2026-10-16）

- 指定組織 `tvahbnsbwsnlmwfessvf` 的測試分支 ref 為 `cpgdxvqywuhredsdgvrd`（branch ID `51c87dc4-0fbe-4956-be52-ff3dc19ccc8e`），無正式資料；不可合併測試資料或把測試 Preview 直接提升正式。費用 US$0.01344／小時另加用量。
- 初次分支建立因正式 migration 歷史缺 baseline 失敗；只在分支補 baseline／缺漏 migration 後 rebase 成功。新增明確 service_role coupon CRUD migration 後 hosted pgTAP 213 項通過；正式庫原有權限，尚未套用該新 migration。
- Shopify 真實 TapPay 沙盒訂單 #1008（gid 18952978923587）付款 166 元，測試 webhook 寫入分支；使用者確認訂單信收到。驗證信是另一條 Supabase Auth／Resend 路徑，分支 SMTP 535 已以核准的測試寄信金鑰修復；Resend Delivered、使用者已點信且 Auth email_confirmed_at 有值，使用者在手機受 Vercel 保護阻擋，已寄限時測試存取連結及新登入信，20:22 已確認手機登入，DB 回讀 #1008 已認領且 correct_owner=true。
- `api/invoice/guangmao.ts` 的 Vercel default.fetch 第二參數是 runtime context，不能當 injected fetch。已改直接用 global fetch，新增回歸測試，449 項單元測試通過；修正已透過 `530b2c3` 上正式部署，CI 成功且正式 alias 回讀確認。
- Resend `auth.saengak.com.tw` 網域 Verified；既有 SAENGAK 金鑰僅寄信權限、完整值不可取回。已核准建立僅該網域寄信的測試金鑰並設定分支，驗證信送達。正式 SMTP 是否可用未測；隔離分支原錯誤不能直接當成正式故障。
- #1008 已取消，TapPay 測試 REFUND SUCCESS；發票 AB12361301 開立及作廢皆回讀 99。五項測試 webhook 已刪除，正式六項回讀未變。
- 正式 guest flag 維持 false；TapPay 正式後台仍為測試模式。驗證後認領已通過；真人 Turnstile 已通過隔離桌機前端＋API，手機截圖確認驗證成功；正式設定及營運資料保留規則尚未完成。

- 真人驗證使用 `saengak-web-d2ux-guest-acceptance.vercel.app`（Preview `dpl_HY7KGcAykeeTqqrSKpofn6xE6uDb`），真實 widget 的 Cloudflare／server whitelist 都已加入精確測試 alias；測試完移除該 hostname、alias 與短效分享連結。

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
