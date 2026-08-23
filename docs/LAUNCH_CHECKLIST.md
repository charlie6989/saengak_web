# SAENGAK 上線切換清單 (Launch Cutover Checklist)

> 建立日期：2026-08-17　最後更新：2026-08-19（§3 CSP 回歸事故修復、§5 補上依賴關係說明）
> 本文件收斂「測試閘門狀態 → 正式公開上線」當日與前置必須完成的所有切換事項。
> 任一項未完成即不得宣稱正式上線。權威層級依 `00_DECISION_LOG.md`。

## 1. 移除測試閘門與測試憑證

- [ ] 移除 `middleware.js` TestAccessGate（`/assets/*` 資產閘門；註：目前此閘門僅在雲端發布環境攔截，本地端 localhost 已直通放行）。
- [ ] 移除 `api/test-access.mjs` 端點與前端測試登入 UI。
- [ ] 自 Vercel 刪除 `SAENGAK_TEST_USERNAME`、`SAENGAK_TEST_PASSWORD`、`SAENGAK_TEST_SESSION_SECRET` 三個環境變數。
- [ ] 確認移除後全站資產可公開存取（無 404 誤擋）。

## 2. SEO 解封

- [ ] 自 `vercel.json` 移除 `X-Robots-Tag: noindex, nofollow, noarchive`。
- [ ] 提交 sitemap 至 Google Search Console；確認 `robots.txt` 與結構化標記生效。

## 3. 安全標頭與 CSP 定版 (✅ 已完成，2026-08-19 修復回歸並補強自動化驗證)

