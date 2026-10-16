# 訪客結帳上線查核

## 最新正式服務查核（2026-10-17）

- **正式寄信已送達**：Supabase Auth 配置回讀 SMTP `smtp.resend.com:465`／`resend`、寄件地址 `noreply@auth.saengak.com.tw`，site_url `https://lucissicare.com`，正式回跳白名單及 Email 驗證均正確。只將 sender name 從 SAENGAK 改為 LUCISSI CARE，回讀其餘 SMTP 與 Auth 配置不變。向 `company@lucissi.com` 發送正式驗證信 HTTP 200；Resend `01a145c3-72b7-7ee8-b487-3e1470c5414a` 顯示正確寄件者及 01:30 Delivered。正式 Auth 新增待驗證帳號，沒有新增訂單／付款；收件者實際收信與回跳待確認。
- **TapPay 仍為測試**：Shopify `gh2xgs-zf` 畫面顯示「啟用中／測試模式已開啟」。管理入口的 TapPay Portal 及光貿後台未登入，使用者將登入既有帳號；未建立新帳號或更改收款模式。
- **正式光貿設定仍未確定**：Vercel seller/key/mode/release 等欄位存在但 sensitive 不可解密讀回，不能據此確認配置值。未呼叫正式派送 API，也未開立正式發票。
- **兩筆歷史測試工作**：正式 outbox pending／attempts=0 的 #1006（8330730242115）、#1007（8339114950723）均由 Shopify API 證實 test=true、TapPay SALE SUCCESS/test=true。未變更兩筆資料；正式放行前須排除它們。
- **程式修正**：Vercel 發票 release gate 改為明確 `true` 才派送；缺值、空值、false、TRUE、其他值皆 503，且不認領工作、不對外派送。46 檔／453 項、typecheck、build 通過。部署狀態須另以平台回讀確認。
- 正式 guest flag 本輪仍回讀 false；以下 10/16 紀錄保留歷史範圍，正式寄信「未驗證」已由本節更新，其餘付款、發票與營運待辦仍有效。

## 先前查核紀錄

更新：2026-10-16（Asia/Taipei）。本機先同步 `bb5f694`，後續修正 `530b2c3` 已推送並部署正式（CI `38899581967` 成功，部署 `dpl_5rAjoDsTwBHiuFkdsN7jvJZSoeRR` Ready／正式 alias 回讀確認）。**訪客開關維持 false；尚未通過正式端到端驗收。**

## 本次已完成

| 項目 | 已執行與證據範圍 |
| --- | --- |
| Cloudflare Turnstile | 建立 `LUCISSI CARE guest checkout` Managed widget，允許 `lucissicare.com`、`www.lucissicare.com`；preclearance 關閉。Production 已保存 secret 與公開 site key，未將 secret 放入 Git |
| 驗證設定分離 | 首次使用共用 `VITE_PUBLIC_TURNSTILE_SITE_KEY` 部署後，在自動瀏覽器觀察到 300030，會員登入按鈕無法使用。改為訪客專用 `VITE_PUBLIC_GUEST_CHECKOUT_TURNSTILE_SITE_KEY`，既有 Auth CAPTCHA 仍用原變數；不以訪客設定啟用會員 CAPTCHA。`99596c0` Production 部署 Ready／Current，會員登入按鈕恢復 |
| Shopify 實際 app | `gh2xgs-zf.myshopify.com` 的 `SAENGAK Order Sync`（app 411199766529）；以現有 client credentials 成功取得 Admin API 存取權。憑證僅保存在 gitignored `.env.local`（0600），沒有建立新 app、增加權限或旋轉密鑰 |
| 實際 webhook | Admin API 回讀六項訂閱原本全部指向 `https://www.saengak.com.tw/api/webhooks/shopify`，無其他頁。已用 `webhookSubscriptionUpdate` 原地更新為 `https://lucissicare.com/api/webhooks/shopify`；更新後逐一回讀相同 ID/topic、新 URI，六項且無重複 |
| webhook 簽章 | 新舊 URL 各送出有效 app HMAC、刻意無效 JSON，皆回 400 無效 JSON，而非 401；確認簽章及路由，沒有寫入訂單。這不是 Shopify 真實事件投遞驗收 |
| Vercel Firewall | 已發布 `Checkout API per-IP rate limit`，Request Path Equals `/api/create-shopify-cart`，Fixed Window 60 秒、10 次／IP，超限 429；適用會員與訪客，未套到 webhook。實測前 10 次回 401、超限回 429 |
| 正式資料庫 | 正確 Supabase `tmqzkagkrzhioftvwbqo` migration `20261016024415` 存在；guest_checkout_enabled=false；Email 自動確認關閉；訪客資料查核時為 0 |
| Shopify 結帳 | 正確後台聯絡方式為 Email、不要求登入；免運門檻 1499，運費 146 |
| 自動測試 | 46 檔／449 項通過（含 Vercel runtime context 回歸）；新增訪客金鑰不影響會員登入、Auth 金鑰不啟用訪客的回歸測試；typecheck、build 通過，主 chunk 約 527 kB 警告仍在 |
| 資料庫測試 | 以獨立本機 Supabase DB（port 55432）從空庫套用所有 migration，8 檔／213 項 pgTAP 全通過，包含訪客 43 項；未改其他專案 Docker 容器 |

