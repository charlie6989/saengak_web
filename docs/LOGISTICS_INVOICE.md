# SAENGAK 物流與電子發票評估／部署基線

更新日期：2026-07-19

## 建議結論

現階段建議 SAENGAK 以 **Waaship 高級方案**作為第一順位，原因是正式上線同時需要台灣超商／宅配與電子發票，而 Waaship 官方方案已明列高級方案包含自動開立發票、2 間商店、前 300 筆訂單免處理費與跨通路庫存。專業方案較適合 5 間商店、每月近千單或需要優先支援的階段，目前不必先負擔。

ShipAny 適合作為物流成本與承運商覆蓋的備選：官方台灣方案可零月費、按運費使用，結帳服務點列表為 NT$398／月且符合每月出貨條件可豁免，並有較廣的本地、冷運與跨境物流選擇。但截至本次查核，ShipAny 公開的 Shopify／台灣產品頁沒有證明可直接完成台灣銷售電子發票，因此若選 ShipAny，必須另接發票服務，不能把物流帳單或 Shopify 已付款狀態當成銷售發票已開立。

## 能力與成本比較

| 評估項目 | Waaship | ShipAny | SAENGAK 判定 |
| --- | --- | --- | --- |
| 7-ELEVEN／全家超取 | 支援 | 支援，另含萊爾富等 | 兩者可用，需在真實 Shopify Checkout 驗證選店 |
| 台灣宅配 | 黑貓、郵局、順豐、嘉里等 | 黑貓、順豐、嘉里及其他承運商 | 兩者可用 |
| 電子發票 | 高級／專業方案明列自動開立，串接綠界或鯨躍 | 公開頁面未列出台灣銷售電子發票 | 發票是上線必要條件時選 Waaship |
| 多通路／庫存 | Shopify＋蝦皮訂單與庫存整合 | Shopify 物流與多承運商自動化為主 | 有蝦皮同步需求時 Waaship 較合適 |
| 固定月費 | 基本 NT$499；高級 NT$1,299；專業 NT$3,299 | 寄付物流 NT$0；服務點列表 NT$398，符合條件可豁免 | 只做物流試跑時 ShipAny 成本較低 |
| COD | 超取、宅配貨到付款 | 代收金額 0.7%，最低 NT$30 | 正式啟用前需確認 TapPay 與 COD 是否同時顯示及對帳 |
| 跨境／冷運 | 有跨境物流 | 承運商與服務類型較廣，明列冷運 | 特殊物流可保留 ShipAny 備援評估 |

以上費用與功能來自 2026-07-19 查核的官方公開頁面；物流實際運費、超材限制、偏遠／離島費、代收撥款週期及發票加值中心費用仍要取得書面報價後確認。

## 系統責任切分

```text
SAENGAK 商品與購物車
  -> Shopify Checkout
     -> TapPay：線上付款
     -> Waaship 或 ShipAny：配送選項／超商選店
  -> Shopify Order
     -> 物流 App：叫件、標籤、貨態與 tracking 回寫
     -> 發票 App／加值中心：開立、作廢、折讓
  -> Shopify signed webhook
     -> Supabase：會員可讀的訂單與配送投影
```

- 商品售價、付款結果、配送選擇與訂單狀態以 Shopify 為準。
- 卡號與 TapPay Partner Key 不進入 SAENGAK 前端或 Supabase。
- 物流 App 的 API 金鑰、承運商客代與電子發票憑證只放在供應商／Shopify 管理端。
- Supabase 只保存配送方式、Shopify fulfillment 狀態、承運商、追蹤碼與 HTTPS 追蹤連結；不複製 Shopify webhook 中的完整姓名、電話與地址。
- 「已付款」不等於「發票已開立」；發票狀態必須來自 Waaship／發票加值中心的可驗證回讀。未確認 API 或 webhook 前，發票查詢仍以該平台後台為權威來源。

## 物流選擇算法

管理端只根據可驗證欄位配置規則，不在網站自行猜運費：

