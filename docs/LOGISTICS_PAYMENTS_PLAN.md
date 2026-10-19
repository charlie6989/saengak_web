# 物流與金流上線清單（LUCISSI CARE）

更新：2026-10-20。母站 LUCISSI（`j97kr5-7b`）的對應工作在 `LUCISSI_website` repo 另外處理；兩站共用同一個 ShipAny 帳號。

## 目前狀態（2026-10-20 唯讀查核 Shopify `gh2xgs-zf`）

| 項目 | 狀態 |
|---|---|
| TapPay（信用卡、JCB、銀聯、LINE Pay） | **測試模式**：不會實際收款。上線前必須切換正式。 |
| PayPal | 設定未完成。 |
| LINE Pay、街口、TapPay ATM | 列在「更多付款方式」，狀態需在各自設定頁確認。 |
| 手動付款方式 | 沒有（所以沒有貨到付款）。 |
| 運送 | 1 個運送設定檔、2 個區域；台灣「標準」黑貓常溫宅配 NT$146、滿 NT$1,500 免運；無超商取貨、無到店取貨。已安裝 ShipAny Shipping Method Helper。 |
| 網站文案 | 只寫黑貓宅配；`scripts/verify-public-content.mjs` 會擋下「超商取貨」等字樣（2026-10-17 決定）。 |

## ShipAny 回覆重點（2026-10-16，Email 往來，原詢問以母站名義、適用整個帳號）

1. **COD 開通**：在 ShipAny 提交銀行資料後，人工審核約 1–2 個工作天；開通後適用帳號下所有 Shopify 商店。
2. **Headless 選全家門市**：「物流服務點列表」方案（NT$398／月，14 天試用，有出貨可豁免）支援自建前台。門市列表與選店 Widget 的 API 目前需技術團隊手動開通；ShipAny 預計兩週內（約 2026-10-30）讓商戶在後台自行申請 API 文件與金鑰。
3. **COD 辨識**：Shopify 必須使用標準手動付款方式「貨到付款（Cash on Delivery／COD）」，ShipAny 才會辨識。代收金額自動帶入折扣後、含運費的總額；只有在 Shopify 端修改訂單會同步，在 ShipAny 改代收金額不會回寫 Shopify。
4. **同步規則**：維持「銷售訂單已支付（Sales Order Paid）」才同步，避免未付款的信用卡訂單被出貨。COD 訂單加標籤（例如 `COD`），出貨時在 Shopify 手動選取匯入 ShipAny。
5. **收款與對帳**：COD 收款或結算後**不會**自動把 Shopify 訂單改成已付款；沒有 API 或 webhook。需在 ShipAny「貨到付款紀錄」確認後，到 Shopify 手動標記已付款。
6. **測試環境**：透過 Shopify App 串接的商戶沒有 sandbox，只能用一筆真實 COD 訂單驗收。

## 使用者決定（2026-10-20）

- 兩站都要做；COD 付款方式**等 ShipAny 開通與全家選店完成後**才在 Shopify 新增，避免收到無法出貨的 COD 訂單。
- 「物流服務點列表」方案由使用者自行訂閱並申請 API。

## 上線步驟與負責人

輸入銀行帳號、金鑰、商店代號、密碼與付費訂閱都由使用者操作；Claude 不代為輸入或購買。

### A. 信用卡金流（TapPay）切換正式

1. **使用者**：在 TapPay Portal 確認正式商家審核通過，取得正式金鑰，於 Shopify TapPay 付款設定切換為正式模式並填入。
2. **使用者**：確認光貿（電子發票）正式 seller／key 與 Vercel 的發票 release 設定；目前只驗證過官方公開沙盒（見 `GUEST_CHECKOUT_LAUNCH_CHECKLIST.md`）。
3. **Claude（經同意）**：切換後以一筆真實小額訂單驗證：付款、Shopify 訂單、CARE `orders` 同步、發票開立；再依使用者決定取消並退款。
   - 取消退款不會自動處理發票：已開立的發票在訂單取消後進入 `void_review`，退款可能另建 `allowance_review` 工作，都要經核准 RPC（`approve_amego_invoice_void`、`approve_amego_allowance_issue`）、由 worker 派送，再回讀光貿 provider 狀態確認已作廢或折讓；做法比照 #1008（`GUEST_CHECKOUT_LAUNCH_CHECKLIST.md`）。沒做完會留下一張正式發票在已退款的測試訂單上。
