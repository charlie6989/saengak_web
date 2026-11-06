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

## 尚未統一

依影響排序。

1. **公司發票類別：** CARE 只接受光貿回讀 `A0401`，LUCISSI 只接受 `C0401`，兩者都沒有正式開過。必有一邊不符，需先用沙盒實測。
2. **開立頻率：** CARE 每天一次 Vercel 排程，LUCISSI 每 10 分鐘 pg_cron。
3. **未開票警示：** LUCISSI 有 `paidWithoutInvoice` 健康檢查，CARE 沒有。
4. **開票前查詢：** CARE 開票前先查光貿並有防重複機制，LUCISSI 沒有。這點應由 LUCISSI 改為跟 CARE 一致。
5. **作廢與折讓：** 兩站都沒有正式操作流程，也都沒有正式驗證過。
