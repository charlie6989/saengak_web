# TapPay × Shopify 串接基線

更新日期：2026-08-22（`create-shopify-cart` 已由 Supabase Edge Function 遷移至 Vercel `api/create-shopify-cart.ts`，見 `00_DECISION_LOG.md` §3.3；前版：2026-08-13）

> 本文件為**現行**結帳流程權威文件。2026-08-17 至 2026-08-21 間曾短暫改為自建 React Checkout + TapPay Direct Pay SDK（見已廢棄之 [`CHECKOUT_PAYMENT_SPEC.md`](CHECKOUT_PAYMENT_SPEC.md)），已於 2026-08-21 回歸本文件所述之 Shopify Checkout 跳轉架構。

## 架構結論

TapPay 依教學文件安裝為 Shopify Payment App。SAENGAK 前端不直接處理卡號，也不保存 TapPay Partner Key；網站只把 Shopify Product Variant 建成 Storefront Cart，取得 `checkoutUrl` 後導向 Shopify Checkout，顧客再於 Shopify 付款頁選擇 TapPay。

```text
SAENGAK 購物車
  -> Vercel API create-shopify-cart (api/create-shopify-cart.ts)
  -> Shopify Storefront API cartCreate
  -> Shopify checkoutUrl
  -> TapPay Payment App
  -> ShipAny Shopify App 提供配送／超商選店
  -> Amego private outbox 於付款確認後處理電子發票
  -> Shopify signed order webhook
  -> Supabase trusted member order／fulfillment projection
```

## 已完成的程式基線

- 購物車保存 Shopify `ProductVariant` ID；多規格但尚未選定規格時停止結帳。
- `buildShopifyCheckoutLines` 驗證所有商品規格並合併相同 variant 數量。
- `create-shopify-cart` 現為 Vercel Function (`api/create-shopify-cart.ts`)，驗證 Origin（`api/_lib/security.ts`）、商品行數、variant ID 與數量。⚠️ 舊版 Supabase Edge Function 具備 server-side `CheckoutReleaseEnabled` 結帳總開關檢查，遷移後**程式碼中未見對應邏輯**（2026-08-22 複查，見 `00_DECISION_LOG.md` §3.3，尚待工程確認）。
- 已登入會員以 `Authorization: Bearer <token>` 呼叫時，函式呼叫 Supabase Auth `getUser()` 驗證 session；未帶 Bearer 視為訪客結帳，不強制登入。
- 前端只接受 HTTPS `checkoutUrl`，缺少後端環境時不導向、不送出付款。
- 正式商品價格、折扣、稅金與可售狀態以 Shopify Checkout 回讀為準，不信任 localStorage 合計。
- 已登入會員建立 Cart 時，後端驗證 session 後保存 `cart_token -> user_id`；訪客結帳不會被猜測或用 email 自動掛到會員。
- `shopify-orders-webhook` 以原始 request body 驗證 Shopify HMAC，檢查商店、topic、Webhook ID 與 payload，再由 service role 投影訂單或建立退款折讓審核工作。
- 同一 Webhook ID 會去重；較舊的 `updated_at` 事件不會覆蓋較新的付款狀態；未找到可信 Cart 連結的訂單只記錄 `unlinked`，不建立會員訂單。
- Webhook receipts 只保存事件 ID、topic、商店、訂單 GID、時間與處理結果，不保存地址、電話或完整顧客 payload。
- ShipAny 回寫 Shopify fulfillment 後，同一簽章 webhook 會同步配送方式、承運商、追蹤碼與 HTTPS 追蹤連結；SAENGAK 不保存 ShipAny 私有 API key。
- `orders`／`order_items`／`order_fulfillments` 維持會員唯讀。程式測試需由 CI／本機重跑；目前 DB runner 應執行 141 項 pgTAP assertion，正式部署前必須有本機 PostgreSQL 全數通過證據。

## 管理端設定清單

以下步驟需要 TapPay 與 Shopify 管理員登入後操作；尚未完成前維持 sandbox、不得啟用正式扣款。

