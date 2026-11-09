# 超商取貨（全家、7-11、萊爾富）

更新：2026-11-09。狀態：**程式已完成第一版、正式開關關閉**；等 ShipAny 回覆門市寫入格式、店主建立 API 金鑰後才能接真實門市資料。

## 店主決定（2026-11-09）

- 開放全家、7-11、萊爾富門市取件。
- 運費 NT$60，達全站免運門檻免運（門檻存在 `site_settings.free_shipping_threshold`，目前為 NT$1,500，不是 1,499）。
- 同時提供取貨付款；顧客在結帳頁的付款方式選「貨到付款」。

## 為什麼要自己做選店畫面

ShipAny「物流服務點列表」的選店畫面是裝在 Shopify 佈景主題上的元件（ShipAny 後台寫明「需要在已發佈的佈景主題上啟用」）。本站是自建前台，購物車直接用 Storefront API 建立結帳，不經過佈景主題，所以顧客看不到 ShipAny 的選店畫面。因此由本站顯示門市清單，並把選好的門市寫進 Shopify 結帳。

## 程式架構

| 部分 | 位置 | 說明 |
| --- | --- | --- |
| 共用規則 | `src/domain/pickupPoints.ts` | 超商種類、門市格式檢查、地址格式、關鍵字搜尋 |
| ShipAny 門市資料 | `api/_lib/shipany-pickup-points.ts` | 取得各物流商門市資料檔、轉換格式、快取 24 小時、token 輪替 |
| 門市搜尋 API | `GET /api/pickup-points?carrier=&q=` | 經 `vercel.json` 改寫到 `api/shopify/discounts.ts?resource=pickup-points`（Hobby 函式數量已滿）；開關關閉時回 404 |
| 建立結帳 | `api/create-shopify-cart.ts` | 收 `pickupPoint: { carrier, code }`，以門市清單確認後預填收件地址並寫入 attributes |
| 前台 | `src/components/feature/PickupPointSelector.tsx`、`src/lib/pickupPoints.ts` | 購物車「配送方式」：宅配到府／超商取貨，選超商、搜尋、選門市；選擇存在 localStorage |
| 資料庫 | `supabase/migrations/20261108174448_store_pickup_foundation.sql` | 開關 `store_pickup_enabled`（false）、運費 `pickup_shipping_fee`（60）、`private.shipany_api_tokens` 與兩個只限 service role 的 RPC |

寫入 Shopify 的內容（格式待 ShipAny 確認，只需改 `formatPickupAddressLine` 與 `api/create-shopify-cart.ts` 一處）：

- 收件地址第一行：`[門市代碼] 門市地址`（依 ShipAny API 文件 `AddressInput.address_line` 的服務點格式）。
- 公司欄位：超商與門市名稱，例如「全家台北民生店」。
- cart attributes：`_delivery_method=pickup`、`_pickup_carrier`、`_pickup_code`、`_pickup_name`、`_pickup_address`、`_pickup_courier`。
- 伺服器只採信前台送來的超商與門市代碼，名稱與地址以門市清單為準；門市不存在回 `PICKUP_POINT_INVALID`。

## 實際門市資料（2026-11-09 管理員診斷）

CARE 專用 token 第一次連線成功（已輪替並加密保存）。ShipAny 回傳三家物流商的門市資料檔（`courier-service-point-locations.shipany.io`，JSON 陣列）：

| 物流商 | 已啟用自取點類型 | 門市筆數 |
| --- | --- | --- |
| SfExpressV2（順豐） | Family Mart (SF Express)、Hi-Life (SF Express)、7-Eleven (SF Express) | 13,087 |
| Yamato（黑貓） | Yamato Store、7-Eleven (Yamato) | 7,160 |
| FamilyMart（全家店到店） | Family Mart | 4,431 |

每筆欄位：`code`、`name_cht`、`detail_loc_typ`、`addr.lns_cht`／`addr.city`／`addr.distr`、`is_active`、`is_delivery`、`supported_storage_types`、重量與尺寸限制（例如順豐超商 5 kg、三邊和 105 cm）。地址數字多為全形，解析時轉半形。**同一間門市在不同物流商的代碼不同**（例如順豐的全家延吉店為 `10003`，全家店到店的板農店為 `002816`），所以每家超商固定由一家物流商配送（`PREFERRED_COURIER`）：全家→全家店到店、7-11→順豐、萊爾富→順豐（依店主 11/07 給 ShipAny 的規劃）。黑貓的 7-11 門市不採用。