六個 topic 與訂閱 ID：

- ORDERS_CREATE：1571833479235
- ORDERS_PAID：1571833512003
- ORDERS_UPDATED：1571833544771
- ORDERS_FULFILLED：1571833577539
- ORDERS_CANCELLED：1571833610307
- REFUNDS_CREATE：1571833643075

舊 Supabase Edge Function v8 缺少訪客 Email 處理，但這個 app 的六項訂閱都不指向它；本次未部署該函式。不能據此斷言其他 app 或手動來源永遠不會使用它。

## 隔離端到端驗收

- Supabase 組織 `tvahbnsbwsnlmwfessvf`，分支 `guest-checkout-acceptance`／ref `cpgdxvqywuhredsdgvrd`／branch ID `51c87dc4-0fbe-4956-be52-ff3dc19ccc8e`，with_data=false；費用 US$0.01344／小時另加用量。原有 Preview 共用正式 DB，因此另建明確覆寫環境的部署，不能把它直接提升正式。
- 分支 migration 自動重建缺歷史 baseline；只在分支補齊後 rebase。新增 `20261016111000_grant_coupon_service_access.sql` 明確授予 service_role coupon CRUD，分支 hosted DB 8 檔／213 項 pgTAP 通過；正式庫原有相同權限，尚未套用該新 migration。不可將分支測試資料／歷史修補直接 merge 回正式。
- 前端／webhook Preview：`dpl_FBnoTytYEWaTEMr7GoDyDTrXtRpi`，發票修正 Preview：`dpl_3ATpoHvu9q54cJzikidENsyuooCC`。只有隔離分支開啟 guest flag；使用 Cloudflare 官方 dummy key，這不等同真人 Turnstile 驗收。
- 實際訪客 API 建立購物車後，透過 Shopify Checkout／TapPay sandbox 頁面與官方測試卡完成付款：**#1008**，gid `18952978923587`，NT$166（商品 20＋運費 146），test=true，SALE SUCCESS。Shopify 真實事件寫入隔離 guest 訂單與私有 Email，使用者確認 `company@lucissi.com` 收到 Shopify 確認信。
- #1008 的發票首次遇 Vercel default.fetch 第二參數誤當 fetch 的錯誤；修正後測試發票 **AB12361301** 已回讀 provider_status=99，隔離 outbox=issued。取消時未寄第二封通知，Shopify 已回讀 REFUNDED、TapPay REFUND SUCCESS（test=true）；實際取消事件使 outbox=void_review，已核准此沙盒發票作廢，最終 outbox=voided、provider_status=99、provider_updated_at=2026-10-16T12:15:01Z。
- 獨立光貿 smoke 發票 **AB12361278** 開立與作廢均回讀 99，僅使用官方公開 sandbox seller 12345678；無正式發票。光貿沙盒不自動寄發票通知，不能宣稱發票 Email 已驗收。
- 測試分支 SMTP 原回 535。Resend 已確認 `auth.saengak.com.tw` Verified；經使用者核准建立 `SAENGAK guest acceptance 20261016`，僅該網域 Sending access（ID `cac57cf9-492c-4e5c-ac01-7e06e1c739c5`），只設定隔離分支。20:14 驗證信請求成功，Resend 回讀 Delivered；使用者確認收信並點擊，Auth Email 已驗證。回跳被 Vercel 保護阻擋，已用既有限時連結開通同台 Edge；使用者表示在手機，另寄限時測試存取連結及新登入信，20:22 使用者確認手機登入並看到會員頁；DB 回讀 #1008 user_id 已綁定同 Email 的已驗證會員，profile 存在，認領成功。既有正式金鑰與 SMTP 未修改，正式寄信可用性仍未驗證。