1. TapPay【開通設置】→【金流服務開通】：確認帳號是 Shopify 帳戶（教學第 3 頁）。
2. TapPay【Shopify 商家設定】：新增商家並依收單規格決定是否啟用 3D（第 4 頁）。
3. 從 [Shopify App Store 安裝 TapPay](https://apps.shopify.com/tappay?locale=zh-TW)，完成 GDPR 信箱與串接，回 Shopify 啟用（第 5–10 頁）。
4. 複製 Shopify 商家設定內的 MGID 名稱，分別於測試／正式環境建立相同 MGID，依收單規格設定備援帳號（第 11–13 頁）。
5. TapPay【開發人員內容】→【應用程式】加入：
   - `link-pay.tappaysdk.com`
   - `shopify-pay.tappaysdk.com`
   - `shopify-t.tappaysdk.com`
   - `shopify.tappaysdk.com`
6. Shopify【付款】→ TapPay：先開啟測試模式（第 15–16 頁）。
7. 建立一筆 sandbox 訂單，確認 Shopify 訂單、TapPay 交易與失敗／取消狀態一致後，才評估正式模式。
8. 訂閱 `orders/create`、`orders/paid`、`orders/updated`、`orders/fulfilled`、`orders/cancelled` 與 `refunds/create`，HTTPS 目的地設為 Supabase `shopify-orders-webhook`；API 使用 2026-07，且只需要 `read_orders`。退款事件只建立人工會計審核工作，不會直接對供應商開立折讓。

三種交易的跨系統證據以 `npm run verify:commerce -- <evidence.json>` 驗收，格式與權威來源見 `docs/COMMERCE_SANDBOX_ACCEPTANCE.md`。成功案例還必須驗證物流 fulfillment／tracking 與發票供應商事件；失敗及取消案例則必須證明沒有誤建物流或發票。

取得 custom app 的 Admin API token 後，不需手動逐條建立：

```bash
# 無 token 時只輸出安全 dry-run 計畫
npm run shopify:webhooks

# 先查現有 subscription，拒絕同 topic 不同 URI；只建立缺少項目並再次回讀
SHOPIFY_ADMIN_ACCESS_TOKEN=*** npm run shopify:webhooks -- --apply
```

腳本固定只允許 `gh2xgs-zf.myshopify.com`、Admin API `2026-07` 與 SAENGAK Production 的 webhook URL；不會把 token 印到輸出，也不會刪除既有 subscription。2026-07-20 建立於舊商店的 `SAENGAK Order Sync` 與訂閱不能當作新商店證據；切換後必須在新商店重新安裝、同步並回讀六個 topics。client secret 只保存於 Supabase Edge Function Secrets，不進入前端、repo 或文件。

## 後端環境設定

> ⚠️ 2026-08-22 更新：`create-shopify-cart` 已遷移為 Vercel Serverless Function (`api/create-shopify-cart.ts`)，與前端共用同一個 Vercel 專案的環境變數，**不再是獨立的 Supabase Edge Function、不再讀取獨立的 Supabase Function Secret**。以下為現行實際使用之變數，取代本節先前描述的 Supabase Secret 清單：

- `VITE_PUBLIC_SHOPIFY_STORE_DOMAIN`：目標商店網域，與前端商品目錄查詢共用同一組公開變數，固定指向 SAENGAK 專用商店 `gh2xgs-zf.myshopify.com`。
- `VITE_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN` / `VITE_PUBLIC_SHOPIFY_API_VERSION`：Storefront API 公開存取憑證與版本，與前端共用（見 `src/lib/shopify.ts`）。
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`（或對應之 `VITE_PUBLIC_SUPABASE_URL` / `VITE_PUBLIC_SUPABASE_ANON_KEY`）：僅用於驗證已登入會員的 Bearer Token 並寫入 `shopify_checkout_links`；service-role 金鑰另由 `api/_lib/supabase-admin.ts` 管理，不對外暴露。
- Origin 允許清單：由 `api/_lib/security.ts` 之 `isOriginAllowed()` 判定，非本節先前所述之獨立 `CheckoutAllowedOrigins` Secret。
- `ShopifyWebhookSecret`：SAENGAK Shopify App 的 client secret，供 `api/webhooks/shopify.ts` 驗證 `X-Shopify-Hmac-Sha256`，只放伺服器端環境變數。

⚠️ **已知缺口（尚待工程確認，見 `00_DECISION_LOG.md` §3.3）**：舊版 Supabase Edge Function 具備 `CheckoutReleaseEnabled=false` 之 server-side 結帳總開關（未精確設為 `true` 一律拒絕建立 Cart），遷移至 `api/create-shopify-cart.ts` 後**程式碼中未見此檢查**。在工程確認此總開關是否仍受控管、或改由其他機制（如 `site_settings.maintenance_mode`）取代之前，**不可假設現行結帳流程仍受此開關保護**。

Storefront 前端另採兩個預設關閉的 release gate：

- `VITE_PUBLIC_SHOPIFY_STOREFRONT_ENABLED=true`：Shopify Online Store 解鎖、真實商品 probe 通過後才設定。
- `VITE_PUBLIC_SHOPIFY_TAGS_ENABLED=true`：Storefront token、tags 與受限庫存欄位驗證完成後才設定。

未通過關卡時公開站使用明確的展示目錄，不反覆呼叫已知會失敗的 Shopify 端點。

六個瀏覽器可呼叫的 Storefront Functions 都以 `verify_jwt=false` 部署並記錄於 `supabase/config.toml`。函式仍會以 Supabase 內建的 `SUPABASE_PUBLISHABLE_KEYS`／`SUPABASE_ANON_KEY` 核對呼叫端 `apikey`；checkout 另以 Origin allowlist 限制瀏覽器來源。

`shopify-orders-webhook` 同樣設為 `verify_jwt=false`，因 Shopify 不會傳 Supabase JWT；函式會在解析 JSON 前用 `ShopifyWebhookSecret` 驗證原始 body 的 HMAC。沒有通過 HMAC、商店網域或 topic allowlist 的請求不會進入資料庫。

## 目前阻擋點（2026-08-13）

以下 2026-07-20／07-30 的 locked、password page 與安裝畫面屬歷史證據，不可當作目前平台狀態。2026-08-12 至 08-13 的公開唯讀回讀已可取得 `gh2xgs-zf.myshopify.com` 商店、商品與 Variant；這只證明公開 Storefront 表面可讀，不等於 TapPay、物流、發票或付款成功。

- 2026-07-30 使用者提供的 TapPay Portal 畫面顯示 `gh2xgs-zf.myshopify.com` 已建立 Shopify 商家設定、MGID 與 3D 驗證規格。這證明 TapPay 商家設定已建立，但畫面未單獨證明 Shopify 付款頁已啟用測試模式或交易成功。
- 2026-07-30 對 `gh2xgs-zf.myshopify.com` 的公開首頁與 Storefront API 曾回覆 password/locked；此紀錄已被 2026-08-12 至 08-13 的公開商品與 Variant 回讀取代，不得再用來描述目前 Storefront 狀態。
- SAENGAK Production Supabase 專案已於 2026-07-30 恢復為 `ACTIVE_HEALTHY`；七個 Shopify Edge Functions 已部署新版本，`create-shopify-cart` v5 遠端回讀固定指向 `gh2xgs-zf.myshopify.com`。使用測試 Variant 的遠端 probe 已正確回傳 `SHOPIFY_STOREFRONT_LOCKED`，仍須 Shopify 解鎖與真實 Variant 才能取得 checkoutUrl。

- Vercel production 已加入新 SAENGAK Supabase URL 與 publishable key、重新部署完成，主要公開路由回歸為 200。
- `SAENGAK Production` (`tmqzkagkrzhioftvwbqo`) 已建立；2026-08-13 七個 migration 已與 Git 對齊並部署，既有七個 Edge Functions 回讀為 `ACTIVE`。新增的 provider-neutral `order_invoices` 只接受受信任後端／發票供應商回寫；Amego worker 與退款版 webhook 尚待部署。商店 domain／API version／公開 Origin 不再依賴 custom secrets。
- `dhktmpcvtoxcicqkwgpn` 已由 `lucissi.com` 正式 bundle 證實屬於另一個網站，不得綁到 SAENGAK；`npm run verify:binding:supabase` 與完整的 `npm run verify:binding` 會阻擋此誤接，`verify:binding:vercel` 只允許驗證前端部署目標，不能取代 Supabase link。
- 舊的 SAENGAK Shopify 商店 `zy6dge-rn.myshopify.com` 是 2026-07-20 的歷史基線，已不再作為目前結帳目標。
- Shopify 2026-07 Storefront API 的 tokenless probe 已可讀取公開商品與 Variant；仍需以真實 Cart／Checkout、付款設定與同一筆 sandbox 訂單回讀證明結帳鏈路。
- TapPay Shopify App Store 目前標示 App 免費。2026-07-20 已在 SAENGAK 商店同意 TapPay Payment App 權限並導向 TapPay 三步驟設定頁，但頁面停在「安裝前請先登入」；只有完成 TapPay 登入、選擇 Shopify 商家設定、開始串接並回到 Shopify 啟用後，才算安裝完成。
- TapPay 要求的 Shopify 權限包含商店擁有人聯絡資料，以及編輯付款閘道／付款工作階段；尚未取得 TapPay Shopify 帳號、3D 收單規格、MGID 或 sandbox 對帳證據。
- 新商店仍須完成 ShipAny owner-system 驗收，以及 Amego worker／secrets／scheduler 與完整 sandbox 對帳；Amego DB migrations 已於 2026-08-13 部署。完成前不可宣稱正式結帳、物流或發票可用。
- `index.html` 中舊 Shopify chat domain `ekfvih-rz.myshopify.com` 目前回傳 404，不能當作有效商店來源。
- Shopify 方案仍需由帳戶持有人選定；這會產生訂閱費用，不能由程式自動購買。
- 現有 mock 商品沒有 Shopify Variant ID，只能驗證安全阻擋，不能建立真實 Shopify Cart。
- `SAENGAK Order Sync` 已建立、發佈並只安裝於 Saengak；`read_orders`、Supabase secret 與五個正式 subscription 已完成。未簽章 probe 回覆 401；使用同一 client secret 產生的有效 HMAC 已通過驗簽並在無效空 payload 階段回覆 400，沒有寫入資料。

## 2026-07-20 串接回讀

| 關卡 | 正式證據 | 判定 |
| --- | --- | --- |
| TapPay App 價格 | Shopify App Store 顯示「免費」 | 可開始安裝，不代表 TapPay 收單服務免費或已核准 |
| Shopify App 授權 | SAENGAK 安裝頁顯示 TapPay 所需權限並已導向 TapPay Portal | OAuth／安裝流程已開始 |
| TapPay Portal | 顯示「安裝前請先登入」及登入／註冊入口 | 需要帳戶持有人登入，尚未完成商家綁定 |
| Shopify 方案 | 付款頁顯示需先「選取方案」，試用期 3 天後結束 | 付費決策關卡，不代購 |
| Storefront API | `gh2xgs-zf.myshopify.com/api/2026-07/graphql.json` 回覆 `Online Store channel is locked` | 新商店尚未解鎖，非前端按鈕或 API 版本錯誤 |
| Supabase checkout v3 | 正確 Origin、publishable key 與合法 cart line 已通過函式驗證；Shopify 回覆 `Online Store channel is locked` | Function 接線完成到 Shopify，待商店啟用與真實 Variant |
| Supabase catalog v3 | Products／Collections／Articles／Search 都到達 Shopify 並回覆 channel locked | tokenless 接線完成；商品尚未可讀 |
| Supabase tag endpoint v3 | 缺 Storefront token 時回覆 503 | tags／受限庫存欄位需管理員建立 token |
| Shopify webhook v2 | App 安裝數回讀為 1（Saengak）；五個 topics 全數回讀存在；未簽章回覆 401，有效 HMAC／無效 payload 回覆 400 且無寫入 | App、secret、訂閱與 HMAC 鏈路完成，待真實 Shopify 訂單事件驗收 |

## 驗收條件

1. 真實 Shopify 單規格商品可從首頁加入購物車並取得 checkoutUrl。
2. 多規格商品沒有選定 variant 時不得結帳。
3. Shopify Checkout 顯示 TapPay，sandbox 測試成功、失敗與取消皆可回讀。
4. 前端、Vercel logs、Supabase function logs 不包含卡號、CVV、Partner Key 或 Storefront token。
5. 正式模式切換前，TapPay 與 Shopify 後台的同一筆測試訂單 ID／金額／狀態完成對帳。

## 參考

- 使用者提供：《TapPay Shopify 串接教學》，2024-09-20，共 18 頁。
- [TapPay Shopify App](https://apps.shopify.com/tappay?locale=zh-TW)
- [Shopify Storefront Cart API](https://shopify.dev/docs/api/storefront/latest/objects/Cart)
- [Shopify Storefront API tokenless access](https://shopify.dev/docs/api/storefront/latest#authentication)
- [Shopify 設定第三方付款供應商](https://help.shopify.com/zh-TW/manual/payments/third-party-providers/configuring-providers)
- [Shopify webhook delivery structure](https://shopify.dev/docs/apps/build/webhooks/delivery-structure)
- [Shopify webhook subscriptions](https://shopify.dev/docs/apps/build/webhooks/subscribe)
- [TapPay Shopify User Manual](https://tappaysdk.com/documents/Shopify%20Operating%20Manual.pdf)