PR #112 部署後正式站再次診斷（2026-11-09），解析出的可選門市：

| 超商 | 物流商 | 門市數 |
| --- | --- | --- |
| 全家 | 全家店到店 | 4,431 |
| 7-11 | 順豐 | 7,052 |
| 萊爾富 | 順豐 | 1,604 |

## ShipAny 匯入實測（2026-11-09，Shopify #1012）

店主同意後在 Shopify 後台以訂單草稿建立未付款測試訂單 #1012（自訂品項「超商取貨匯入測試（請勿出貨）」NT$1、自訂運費「全家店到店取貨」NT$60、測試顧客、收件地址第一行 `[002816] 新北市板橋區文化路一段216巷31號`、公司欄「全家板橋板農店」）。ShipAny 依「銷售訂單已創建」自動匯入為草稿 `1c1483be-5a2d-4a9b-b22e-5806b9a32c18`。

- **門市格式確認可用**：ShipAny 草稿的收件人變成「全家板橋板農店／便利店／自提點取貨」，地址改為 ShipAny 門市清單中 002816 的實際地址（府中路29-1號1樓），代表 ShipAny 以 `[門市代碼]` 查門市，後面的地址文字不影響。網站目前的寫入格式（`formatPickupAddressLine`）正確。
- **物流規則未命中**：草稿錯誤「沒有適用的物流規則」：全家店到店規則「External shipping method condition is not met」、黑貓宅配「不支援寄到服務點 002816」。CARE 物流設定檔 `shopify-gh2xgs-zf` 第 1 條規則條件為「平台運送方式：包括 全家」。#1012 的 Shopify shipping line 為 `title=全家店到店取貨`、`code=custom`（後台自訂運費），推測 ShipAny 比對的是 code 而非顯示名稱；正式結帳的運費 code 等於運費名稱，需以真實運費再驗證。
- 測完於 Shopify 取消 #1012（未付款、未通知顧客），ShipAny 草稿同步為「訂單取消」（02:50）；網站資料庫無此訂單與發票工作。

影響：
1. Shopify 需新增名稱含「全家」「7-11」「萊爾富」的真實運費，ShipAny 需新增 7-11、萊爾富 → 順豐的規則（目前只有全家店到店與黑貓宅配兩條）。
2. 顧客在 Shopify 結帳頁若選錯運費（例如選了宅配），ShipAny 會因規則不符而報錯，需人工處理；且超商運費會對所有顧客顯示，需要限制只在選了門市時出現。

## Shopify 超商運費與顯示規則（2026-11-09 已上線）

店主同意後完成。CARE 為 Shopify Basic，無法自建 Shopify Functions，也沒有依條件隱藏運費的內建功能，而 Shopify 結帳頁預設選最便宜的運費（超商 NT$60 低於宅配 NT$146），所以必須讓宅配顧客看不到超商運費。改用公開 App「Shipy - Hide Shipping Rules」（Cirkle Studio，Premium 試用中，11/16 起每月 US$7.99）。

Shopify 一般設定檔 Domestic（台灣）目前四個運費，皆為固定費率、3 至 5 個工作日、訂單金額滿 NT$1,500 免運：

| 運費名稱 | 價格 |
| --- | --- |
| 標準（黑貓宅配） | NT$146 |
| 全家取貨 | NT$60 |
| 7-11取貨 | NT$60 |
| 萊爾富取貨 | NT$60 |

Shipy 啟用中的規則（都是「隱藏運費」）：

| 規則 | 條件 | 隱藏 |
| --- | --- | --- |
| 地址為門市：隱藏宅配運費 | 收件地址第一行包含 `[` | 名稱等於「標準」 |
| 地址非門市：隱藏超商運費 | 收件地址第一行不包含 `[` | 名稱包含「取貨」 |
| 非全家：隱藏全家運費 | `_pickup_carrier` 不包含 familymart | 名稱包含「全家」 |
| 非7-11：隱藏7-11運費 | `_pickup_carrier` 不包含 seven-eleven | 名稱包含「7-11」 |
| 非萊爾富：隱藏萊爾富運費 | `_pickup_carrier` 不包含 hilife | 名稱包含「萊爾富」 |

