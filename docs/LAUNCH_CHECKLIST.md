# SAENGAK 上線切換清單 (Launch Cutover Checklist)

> 建立日期：2026-08-17
> 本文件收斂「測試閘門狀態 → 正式公開上線」當日與前置必須完成的所有切換事項。
> 任一項未完成即不得宣稱正式上線。權威層級依 `00_DECISION_LOG.md`。

## 1. 移除測試閘門與測試憑證

- [ ] 移除 `middleware.js` TestAccessGate（`/assets/*` 資產閘門）。
- [ ] 移除 `api/test-access.mjs` 端點與前端測試登入 UI。
- [ ] 自 Vercel 刪除 `SAENGAK_TEST_USERNAME`、`SAENGAK_TEST_PASSWORD`、`SAENGAK_TEST_SESSION_SECRET` 三個環境變數。
- [ ] 確認移除後全站資產可公開存取（無 404 誤擋）。

## 2. SEO 解封

- [ ] 自 `vercel.json` 移除 `X-Robots-Tag: noindex, nofollow, noarchive`。
- [ ] 提交 sitemap 至 Google Search Console；確認 `robots.txt` 與結構化標記生效。

## 3. 安全標頭與 CSP 定版 (✅ 已完成)

- [x] `vercel.json` 補上 `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`（HSTS）。
- [x] CSP `connect-src` 放行 `https://gh2xgs-zf.myshopify.com`。
- [x] CSP `connect-src` 放行 `https://*.ingest.sentry.io`。
- [ ] Phase 2 啟用結帳時：依 `MAIN_SPECIFICATION.md` §1.2.5 之「CSP 網域放行對照表」補齊 TapPay 相關網域。
- [ ] 以 securityheaders.com 或同等工具驗收 A 級以上。（需實際部署後線上掃描，程式碼複查無法確認）。

## 4. 程式碼硬編碼清理（✅ 已完成）

- [x] 移除 `src/pages/product/page.tsx` 與 `src/pages/search/page.tsx` 中硬編碼之非授權專案 ref。
- [x] 修正 `src/pages/community/page.tsx`、`src/pages/home/page.tsx` 之 fallback 網域。
- [x] 全域掃描確認：除 `tmqzkagkrzhioftvwbqo` 外，原始碼與環境變數中不得出現任何其他 Supabase project ref。
- [x] 清理 `VITE_PUBLIC_CHECKOUT_SUPABASE_URL` / `VITE_PUBLIC_CHECKOUT_SUPABASE_KEY`（程式碼面已確認無引用，尚待自 Vercel 專案設定實際移除環境變數）。

## 5. 監控接線（✅ 已完成）

- [x] 安裝並初始化 `@sentry/react` 與 `@sentry/vite-plugin`。
- [x] `vite.config.ts` 配置 `build.sourcemap: 'hidden'` 與 `@sentry/vite-plugin`。
- [x] `beforeSend` / `beforeBreadcrumb` 掛上 `src/lib/sentry.ts` 之 `sanitizeEvent` / `sanitizeBreadcrumb`。
- [ ] 部署後實測一筆錯誤事件成功上報且已脫敏。（需實際部署後驗證，程式碼複查無法確認）。

## 6. 憑證與帳號安全

- [ ] 依 `SECRET_HANDOFF_GUIDE.md` §3 完成應輪替之金鑰輪替。
- [ ] 所有平台帳號（Vercel / Supabase / Shopify / TapPay / SiteGiant / 光貿 / ShipAny / Sentry）啟用 2FA。
- [ ] GitHub repo 啟用 push protection / secret scanning。

## 7. 最終驗收

- [ ] Vite production build 零錯誤零警告。
- [ ] 單元與整合測試全數通過。
- [ ] 主要頁面 Web Vitals（LCP / CLS / INP）達標。
- [ ] 跨帳號 RLS 測試 11/11 通過（見 SUPABASE_DEPLOYMENT §4）。