## 尚未完成，未啟用原因

1. 真人驗證 Preview 已另部署 `dpl_HY7KGcAykeeTqqrSKpofn6xE6uDb`，alias `saengak-web-d2ux-guest-acceptance.vercel.app`；使用真實 widget key／secret，Cloudflare whitelist 與 server hostname 都限定此 alias，仍連隔離 DB。20:27 使用者手機截圖顯示 Cloudflare 成功；當時 Email 空白，前端正確阻擋送出。20:29 桌機同站真實 widget 成功後，輸入測試 Email 並點訪客結帳，進入 Shopify Checkout（NT$166），DB 新增 anonymous guest link，證實伺服器 hostname/action 驗證成功。未再次付款。手機填 Email 後導向仍待使用者確認；最終正式網域 smoke 與真人 token 重放尚未另測。先前 300030 不代表所有真人都失敗。
2. 同 Email 驗證後認領已通過（手機登入與 DB correct_owner=true）；桌機前端、會員優惠及完整真人結帳流程待驗收；取消／退款及發票作廢已完成回讀。重複事件與認領競態／他人資料隔離已有 pgTAP，尚不等同全部外部服務驗收。
3. TapPay 仍為測試模式。正式光貿 seller／key／release 設定與正式寄信仍需核對；不能把官方公開 sandbox 配置用於正式。
4. 營運仍需確定訪客 Email 保存／刪除期間、個人無載具發票處理及客服訪客訂單流程，並更新隱私頁與清理策略。不可擅自設定保存期限。
5. 上述完成才設定正式 `guest_checkout_enabled=true`，回讀手機／桌機。回復方式為 false，僅停止新訪客 checkout，既有 webhook 照常處理。本輪最後查核正式 guest 訂單／contacts／links 皆 0。

## 暫時資源與清理

- 為 #1008 建立五個額外測試 webhook（原六項正式訂閱未變）：2089205497923、2089205530691、2089205563459、2089205596227、2089208709187。前四項 filter 限 test=true 且該 cart token；退款限 order_id=18952978923587。已刪除這五項，Admin API 回讀只剩原六項，URI 皆為正式 canonical endpoint。
- 測試 Preview 保留部署保護；使用既有 automation bypass（未建立新的全域 bypass），另建 24 小時單一部署分享連結。敏感 query 不寫進文件。
- 真人 Turnstile alias 有另建 24 小時分享連結；驗收結束移除 Cloudflare 的該測試 hostname 與 Vercel alias。
- 測試 branch／Preview／Resend key 在全部驗收完成後需清理或明確保留；branch 未刪除前持續計費。勿清理其他專案容器或正式資源。

本站訂單查詢表單／`api/order-lookup` 為第二階段，第一階段依設計使用 Shopify 確認信的狀態連結。

## 存取及回復

- Vercel MCP／原 CLI 無此團隊權限；本次已透過既有 Google 帳戶登入後台，另以隔離 CLI 登入完成部署。不要再把環境變數列為完全未查證。
- Shopify connector 仍連到別店 `j97kr5-7b`；本次改用正確商店的 Admin API，不使用別店資料。
- webhook 回復可用相同六個 ID 原地改回上列舊 URL；不要另建訂閱。舊網域 API 未轉址且簽章檢查仍可用。
- 本機驗證輸出與限權限暫存憑證保存在 gitignored `.tmp/guest-launch/`；不可整包分享或提交。正式服務設定與資料不在 Git 備份內。

參考：[Shopify 原地更新訂閱 API](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/webhookSubscriptionUpdate)、[Turnstile 錯誤碼](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/)。
