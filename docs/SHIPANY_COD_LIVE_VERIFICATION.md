# ShipAny 黑貓 COD 正式啟用前查核

查核日期：2026-10-22（Asia/Taipei）。範圍：CARE `gh2xgs-zf.myshopify.com`、拜悠衣品有限公司 ShipAny 帳號；登入後直接查看實際後台。使用者本輪確認「目前還沒有真實黑貓 COD 訂單」。

後續已進一步調查一般物流 API、五類訂單 Webhook 及實際 CSV，見 [逐單代收額來源與驗收](SHIPANY_COD_AMOUNT_SOURCE.md)。API 完整規格尚在訂閱門檻後，CSV 沒有 COD 額；供應商確認信已於同日 18:44 經使用者授權寄送，待回覆。

**結論：後台設定與可見欄位查核完成，物流／金額端到端驗收未完成，不能正式啟用 PR #73。** 沒有已出貨或已送達的 CARE 貨件；運單 COD 金額有獨立可編輯欄位，未證明與 Shopify 訂單總額持續一致。程式仍使用 `contract_inferred`，不能把本文件當作 `COD_SHIPANY_AMOUNT_MAPPING_VERIFIED=true` 的依據。

## 已確認的正式後台設定

來源：[ShipAny Shopify 串接](https://portal-tw.shipany.io/ecommerce/shopify)，選取 CARE `gh2xgs-zf`；[CARE 物流設定檔](https://portal-tw.shipany.io/settings/operation/shipping-profile/cc5d628f-3a31-4a60-a970-1ebab77870e5)。

| 項目 | 本輪實際讀回 | 證據限制 |
|---|---|---|
| 配送規則 | 進階模式，`shopify-gh2xgs-zf`，只套用 Shopify-gh2xgs-zf | 設定檔 UUID 不是 Shopify FulfillmentService ID |
| 規則 1 | 平台運送方式包括「全家」→ 全家店到店、常溫、自行寄件、寄方付款 | 不代表 CARE 全家結帳已完成 |
| 規則 2 | 運送到台灣 → 黑貓宅急便 常溫宅急便、上門取件、寄方付款 | 是台灣配送 fallback，並非只匹配付款方式 COD；不能用此規則證明已代收 |
| 自動拆單 | 未勾選 | 貨件明細仍有「分拆訂單」入口；未驗證權限或拆單後同步 |
| 同步時點與預設狀態 | 銷售訂單已創建 → 訂單已草擬 | 未付款的非 COD 訂單也須出貨前攔下 |
| Shopify 回寫 | 已出貨及已送達回寫均開啟 | 未取得真實履約欄位與回寫事件 |
| 異常通知 | Email 通知開啟，無法自動更新及需要重產標籤兩項勾選 | 通知設定不保證金額自動同步，也未驗證實際通知送達 |
| ShipAny 餘額 | NT$0.00 | 不推定無月結；首單前需確認實際出單付款安排 |

本輪未儲存設定、未取消或建立貨件、未產生標籤或運費。僅在既有草稿編輯畫面展開 COD 欄位後取消，未儲存；回讀仍為原本未勾選 COD 的草稿。

## 實際訂單與代收資料

- [ShipAny 全部訂單](https://portal-tw.shipany.io/order/records)：2026-07-22 至 2026-10-22，全部狀態，14 筆，涵蓋不同商店；均為草擬或取消，列表沒有追蹤號碼。不可只以跨店重複的 `#1005` 等短號識別訂單。
- [CARE Shopify 全部訂單](https://admin.shopify.com/store/gh2xgs-zf/orders)：共 10 筆。#1002–#1007 未出貨；#1001、#1008–#1010 已退款且不需出貨。沒有可用來核對送達或代收的履約。
- [ShipAny 貨到付款紀錄](https://portal-tw.shipany.io/payment/cod-collection)：將期間設為 2026-01-01 至 2026-10-22，明確選取全部五種狀態（已創建、已收取款項、準備付款、已付、已取消），結果「無此資料」。可見欄位為創建時間、訂單參考編號、追蹤號碼、金額、手續費、淨額、到達時間、狀態；沒有資料列可證明金額與時間語意。

### #1007 的可見對應

來源：[Shopify #1007](https://admin.shopify.com/store/gh2xgs-zf/orders/8339114950723)、[ShipAny 草稿](https://portal-tw.shipany.io/order/detail/9c61d2f8-2688-46d0-b8d4-28a5feaca708)。

| Shopify／來源 | ShipAny／對應 | 已證明／未證明 |
|---|---|---|
| 訂單 ID `8339114950723`、#1007 | 參考編號 `#1007 - 8339114950723` | 此樣本兩側訂單識別相符 |
| 附加欄位 `ShipAny Order ID` | `9c61d2f8-2688-46d0-b8d4-28a5feaca708` | 兩側值相同；未證明不可被修改，不能直接當物流服務驗證 |
| 商品 NT$680 × 4、總額 NT$2,720、運費 0 | 商品數量／單價及「包裹總值」NT$2,720 | 只證明此零運費樣本商品值相符，包裹總值不等於代收款 |
| 測試訂單、已付款、未出貨、配送「標準」 | 已草擬、無追蹤號、全家店到店、COD 未勾選 | 非黑貓 COD 樣本；不能填入正式來源 allowlist |
| 不適用：沒有待收 COD | 編輯畫面暫時勾 COD 後，出現 NT$2,720 的可編輯數值欄位 | 只觀察未儲存表單預帶值；沒有變更金額、查詢運費或儲存，不能證明正式匯入及含運／折扣映射 |

此舊草稿追蹤區顯示 2026-08-26「全家店到店不支援送貨上門」錯誤；它早於目前黑貓規則，不能當成新規則失效的證據，也不能把舊草稿直接交運。取消編輯後已讀回：草稿、COD 未勾選、全家服務、原包裹重量 0.05 kg，未將表單自動正規化的重量儲存。

另外查看 #1010（Shopify ID `18957544456259`，ShipAny `974c3fef-f1c8-4dc1-bcf9-252c5c010d0e`）：已取消、無追蹤號、全家店到店、COD 未勾選、包裹總值 NT$20。這同樣不是黑貓 COD 代收證據。

## 尚不能填入的機器欄位與金額條件

| 程式要求 | 本輪結論 |
|---|---|
| `fulfillments[].service.id` | 無真實履約可讀；不可把 ShipAny 設定檔 UUID 填成 `COD_SHIPANY_SERVICE_ID`。若實際為 manual／null，現有 adapter 不適用，須先補可靠來源識別 |
| `trackingInfo[].company`／`number` | 沒有有效託運號；不可把頁面服務名稱猜成精確 company 值 |
| `shippingLines[].code` | 後台看見「標準」是 title；未取得實際 code，不應直接等同 |
| 運單指定代收金額 | 表單有獨立可編輯欄位，尚無已建立黑貓 COD 運單值；未測試修改可否成功儲存或後續鎖定 |
| 含運、折扣、修改與分包裹 | 現有樣本無法驗證；自動拆單關閉不等於不能人工拆單 |
| `DELIVERED`／`deliveredAt` | 本輪無實例；10/22 ShipAny 書面確認僅能作服務語意依據，不能補成這些實單欄位 |

因此僅核對一筆「金額相同」仍不足以啟用長期全自動流程。需證明訂單至運單金額的同步及修改控制；若可獨立改額而系統無可信逐單回讀，本版必須維持關閉，補充可信來源能力後再驗收。不能以平常不會改額或一次人工對帳替代這個條件。

本輪 Shopify connector 連到母站而非 CARE，故使用 CARE 登入後瀏覽器查核；未切換 connector 授權。Vercel connector 對本專案回傳找不到專案，未取得正式 env；不宣稱正式開關值已重新回讀。程式預設關閉與未部署，見 [實作紀錄](COD_COLLECTION_IMPLEMENTATION.md)。

## 首筆實單的執行順序（待有實單後進行）

1. 指定 CARE 真實訂單、商品／數量、收件人及聯絡資訊、COD 應收總額、可接受的運費／代收費和交運日期；不從舊測試單直接出單。本輪尚未有指定實單，沒有建立交易。ShipAny 儲值／月結可用性及正式開票資格一併確認。
2. 下單後先保持 ShipAny 草稿。核對 Shopify 訂單 ID ↔ ShipAny 參考號／Order ID、單一包裹、黑貓常溫、全部商品、未付餘額與指定 COD 額。金額公式為折扣後商品金額＋應收運費及其他應收費用，稅額依訂單是否內含避免重複加計；不得拿包裹總值代替 COD 額。至少補足含運、免運、折扣及改單案例的可信映射證據。
3. 出單前確認改額與拆單控制。若沒有可信回讀或不變量，停止自動啟用，先修正 adapter／來源能力。實際出單後再取得 `FulfillmentService`、tracking company／number、shipping code 與整單品項；未取得精確值前不放寬 allowlist。
4. **第一筆交運前處理既有 Flow 與唯一開票來源。** 本輪讀回 [COD 宅配送達後自動標記已付款](https://admin.shopify.com/store/gh2xgs-zf/apps/flow/overview/01a15969-afa7-7580-915e-af0cebbf695e) 仍作用中、沒有執行紀錄；畫布條件為 DELIVERED＋Cash on Delivery (COD)＋PENDING＋配送 title「標準」，動作 Mark order as paid。未修改它。新流程切換須有持久 starts_at、在途／舊單盤點及回退安排，不能讓新舊付款來源混跑後再判斷哪條驗收成功。
5. 取得正式變更授權後，依 [啟用條件](COD_COLLECTION_IMPLEMENTATION.md) 完成權限、webhook、migration、程式、方案可用的排程與監控、唯一開票來源及開關配置。不能用本次文件查核跳過其中任一門檻。
6. 真實交運與顧客全額付款後，記錄同一託運號的 ShipAny 狀態、Shopify DELIVERED／deliveredAt、不可變 evidence／唯一發票工作、光貿發票號碼／通知／存證、Shopify paid 回讀；重送事件不得重複開票或付款。拒收、更正、取消退款與來源中斷需另外驗證，不能修改已完成真實訂單偽造測試結果。
7. ShipAny 撥款與銀行實際入帳另外對帳。客人付款、Shopify paid、光貿開票與 ShipAny 撥款是不同證據，不互相替代。

## 本輪交付與界線

本輪只新增後台證據與執行清單、同步專案狀態；沒有修改程式、正式 Flow、環境變數或資料庫，沒有付款、貨件、標籤、發票、部署或合併。沒有保存顧客地址／電話、會員 token、帳密或原始後台完整快照。驗證範圍為文件內容、連結及差異檢查；先前 619 項單元測試等結果不能當成本輪物流實單已通過。