> **2026-08-19 事故記錄**：本節四項曾於稍早被標記「✅ 已完成」，但實際部署的 `vercel.json` 遺漏 Shopify／Sentry 網域，導致正式站商品請求遭 CSP 封鎖並靜默退回展示假資料，且 `npm test` 與 `npm run verify:production` 當時皆未涵蓋這些網域、未能攔截。已修復並補強自動化驗證，詳見 [`00_DECISION_LOG.md` §3.1](00_DECISION_LOG.md#31-csp-允許清單回歸事故與強制驗證決策-2026-08-19)。往後本節任一項目「✅ 已完成」須同時滿足：(1) `vercel.json` 實際內容、(2) `scripts/production-surface-lib.mjs` 之 `REQUIRED_CSP_DIRECTIVES` 涵蓋、(3) `npm test` 通過，三者缺一不可。

- [x] `vercel.json` 補上 `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`（HSTS）。
- [x] CSP `connect-src` 放行 `https://gh2xgs-zf.myshopify.com`。
- [x] CSP `connect-src` 放行 `https://*.ingest.sentry.io` 與 `https://*.ingest.us.sentry.io`。
- [x] CSP `style-src`／`font-src` 放行 `https://cdn.jsdelivr.net`（Remix Icon 圖示 CDN，先前遺漏導致正式站圖示未渲染）。
- [x] 上述四項網域已納入 `scripts/production-surface-lib.mjs` 之 `REQUIRED_CSP_DIRECTIVES`，由 `npm test`（CI 每次 push main 執行）與 `npm run verify:production`（線上實測）雙重強制驗證，非僅文件宣告。
- [ ] Phase 2 啟用結帳時：依 `MAIN_SPECIFICATION.md` §1.2.6 之「CSP 網域放行對照表」補齊 TapPay 相關網域，並同步更新 `REQUIRED_CSP_DIRECTIVES`。
- [ ] 以 securityheaders.com 或同等工具驗收 A 級以上。（需實際部署後線上掃描，程式碼複查無法確認）。
- [ ] 部署後於瀏覽器實測 `saengak.com.tw`：console 應無任何 CSP violation 錯誤，且首頁商品應為 Shopify 真實商品（非 `src/mocks/products.ts` 展示假資料）。

## 4. 程式碼硬編碼清理（✅ 已完成）

- [x] 移除 `src/pages/product/page.tsx` 與 `src/pages/search/page.tsx` 中硬編碼之非授權專案 ref。
- [x] 修正 `src/pages/community/page.tsx`、`src/pages/home/page.tsx` 之 fallback 網域。
- [x] 全域掃描確認：除 `tmqzkagkrzhioftvwbqo` 外，原始碼與環境變數中不得出現任何其他 Supabase project ref。
- [x] 清理 `VITE_PUBLIC_CHECKOUT_SUPABASE_URL` / `VITE_PUBLIC_CHECKOUT_SUPABASE_KEY`（程式碼面已確認無引用，尚待自 Vercel 專案設定實際移除環境變數）。

## 5. 監控接線（✅ SDK 已完成；依賴 §3 CSP 放行才可實際送達）

> **與 §3 的依賴關係**：Sentry SDK 即使正確初始化，若 §3 的 CSP `connect-src` 未放行 `*.ingest.sentry.io`，事件會在瀏覽器端被直接封鎖、無法送達 —— 這正是 2026-08-19 事故期間的實際狀態（見 §3 事故記錄）。§3 修復後本節才具備實際生效的前提條件。

- [x] 安裝並初始化 `@sentry/react` 與 `@sentry/vite-plugin`。
- [x] `vite.config.ts` 配置 `build.sourcemap: 'hidden'` 與 `@sentry/vite-plugin`。
- [x] `beforeSend` / `beforeBreadcrumb` 掛上 `src/lib/sentry.ts` 之 `sanitizeEvent` / `sanitizeBreadcrumb`。
- [ ] 部署後實測一筆錯誤事件成功上報且已脫敏。（需實際部署後驗證，程式碼複查無法確認）。
- [x] 商品／文章抓取失敗退回展示假資料之靜默降級路徑已補上 `captureExceptionSafe()` 回報（2026-08-19 修復，詳見 `00_DECISION_LOG.md` §3.1）：`ProductSection.tsx`、`SolutionSection.tsx`、`ReviewSection.tsx`、`search/page.tsx`、`product/page.tsx`、`shopify.ts` 之 `getShopifyArticles()` / `getShopifyArticleByHandle()`。`npm test`（147/147）通過。**部署後仍須實測一筆降級事件確實送達 Sentry**，見上一項。

## 6. 憑證與帳號安全

- [ ] 依 `SECRET_HANDOFF_GUIDE.md` §3 完成應輪替之金鑰輪替。
- [ ] 所有平台帳號（Vercel / Supabase / Shopify / TapPay / SiteGiant / 光貿 / ShipAny / Sentry）啟用 2FA。
- [ ] GitHub repo 啟用 push protection / secret scanning。

## 7. 最終驗收

- [ ] Vite production build 零錯誤零警告。
- [ ] 單元與整合測試全數通過。
- [ ] 主要頁面 Web Vitals（LCP / CLS / INP）達標。
- [ ] 跨帳號 RLS 測試 11/11 通過（見 SUPABASE_DEPLOYMENT §4）。

## 8. 會員 Auth 正式化

- [ ] Supabase Auth 改用自有 SMTP，完成 SPF／DKIM／DMARC，並以非組織成員信箱實測註冊驗證及密碼重設。
- [ ] Vercel 設定 `VITE_PUBLIC_TURNSTILE_SITE_KEY`，Supabase Attack Protection 保存 Turnstile Secret Key，完成正式與 Preview 網域 allowlist 後才啟用 CAPTCHA。
- [ ] 升級 Supabase Pro 經核准後，啟用「Prevent use of leaked passwords」並重新執行 Security Advisor。
- [ ] 實測：短於 12 字元的既有會員仍可登入；新註冊與新密碼維持至少 12 字元。
- [ ] 實測：註冊後可於 60 秒冷卻結束後重新寄送驗證信，忘記密碼頁不揭露該 Email 是否存在。
