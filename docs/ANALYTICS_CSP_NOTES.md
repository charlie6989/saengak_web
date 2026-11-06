# 分析與廣告代碼的 CSP 準備筆記

目前網站**沒有**任何分析或廣告代碼。帳號與工具須由店主先決定；本文件只記錄決定後需要調整的項目，不代表已啟用。

## 目前的限制

`vercel.json` 的 CSP 只允許 `script-src 'self'` 加上 TapPay、Cloudflare Turnstile、Google 登入，且沒有 `'unsafe-inline'`。供應商提供的內嵌初始化程式碼會被擋下，須改寫成同源模組（例如 `src/lib/analytics.ts`），不要為此開放 `'unsafe-inline'`。

`img-src` 已允許 `https:`，追蹤像素圖片不需調整。

## 依工具需要增加的網域

下列網域僅供規劃，實際設定時請對照供應商當下的官方文件。

| 工具 | `script-src` | `connect-src` | `frame-src` |
| --- | --- | --- | --- |
| Google Analytics 4／GTM | `https://www.googletagmanager.com` | `https://www.google-analytics.com`、`https://*.google-analytics.com`、`https://*.analytics.google.com`、`https://*.googletagmanager.com` | 使用 GTM 預覽模式時才需要 `https://www.googletagmanager.com` |
| Meta Pixel | `https://connect.facebook.net` | `https://www.facebook.com` | — |
| LINE Tag | `https://d.line-scdn.net` | `https://tr.line.me` | — |

GTM 會讓後台可載入任意第三方程式碼。若使用 GTM，需另外評估 CSP 範圍與後台權限；只用 GA4 時建議直接載入 gtag。

## 啟用前的非程式項目

- 更新 `/privacy` 與 `/adchoices`：`/adchoices` 目前載明沒有提供廣告偏好中心，並承諾加入服務時列明供應商、用途、資料類型與退出方式。
- 由店主與法務決定是否需要同意機制（Cookie 橫幅）。
- Shopify Checkout 在另一個網域，轉換追蹤須在 Shopify 後台另外設定，不受本站 CSP 影響。
