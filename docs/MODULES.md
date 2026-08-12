# SAENGAK 現階段模塊與算法基線

更新日期：2026-07-20

## 上線口徑

目前版本是「可公開瀏覽的品牌與展示目錄」。商品、搜尋、精選排序、內容頁與本地購物車可以使用；會員、正式 Shopify 結帳、真實訂單與營運後台仍需要有效的 Supabase／Shopify 專案憑證與資料表後才能宣稱正式啟用。介面不得用假訂單、假營收或假評分冒充即時資料。

## 模塊責任與算法

| 模塊 | 現階段內容責任 | 對應算法／規則 | 上線狀態 |
| --- | --- | --- | --- |
| 商品目錄 | 展示名稱、說明、價格、圖片、標籤 | 結構正規化、穩定 ID、API 未啟用時使用明確的展示目錄；`VITE_PUBLIC_SHOPIFY_STOREFRONT_ENABLED` 必須經解鎖驗收後才開啟 | 可展示；正式 API 已到達 Shopify，待啟用商店與匯入商品 |
| 搜尋與篩選 | 關鍵字、分類、品牌、價格、每頁 12 筆 | 繁中正規化、同義詞擴展、名稱／標籤／類型／說明加權、確定性訊號與穩定分頁排序 | 可用 |
| 編輯精選 | 推薦商品而不假稱真實五星評分 | 編輯標記、已有評論證據量、折扣、上新訊號的確定性分數；不生成隨機互動數 | 可用；評分來源待接 |
| 商品詳情 | 圖片、價格、說明、數量 | 折扣率、數量 1–99 邊界、找不到即停止而非造資料；詳情主圖用方形完整顯示，首頁／搜尋商品卡維持 2:3 直式裁切 | 可用於展示 |
| 購物車／結帳 | 加入、合併、增減、合計、本機保存，導向 Shopify Checkout | 以 variant ID 建立 Cart lines；缺規格即停止；Shopify `checkoutUrl` 為唯一正式結帳入口 | 正式 Function 已到達 Shopify；待解除 channel lock、匯入 Variant 與完成 TapPay 商家綁定 |
| 會員 | 註冊、登入、重設密碼、個人資料、收藏 | Supabase Auth；後台權限只能讀 `app_metadata`；`profiles`／`user_favorites` 以 `auth.uid()` 做擁有權 RLS | 電子郵件 Auth、production URLs 與跨帳號 RLS 11/11 已驗證；OAuth providers 皆未啟用，待真實郵件流程回歸 |
| 內容文章 | 品牌、知識、法務與社群內容 | HTML 去標籤、繁中每分鐘 400 字與西文每分鐘 200 字的閱讀時間估算；編輯稿明示審閱狀態，不顯示假留言或假互動 | 品牌與政策頁已收斂為現況說明；醫療內容仍待專業審閱，Shopify Blog 待接 |
| 訂單 | 導向真實訂單來源，不顯示示範個資 | 已驗證會員 session 建立可信 Cart link；Shopify HMAC、Webhook ID 去重、事件時間戳防倒退；`orders`／`order_items` 僅允許會員讀自己的列。`verify:commerce` 要求 success／failed／cancelled 三種案例的 Order ID、金額、付款、物流與發票跨系統一致 | App、secret、五個 subscriptions 與 HMAC 鏈路已完成；待真實 Shopify／TapPay sandbox 三案例驗收 |
| 物流／發票 | Shopify Checkout 選擇宅配／超取，物流 App 叫件及回寫貨態，發票平台開立／作廢／折讓 | `src/domain/fulfillment.ts` 先按目的地、材積、溫層、付款方式、商品限制與 SLA 過濾，再計算完整落地成本；滿 30 天證據才用妥投率／時效排序，否則要求人工選擇。發票狀態只接受供應商事件，不由付款狀態推測。`verify:commerce` 另要求 App、帳號綁定、success 案例回寫及 failed／cancelled 不誤建狀態 | provider-neutral projection、會員唯讀 RLS、會員中心查詢及路由算法已部署；Waaship 已安裝，待帳號綁定與 sandbox 實單 |
| 營運後台 | 顯示模塊健康度與外部管理入口 | 管理員 `app_metadata.role` 授權、即時讀回、不得顯示假 KPI | 待 Auth／資料源 |
| 法務與客服 | 隱私、條款、退換貨、FAQ、聯絡資訊 | 公司資料統一由 `src/content/site.ts` 提供；`verify:content` 阻擋舊品牌、假電話／地址、跨品牌信箱與無來源安全宣稱 | 舊品牌與假聯絡資料已移除；正式客服管道及法務核准仍待營運提供 |

