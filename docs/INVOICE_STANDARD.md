# 電子發票開立標準（LUCISSI 與 LUCISSI CARE）

2026-11-07 使用者要求兩站開票方法統一。兩站同一賣方（統編 90014835），各有自己的程式，以 LUCISSI 已正式開立過的做法為準；不合併 repository。修改任一站時請同步比對另一站。

## 一致的行為

| 項目 | 標準 |
| --- | --- |
| 個人發票預設 | 光貿會員載具：`CarrierType=amego`，`CarrierId1/2` 為小寫 Email。不開空載具（空載具是紙本發票）。沒有 Email 時不開立 |
| 手機條碼 | `CarrierType=3J0002` |
| 捐贈 | `NPOBAN` 為捐贈碼 |
| 公司發票 | 買方統編與抬頭，`PrintMark=Y`，稅額外加拆分 |
| 其他欄位 | `BuyerName=消費者`、`PrintMark=N`、4 碼 `RandomNumber`、`DetailVat=1`、`MainRemark=開立說明｜訂單編號` |
| 金額 | 商品、運費、折扣各一行，加總必須等於訂單總額；對不上就不開立，不補猜測的調整行 |
| 統編檢查 | 加權和可被 5 整除，第 7 碼為 7 時可多算 1 |

兩站有意保留的差異：訂單編號前綴（CARE 為 `S`，LUCISSI 為 `LUCISSI-`）用來區分同一賣方下的兩站。CARE 的畫面文字寫「Email 載具」，不顯示廠商名稱。

## 貨到付款標準（2026-11-07 使用者採用）

依據：ShipAny 2026-10-16、10-22、10-28 的書面回覆。兩站都採用此流程。

1. 黑貓常溫宅配，付款方式用 Shopify 標準手動付款「貨到付款 (COD)」。ShipAny 在訂單建立時匯入為草稿。
2. **出貨時人工核對**：運單有勾 COD，代收額等於 Shopify 折扣後含運費的訂單總額，再交運。改金額只在 Shopify 改，ShipAny 的修改不會同步回 Shopify；物流取件後運單不能再改。**一張訂單只出一個包裹，不可拆單出貨**：Flow 在第一個包裹送達時就會把整張訂單標成已付款。
3. 送達（`DELIVERED`）後由 Shopify Flow 標記已付款。ShipAny 確認黑貓常溫 COD 的送達代表已收足該運單指定的代收額；拒收、未付款不會變成送達。ShipAny 不會自動改 Shopify 付款狀態，也沒有收款 API。
4. 標記已付款後走一般發票流程自動開立，不另外人工開票。送達前不要手動標記已付款，否則會在收款前開出發票。
5. ShipAny 撥款與開票分開，到 ShipAny 後台「貨到付款紀錄」對帳，不作為開票條件。

未付款訂單（含 ATM）也會有 ShipAny 草稿，**出貨前要確認該訂單是貨到付款或已付款**。

尚未驗證：CARE 還沒有真實貨到付款訂單；LUCISSI 第一筆 #1008 已成立，尚未出貨。第一筆要確認實際的付款方式名稱符合 Flow 條件、運單金額對應、送達回寫、發票與撥款紀錄。Flow 不比對金額，金額由第 2 步把關。開票時點（送達後）待會計確認。

CARE 另有 PR #73 的自動比對流程，維持關閉（`cod_invoice_policy.enabled=false`）。ShipAny API Pro 不是這個流程的必要條件；第一批真實訂單後再評估是否用它取代第 2 步。

## 尚未統一

依影響排序。

1. **貨到付款（LUCISSI 尚未啟用）：** LUCISSI PR #105 改為跟上面的標準，開關預設關閉，尚未合併；LUCISSI 也還沒安裝 Shopify Flow。
2. **公司發票類別：** CARE 只接受光貿回讀 `A0401`，LUCISSI 只接受 `C0401`，兩者都沒有正式開過。必有一邊不符，需先用沙盒實測。
3. **開立頻率：** CARE 每天一次 Vercel 排程，LUCISSI 每 10 分鐘 pg_cron。CARE 第一張發票送出約 6 分鐘後光貿就寄出開立通知，但系統要到隔天排程才回查，這段期間會員頁看不到發票。
4. **未開票警示：** LUCISSI 有 `paidWithoutInvoice` 健康檢查，CARE 沒有。
5. **開票前查詢：** CARE 開票前先查光貿並有防重複機制，LUCISSI 沒有。這點應由 LUCISSI 改為跟 CARE 一致。
6. **作廢與折讓：** 兩站都沒有正式操作流程。CARE 作廢已於 2026-11-09 實際走過一次（見下方紀錄）；折讓仍未驗證，LUCISSI 兩者皆未驗證。

**CARE 作廢實測（2026-11-09，店主要求）：** 店主自購測試單 #1011（TapPay 實刷 NT$277，發票 HV14744580）在 Shopify 取消並退款至原卡後，`orders/cancelled` webhook 把發票工作改為 `void_review`（operation=void），沒有另建折讓工作。依店主指示以 `select public.approve_amego_invoice_void('<Shopify 訂單 GID>')` 核准（status → `void_pending`），再於 Vercel Cron Jobs 頁手動 Run `/api/invoice/guangmao`：第一次送出 f0501 後光貿回 provider_status=1（處理中，工作為 `provider_pending`）；約 6 分鐘後再 Run，回讀 provider_status=99、作廢時間 11:00:01（台灣），工作 `voided`、`order_invoices.status=voided`。注意 Run 時若工作的 `next_attempt_at` 尚未到，該次不會處理。同期間其他可執行工作只有這一筆（另兩筆 #1006／#1007 為 `manual_review` 不會被取走），所以手動 Run 沒有影響其他訂單。
