# 貨到付款自動標記已付款（2026-11-18 店主要求全自動）

店主要求貨到付款「全自動」標記已付款，不靠客服手動。標記已付款後，一般發票流程會自動開票（見 `INVOICE_STANDARD.md`）。

## 現況與 LUCISSI 比較（2026-11-18 讀 LUCISSI `origin/main` `4a56bb1`）

| 配送 | LUCISSI | CARE |
|---|---|---|
| 黑貓宅配 | Flow「COD 宅配送達後自動標記已付款」：ShipAny 回寫 DELIVERED → 標記已付款 | 同左，作用中 |
| 順豐宅配 | 客服確認送達後手動標記（`COD_INVOICE_RUNBOOK.md`） | **2026-11-18 起自動**：新 Flow「COD 順豐宅配送達後自動標記已付款」（複製黑貓那條，`shippingLine.title` 改「順豐宅配」），作用中 |
| 超商取貨（綠界） | 手動。另寫好網站自開綠界單時的通知自動標記（`ECPAY_COD_MARK_PAID`），但 SiteGiant 開單時綠界通知送 SiteGiant，網站收不到，所以沒在用 | 目前手動；全自動方案如下 |

順豐 Flow 條件：Fulfillment event status = DELIVERED、付款方式含 Cash on Delivery (COD)、財務狀態 PENDING、運送方式名稱 = 順豐宅配。未驗證：ShipAny 對順豐台灣宅配是否回寫 DELIVERED；要等第一張順豐宅配貨到付款訂單。

## 超商（綠界）全自動方案

綠界單由 SiteGiant 開，綠界的狀態通知送到 SiteGiant，網站收不到，所以改成網站主動查詢：

1. 找出待收款的超商貨到付款訂單：付款方式只有 Cash on Delivery (COD)、財務狀態 PENDING、運送方式為 7-11取貨／全家取貨／萊爾富取貨、已出貨（有 SiteGiant 回寫的追蹤號）。
2. 用綠界物流查詢 API（`/Helper/QueryLogisticsTradeInfo/V5`，LUCISSI `api/_lib/ecpay-logistics.ts` 已實作，可用 MerchantTradeNo 查詢）查包裹狀態。
3. 狀態為顧客已取件（7-11 `2067`、全家 `3022`、萊爾富 `2067` 或 `3022`，同 LUCISSI），且綠界代收金額等於訂單目前應付總額，才在 Shopify 標記已付款；其他狀態只記錄。
4. 沿用 CARE 既有的貨到付款收款檢查（`api/invoice/cod-collection.ts`、`api/_lib/cod-collection*.ts`、`claim_cod_collection_check`），加一個綠界來源。不新增 `api/` 函式（Vercel Hobby 12 個上限已滿）。

上線前要先確認（需第一張真實綠界超商訂單）：
- SiteGiant 在綠界建單用的 MerchantTradeNo 格式（能否由 Shopify 訂單或 SiteGiant 訂單推得），或改以追蹤號對應；
- SiteGiant 是否把追蹤號回寫 Shopify；
- 綠界查詢回傳的代收金額欄位。

需要店主：
- 在 Vercel Production 自行輸入綠界物流的商店代號、HashKey、HashIV（與 SiteGiant 綠界物流設定同一組；不得進 Git）；
- 確認 SAENGAK Order Sync app 有 `write_orders`（標記已付款需要）；
- 決定查詢頻率：Vercel Hobby 排程一天一次；要每 15 分鐘可改用 GitHub Actions 排程呼叫既有端點（Bearer `CRON_SECRET`）。

在這之前，超商貨到付款由客服確認取件後手動標記已付款；不要在取件前標記，否則會在收款前開票。