4. **使用者決定**：PayPal 要完成設定或移除；LINE Pay、街口、TapPay ATM 是否開放。

### B. 全家店到店取貨付款（COD）

1. **使用者**：ShipAny 後台提交銀行資料申請 COD，等審核通過。2026-10-20 唯讀查看：帳號設定與「付款 → 運費及計畫」都沒有 COD 申請或貨到付款紀錄頁面，尚未開通；申請方式依 ShipAny 來信或洽客服。
2. **使用者**：訂閱「物流服務點列表」，取得門市列表／選店 API 文件與金鑰；金鑰由使用者放進 Vercel 環境變數。2026-10-20「附加功能」頁顯示「沒有可用的附加功能」，與 ShipAny 說約 10/30 開放自助訂閱相符，到時再看。
3. **使用者決定**：全家店到店運費、是否適用滿額免運、COD 是否另收手續費或有金額上限。
4. **Claude**：依 ShipAny 文件實作前台全家選店，並以 Shopify Cart API 寫入門市代碼（欄位依 ShipAny 規格）；在 Shopify 新增「全家店到店」運費；把 FAQ、商品頁配送標籤、隱私權政策（ShipAny 資料項目）改回包含超商取貨，同步調整 `verify-public-content.mjs` 的防回歸字樣。
5. **同步條件（已確認）**：2026-10-20 使用者登入 ShipAny（portal-tw.shipany.io）後，Claude 唯讀查看「電子商務 → Shopify」。帳號連了三間商店：
   - CARE `gh2xgs-zf`：同步策略「銷售訂單已支付」✓；物流匹配「簡易模式」，預設物流**全家店到店**、自行寄件、寄付；匯入後狀態「訂單已草擬」；黑貓收件後自動把 Shopify 訂單改為已出貨（開），送達通知（關）；結帳頁顯示服務點、物流選項都關。
   - 母站 `j97kr5-7b`：同步策略「銷售訂單已支付」✓；預設物流黑貓常溫宅急便、上門收件；已出貨與送達通知都開。
   - 第三間 `mfwqtn-uy`（不在本計畫範圍，用途待使用者說明）：同步策略是「銷售訂單已創建」，未付款訂單也會匯入。
   - **已改（2026-10-20，使用者核可）**：CARE 改用「進階物流匹配模式」，物流設定檔 `shopify-gh2xgs-zf`（取代原本只有順豐／Lalamove 的「本地運送」規則）由上往下比對：
     1. 「全家店到店」：平台運送方式包括「全家」→ 全家店到店，自行寄件，寄方付款。Shopify 新增的全家運費名稱必須含「全家」才會套用（B-4）。
     2. 「宅配（黑貓常溫）」：運送到台灣 → 黑貓宅急便常溫，上門取件，寄方付款。
     儲存後重新載入回讀：CARE 為進階模式並指向此設定檔，兩條規則內容如上；母站與 `mfwqtn-uy` 未變。
