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

## 尚未確認（依賴外部回覆）

1. **ShipAny 匯入如何辨識門市**：店主 2026-11-07 已來信詢問（討論串「LUCISSI：確認台灣 Shopify App／黑貓沙盒運單與追蹤回寫測試」），2026-11-09 尚未回覆。信中以 LUCISSI 商店 j97kr5-7b 名義詢問，CARE（gh2xgs-zf）同帳號。
2. **門市資料檔格式**：`normalizeLocationFile` 以常見欄位名稱寬鬆解析，取得金鑰後需以實際檔案確認欄位與自取點類型名稱，並補測試。
3. **同一超商由哪家物流商出貨**：7-11 由黑貓與順豐都可配送；目前同代碼只保留先出現的一筆，`_pickup_courier` 記錄來源，需與 ShipAny 進階物流匹配規則一致。
4. **顧客在結帳頁改掉地址**：Shopify 結帳頁無法鎖定地址，只能提示；需確認 ShipAny 收到被改過的地址時如何處理。

## 開啟前步驟

1. ~~店主在 ShipAny 後台建立 CARE 專用 token，設定 Vercel Production：`SHIPANY_CLIENT_KEY`、`SHIPANY_MERCHANT_TOKEN`、`SHIPANY_REFRESH_TOKEN`~~（2026-11-09 完成，`saengak-web-d2ux` 三項皆為 sensitive）。CARE 不可與 LUCISSI 共用同一組 token：兩站都會輪替 refresh token，共用會互相使對方失效。第一次使用後 token 以 AES-256-GCM 加密存在 `private.shipany_api_tokens` 並自動輪替；更換 Client Key 或 token 時需先刪除該資料列。
2. ~~套用 migration~~（2026-11-09 已套用正式 Supabase，版本 `20261108174448`；回讀開關 false、運費 60、token 表 0 筆，anon／authenticated 無法呼叫兩個 RPC）。
3. 以實際門市資料檔調整並測試 `normalizeLocationFile`。
4. 依 ShipAny 回覆調整寫入格式。
5. Shopify 新增超商取貨運費（NT$60、門檻免運），名稱需符合 ShipAny 進階物流匹配規則；確認「貨到付款」付款方式對超商取貨可用。
6. 取貨付款的收款確認：送到門市不代表已付款。ShipAny 文件寫明服務點的 `order/delivered` 代表顧客已取件；收款與撥款需在 ShipAny「貨到付款紀錄」對帳，確認後才在 Shopify 標記已付款並開發票（不可沿用黑貓「送達即付款」的 Flow）。
7. 用一筆真實訂單驗收：門市、運費、代收金額、ShipAny 運單、取件通知、付款與發票。
8. 最後才把 `site_settings.store_pickup_enabled` 改為 true；回復方式為改回 false。

## 管理員診斷

`GET /api/pickup-points?diagnose=1`，帶管理員的 Supabase 登入 token（`Authorization: Bearer`）。不受開關限制，回傳各物流商門市資料檔的網域、結構、筆數、前兩筆範例、類型值與解析結果；不含 token。非管理員回 403。

## 驗證紀錄

- 2026-11-09：typecheck、Vitest 76 檔／757 項、verify:content、build 通過。新增 `tests/store-pickup-api.test.ts`（門市資料解析、token 輪替、快取、搜尋 API）、`tests/create-shopify-cart-pickup.test.ts`（預填門市地址、開關關閉、偽造門市、門市清單不可用）、`tests/store-pickup-ui.test.tsx`。資料庫測試 `supabase/tests/database/store_pickup.test.sql` 已撰寫，本機未執行。
- 本機預覽（模擬開關開啟與門市搜尋結果，iPhone 13 尺寸）：選超商取貨後預估運費變為 NT$60，搜尋「民生」列出門市，選定後顯示門市與「更換」，選擇保存在 localStorage，無頁面錯誤。未連 ShipAny、未建立結帳。
