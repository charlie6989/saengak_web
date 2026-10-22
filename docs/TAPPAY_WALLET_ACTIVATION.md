# LINE Pay 與街口支付開通查核

更新：2026-10-22。使用者指定為 LUCISSI CARE 開通 LINE Pay、街口支付，並確認沿用 LUCISSI 商家名稱。街口新增官網串接需求已送出，尚未取得新 Store ID 或完成正式收款開通。

## 實際查核

- TapPay 正式環境「新增商家」選擇 LINE Pay 後，必填 `Line Channel Secret`、`Line Channel ID`；選擇 JKOPAY 後，必填 `Store ID`。只查看表單，沒有填入憑證或送出。
- 正式收單清單仍只有信用卡、ATM、超商取貨付款，正式 MGID 為 0 組。CARE 已安裝 LINE Pay／JKO Pay 套件，不代表正式收單設定完成。
- 使用者表示街口可能已申請，指定查蝦皮。蝦皮賣家 `charlie0809` 的「賣場設定 → 付款設定」街口支付為綠色開啟；該頁不顯示 Store ID。
- 已透過使用者提供的簡訊驗證碼完成蝦皮重新驗證；「我的錢包 → 街口支付錢包餘額」確認已綁定拜悠衣品有限公司的街口企業帳戶，並有已完成的街口訂單收入紀錄。該頁未顯示 TapPay 所需的 Store ID。
- 已用使用者提供的街口專用登入資料成功登入。街口「基本資料管理 → 店家管理」確認公司為拜悠衣品有限公司、品牌 LUCISSI，電商平台綁定資料只列蝦皮，未列 CARE／Shopify／TapPay。「店舖資料管理」未呈現店舖表單或 Store ID。未修改設定、解除綁定或提款。
- 街口官方開店平台 FAQ 明確表示：Store ID 無法自行取得，審核通過後由街口寄送；同組 Store ID 不可綁定不同平台，新增平台須透過店家問題表單申請另一組。已依使用者「協助申請」授權提交「開店平台 → 新增店舖或新增串接開店平台」表單；完成頁確認將透過公司信箱與原聯絡電話回覆。
- LINE Pay 是否已有網路商店帳號仍待確認。TapPay 官方 LINE Pay 文件要求聯繫客服協助帳號申請；目前服務申請頁未出現 LINE Pay／街口的一鍵追加申請入口。

## 後續順序

1. 街口新增官網串接需求已提交。等待街口向 company@lucissi.com 回覆新 Store ID 申請／補件與串接要求；完成頁未顯示案件編號或處理天數。
2. 確認 LINE Pay 是否已有適用 CARE 的網路商店帳號；已有則核對 Channel ID／Secret，沒有則申請。
3. TapPay 對非經其申請的收單帳號提示需先聯繫客服調整參數；確認新街口 Store ID 的核發與平台參數要求。
4. 取得可用正式串接資料後，建立正式收單商家及 CARE MGID 支付配置，完成測試、帳號開通條件與 Shopify 正式設定核對。
5. 真實收款、退款及訂單／發票回寫尚未驗收。新合約、收費及實際交易須在具體內容確定後處理。

## TapPay 客服詢問草稿（未寄出）

收件人：support@cherri.tech

主旨：LUCISSI CARE／Shopify 追加 LINE Pay、街口支付開通及既有街口帳號確認

您好：

我們是拜悠衣品有限公司，希望在 LUCISSI CARE 官網 https://lucissicare.com 開通 LINE Pay 與街口支付，結帳使用 Shopify 商店 gh2xgs-zf.myshopify.com，透過 TapPay 串接。

目前 TapPay 已有信用卡、ATM、超商取貨的審核通過紀錄；Shopify 已安裝 LINE Pay 與 JKO Pay 套件，但 TapPay 正式商家清單尚無這兩項收單帳號，正式 MGID 尚未建立。

我們已從蝦皮錢包確認綁定本公司的街口企業帳戶，並有已完成的街口訂單收入紀錄；尚未取得適用 CARE 的 Store ID。請協助確認：

1. LINE Pay 的申請流程、文件、交易費率、撥款週期及是否有額外 TapPay 費用。
2. 街口官方說明新增平台須另外申請 Store ID；請確認 CARE／Shopify 透過 TapPay 的申請協作方式，以及是否需由貴司調整參數。
3. 兩項服務核准後，正式收單商家、MGID 與 Shopify 的必要設定及驗收流程。
4. 本帳號目前開通頁「基本資訊」與「MGID」未完成的具體補件／設定要求，以及適用合約與費率。

請提供申請指引及需補資料，謝謝。

## 街口追加平台需求（已送出）

- 送出日期：2026-10-22，約台灣時間 14:00；使用者已明確授權協助申請。
- 收件目的地：街口官方 FAQ 連結的合作店家表單 https://www.surveycake.com/s/wWg46
- 類別：開店平台 → 新增店舖或新增串接開店平台。
- 回覆信箱：company@lucissi.com。
- 既有店鋪名稱與申請網站名稱：均為 LUCISSI（依使用者指示沿用既有品牌）。
- 公司統編：90014835；聯絡人與電話沿用街口後台既有資料，不在此文件複製私人電話。
- 網站：https://lucissicare.com
- 平台：其他，填入以下需求原文：

> Shopify／TapPay。沿用既有 LUCISSI 商家，新增官網 https://lucissicare.com 收款（Shopify 商店 gh2xgs-zf.myshopify.com），請協助提供適用的新 Store ID 及申請／補件指引，並告知費率、撥款條件與 TapPay 所需配合設定。請保留原有蝦皮綁定。

送出前已核對確認摘要；點擊「確定送出」後出現完成頁，確認會以填寫的公司信箱與聯絡電話依序回覆，服務時間為週一至週五 10:00–18:00（國定假日除外）。未顯示案件編號。完成頁截圖暫存 `/tmp/lucissi-payment-review/jko-submitted.png`（含聯絡資料，不加入版本控制）。

目前僅完成既有商家的追加串接需求送件；新 Store ID 核發、費率／合約確認、TapPay 正式綁定與實際收款驗收均未完成。LINE Pay 申請與上方 TapPay 客服信尚未送出。

## 來源

- TapPay 登入後正式商家新增表單：<https://portal.tappaysdk.com/merchant/prod/pages/1>
- TapPay LINE Pay 官方文件：<https://docs.tappaysdk.com/line-pay/zh/home.html>
- TapPay 街口官方文件：<https://docs.tappaysdk.com/jko-pay/zh/home.html>
- 蝦皮付款設定：<https://seller.shopee.tw/portal/all-settings/payment>
- 蝦皮街口錢包：<https://seller.shopee.tw/portal/finance/wallet/jkopay/>
- 街口商家後台：<https://merchant.jkos.com/Merchant.Web/MerchantLogin/Login>
- 街口 Store ID 官方 FAQ：<https://sites.google.com/jkos.com/jkofaq/開店平台-qa/常見問題>
- 街口合作店家問題表單：<https://www.surveycake.com/s/wWg46>
- 街口官方申請入口：<https://www.jkopay.com/apply/identity>

本文件不含密碼、驗證碼、金鑰或銀行帳戶資料。街口官方表單已提交；TapPay 客服草稿僅保存在本機，尚未寄出。
