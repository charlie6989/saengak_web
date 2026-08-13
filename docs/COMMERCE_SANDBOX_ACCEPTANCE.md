# SAENGAK 交易 Sandbox 對帳驗收

更新日期：2026-08-13

## 判定目的

TapPay 教學第 17 頁只要求在測試模式建立交易；SAENGAK 的正式上線關卡再加上跨系統回讀，避免只看到 Shopify 頁面成功就誤判完成。必須分別保存 `success`、`failed`、`cancelled` 三個案例，且全部通過才可把 `launchReady` 判定為 `true`。

```bash
cp docs/commerce-sandbox-evidence.template.json /tmp/saengak-commerce-evidence.json
# 只填入各管理端實際回讀值；不得填入個資或密鑰
npm run verify:commerce -- /tmp/saengak-commerce-evidence.json
```

驗證器會回傳每個案例的 `pass`、`fail`、`pending` 關卡；只要少一個案例、任何欄位仍待回讀，或任一系統狀態互相矛盾，命令就以非零狀態結束。

## 權威資料來源

| 證據 | 必須從哪裡回讀 | 不接受的替代物 |
| --- | --- | --- |
| Shopify 方案、Online Store、Variant、checkoutUrl | SAENGAK Shopify Admin 與真實 Storefront Cart | 展示商品、localStorage 金額、另一間商店 |
| TapPay App、商家設定、MGID、4 個 domain、測試模式 | TapPay Portal 與 Shopify 付款設定 | 教學截圖、App Store 顯示免費 |
| 交易狀態與金額 | 同一 Shopify Order ID 在 Shopify／TapPay／Supabase 的各自回讀 | 單一成功頁或通知信 |
| Webhook | Shopify delivery／subscription 與 Supabase Function 接受紀錄 | 只知道 endpoint 回覆 200／401 |
| 物流 | Shopify Checkout 配送方式、物流 App 建單、Shopify fulfillment 與 HTTPS tracking URL | 手填追蹤碼或估計配送天數 |
| 發票 | 發票供應商的 issued／voided／allowance 事件 | Shopify `paid` 或 TapPay `success` |

## 三個案例的算法

- `success`：TapPay=`success`、Shopify=`paid`、Supabase=`paid`；三方 TWD 金額與 Shopify Order ID 一致。ShipAny 配送方式完成，Shopify／Supabase 的 fulfillment GID 與 HTTPS tracking URL 必須一致；Amego 必須回讀 `invoice_type=C0401`、`invoice_status=99`、相同 Provider OrderId 與金額後才能確認 `issued`。
- `failed`：TapPay=`failed`，Shopify 與 Supabase 都必須提供明確的非 `paid` 回讀；缺值不算證據。不能建立 fulfillment、tracking URL 或發票供應商事件，發票狀態須明確為 `not-issued`／`voided`。
- `cancelled`：TapPay=`cancelled`、Shopify `cancelled=true`，Shopify 與 Supabase 都必須明確非 `paid`；同樣不能誤建物流或發票。

若失敗或取消流程根本沒有建立 Shopify Order，請設定 `shopify.orderCreated=false`、`supabase.orderLinked=false` 並保持兩個 `shopifyOrderId` 為 `null`；驗證器會要求 Supabase 不得憑 email 或其他猜測建立會員訂單。

## 證據最小化

證據 JSON 只能保存系統 ID、狀態、TWD 金額、布林回讀與公開 HTTPS tracking URL。驗證器會拒絕含 `email`、`phone`、`address`、`name`、卡號／CVV、password、token、secret、Partner Key 或 client secret 類欄位的檔案。實際證據檔應放在 `/tmp` 或其他受控位置，不提交 Git。

## 目前即時狀態

- 2026-08-12 至 08-13 公開唯讀回讀已可取得 SAENGAK 商店、商品與 Variant；這只證明 Storefront 表面可讀，尚未證明 Shopify Checkout 與 TapPay 可付款。
- TapPay App Store 顯示免費，但 App 仍顯示「安裝」；進入 TapPay Portal 後停在「安裝前請先登入」。
- 歷史上 Waaship 曾免費安裝但未完成帳號綁定。現已選擇 ShipAny＋Amego 架構；正式操作時須先停用 Waaship 重複配送方式，再安裝／綁定 ShipAny。Amego 程式基線使用私有 outbox 與 status 99 回讀，但 migration、worker、secrets、scheduler 與 sandbox 實單仍待部署／驗收。
- `SAENGAK Order Sync`、Supabase webhook secret 與五個訂單 topics 已完成，但尚未有真實 TapPay sandbox 訂單 delivery 可供本驗證器對帳。

因此目前必須維持 `launchReady=false`，不得啟用正式扣款。

此外，Supabase secret `CheckoutReleaseEnabled` 必須保持 `false`。只有本文件三個案例全部通過、DB/binding/readback 完成並經上線核准後，才可改為精確值 `true`。