1. 先依目的地排除不服務的本島、離島或海外方式。
2. 依包裹實際重量、材積、溫層與商品限制排除超材、禁運或不相容承運商。
3. 依顧客選擇的宅配／超取與線上付款／COD 保留可用服務。
4. 在承諾到貨日內，按「完整落地成本＝運費＋平台費＋COD 費＋偏遠／離島附加費－可核實折扣」排序。
5. 同成本時依近期妥投率優先，再依平均配送時間與異常率；資料量不足時維持人工指定，不生成虛構排名。
6. 促銷贈品、液體、組合品與多件訂單必須以實際包裝後重量／材積重新檢查，不能只用單品重量相加後直接叫件。

第一階段先在 Shopify／物流 App 設定固定方式與運費；有至少 30 天真實出貨資料後，才啟用依妥投率與成本的自動路由。

上述規則已落地於 `src/domain/fulfillment.ts`：沒有符合條件的服務會回傳 `no_eligible_service`；妥投率／平均時效未滿 30 天證據門檻時回傳 `insufficient_performance_evidence` 並要求人工選擇。發票顯示狀態同樣只接受發票供應商事件；即使 Shopify／TapPay 已付款，沒有供應商回讀仍維持 `awaiting-provider`。

## 部署步驟

1. 建立或指定 **SAENGAK 專用 Shopify 商店**；不得安裝到目前已識別為 LUCISSI 商品用途的商店。
2. 先在測試／未公開商店安裝 Waaship，選高級方案；建立物流與發票加值中心帳號，方案與促銷資訊只在管理端處理，不寫入公開 repo。
3. 設定 7-ELEVEN／全家超取、宅配、離島、免運門檻與 COD；確認商品重量、出貨地址、寄件人資料及退貨地址。
4. 設定 B2C、B2B 統編、手機條碼／載具、捐贈、作廢、退貨折讓與海外零稅率流程，取得測試發票證據。
5. Shopify Checkout 逐一測試：宅配、超取選店、TapPay 成功、TapPay 失敗／取消、COD、超材、離島、地址／電話驗證。
6. 從物流 App 建單並列印標籤，確認 tracking number／URL 回寫 Shopify；再確認 SAENGAK 會員中心只顯示該會員自己的追蹤資料。
7. 用同一筆訂單 ID 對帳 Shopify、TapPay、Waaship／ShipAny、發票加值中心與 Supabase；金額、付款、發票、出貨及取消狀態全數一致才切正式模式。
8. 若 Waaship 的真實運費或作業流程不符合需求，再以相同驗收案例 A/B 試跑 ShipAny；不要在同一正式 Checkout 同時啟用重複的超取方式。

## 已完成與阻擋點

已完成：SAENGAK 專用 Shopify 商店與 Supabase 專案已建立；`SAENGAK Order Sync` 已只安裝於 Saengak，五個訂單 webhook topics、Supabase secret 與 HMAC 驗簽鏈路已完成。Shopify order webhook 解析與資料庫投影已改為物流商中立，可接 Waaship 或 ShipAny 回寫的 Shopify fulfillment。`order_invoices` 發票商中立投影與會員中心查詢亦已部署；正式 Supabase 遠端跨帳號 RLS 測試確認會員只能讀自己的追蹤與發票資料，瀏覽器不能偽造狀態。

2026-07-20 已把 Waaship 免費安裝到 SAENGAK，並在 Shopify 導覽與 App iframe 回讀成功；目前停在 Waaship「帳號綁定」，未輸入帳密、未選付費方案、未套用不公開折扣碼。ShipAny 維持只讀備援評估，沒有同時安裝，避免重複 Checkout 物流方式。

尚未完成：Shopify 方案選擇、商品匯入、Waaship 帳號綁定、物流／發票帳號開通與 sandbox 實單。付款頁目前要求先選方案，Online Store API 亦回覆 channel locked；不會改動既有 LUCISSI 商店，也不會代購方案或啟用正式扣款。

## 官方參考

- [Waaship Shopify App](https://apps.shopify.com/waaship?locale=zh-TW)
- [Waaship 方案](https://waaship.com/zh-tw/plansPricing/)
- [Waaship 物流服務](https://waaship.com/zh-tw/shipping/)
- [ShipAny Shopify App](https://apps.shopify.com/shipany-1?locale=zh-TW)
- [ShipAny 台灣方案](https://www.shipany.io/zho/pricing/)