另有兩條舊規則（超商取貨：隱藏宅配運費、非超商取貨：隱藏超商運費）以 `_delivery_method` 判斷，已停用、未刪除。停用原因：實測發現 Shipy 的購物車屬性條件在屬性**不存在**時，「不包含」判定為不成立，所以一般宅配購物車（沒有 `_delivery_method`）仍看得到超商運費。第一次加入全家取貨時因此讓宅配購物車出現 NT$60 全家運費，發現後立即刪除該運費（正式站開關關閉，期間無顧客能建立超商結帳），改以收件地址判斷後重新加入。

驗收（Storefront API 建立購物車並讀取 `deliveryGroups`；門市地址 `[002816] 新北市板橋區府中路29-1號1樓`）：

| 情境 | NT$99 × 1 | NT$99 × 16（NT$1,584） |
| --- | --- | --- |
| 一般地址、無屬性（宅配） | 標準 146 | 標準 0 |
| 門市地址＋全家 | 全家取貨 60 | 全家取貨 0 |
| 門市地址＋7-11 | 7-11取貨 60 | 7-11取貨 0 |
| 門市地址＋萊爾富 | 萊爾富取貨 60 | 萊爾富取貨 0 |
| 門市地址、無屬性 | 三個取貨運費都出現 | 三個都是 0 |
| 一般地址＋取貨屬性 | 標準 146 | — |

NT$99 × 14（NT$1,386，未達門檻）的萊爾富情境為 60。

已知限制：
- 「門市地址、無屬性」會同時出現三家運費。本站建立超商結帳時一定寫入 `_pickup_carrier`，只有顧客自行在結帳頁輸入 `[` 開頭地址才會發生。
- 判斷依據是結帳頁當下的收件地址。顧客若把門市地址改成一般地址，運費會變回宅配「標準」，但 cart attributes 仍是超商取貨，出貨前需人工確認。
- ShipAny 規則已用真實結帳訂單驗證可比對這些運費名稱（見「實單測試」）。

## ShipAny 物流規則（2026-11-09 店主同意後更新）

CARE 物流設定檔 `shopify-gh2xgs-zf`（套用到 Shopify - gh2xgs-zf），規則由上到下優先套用：

| 順序 | 規則 | 條件 | 物流服務 |
| --- | --- | --- | --- |
| 1 | 全家店到店 | 平台運送方式包括「全家」「全家取貨」 | 全家店到店 |
| 2 | 7-11店取（順豐） | 平台運送方式包括「7-11」「7-11取貨」 | 順豐台灣 |
| 3 | 萊爾富店取（順豐） | 平台運送方式包括「萊爾富」「萊爾富取貨」 | 順豐台灣 |
| 4 | 宅配（黑貓常溫） | 運送到台灣（無運費名稱條件） | 黑貓宅急便常溫、上門取件 |

**「包括」是清單完全相符，不是包含字串。** 只有「全家」時，運費名稱「全家取貨」比對失敗（實單 #1013–#1015 草稿錯誤「External shipping method condition is not met」）；加入完整名稱後 #1016–#1018 才命中。日後若改 Shopify 運費名稱，必須同步改這三條規則，否則超商單會落到黑貓規則並報錯「不支援寄到服務點」。運算子只有「包括／不包括」。

第 2、3 條由第 1 條複製後修改，其餘設定相同：出貨地點拜悠衣品有限公司、常溫、寄方付款、自行寄件、物流公司依清單順序。複製出的規則多顯示一行「進口關稅：收方付款（DDU）」，只與跨境有關，國內件不影響。ShipAny 只在訂單匯入建立草稿時套用規則；之後在 Shopify 修改訂單（例如備註）不會重新套用。

## 實單測試（2026-11-09，店主同意，皆已取消）

用 Storefront API 建立與網站相同格式的購物車（收件地址 `[門市代碼] 地址`、`_pickup_*` attributes、備註「請勿出貨」），在 Shopify 結帳頁以店主 Email、測試電話 0912345678 選「貨到付款 (COD)」下單。每張 NT$99 商品＋NT$60 運費＝NT$159。

