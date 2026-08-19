# SAENGAK：ShipAny 物流＋Amego 光貿電子發票整合

更新日期：2026-08-13

## 已選架構

```text
SAENGAK Cart
  -> Shopify Checkout
     -> TapPay：付款
     -> ShipAny：配送方式／超商選店
  -> Shopify Order
     -> ShipAny 回寫 Shopify fulfillment + tracking
     -> Shopify signed order webhook -> Supabase 訂單／物流投影
     -> exact paid -> private Amego outbox
        -> 獨立 worker -> Amego API
        -> invoice_query 回讀 C0401／A0401 + status 99
        -> public.order_invoices（會員只讀自己的）
     -> signed refunds/create webhook
        -> private allowance_review（人工財會核准）
        -> g0401／g0501
        -> allowance_query 回讀 D0401／B0401 或 D0501／B0501 + status 99
        -> public.order_invoice_allowances（會員只讀自己的）
```

- ShipAny 採 Shopify App 原生整合。repo、Vercel 與 Supabase **不需要 ShipAny API key**。
- ShipAny 官方 App 說明支援訂單同步、標記 Shopify fulfillment 與 tracking URL 回寫；SAENGAK 只信任 Shopify HMAC webhook，不另信任物流商 payload。
- Amego 使用 `/json/f0401` 自動配號；HTTP 2xx 或 `code=0` 都不直接標記 `issued`。只有 `/json/invoice_query` 回讀同一 `OrderId`、同金額、合法 C0401／A0401 類型且 `invoice_status=99` 才建立會員可見發票投影。
- 付款 webhook 只在資料庫 transaction 內建立私有、具 SHA-256 digest 的 outbox；不等待 Amego 網路呼叫。
- 作廢不自動執行。Shopify 取消已開票訂單只會進 `void_review`，須財會確認跨期、折讓與申報狀態後，以受限 RPC 核准。
- Shopify `refunds/create` 只建立 `allowance_review`；財會核准後才可呼叫 `/json/g0401`。折讓作廢同樣需要另一次核准後才可呼叫 `/json/g0501`。同一發票的作廢與有效折讓互斥，累積折讓金額不得超過原發票。

財會核准只能由持有 service role 的受信任後端執行，入口如下；管理介面或一般會員不得直接取得 service role：

| 動作 | 受限 RPC | 輸入識別碼 |
| --- | --- | --- |
| 發票作廢 | `approve_amego_invoice_void` | Shopify Order GID |
| 開立折讓 | `approve_amego_allowance_issue` | Shopify Refund GID |
| 折讓作廢 | `approve_amego_allowance_void` | Shopify Refund GID |

## 程式狀態

以下程式已在目前 branch 實作；兩筆資料庫 migration 已於 2026-08-13 部署至 `SAENGAK Production`，Edge Functions、secrets、scheduler 與供應商 sandbox 驗收仍未部署／完成：

- Checkout 收集個人、公司統編、手機條碼、光貿 Email 載具或捐贈碼；前後端都做格式驗證。只有已登入、且能以 checkout link 精確連回同一會員訂單的付款，才進入自動 Amego outbox；未知 cart token 或其他 Shopify 通路不會自動開票。匿名結帳在財會另訂流程前不得算作自動開票上線證據。
- `private.checkout_invoice_preferences`：依 Shopify cart token 暫存，瀏覽器角色無權讀寫。
- `private.amego_invoice_jobs`：transactional outbox、不可變 request snapshot/digest、具 fencing token 的 lease、外部 mutation 一次送出後只查詢、退避重試與人工作廢審核。
- `private.amego_allowance_jobs`：每個 Shopify Refund 一筆不可變折讓 snapshot；先人工審核，核准後才可執行，支援多次部分退款、折讓作廢、累積金額上限與獨立 fencing token。
- 目前退款 parser 只接受整數 TWD 且每個退款品項可精確核對為台灣應稅 5% 的資料；零稅率、免稅或混合稅率一律拒絕自動建立折讓工作，須等財會另訂規則後再擴充。
- `amego-invoice-dispatch`：固定只連 `https://invoice-api.amego.tw`，form-urlencoded、官方 MD5 簽章、10 秒 timeout、禁止 redirect、限制 response 大小、先查再開與開後再查。
- provider response 只保存狀態、發票號碼與時間；不記錄 App Key、簽章、載具、買受人資料、QR code 或原始 response。
- 開立、作廢、折讓、折讓作廢、取消、終止失敗或轉人工審查後清空 outbox payload；過期 checkout preference 會在保存、同步與 worker claim 時清除，另提供受限 purge RPC 供排程執行。`order_invoices` 與 `order_invoice_allowances` 均由 RLS 限制為訂單本人可讀。
- ShipAny 回寫沿用 `orders/updated`／`orders/fulfilled`；相同 Shopify update timestamp 以 webhook triggered-at 解決排序，不新增 ShipAny secret 或不同 payload 的 fulfillment webhook。

## 正式啟用前必要步驟

### ShipAny（Shopify owner 操作）