6. **使用者決定＋Claude 設定（阻擋條件）**：限制貨到付款只能搭配全家店到店。Shopify 啟用的手動付款方式對所有運送方式都會出現。CARE 是 Basic 方案，Shopify 規定含 Function 的自訂 app 只限 Plus，所以不能自建 Payment Customization，要用 App Store 的付款規則 app（任何方案可用）。候選：Payfy: Hide Payment Rules（Basic US$3.99／月可依運送方式隱藏，Premium US$9.99／月另可檢查購物車屬性中的門市代碼）。由使用者選定並安裝（需同意 app 權限與付費），Claude 再設定規則：未選全家店到店時隱藏貨到付款，並實測宅配時看不到 COD。
   2026-10-20 App Store 比較（價格與功能以商店頁為準，安裝前再確認相容 Basic）：
   - [Payfy: Hide Payment Rules](https://apps.shopify.com/payfy-conditional-payments)：Basic US$3.99／月、最多 2 條規則；評分 4.9（156 則）、Built for Shopify。建議選這個。
   - [Easy! Payment Control](https://apps.shopify.com/payment-control)：免費版 1 條規則，可依運送方式隱藏貨到付款，支援繁中；但 0 則評價。
   - 其他可依運送方式隱藏的：[HidePay](https://apps.shopify.com/hidepay)、[Kip](https://apps.shopify.com/kip-customize-payment-methods)、[ETP](https://apps.shopify.com/etp-hide-sort-payments)。
   規則只需一條：運送方式名稱不含「全家」時隱藏「貨到付款（Cash on Delivery）」。
   **2026-10-20 更新：可能不需要限制。** ShipAny 2025-09-04 公告〈ShipAny 台灣正式支援「貨到付款」服務〉寫明 COD 支援順豐速運、黑貓宅急便與全家店到店三家，服務費為代收金額 0.7%（最低 NT$30），在「設定 → 物流服務設定」啟用。若屬實，宅配（黑貓）也能代收，就不必只限全家，也不用裝 Payfy。開通 COD 時要在後台確認黑貓確實可選 COD；若只有全家可選，再回到上面的限制做法。
   **使用者決定（2026-10-20）**：先不裝 Payfy。COD 開通時在 ShipAny 確認黑貓可選貨到付款；不行再裝 Payfy 並設定「運送方式不含『全家』時隱藏貨到付款」。此項因此不再是開 COD 前的阻擋條件，改為開通時的檢查項。（2026-10-16 客服回信只談全家，是因為我們當時只問全家。）
7. **發票偏好（已完成）**：保留 COD 訂單的發票偏好。PR #70 讓訂單成立但未付款時把偏好保存到下單後 120 天，付款建立發票工作後刪除，取消時（含 `orders/updated` 帶 `cancelled_at`）刪除，並加 11 項資料庫測試。2026-10-20 經使用者同意套用到正式 Supabase（版本 `20261019215834`，PR #71 同步檔名）。
8. **Claude（經同意，在 1–7 完成後）**：在 Shopify 新增手動付款方式「貨到付款（Cash on Delivery）」。
9. **確認發票時點**：發票目前在訂單付款後開立；COD 訂單要等人工標記已付款才會觸發，需確認這個時點符合營運與稅務要求。
10. **驗收（真實訂單，會產生運費與派件）**：建立一筆選全家店到店的 COD 訂單 → 在 Shopify 手動選取並匯入 ShipAny（未付款訂單不會自動同步）→ 在 Shopify 修改品項或金額，確認 ShipAny 代收金額跟著更新 → 印單出貨 → 送達並結算後，在 ShipAny「貨到付款紀錄」核對，再到 Shopify 標記已付款，確認發票依結帳時的偏好開立。

### C. 日常作業（COD 上線後）

- COD 訂單加 `COD` 標籤；出貨時在 Shopify 選取並匯入 ShipAny。
- 訂單修改只在 Shopify 進行。
- 每週（或撥款時）以 ShipAny「貨到付款紀錄」對帳，再在 Shopify 標記已付款。

## 仍需使用者確認

- ShipAny 第三間商店 `mfwqtn-uy` 是哪個店、同步策略「銷售訂單已創建」是否要保留。
- 測試訂單 #1010：2026-10-20 ShipAny「全部訂單」列表顯示為「訂單取消」。
- ShipAny 帳戶可用額度 NT$0、近 3 個月沒有交易紀錄（2026-10-20）。實際建立運單前，確認運費是預付扣款（需先「增值」）還是月結，避免第一張宅配單無法出單。