| Shopify | 超商／門市 | 結帳頁運費 | ShipAny 草稿 |
| --- | --- | --- | --- |
| #1013 | 全家板橋板農店 002816 | 只有 全家取貨 60 | 規則未命中（當時條件只有「全家」） |
| #1014 | 7-11一勝門市 110035（順豐代碼） | 只有 7-11取貨 60 | 規則未命中 |
| #1015 | 萊爾富中和國際店 22180（順豐代碼） | 只有 萊爾富取貨 60 | 規則未命中 |
| #1016 | 全家板橋板農店 | 全家取貨 60 | 全家店到店，預估運費 NT$65 |
| #1017 | 7-11一勝門市 | 7-11取貨 60 | 順豐台灣，NT$82 |
| #1018 | 萊爾富中和國際店 | 萊爾富取貨 60 | 順豐台灣，NT$82，預計 1 日送達 |

確認事項：
- ShipAny 依 `[門市代碼]` 把收件人改為該門市（便利店／自提點取貨），地址換成門市清單地址；順豐代碼也能辨識。
- ShipAny 讀到「貨到付款 (COD) NT$159」＝訂單總額（含運費）。
- 結帳頁每家只出現自己的運費；COD 付款方式可用於超商取貨。
- 六張測完都在 Shopify 取消（重新入庫、不通知顧客、員工備註「超商取貨實單測試，測完取消」），ShipAny 草稿同步為「訂單取消」，沒有建立運單或叫件。網站資料庫沒有這些訂單、沒有發票工作（測試購物車不是經網站 `create-shopify-cart` 建立，所以網站的訂單同步與發票流程**沒有**被驗到）。

發現的問題：
- 結帳頁「貨到付款 (COD)」說明寫「商品送達時，請以現金支付訂單總額（含運費）給配送人員」，對超商取貨不正確（是到門市付款）。需改成通用說明，Shopify 付款設定變更需店主同意。
- 收件人公司欄位（門市名稱）在 Shopify 結帳頁沒有顯示，但訂單收件地址與 ShipAny 有收到。

## 取貨付款自動標記已付款（2026-11-09 店主決定「現在就加進 Flow」）

沿用宅配做法：ShipAny 回寫 Shopify 貨件 DELIVERED → Flow 標記已付款 → 每日發票排程開票。為了不動已運作的宅配 Flow，另建三個 Flow（由「COD 宅配送達後自動標記已付款」複製），皆已啟用：

| Flow | 條件（全部 AND） | 動作 |
| --- | --- | --- |
| COD 全家取貨後自動標記已付款 | Fulfillment event status = DELIVERED、Payment gateway names = Cash on Delivery (COD)、display financial status = PENDING、Shipping line title = 全家取貨 | Mark order as paid |
| COD 7-11取貨後自動標記已付款 | 同上，title = 7-11取貨 | 同上 |
| COD 萊爾富取貨後自動標記已付款 | 同上，title = 萊爾富取貨 | 同上 |

用三個完全相符的 Flow，而不是一個「title 包含 取貨」，是因為 Flow 編輯器的運算子下拉選單無法以自動化操作；完全相符也比包含更嚴格。原宅配 Flow（title = 標準）未修改。

**風險（店主已知悉後選擇）：** 尚未確認 ShipAny 對超商單是在「到店」還是「顧客取件付款」時回寫 DELIVERED。若是到店就回寫，訂單會在顧客付款前被標記已付款並開票。第一筆真實超商取貨付款訂單需比對 ShipAny 狀態時間線、Shopify 貨件事件與實際取件時間；若不符，關閉這三個 Flow 改人工確認。日後若改運費名稱，三個 Flow 也要一起改。

## 尚未確認（依賴外部回覆）

1. ~~ShipAny 匯入如何辨識門市~~：2026-11-09 實測確認收件地址第一行 `[門市代碼]` 即可辨識（見上節）。原詢問：店主 2026-11-07 已來信詢問（討論串「LUCISSI：確認台灣 Shopify App／黑貓沙盒運單與追蹤回寫測試」），2026-11-09 尚未回覆。信中以 LUCISSI 商店 j97kr5-7b 名義詢問，CARE（gh2xgs-zf）同帳號。
2. ~~門市資料檔格式~~：已依 2026-11-09 實際檔案調整解析器並補測試（PR #112）。
3. **同一超商由哪家物流商出貨**：7-11 由黑貓與順豐都可配送；目前同代碼只保留先出現的一筆，`_pickup_courier` 記錄來源，需與 ShipAny 進階物流匹配規則一致。
4. **顧客在結帳頁改掉地址**：Shopify 結帳頁無法鎖定地址，只能提示；需確認 ShipAny 收到被改過的地址時如何處理。