## 下一階段接線條件

1. 新的 SAENGAK 專用 Supabase `tmqzkagkrzhioftvwbqo` 已建立，publishable key、RLS 與 Auth URL 已部署；Site URL 為 `https://saengak.com.tw`，正式後台回讀的 redirect allow list 為 `/auth/confirm`、`/reset-password` 兩條。跨帳號 RLS 交易測試 11/11 通過且 rollback 後零殘留。不得使用已證實屬於 `lucissi.com` 的 `dhktmpcvtoxcicqkwgpn`。
2. 2026-07-30 結帳目標已改為已完成 TapPay 商家設定的 SAENGAK Shopify 商店 `gh2xgs-zf.myshopify.com`。目前 Online Store 仍受鎖定，Storefront API 回覆 `Online Store channel is locked`；解鎖並建立真實商品規格後使用 `2026-07` API。
3. `create-shopify-cart` v3 與 `shopify-orders-webhook` v2 已部署。`SAENGAK Order Sync` 的使用中版本為 `saengak-order-sync-2`，只安裝於 Saengak、scope 為 `read_orders`；client secret 已保存於 Supabase，五個訂單 webhook topics 已建立並回讀完整。`npm run shopify:webhooks` 保留安全 dry-run／去重／衝突拒絕與套用後回讀。取得 `checkoutUrl` 後才導向 Shopify Checkout，付款結果只接受已驗證 HMAC 的 Shopify webhook。
4. `saengak.com.tw` 已切到本倉庫的 `saengak-web-d2ux` 並可公開存取；Supabase production 環境變數已加入。最新 production `dpl_GymaDrHXPzoDyAA2ZHcaCJHx94dy` 已部署 CSP、防嵌入、MIME sniffing 防護及其他安全標頭；`npm run verify:production` 對 7 條路由、bundle、安全標頭及 Edge Function 未授權探針為 23/23。
5. TapPay Payment App 授權流程已導向 TapPay Portal，但仍需帳戶持有人登入、選擇 Shopify 商家設定／MGID 並完成啟用；Shopify 付款頁要求先選方案，Storefront API 目前回覆 `Online Store channel is locked`。
6. 本機 `supabase/.temp/project-ref` 仍指向舊專案，因此 `npm run verify:binding:supabase` 與完整的 `npm run verify:binding` 會刻意失敗；2026-07-20 `supabase link --project-ref tmqzkagkrzhioftvwbqo --yes` 明確回覆 `Access token not provided`。遠端已透過 Supabase 管理連線驗證為 `ACTIVE_HEALTHY`，但在取得 CLI login／link 權限前仍不得手動竄改暫存檔假裝完成綁定。前端部署只可在 `npm run verify:binding:vercel` 通過時執行，且不能把它當作 Supabase CLI 已重新 link。

2026-07-20 production UI 回歸已確認：註冊與重設密碼表單會在正式 Supabase 設定下顯示；展示商品可以加入本機購物車，但按下結帳會明確回覆「缺少 Shopify 規格 ID」且不會離開 SAENGAK 或送出付款。測試購物車已清空。

## 公開內容守門

- `npm run verify:content` 掃描 `index.html` 與 `src`，阻擋舊 Shopify 商店、LUCISSI／Innercare 聯絡資料、示範電話／地址及特定無來源宣稱。
- 公司名稱、統一編號、登記地址、客服狀態與內容盤點日期集中在 `src/content/site.ts`；正式客服資料確認後只在此處更新，再重跑內容守門。
- 隱私、條款與退換貨頁已清楚說明目前付款、物流、退款與客服尚未啟用，不宣稱 ATM、超商、貨到付款、固定運費或固定退款天數。
- 2026-07-20 已移除公開優惠頁中的過期 2024 折扣、韓元免運、模擬訂閱成功、舊品牌歡迎文案與未啟用 OAuth 按鈕；首頁 Storefront 尚未解鎖時不再持續呼叫失敗端點或留下 console errors。

所有前端 Functions 請求都由 `VITE_PUBLIC_SUPABASE_URL` 與共用 header helper 組成，不寫死專案 ref。新專案優先使用 `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，只放在 `apikey`；`VITE_PUBLIC_SUPABASE_ANON_KEY` 僅保留給 legacy JWT anon key，相容舊函式時才同時使用 Bearer header。
