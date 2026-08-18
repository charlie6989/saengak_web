# Security Policy

## Reporting a Vulnerability

請勿透過公開 Issue、Discussion、PR 或聊天貼出漏洞、密鑰、個資、訂單或付款資料。請使用 GitHub repository 的 **Security → Report a vulnerability** 私人回報功能，提供受影響版本、重現前提、影響與最小必要證據。

Repository owner 會先確認收到回報，再依可達性、資料／付款影響與修復風險安排處理。未經明確同意，請勿測試正式客戶資料、建立真實訂單、嘗試扣款、外傳資料或進行阻斷服務測試。

## Supported Versions

目前僅支援 default branch 最新版本，以及 repository owner 明確指定的 active recovery／release branch。舊 commit、個人 fork、未合併 patch 與未經核准的 production deployment 不在支援範圍；回報時仍請附上實際 branch、commit SHA 與部署邊界。

## System and Scope

本政策適用於：

- React/Vite 公開網站、Vercel middleware 與 test-access API
- Supabase Auth、RLS、migrations、database functions 與 Edge Functions
- Shopify Storefront Cart、Checkout URL 與 signed order webhooks
- Release、binding、commerce、content 與 production verification scripts

重要資產包含會員及訂單資料、付款與 fulfillment 狀態、service-role mutation、Webhook 完整性、平台 secrets，以及正確的 Shopify store／Supabase project 綁定。

## Threat Model and Trust Boundaries

- 公開瀏覽器、公開 API body/header/route/query 與 deployment configuration 都視為不可信輸入。
- Supabase public/publishable key 不是 secret，不能單獨授權敏感 mutation。
- Shopify webhook 只有在原始 body HMAC、shop domain、topic、Webhook ID 及 payload 一致性全部通過後才可信。
- Service-role、Shopify Admin token、Webhook secret 與 TapPay server credential 只能存在受控 server-side secrets。
- Shopify、TapPay、Supabase、物流及發票是不同權威系統；前端 localStorage、成功頁、Email、toast 或文件聲明不是交易真相。

## Security Invariants

下列性質必須維持：

- 上線前結帳 fail-closed；`CheckoutReleaseEnabled` 未精確設為 `true` 時不得建立 Shopify Cart。
- 敏感資料 mutation 必須在可信後端完成授權，不依賴 UI 隱藏或 client-side gate。
- 所有外部輸入必須有格式、長度、數量與資源消耗上限。
- Customer-clickable URL 必須是可接受的公開 HTTPS 目的地；Checkout 必須固定到 SAENGAK Shopify host。
- Webhook 必須驗簽、去重、限制 body，並防止 topic/body 矛盾與舊狀態覆蓋新狀態。
- RLS 必須使會員只能讀寫自己的允許資料；service-role 不得進入 browser bundle。
- Binding verifier 必須精確核對 SAENGAK 的 Supabase project、Shopify store 與 Vercel project。
- Release evidence 缺值、矛盾或來源未核對時必須失敗，不得由「不是 paid」之類的缺值推論通過。
- Repository、build assets、logs 與測試證據不得包含 secrets、個資或真實付款資料。

## Reportable Findings and Severity Context

可實際跨越上述信任邊界、破壞授權／資料隔離／訂單付款完整性、洩漏機密，或使 release verifier 錯誤批准上線的問題，都屬可回報範圍。

嚴重度依實際可達性與影響判斷：未授權付款或 service-role mutation、跨會員資料存取、有效 credential 外洩通常較高；只在非 production、需 owner 權限且有可靠補償控制的問題通常較低，但不能僅以「目前未上線」自動忽略。

## Out of Scope and Limitations

- 未經授權的社交工程、實體攻擊、員工帳號接管或第三方平台本身的漏洞。
- 只影響 `node_modules` 的第三方問題應先確認本專案是否可達；dependency advisories 仍需追蹤與更新。
- 展示文字、UI 偏好或一般功能錯誤，若不破壞安全邊界，不視為安全漏洞。
- 不接受對正式站進行壓力測試、真實扣款、客戶資料探測或破壞性驗證。

已知限制不等於接受風險：Docker-backed pgTAP、Supabase 正式 binding、TapPay 三種 sandbox 情境及 owner-system readback 仍是正式扣款前的必要關卡。
