# ShipAny 逐單 COD 金額技術確認信（已寄送）

收件人：cs@shipany.io；副本：info@shipany.io。
已回覆既有討論串「LUCISSI：確認台灣 Shopify App／黑貓沙盒運單與追蹤回寫測試」。本信不授權訂閱、派件或設定變更。

寄送紀錄：2026-10-22 18:44:33（Asia/Taipei），經使用者明確同意後寄送。[Gmail 已寄出郵件](https://mail.google.com/mail/#sent/1a163366ba8537ae)，原 thread `1a103d9e680f0f61`。已回讀 SENT、To／Cc／主旨及原 thread，核對新信本文與核准草稿一致（後方附原討論串引用）。等待供應商回覆；未開通任何服務。

---

ShipAny 客服／技術團隊您好：

感謝 10/22 確認台灣黑貓常溫 COD 的 DELIVERED 代表已收足該運單指定代收額。我們正在驗收 LUCISSI CARE（gh2xgs-zf.myshopify.com）的全自動開票流程。

這次要確認的是「運單指定且已生效的 COD 金額」如何逐單讀取，不是另外查詢收款／撥款對帳。我們已知 ShipAny 後台修改代收額不會反向同步 Shopify，因此不能直接以 Shopify 訂單總額推定運單代收額。

後台目前可見 API Pro 與 order/updated、order/fulfilled、order/delivered、order/merged、order/splitted Webhook。請協助逐項確認：

1. API Pro 是否可用唯讀 API 查詢「由 Shopify App 已匯入的原運單」，而不必重建 API 運單？請提供 endpoint、授權 scope、單筆回應範例及查詢方式。
2. 回應能否提供原 Shopify 商店／訂單 ID、ShipAny 運單 ID、COD 啟用、幣別、指定代收額、黑貓常溫服務識別、有效託運號與更新版本／時間？請指出精確欄位，並說明金額是否包含 Shopify 折扣後運費。
3. 該 COD 額是可編輯表單值，還是黑貓已接受、實際執行的金額？出單後／交運後／送達後能否修改？如何辨識改額待生效、換單、舊託運號失效，以及送達當下採用的金額？是否有不可變版本或歷史查詢？
4. 上述 Webhook 是否包含 COD 額及版本？請提供 payload、驗簽／簽章 header、event ID、重試、亂序及更正規格；關閉 PII 後是否仍保留必要運單識別與金額？是否需訂閱 API Pro？
5. 若沒有可讀取金額的 API／可信 Webhook，是否能提供官方支持的不可變金額回寫或鎖定機制，讓程式確認「該託運號送達時的代收額」？一般訂單 CSV 目前未見 COD 金額欄。
6. 請確認本台灣帳號 API Pro 的費用、唯讀查詢／Webhook 計次、超額處理，以及是否有不扣款、不派件的 API sandbox 可測試改額及送達更正；該 sandbox 是否涵蓋 Shopify App 匯入的同一路徑？能否先提供相關規格節錄供判斷適用性？

我們希望先確認可行性再開通服務。本信僅詢問技術規格，請勿代為開通試用／付費服務、產生金鑰、修改設定、建立或修改運單、安排派件；也請勿在回信提供密鑰。若需技術團隊判斷，煩請轉交並以 Email 回覆。

謝謝。
Charlie
拜悠衣品有限公司／LUCISSI CARE
