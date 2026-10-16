# 訪客結帳上線查核

更新：2026-10-16（Asia/Taipei）。本機已由 `2f5d0c7` fast-forward 至 `bb5f694`，並接續下列設定及程式修正。**訪客開關維持 false；尚未通過正式端到端驗收。**

## 本次已完成

| 項目 | 已執行與證據範圍 |
| --- | --- |
| Cloudflare Turnstile | 建立 `LUCISSI CARE guest checkout` Managed widget，允許 `lucissicare.com`、`www.lucissicare.com`；preclearance 關閉。Production 已保存 secret 與公開 site key，未將 secret 放入 Git |
| 驗證設定分離 | 首次使用共用 `VITE_PUBLIC_TURNSTILE_SITE_KEY` 部署後，在自動瀏覽器觀察到 300030，會員登入按鈕無法使用。改為訪客專用 `VITE_PUBLIC_GUEST_CHECKOUT_TURNSTILE_SITE_KEY`，既有 Auth CAPTCHA 仍用原變數；不以訪客設定啟用會員 CAPTCHA。程式修正待下方正式部署回讀 |
| Shopify 實際 app | `gh2xgs-zf.myshopify.com` 的 `SAENGAK Order Sync`（app 411199766529）；以現有 client credentials 成功取得 Admin API 存取權。憑證僅保存在 gitignored `.env.local`（0600），沒有建立新 app、增加權限或旋轉密鑰 |
| 實際 webhook | Admin API 回讀六項訂閱原本全部指向 `https://www.saengak.com.tw/api/webhooks/shopify`，無其他頁。已用 `webhookSubscriptionUpdate` 原地更新為 `https://lucissicare.com/api/webhooks/shopify`；更新後逐一回讀相同 ID/topic、新 URI，六項且無重複 |
| webhook 簽章 | 新舊 URL 各送出有效 app HMAC、刻意無效 JSON，皆回 400 無效 JSON，而非 401；確認簽章及路由，沒有寫入訂單。這不是 Shopify 真實事件投遞驗收 |
| Vercel Firewall | 已發布 `Checkout API per-IP rate limit`，Request Path Equals `/api/create-shopify-cart`，Fixed Window 60 秒、10 次／IP，超限 429；適用會員與訪客，未套到 webhook。需下方實測回讀 |
| 正式資料庫 | 正確 Supabase `tmqzkagkrzhioftvwbqo` migration `20261016024415` 存在；guest_checkout_enabled=false；Email 自動確認關閉；訪客資料查核時為 0 |
| Shopify 結帳 | 正確後台聯絡方式為 Email、不要求登入；免運門檻 1499，運費 146 |
| 自動測試 | 46 檔／448 項通過；新增訪客金鑰不影響會員登入、Auth 金鑰不啟用訪客的回歸測試；typecheck、build 通過，主 chunk 約 527 kB 警告仍在 |
| 資料庫測試 | 以獨立本機 Supabase DB（port 55432）從空庫套用所有 migration，8 檔／213 項 pgTAP 全通過，包含訪客 43 項；未改其他專案 Docker 容器 |

六個 topic 與訂閱 ID：

- ORDERS_CREATE：1571833479235
- ORDERS_PAID：1571833512003
- ORDERS_UPDATED：1571833544771
- ORDERS_FULFILLED：1571833577539
- ORDERS_CANCELLED：1571833610307
- REFUNDS_CREATE：1571833643075

舊 Supabase Edge Function v8 缺少訪客 Email 處理，但這個 app 的六項訂閱都不指向它；本次未部署該函式。不能據此斷言其他 app 或手動來源永遠不會使用它。

## 尚未完成，未啟用原因

1. 真實 Turnstile `guest_checkout` challenge、hostname/action、一次性 token 的成功驗收。300030 是本次自動瀏覽器觀察，不能推論每位真人都會失敗，也不能算通過。使用隔離測試環境，不可為了取得 token 先打開正式訪客開關。
2. 隔離 Shopify／TapPay 測試訂單 → 真正 Shopify webhook → guest 訂單／Email → 光貿測試發票 → 訂單確認信 → 同 Email 驗證註冊後認領；另驗退款／取消、重複事件、認領競態、他人資料隔離及既有會員優惠。此次未執行付款、建立訂單或開立發票。
3. 尚未取得並核對光貿測試模式、測試商店／付款測試資料；正式 Preview 現有 Supabase URL 與 Production 共用設定，不可直接當作隔離測試環境。
4. 營運仍需確定訪客 Email 保存／刪除期間、個人無載具發票處理及客服訪客訂單流程，並更新隱私頁與清理策略。不可擅自設定個資保存期限或改正式發票模式。
5. 上述驗收通過才設定 `guest_checkout_enabled=true`，再回讀手機／桌機與正式流程。回復方式是設回 false，僅停止新訪客 checkout；既有訂單 webhook 照常處理。

本站訂單查詢表單／`api/order-lookup` 為第二階段，第一階段依設計使用 Shopify 確認信的狀態連結。

## 存取及回復

- Vercel MCP／原 CLI 無此團隊權限，但本次已透過既有 Google 帳戶登入正確瀏覽器後台完成設定。不要再把環境變數列為完全未查證。
- Shopify connector 仍連到別店 `j97kr5-7b`；本次改用正確商店的 Admin API，不使用別店資料。
- webhook 回復可用相同六個 ID 原地改回上列舊 URL；不要另建訂閱。舊網域 API 未轉址且簽章檢查仍可用。
- 本機原始驗證輸出保存在 gitignored `.tmp/guest-launch/`；不包含明文憑證。正式服務設定與資料不在 Git 備份內。

參考：[Shopify 原地更新訂閱 API](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/webhookSubscriptionUpdate)、[Turnstile 錯誤碼](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/)。