1. 登入 [ShipAny Taiwan Portal](https://portal-tw.shipany.io/user/login) (管理帳號：`charlie.liu6989@gmail.com`)，確認密碼已透過加密管道交接。
2. 精確確認商店為 `gh2xgs-zf.myshopify.com`，再安裝 ShipAny。
3. 先停用 Waaship 可能建立的重複 Checkout 配送方式；不要讓兩套超商選店同時對客。
4. 審閱 App 所需訂單、顧客與履約權限，以及 ShipAny 隱私政策。
5. 綁定台灣帳號、寄件／退貨地址、7-ELEVEN／全家與宅配承運商。
6. 若要在 Checkout 顯示即時計算運費，確認 Shopify 方案具第三方承運商計算運費資格。
7. 如需服務點列表，帳戶持有人確認 NT$398／月、14 天試用及當期豁免條件後再接受訂閱。
8. 實測完整出貨、部分出貨與後補 tracking，逐層回讀 ShipAny → Shopify → signed webhook → Supabase → 會員中心。

### Amego（公司／財會與工程共同操作）

1. 公司代表在 Amego 完成公司新增、財政部授權、字軌與 API 申請；不要共用 owner 密碼。
2. 先用官方 test seller 測試，再切正式公司統編與 App Key。測試與正式共用 host，必須靠 `AmegoMode`、seller allowlist 與 release kill switch 防止誤用。
   - **測試統編 (Sandbox)**：`12345678`
   - **正式統編 (Production)**：`90014835` (SAENGAK)
3. 將對應的 `AmegoAppKey`、`AmegoSellerTaxId`、`AmegoDispatchToken` 分別更新於 `.env.local` 與 Supabase Edge Function Secrets 中，嚴禁明文寫入規格書。
4. 部署 `20260813045204_add_amego_invoice_outbox.sql`、`20260813070648_add_amego_allowance_lifecycle.sql` 與兩個更新 Edge Functions 後，新增並回讀 Shopify `REFUNDS_CREATE` subscription；配置受信任 scheduler 呼叫 worker與每日 `purge_expired_invoice_data()`；queue 只傳 order GID，不傳 PII。
5. 財會書面決定：手動標記付款是否可開票、B2B 稅額規則、跨期作廢、退款折讓、混合稅率與海外零稅率。未決定前保持 `AmegoInvoiceReleaseEnabled=false`。
6. success／failed／cancelled 各跑一筆 sandbox；success 必須取得 Amego status 99，failed/cancelled 必須證明沒有 provider OrderId／發票號碼。
7. 另跑四個財會案例：核准發票作廢並回讀 C0501／A0501 status 99、部分退款開立折讓並回讀 D0401／B0401 status 99、第二次部分退款累積不超額、折讓作廢並回讀 D0501／B0501 status 99。所有案例只用測試 seller，正式 release switch 保持關閉。

## 環境變數契約

| 名稱 | 放置位置 | 說明 |
| --- | --- | --- |
| `AmegoInvoiceReleaseEnabled` | Supabase secret | 預設 `false`；核准後才可精確設為 `true` |
| `AmegoMode` | Supabase secret | `test` 或 `production` |
| `AmegoSellerTaxId` | Supabase secret | 賣方統編，不得放入 `VITE_*` |
| `AmegoAllowedSellerTaxIds` | Supabase secret | 允許統編清單，避免 test/prod 誤切 |
| `AmegoAppKey` | Supabase secret | 光貿 App Key |
| `AmegoDispatchToken` | Supabase secret／scheduler | worker 自訂驗證 token，需高熵並輪替 |
| ShipAny secret | 不存在 | 設定留在 ShipAny／Shopify 管理端 |

## 正式驗收證據

執行：

```bash
npm run verify:commerce -- docs/commerce-sandbox-evidence.local.json
```

成功案例必須同時符合：

- Shopify、TapPay、Supabase 的同一 Order GID 與整數 TWD 金額一致。
- ShipAny 已安裝／綁定，Checkout 配送方式已實測。
- Shopify 與 Supabase 的同一 fulfillment GID、公開 HTTPS tracking URL 完全一致。
- Amego provider=`amego`、provider status=99、同一 Shopify Order GID、不可變 `S<Shopify numeric order id>` Provider OrderId 與合法發票號碼。
- 四個財會 sandbox 案例的 owner-system 回讀另要求同一 Shopify Refund GID、唯一 AllowanceNumber、折讓淨額＋稅額等於退款整數 TWD 金額，且只能由供應商 `allowance_query` 的 status 99 確認開立或作廢；目前 `verify:commerce` 只機械驗證付款三案例，不能取代這四筆財會回讀。

failed／cancelled 案例必須明確沒有 fulfillment GID、tracking URL、Amego Provider OrderId 或發票號碼。正式 launch 仍需 DB pgTAP、binding、三情境證據與 owner-system readback 全部完成。

## 官方參考

- [ShipAny Shopify App](https://apps.shopify.com/shipany-1?locale=zh-TW)
- [ShipAny 台灣方案](https://www.shipany.io/zho/pricing/)
- [Shopify 第三方計算運費資格](https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/third-party-carrier-calculated-shipping)
- [Amego API 文件](https://invoice.amego.tw/api_doc/)
- [Amego API 範例](https://invoice.amego.tw/api_doc/example)
- [Amego 錯誤碼](https://invoice.amego.tw/info_detail?mid=71)