## 開啟前步驟

1. ~~店主在 ShipAny 後台建立 CARE 專用 token，設定 Vercel Production：`SHIPANY_CLIENT_KEY`、`SHIPANY_MERCHANT_TOKEN`、`SHIPANY_REFRESH_TOKEN`~~（2026-11-09 完成，`saengak-web-d2ux` 三項皆為 sensitive）。CARE 不可與 LUCISSI 共用同一組 token：兩站都會輪替 refresh token，共用會互相使對方失效。第一次使用後 token 以 AES-256-GCM 加密存在 `private.shipany_api_tokens` 並自動輪替；更換 Client Key 或 token 時需先刪除該資料列。
2. ~~套用 migration~~（2026-11-09 已套用正式 Supabase，版本 `20261108174448`；回讀開關 false、運費 60、token 表 0 筆，anon／authenticated 無法呼叫兩個 RPC）。
3. ~~以實際門市資料檔調整並測試 `normalizeLocationFile`~~（PR #112 完成）。
4. 依 ShipAny 回覆調整寫入格式。
5. ~~Shopify 新增超商取貨運費（NT$60、門檻免運）並限制只在選了門市時出現~~（2026-11-09 完成）。~~ShipAny 新增 7-11、萊爾富 → 順豐的物流規則~~（2026-11-09 完成並以實單驗證）。~~確認「貨到付款」付款方式對超商取貨可用~~（實單確認可選）。~~COD 付款說明文字改為通用版本~~（2026-11-09 店主同意後更新並回讀：其他詳細資訊「宅配：商品送達時，請以現金支付訂單總額（含運費）給配送人員。超商取貨：請於門市取件時付款。」；付款說明「我們會盡快安排出貨。宅配請於商品送達時以現金支付訂單總額（含運費）；超商取貨請於門市取件時付款。電子發票會在確認收款後開立，並寄到您的 Email。」）。
6. ~~取貨付款的收款確認~~：店主 2026-11-09 決定沿用 DELIVERED → 標記已付款，三個超商 Flow 已啟用（見上節）。首筆真實訂單需確認 DELIVERED 時點等於顧客取件付款；ShipAny 撥款仍需在「貨到付款紀錄」另行對帳。
7. 從網站本身走一次完整流程：選店 → 網站建立結帳 → 下單 → 網站資料庫訂單同步。開關只存在正式資料庫，預覽環境無法單獨開啟。2026-11-09 店主同意暫開（11:04:29–11:05:56，約 1.5 分鐘，之後改回 false，`/api/pickup-points` 回 404）：正式站購物車出現「宅配到府／超商取貨」，選超商後預估運費 NT$60、總計 NT$80，7-ELEVEN 搜尋「一勝」列出 7-11一勝門市（110035）並可選定。之後按「訪客結帳」時 Cloudflare Turnstile 判定自動化瀏覽器失敗，依規定不繞過，所以「網站建立結帳 → 下單 → 資料庫同步」**尚未驗證**，需由店主本人在瀏覽器完成驗證或登入會員後接手。之後第一筆真實訂單驗收寄件、取件通知、付款與發票。
8. 最後才把 `site_settings.store_pickup_enabled` 改為 true；回復方式為改回 false。

## 管理員診斷

`GET /api/pickup-points?diagnose=1`，帶管理員的 Supabase 登入 token（`Authorization: Bearer`）。不受開關限制，回傳各物流商門市資料檔的網域、結構、筆數、前兩筆範例、類型值與解析結果；不含 token。非管理員回 403。

## 驗證紀錄

- 2026-11-09：typecheck、Vitest 76 檔／757 項、verify:content、build 通過。新增 `tests/store-pickup-api.test.ts`（門市資料解析、token 輪替、快取、搜尋 API）、`tests/create-shopify-cart-pickup.test.ts`（預填門市地址、開關關閉、偽造門市、門市清單不可用）、`tests/store-pickup-ui.test.tsx`。資料庫測試 `supabase/tests/database/store_pickup.test.sql` 已撰寫，本機未執行。
- 本機預覽（模擬開關開啟與門市搜尋結果，iPhone 13 尺寸）：選超商取貨後預估運費變為 NT$60，搜尋「民生」列出門市，選定後顯示門市與「更換」，選擇保存在 localStorage，無頁面錯誤。未連 ShipAny、未建立結帳。
