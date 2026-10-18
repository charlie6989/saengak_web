# 項目狀態

更新日期：2026-10-18（Asia/Taipei）。最新工作為商品主圖視覺規範與第一批重製圖；以下各節依時間由新到舊排列。其下保留各分支當時的驗證紀錄。歷史段落中的「未部署／未套用」只描述當時範圍，現況以本節及上線查核文件為準。

## 商品主圖視覺規範與第一批重製（2026-10-18，分支 `claude/website-product-visual-style-07e360`）

- 新增 `docs/PRODUCT_IMAGE_STYLE.md`：商品主圖統一為「Ivory Studio」——1:1、象牙 `#F8F5F1` 無縫背景、左上柔光、梅紫調淡陰影、商品約佔 70%、不放文字／貼紙／浮水印／他牌道具／身體；第二張為質感或情境圖（Daylight Linen），沒有合適素材時保留原圖。製作優先順序：原圖去背合成 → AI 以原圖為參考重繪 → 補拍。
- 盤點：Storefront 回傳 28 件公開商品（含 1 件金流驗收測試商品，未處理）。內著類主圖多為供應商照片，含報紙／木桌／黑桌背景、促銷字、浮水印、7A 貼紙、他牌（CHANEL）道具與身體特寫；三個 SAENGAK 組合為框格拼貼。
- 已產出 27 張 1600×1600 主圖，存於 `creative/product-v1/main/{index}.jpg`，對照圖 `creative/product-v1/before-after-{1,2}.jpg`，來源、方法與逐張檢查事項在 `creative/product-v1/provenance.json`。12 張先以 Canva generate-image（原圖為參考）重繪，再與 13 張原圖去背圖一起用 `scripts/product-images/` 合成到同一張標準背景；3 個組合由單品去背圖並排合成。Canva 匯出用暫存設計 `DAHYSkz6bps` 已存檔在使用者 Canva 帳號。
- 已驗證：逐張目視對照原圖；`npm run verify:content` 通過。
- 使用者決定（2026-10-18）：第 10 件改名為 MEDION 並刪除缺貨的 SAENGAK 規格；第 14 件下架（保留選項結構較好的第 20 件，兩件 SKU 完全相同）；預設規格沒有實拍照的 7 件，改把有照片的顏色排到第一個規格（網站預設選第一個有庫存的規格，`pickInitialVariant`）。
- 主圖顏色第二版：11 張改成預設規格顏色並重新合成（01 霧光藍、02 魅惑紫、05 櫻花粉、08 極雅黑、09 灰藍、11 粉色、12 藍邊、13 午夜藍、16 飄雪白、17 極雅黑、18 雪紗白），每件顯示的顏色記在 `provenance.json` 的 `color_shown`。
- Shopify（經 Chrome 已登入後台，使用者授權，2026-10-18 完成）：26 件新主圖上傳並排第一張、原圖保留在後；第 10 件標題改「MEDION 私密淨化凝膠」、廠商改 MEDION、刪除「益生菌私密舒緩凝膠（單支，盒裝7隻）」規格；第 14 件設為草稿；第 3、4、9、15、18、19 件把有實拍照的顏色排到第一個規格。Storefront API 逐件回讀：新圖皆為第一張、每件只多一張、無重複；第 14 件不再公開；網站預設規格顏色與主圖一致。正式站 `/products` 目視確認新主圖已顯示。
- 使用者確認（2026-10-18）：看過待確認對照表 `creative/product-v1/review-needed.jpg`（#13 腰頭字樣、#18 印標小字、#8 與 #16 改色、#15 色名推定、#10 文字內容）後回覆「確認可以」，全部維持現狀。
- 原列未處理（已由上一行確認維持）：第 10 件的說明、標籤（SAENGAK、益生菌凝膠）與商品中繼欄位仍是 SAENGAK 凝膠內容，需 MEDION 原廠資料才能改寫；AI 圖細節（#8、#16 改色、#13 腰頭字樣、#18 印標小字、#15 色名推定）仍待對照實品；第二張情境圖尚未製作。第 22 件濕巾只賣單片（1片入），已上架主圖卻是三盒堆疊，經使用者同意已把單片版 `creative/product-v1/main/22-single.jpg` 設為第一張（三盒版與原圖保留在後），Storefront 回讀確認。主圖背景用 `#F8F5F1`，與同日合併的 Calm Care 色票 porcelain `#F7F6F3` 略有差異（肉眼幾乎無差），未重製。製圖腳本依 PR 審查修正：組合間距納入寬度計算、平拍陰影先加邊再模糊、Vision 去背套用 EXIF 方向、貼紙填補只取不透明布面並限縮運算範圍；已上架圖用舊版產生，重算後只差陰影邊緣幾個色階，未重新上傳。上傳方式：後台多媒體欄位在 shadow DOM，經頁面內代理 file input 轉交後再以指標事件拖曳排序。

## 品牌照片重新調色（2026-10-18，分支 `claude/photo-neutral-grade`）

使用者選擇「重新調色」取代重拍。`scripts/regrade-brand-photos.mjs`（sharp）逐像素把粉色調拉向暖灰米：只處理色相約 340°–36°、飽和度 ≤0.45、明度 ≥0.3 的區域（實測粉牆與道具在色相 6–12°、飽和 0.21–0.27），色相往 34°（`stone`）拉、飽和度最多降 55%；皮膚與唇色（飽和 0.4 以上）、深色道具（plum 收納包）與 Saengak 綠色包裝不受影響。`public/images/lucissi-v5/` 41 張全部重新輸出（webp 品質 82，總量 4.1 MB → 2.6 MB）；檔名不變，元件不需修改。

- 已驗證：抽樣前後對照（粉牆、人物、商品平拍、粉色最重的 thumb-wear／social-gentle／promotion-discount）確認牆面轉為暖灰米、膚色與唇色保留、商品顏色不變。
- 未處理：設計系統 Photography 素材組仍是舊圖；Shopify 商品圖不在此範圍。

## Calm Care 色票上線、商店改名與母站權益開啟（2026-10-18，分支 `claude/calm-care-palette`）

使用者同意設計系統「色彩重新定位（提案）」與下列營運動作：

- **色票**：`src/index.css` 的 `@theme` 改為 Calm Care 值，`ivory`／`blush` 保留名稱但改為 `porcelain` #F7F6F3／`stone` #ECE8E2，新增 `stone`、`porcelain`、`line-strong`、`ink-muted`、`eucalyptus`、`eucalyptus-tint`、`rose-tint`；文字 `charcoal` #2A2725、`gray-500` #5C5552、`gray-400` #6E6662（修正原 3.72:1 不合格）；`surface` 改純白。元件內寫死的舊色碼（23 檔、138 處）一併換成新值。商品卡「查看商品」改白底＋1px `line-strong` 框＋`plum` 字，hover `plum` 實心；商品頁信任列改 `eucalyptus-tint` 底與 `eucalyptus` 圖示；首頁「生理期照護」入口改 `rose-tint` 底；`theme-color` 與分享圖背景改 `stone`／`porcelain`。Logo 不變。
- **Shopify 商店名稱**：`gh2xgs-zf` 由「My Store 7」改為「LUCISSI CARE」（結帳頁抬頭同步）。
- **Migration 紀錄**：正式站 `supabase_migrations.schema_migrations` 補記 `20261016111000_grant_coupon_service_access`（權限本已存在，同時再執行一次 grant，結果不變）。
- **母站權益**：`lucissi-website` production 設 `CARE_MEMBER_PERK_ENABLED=true` 並重新部署；兩站 `member-status` 簽章呼叫仍正常。母站實際領取需在母站登入測試（母站仍有 Private Access 門禁）。
- 已驗證：Vitest 482 項、build、`verify:content`、typecheck、lint 通過；本機首頁頁首已為 `stone`。商品卡與商品頁需資料，於 Vercel preview 驗證（見 PR）。

## 會員首單免運：CARE 端實單驗證與開放領取（2026-10-18，分支 `claude/perk-rollout-results`）

**CARE 端整段流程已在正式站驗證通過**（取代下方各節的「待解決」）：

- 測試會員 `charlie.liu6989+lucissitest@gmail.com`（兩站皆為已驗證會員、CARE 無訂單）領取代碼 `LCKQ4A74N7WC`，Shopify 建立綁定該顧客的免運折扣。
- 第一次測試結帳停在 TapPay 付款頁，Shopify 只留下未完成結帳（待顧客付款 NT$20），所以沒有訂單，不是 webhook 故障。
- 第二次在 TapPay 沙盒付款頁完成付款並回到 Shopify 感謝頁（確認碼 M6NL0EZXQ）：訂單 **#1009** 已付款 NT$20，運費 NT$146 由代碼折抵為免運。
- 訂單 webhook 寫入 CARE `orders`（`paid`、`discount_codes` 含代碼、已綁會員），6 秒後 `partner_member_perks` 由 `issued` 變為 **`used`**。
- 收尾：使用者同意後於 Shopify 取消 #1009，退款 NT$20 至 TapPay（沙盒）、補回庫存、封存，未寄顧客通知。CARE `orders` 同步為 `cancelled`／`refunded`；該單的電子發票工作（`private.amego_invoice_jobs`，operation `issue`）在 0 次嘗試時轉為 `cancelled`，未開立發票。代碼維持 `used`（依設計，取消訂單不退回首單權益）。
- ShipAny：為 #1009 建立的出貨單（ShipAny Order ID `456668fc…`）於 2026-10-18 在 ShipAny 後台「全部訂單」確認為「訂單取消」，不會出貨。
- 觀察：CARE `orders.shipping_amount` 記錄折扣前運費 146（實付總額 20 正確），之後做運費報表需扣除折扣。
- 「首單未使用代碼 → 停用折扣並標記 `expired`」的分支：已於 2026-10-18 另行驗證，見下節。

## 會員首單免運：首單未用代碼 → 代碼作廢（2026-10-18，分支 `claude/perk-expiry-test-results`）

**「首單沒用代碼就作廢」分支已在正式站驗證通過**：

- 使用者同意以主帳號 `charlie.liu6989@gmail.com` 測試（接受其首單免運權益因此作廢）。主帳號以 Google 登入 CARE（Google 登入於同日修復，見 PR #55），在 `/promotion` 領取代碼 `LCVED46LF4DJ`，Shopify 建立綁定該顧客的免運折扣 `gid://shopify/DiscountCodeNode/1494065315907`。
- 結帳不輸入代碼，於 TapPay 沙盒付款，回到 Shopify 感謝頁（確認碼 59LM0DEFJ）：訂單 **#1010** 已付款 NT$166（商品 NT$20＋運費 NT$146，未折抵）。
- 訂單 webhook 寫入 CARE `orders`（`paid`、`discount_codes` 空），5 秒後 `partner_member_perks` 由 `issued` 變為 **`expired`**。
- Shopify 後台該折扣狀態為「已到期」、已使用 0 次；時間軸顯示 SAENGAK Order Sync 停用此折扣兩次（推測訂單建立與付款兩個 webhook 各觸發一次，第二次無實質影響）。
- 收尾：使用者同意後於 Shopify 取消 #1010，退款 NT$166 至 TapPay（沙盒）、補回庫存，未寄顧客通知。CARE `orders` 同步為 `cancelled`／`refunded`；電子發票工作（operation `issue`）在 0 次嘗試時轉為 `cancelled`，未開立發票。代碼維持 `expired`（取消訂單不退回首單權益）。
- 尚未確認：#1010 的 ShipAny 出貨單（ShipAny Order ID `974c3fef…`）是否為「訂單取消」；ShipAny 後台需使用者登入，由使用者自行確認。
- 觀察：Shopify 結帳頁的瀏覽器分頁標題仍顯示「Checkout - My Store 7」（頁首已是 LUCISSI CARE、感謝頁標題亦為 LUCISSI CARE），可能為快取，待觀察。

**Migration 版本對齊（2026-10-18）**：`partner_member_perks` 檔名由 `20261017120000` 改為正式站實際記錄的 `20261016205350`（母站 repo 另改為 `20261016205402`），避免日後 `supabase db push` 以為尚未套用。另發現 `20261016111000_grant_coupon_service_access.sql` 不在正式站 migration 紀錄，但正式站 `service_role` 已具 `promotions`／`user_coupons` 的 select／insert／update／delete 權限，內容等同已生效；是否補記錄需使用者同意，未變更正式站。ShipAny 端 #1009 已確認為「訂單取消」。

**母站權限**：`j97kr5-7b` 的 LUCISSI Product Sync 第 12 版核准後已授予 `read_customers`／`write_customers`，但同時移除了未寫在 `shopify.app.toml` 的 `write_inventory`／`read_locations`。母站 PR #36 補回 `read_inventory`／`write_inventory`／`read_locations` 並加測試，發布第 13 版且已核准；以新 token 實測顧客、地點、庫存查詢皆成功。母站權益 `CARE_MEMBER_PERK_ENABLED` 仍關閉。

**開放領取**：本次將 CARE production 的 `VITE_PUBLIC_LUCISSI_MEMBER_PERK_ENABLED` 設為 `true` 並重新部署，優惠活動頁與會員中心「我的優惠券」顯示領取卡片（驗證結果見 PR 說明）。

## 分享圖與主畫面圖示（2026-10-17，分支 `claude/share-icons`）

補齊 Logo 規範網站導入步驟 3–4（暫用字標版本）：

- 以 sharp 從暫用字標 SVG 產生 `public/apple-touch-icon.png`（180px）、`public/favicon-32x32.png`，以及 `public/images/brand/og-image.png`（1200×630，`ivory` #F8F5F1 底、Primary 字標 560px 寬、`plum`，依規範置中）。
- `index.html` 加入 32px PNG icon、`apple-touch-icon`、Open Graph（type、site_name、locale、title、description、image 與尺寸、alt；不設固定 `og:url`，因所有路由共用 `index.html`，固定值會讓各頁分享被併成首頁）及 `twitter:card=summary_large_image`。各頁仍共用首頁的分享資訊；個別商品頁的分享標題與圖片尚未處理。
- 已驗證：本機 dev server 四個圖檔皆 200 且型別正確、12 個分享標籤存在；目視檢查分享圖與圖示。
- 未處理：`.ico`（現代瀏覽器用 SVG／PNG 即可）；設計師正式檔到位後需重產這三張圖。

## 配送文案比照 LUCISSI（2026-10-17，分支 `claude/shipping-copy-home-delivery`）

使用者要求比照 LUCISSI 物流設定。唯讀檢視兩店 Shopify 後台：CARE `gh2xgs-zf` 與母站 `j97kr5-7b` 都只有台灣「標準」宅配 NT$146、滿 NT$1,500 免運，沒有超商取貨；母站網站設定列出的三種超商取貨皆為關閉。CARE 網站卻有多處寫超商取貨，已改為只寫黑貓宅急便常溫宅配：

- 商品頁與商品預覽頁標籤「超商 / 宅配」改為「黑貓宅急便宅配」；FAQ 配送時間改為黑貓常溫宅配、付款後約 3 至 5 個工作天（與 Shopify 運費標示一致）、目前不提供超商取貨；FAQ 運費改用 `DEFAULT_SHIPPING_FEE`／`DEFAULT_FREE_SHIPPING_THRESHOLD` 顯示 NT$146／滿 NT$1,500 免運。
- 優惠頁免運副標、購物車手機號碼說明與「下一步」提示、後台站點設定說明、評價未送達訊息、隱私權政策的 ShipAny 資料項目，一併移除超商取貨字樣。
- `scripts/verify-public-content.mjs` 新增五個超商取貨宣稱片語，防止回歸（舊 build 產物即被擋下，重新 build 後通過）。
- 已驗證：本機 FAQ 兩題與商品頁顯示新文案、無主控台錯誤；typecheck、lint、Vitest 482 項、build、`verify:content` 通過。

**更正上節測試訂單判讀**：以使用者 Chrome 唯讀檢視 CARE Shopify 後台，訂單最新仍為 #1008（10/16 的隔離驗收單、已退款），未完成結帳也沒有 lucissitest 的紀錄，表示首次測試結帳在 Shopify 端未成立訂單，並非 webhook 故障；CARE `orders` 自 8/26 後無新單是因為商店沒有新訂單。代碼 `LCKQ4A74N7WC` 仍為 `issued`，待使用者重新結帳並回報訂單號。

## 暫用字標與會員首單免運上線進度（2026-10-17，分支 `claude/interim-wordmark`）

**字標**：使用者同意先以程式排出方向 A 家族字標，取代頁首 PNG（「care」在頁首不到 1px）。依設計系統 Logo 規範，以 Cormorant Garamond 400（LUCISSI，字距 0.32em）與 Noto Sans TC 500（CARE）轉成外框路徑（OFL 字型），不依賴裝置字型；單色 `currentColor`／`text-brand`（plum #5B3D48）。

- `BrandLogo` 改輸出 inline SVG，`lockup` 為 `small`（預設，header 150px／手機 138px）、`primary`（≥200px，重設密碼頁 220px）、`horizontal`。路徑資料在 `src/components/base/brandLogoPaths.ts`；同規格的 SVG 檔在 `public/images/brand/lucissi-care-{small,primary,horizontal,icon}.svg`。
- `index.html` 加入 `favicon.svg`（plum 方形＋Cormorant「L」，規格中的暫定圖示）與 `theme-color`。舊 `lucissi-care-logo.png` 移除。
- 已驗證：本機 dev server 手機與 1440px 桌機頁首皆顯示新字標（桌機 150×37px、plum、無主控台錯誤）；`tsc`、lint、Vitest 482 項、build、`verify:content` 通過。
- 未處理：設計師正式 SVG、`.ico`／`apple-touch-icon`、Open Graph 分享圖；Email 範本未使用此元件。

**會員首單免運正式上線進度**（依 `docs/LUCISSI_MEMBER_PARTNER_API.md` 步驟）：

- 已完成：兩站正式 Supabase 套用 `partner_member_perks`（MCP 記錄版本 CARE `20261016205350`、母站 `20261016205402`；2026-10-18 已將兩個 repo 的檔名改為這兩個版本）；兩站 Vercel production 設定 `PARTNER_MEMBER_SECRET`、`PARTNER_MEMBER_STATUS_URL`；母站 PR #33、修正 PR #34 已合併；兩站互相簽章呼叫 `member-status` 回 200、未簽章與錯誤簽章回 401。
- CARE 已開 `LUCISSI_MEMBER_PERK_ENABLED=true`（前台卡片仍隱藏）。首次領取時 Shopify 拒絕 `appliesOnOneTimePurchase`／`appliesOnSubscription`（商店未使用訂閱），PR #46 移除後，測試會員 `charlie.liu6989+lucissitest@gmail.com` 成功領取 `issued` 代碼並建立綁定顧客的 Shopify 折扣（亦證實 CARE app 具顧客權限）；代碼不在公開優惠列表。
- （已由 2026-10-18 一節取代）當時待解決：使用者以此代碼與 TapPay 測試卡完成結帳、結帳頁運費為免運，但訂單未寫入 CARE 資料庫（正式 `orders` 最新為 2026-08-26 的 #1007），代碼仍為 `issued`；需查 Shopify `gh2xgs-zf` 的 webhook 投遞結果。母站 app 第 12 版已要求 `read_customers`／`write_customers`，但 `j97kr5-7b` 安裝仍未授予，母站權益維持關閉。尚未做「不用代碼的首單」停用測試、未開前台卡片旗標、測試訂單尚未取消。

## LUCISSI 會員首單免運（會員互通第 1 階段，2026-10-17，分支 `claude/lucissi-member-perk`）

使用者決定第 1 階段權益為雙向首單免運；母站「女性護理私密凝膠」採「連到 CARE」而非搬移（CARE 只有 SAENGAK 的原廠文件，搬移會多一份需維護的 PIF）。母站部分由另一個工作階段在 `LUCISSI_website` 另開 PR。契約與上線步驟見 `docs/LUCISSI_MEMBER_PARTNER_API.md`。

- 新增 `POST /api/partner/member-status`（HMAC 簽章、300 秒時間窗、只回 `isMember`）與 `api/_lib/partner-member.ts`。
- 新增 `POST /api/promotions/lucissi-member-perk`：Email 已驗證、CARE 首單（先同步認領同 Email 訪客訂單）、母站確認為會員時，為這位會員建立專屬 Shopify 免運折扣（單一 `LC` 代碼、總使用 1 次、綁定本人 Shopify 顧客、60 天到期）；紀錄狀態 pending → issued → used／expired，同時領取只回「建立中」。訂單 webhook 在會員第一筆付款訂單後結算：用了代碼標 used，沒用就停用折扣標 expired。會員折扣依名稱前綴與代碼格式從公開列表與一般領券流程排除（不依賴環境變數）。PR #45 Codex 審查後由「共用折扣＋批次代碼」改為此設計。
- 新增 migration `20261016205350_partner_member_perks.sql`（原檔名 `20261017120000`，2026-10-18 對齊正式站版本）（`public.partner_member_exists` 僅 service_role、`public.partner_member_perks` 會員只能讀自己的）與 pgTAP `partner_member_perks.test.sql`（12 項）。
- 優惠活動頁與會員中心「我的優惠券」加上領取卡片，以 `VITE_PUBLIC_LUCISSI_MEMBER_PERK_ENABLED` 控制，預設隱藏。隱私權政策新增「與 LUCISSI 的會員資格互認」。
- 已執行驗證：`npm test -- --run`（49 檔／482 項）、`npm run build`、`npm run verify:content`、`npm run verify:supabase` 通過；本機 Supabase 套用 migration 後 `npm run test:db` 225 項通過。本機開啟旗標確認卡片未登入狀態的畫面與文案；登入後領取流程以單元測試涵蓋，未在瀏覽器端到端執行。
- 未執行：未套用正式 migration、未設定 Vercel 環境變數、未部署；綁定顧客的代碼能否在本店結帳套用需上線時實測；母站 API 尚未完成，兩站互相呼叫未驗證。

## 商品改名、母站分工與會員互通決策（2026-10-17）

- 使用者決定：品類分工照建議執行；會員需要互通；互認對象只限 lucissi.com 官網會員（品牌另在蝦皮販售，蝦皮買家不在互認範圍）；兩站同屬拜悠衣品有限公司（兩站頁尾統一編號 90014835 一致）。
- Shopify `gh2xgs-zf`（使用者授權，經 Chrome 已登入的後台）：商品 7811041820739 依款式判斷適合 CARE（高腰純棉、雙層棉質底襠、僅側邊蕾絲），只有名稱不符語氣，標題「性感蕾絲女三角內褲」改為「蕾絲邊高腰純棉三角褲」；網址 handle 未改；重新載入回讀標題與搜尋結果標題皆為新名稱，正式站商品頁回讀新名稱。後台另有含「性感」的草稿商品（蕾絲內褲、蕾絲睡衣），未上架、未更動。
- 正式站公告列回讀「LUCISSI 的日常照護系列｜全館滿 NT$1,500 免運」（PR #43 已部署）。
- 母站正式分類頁唯讀盤點：私密保養 1（女性護理私密凝膠）、個人護理 1（面膜）、除毛用品 0、高腰包臀褲 11、無痕舒適褲 24、運動與休閒 21；部分內褲同款同時在兩站販售。分工規則因此修正為：照護化粧品只在 CARE；機能貼身衣物可兩站並列但 CARE 為主、價格庫存由 ERP 一致；性感款只在母站；CARE 品名不用「性感」等字眼。
- 第 1 階段會員權益建議「雙向首單免運」，待使用者確認；實作需同時修改 `LUCISSI_website` 與本程式庫。完整內容見設計系統「母站分工與會員互通」。
- CARE 列表售價約 NT$20–689（中位數約 NT$69，列表最低規格價），供日後評估免運門檻參考。

## 免運門檻比照 LUCISSI 改為 NT$1,500（2026-10-17，分支 `claude/free-shipping-1500`）

使用者決定免運門檻「按照 LUCISSI」；母站 `LUCISSI_website/config/brands/lucissi.manifest.json` 為滿 NT$1,500、未滿 NT$146。

- 程式碼：`DEFAULT_FREE_SHIPPING_THRESHOLD` 1499 → 1500；公告列、購物車免運進度、後台預設值隨常數更新；FREESHIP 後備促銷說明改由常數產生。
- 資料庫：migration `supabase/migrations/20261016195154_align_free_shipping_threshold_with_lucissi.sql`（`site_settings.free_shipping_threshold` 改 1500；FREESHIP `min_spend` 改 1500，說明只替換金額、保留「每位顧客限用一次・不可與其他折扣併用」）。使用者同意後，2026-10-17 以 MCP `apply_migration` 套用到正式 Supabase `tmqzkagkrzhioftvwbqo`（版本 `20261016195154`，檔名同步）；套用前回讀 1499，套用後回讀 threshold 1500、FREESHIP 1500。
- Shopify `gh2xgs-zf` 後台（使用者授權，經 Chrome 已登入的後台操作）：運送設定檔「一般設定檔」› Domestic › 標準：最低訂單金額 1,499 → 1,500，運費 $146 不變，重新載入回讀「滿 $1500.00 免費」；折扣「初夏免運專案 - 滿額免運費」（代碼 FREESHIP）：最低消費 $1,499 → $1,500，重新載入回讀「最低消費金額 $1,500.00」。折扣標題仍含過季的「初夏」，未更動。
- 正式 API `https://lucissicare.com/api/shopify/discounts` 回讀 `siteSettings` `{freeShippingThreshold: 1500, defaultShippingFee: 146}`，FREESHIP `min_spend` 1500。
- 注意：FREESHIP 由「SAENGAK Order Sync」應用程式建立並曾編輯；若該應用程式日後重新同步折扣，需確認不會改回 1,499。
- 已執行驗證：`npm test -- --run`（47 檔／461 項）、`npm run build`、`npm run verify:content`、`npm run verify:supabase`（靜態檢查）通過。
- 未執行：本分支程式碼尚未合併部署；合併前公告列仍顯示舊的 1,499（購物車與結帳已是 1,500）。

## 照護入口收斂為「貼身照護」（2026-10-17，分支 `claude/care-pillars-narrow`）

依設計系統「照護面向評估」的市場與品牌評估，使用者決定收斂五個面向（前一節 PR #41 已上線的版本）。

- 導覽改為 全部商品｜私密保養｜舒適內搭｜生理期照護｜LUCISSI Talk；首頁入口由五欄改三欄。品牌主張由「照顧身體的日常」改為「貼近身體的日常照護」，背書句「LUCISSI 的日常照護系列」不變。
- 身體保養併入私密保養（子分類「除毛與修整」）；運動內衣併入舒適內搭（子分類「運動時穿著」）；肌膚保養與輕盈運動退出導覽與首頁。
- 新增跨分類情境入口「生理期照護」（`isPeriodCareProduct`）：生理褲、私密濕巾、私密舒緩凝膠、內搭清洗配件，或標籤／productType 明確標示生理期的商品。
- 舊連結保持可用：`身體保養`→私密保養並預選「除毛與修整」，`輕盈運動`→舒適內搭並預選「運動時穿著」，`肌膚保養`→全部商品；`私密護理`、`貼身穿著`、`舒適穿著` 照舊。
- 首頁主視覺、品牌宣言、頁尾背書、關於我們、全部商品頁與 meta description 的範圍文案同步改為「私密保養、舒適內搭，與生理期照護／的每一天」。
- 已執行驗證：`npm run typecheck`、`npm test -- --run`（47 檔／461 項）、`npm run build`、`npm run verify:content`（166 檔）通過。本機 dev server 連既有 Shopify 資料：私密保養 9（含除毛刀）、舒適內搭 18（含運動內衣）、生理期照護 5、`身體保養` 舊連結 1 件並預選子分類、`輕盈運動` 舊連結 1 件、`肌膚保養` 舊連結 27 件全部商品；桌機與手機 375 首頁無水平捲動。
- 未執行：未部署；未改 Shopify 後台。「性感蕾絲女三角內褲」仍在舒適內搭，是否移回母站待使用者決定。

## 五個照護面向導覽與背書文案（2026-10-17，分支 `claude/lucissi-care-brand-web-51f3a7`）

依使用者確認的提案（設計系統「導覽與文案提案」）實作；重疊品類、會員互通、免運門檻統一與新照片仍待使用者決定，未處理。PR #40 已於同日合併後再接續本分支。

- 新增 `src/content/carePillars.ts` 作為五個面向（私密保養／身體保養／肌膚保養／舒適內搭／輕盈運動）的單一來源：導覽名稱、頁首文案、首頁圖卡、子分類、商品歸類與舊分類名對應。舊網址 `?category=私密護理`、`貼身穿著`、`舒適穿著` 仍可用，會解析為新面向。
- 商品歸類只在程式端判斷，**未改 Shopify 後台**：除毛刀→身體保養、護衣袋→舒適內搭、運動內衣→輕盈運動；運動與身體保養只看品名與 productType（內褲帶「運動時穿著」標籤時仍歸舒適內搭）。
- `brandOwnership.ts`：非 SAENGAK 關鍵字加入「內衣」「運動」，productType「舒適內搭」「輕盈運動」也視為非 SAENGAK，避免運動內衣被誤標 SAENGAK。
- Header：導覽改為 全部商品｜五個面向｜LUCISSI Talk（優惠活動、關於我們移到頁尾與手機選單），目前面向加底線並標 `aria-current`；公告列改為靜態「LUCISSI 的日常照護系列｜全館滿 NT$1,499 免運」（門檻取 `DEFAULT_FREE_SHIPPING_THRESHOLD`，不另打 API；Supabase 門檻若改，這裡要一起改）。結帳安全說明移出公告列。
- 搜尋／分類頁：五個面向的頁首文案與子分類切換；子分類文案移除「專利高活性」「專利益生菌」「韓國沙龍級」「頂級親膚純棉」等無文件依據的宣稱。商品少於 4 件的面向在商品下方加上 LUCISSI Talk 文章（`PillarArticles`）；沒有商品時不顯示「找不到商品」，改顯示「正在準備中」與文章。
- 首頁：主視覺由 5 張減為 3 張並移除重複標題；新增五面向入口（`PillarSection`）與「來自 LUCISSI」區塊；「精選產品」改「本季精選」並刪除「最受歡迎」字樣；Solution 區 h2 改「超值組合」；貼身穿著橫幅改舒適內搭。
- 頁尾加 LUCISSI 背書與「前往 LUCISSI」連結，新增「品牌」欄（關於我們、LUCISSI Talk、優惠活動）。關於我們、精選頁文案同步；`<title>`／meta description 改為「LUCISSI CARE｜LUCISSI 的日常照護系列」。
- `verify-public-content.mjs` 新增被移除宣稱的回歸檢查。
- 新面向暫用既有 v5 照片（身體保養 `home-philosophy`、肌膚保養 `article-care`／`about-daily-portrait`、輕盈運動 `about-balance-portrait`），待使用者決定是否新製。
- 已執行驗證：`npm ci`（worktree 原本的 node_modules 早於 Tailwind 4 遷移，build 找不到 `@tailwindcss/postcss`）、`npm run typecheck`、`npm test -- --run`（47 檔／459 項）、`npm run build`（僅既有 chunk 大小警告）、`npm run verify:content`（166 檔）皆通過。本機 dev server 連既有 Shopify 資料逐一檢查五個面向與舊網址：私密保養 8、身體保養 1、肌膚保養 0（顯示準備中與文章）、舒適內搭 16、輕盈運動 1；桌機與手機 375 首頁、關於我們、頁尾無水平捲動或錯位，console 無錯誤。
- 已知：舒適內搭目前包含「性感蕾絲女三角內褲」，與 CARE 非性感化語氣不一致，屬商品選品決定，未更動。
- 未執行：未部署；未改 Shopify productType／Collections；未更新 `sitemap.xml`（目前未列分類網址）。

## 品牌檢視低風險視覺修正（2026-10-17，分支 `claude/compassionate-chaum-640a12`）

依 LUCISSI CARE 品牌檢視只做機械性修正；導覽分類、文案定位、LUCISSI 背書與 Logo 仍待營運決策，未變更。

- 字型：`--font-sans` 改為 `"Noto Sans TC"` 優先（Apple 裝置原本會先用 `-apple-system`），Google Fonts 載入補上 800／900 字重供 `font-extrabold`／`font-black` 使用；移除未使用的 Pacifico 字型載入與 `.logo-font`。
- 對比：`text-gray-400`（#8A7B79，在 #F8F5F1 上 3.72:1）的文字用途（文章日期、刪除線原價、說明文字、收藏愛心、規格選項、後台輔助文字）及 input／textarea placeholder（全域規則與 14 處明確的 `placeholder-gray-400`）改為 `gray-500`（#655859）。保留 `gray-400` 的只有圖示、✕ 關閉鈕與停用／不可選狀態（非文字 3:1 已達標，停用元件不受 WCAG 對比要求）。
- 首頁：移除兩個空白 `py-12 bg-white` 間隔區；LUCISSI Talk 區改為白底，與上方象牙色 EditorialHero 以底色區隔。刪除未被引用的 `StorySection.tsx`。
- 跑馬燈：`--marquee-height` 由 28px 改為 32px，`Header.tsx` 的橫幅高度與兩個 header 的 `marginTop` 改用該變數（`.page-content` 頁面內容因此下移 4px）；`prefers-reduced-motion: reduce` 時停止動畫，改為靜止並以省略號截斷。
- 商品卡（`ProductCard` 與首頁 `SolutionSection` 同款卡片）：價格改為 `NT$`；BEST／NEW 標籤由紅／藍改為品牌紫 `bg-brand`＋`text-white`（#5B3D48／#FFFDFC）；手機（`sm` 以下）價格字級由 18px 改 16px，避免 `NT$` 前綴在 320px 寬超出卡片內距。移除未使用的韓元換算函式。
- 已執行驗證：`npm run typecheck`、`npm test -- --run`（46 檔／453 項）、`npm run build`（僅既有 chunk 大小警告）、`npm run verify:content`（160 檔）皆通過。以本機 dev server（連既有 Shopify 資料）用 Chrome 擷取首頁與 `/search` 修改前後全頁畫面（桌機 1280、手機 390），另測 reduced-motion 與 320／360 寬價格寬度；首頁桌機高度少 192px（兩個間隔區），其餘版面無回歸。目前商品資料沒有 BEST／NEW 標籤，新標籤顏色僅經程式碼確認。
- 未執行：未部署、未在實體 iOS 裝置確認字型。

## 正式服務查核（2026-10-17）

- 正式 Supabase Auth：site_url 為 `https://lucissicare.com`，回跳白名單包含正式 `/auth/confirm` 與 `/reset-password`，Email 驗證開啟。SMTP 為 `smtp.resend.com:465`／`resend`，寄件地址 `noreply@auth.saengak.com.tw`；原寄件者顯示名稱 SAENGAK 已改為 LUCISSI CARE，API 回讀其餘 SMTP 憑證及 Auth 設定未變。
- 實際正式驗證信寄送 HTTP 200，Resend `01a145c3-72b7-7ee8-b487-3e1470c5414a` 回讀 LUCISSI CARE 寄件者、01:30 Delivered。測試 Email 為 `company@lucissi.com`；本輪在正式 Auth 建立待驗證帳號，未建立訂單／付款。使用者已確認收信並成功回到正式站；DB 回讀 Email 已驗證、最後登入為 2026-10-17 01:33:40（Asia/Taipei）。
- Shopify `gh2xgs-zf` 的 TapPay 顯示「啟用中／測試模式已開啟」，無實際收款。管理入口需 TapPay Portal 登入；光貿也停在登入頁，使用者表示將登入兩者。尚不能確認正式商家資格與光貿 seller／API key。
- 正式 outbox 兩筆 pending／attempts=0 對應 #1006（8330730242115）、#1007（8339114950723）；Shopify API 確認兩筆 test=true、TapPay SALE SUCCESS/test=true。兩筆發票工作已改為 manual_review、last_error_code=SHOPIFY_TEST_ORDER 並回讀 attempts=0／未開票，排除自動派送；Shopify 訂單未取消、未退款。
- Vercel 中 Amego 欄位存在，但為 sensitive、不可解密讀回；「欄位存在」不代表正式憑證或 release/mode 已驗證。本輪未呼叫正式發票派送 API，未變更任何金流／發票開關。正式 `guest_checkout_enabled=false`。
- 修正 Vercel 發票開關為只有明確 `AmegoInvoiceReleaseEnabled=true` 才能派送，與 Edge Function 一致；缺值、空值、false、大寫 TRUE 及其他值皆回 503，不認領工作／不呼叫供應商。46 檔／453 項測試、typecheck、build 通過；修正 b26667a 已推送，CI 38940417377 成功，Vercel dpl_DHFEiYrmqFfANZsqEhM1UuhU5HN3 Ready 且 lucissicare.com alias 回讀該 SHA。


## 訪客結帳上線準備（2026-10-16）

- 修正 `530b2c3` 已推送 main，GitHub Actions `38899581967` 成功；正式 Vercel `dpl_5rAjoDsTwBHiuFkdsN7jvJZSoeRR` Ready，`lucissicare.com` alias 已回讀綁定該版，會員登入按鈕已恢復。訪客 Turnstile 使用獨立 site key。
- 六個正式 Shopify webhook 已原地更新至 `https://lucissicare.com/api/webhooks/shopify`。限速實測前 10 次無登入請求回 401，超限回 429。
- 已建立無正式資料的 Supabase 分支 `guest-checkout-acceptance`（`cpgdxvqywuhredsdgvrd`）；只有此分支訪客開關為 true。分支費用 US$0.01344／小時另加用量，驗收結束需清理。
- 隔離驗收：實際 TapPay 沙盒付款訂單 **#1008／NT$166** 成功，Shopify 真實 webhook 寫入隔離 DB；使用者確認 `company@lucissi.com` 收到訂單確認信。
- 發票：獨立光貿公開沙盒 smoke 發票 `AB12361278` 開立及作廢皆回讀 99。#1008 在 Vercel 發現 `fetcher is not a function`，已修正預設 fetch handler 誤把 runtime context 當 fetch 的問題；隔離部署 `dpl_3ATpoHvu9q54cJzikidENsyuooCC` 測試發票 `AB12361301` 已回讀 99；#1008 已取消並回讀 TapPay 測試退款成功，作廢亦回讀 99。
- 新增 migration 明確授予 `service_role` promotions／user_coupons CRUD；只套用隔離分支，正式庫原本已有這些權限。隔離 hosted DB 8 檔／213 項 pgTAP 通過；程式 46 檔／449 項通過，修正後 Preview build 成功。
- 測試分支 SMTP 535 已以經核准的單一網域寄信金鑰修復，Resend 回讀 Delivered，使用者確認收信並已驗證 Email；使用者在手機被 Vercel 保護擋住回跳，已寄限時存取連結及新登入信。20:22 使用者確認進入會員頁，DB 回讀 #1008 已認領且正確歸屬該已驗證會員。正式 SMTP 未變更。
- 正式 `guest_checkout_enabled=false`，本輪最後回讀訪客訂單／聯絡資料／link 皆 0。真實 Turnstile 已通過隔離桌機前端與 API，手機已見驗證成功；仍缺正式付款與發票設定及訪客個資營運規則。TapPay 仍為測試模式。
- 五項測試 webhook 已刪除，Admin API 回讀只剩原六項正式訂閱。測試分支與寄信金鑰暫保留供真人 Turnstile 驗收。
- 真人 Turnstile Preview `dpl_HY7KGcAykeeTqqrSKpofn6xE6uDb` 與 alias `saengak-web-d2ux-guest-acceptance.vercel.app` 已建立，Cloudflare 與伺服器精確 whitelist，20:27 使用者手機截圖顯示驗證成功（Email 空白阻擋符合預期）；20:29 桌機完成真實驗證並導向 Shopify，DB 新增 guest link，未付款。手機填 Email 後導向待確認。
- 詳細證據、暫時訂閱及清理事項見 [訪客結帳上線查核](GUEST_CHECKOUT_LAUNCH_CHECKLIST.md)。

## 訪客結帳前端（2026-10-16，分支 `claude/guest-checkout-frontend`，疊在 PR #37 上）

實作 `docs/GUEST_CHECKOUT_PLAN.md` §9 步驟 4，細節見該文件 §9.2。

- 程式碼：`CartSidebar` 與新元件 `SignedOutCheckoutActions`（未登入且開關開啟時顯示「登入結帳（使用會員優惠）」與「訪客結帳」）、`src/lib/shopifyCheckout.ts` 訪客請求與新錯誤碼、`src/lib/guestOrders.ts`（`claim_guest_orders`）、`AuthContext` 於 `SIGNED_IN` 認領、會員中心載入訂單前認領、`/order-status` 訪客說明。
- 已執行驗證：`npm test -- --run`（44 個檔案、413 項通過，新增 31 項）；`npm run build` 通過。
- 未執行：未在瀏覽器實測訪客流程（需要開關為 true 與 `VITE_PUBLIC_TURNSTILE_SITE_KEY`）；未開啟 `guest_checkout_enabled`、未套用任何遠端 migration、未部署。

## 訪客結帳後端（2026-10-16，分支 `claude/guest-checkout-backend`）

實作 `docs/GUEST_CHECKOUT_PLAN.md` §9 步驟 1–3，細節見該文件 §9.1。

- 程式碼：migration `20261016024415_allow_guest_checkout_orders.sql`、`parseShopifyOrderWebhook` 解析訂單 Email、`api/create-shopify-cart.ts` 訪客分支與 `api/_lib/turnstile.ts`。前端未修改。
- 已執行驗證：`npm test -- --run`（43 個檔案、400 項通過，含 PR #37 審查修正）；本機 Supabase（Docker）`npm run test:db`，213 項 pgTAP 斷言通過，其中 `guest_checkout.test.sql` 43 項（含認領競態）。Migration 以 `supabase migration up --local` 套用在既有本機資料庫上，未從空資料庫重建。
- 正式資料庫：2026-10-16 已以 MCP `apply_migration` 套用到正式 Supabase `tmqzkagkrzhioftvwbqo`（正式版本 `20261016024415`，檔名同步）。套用前確認：既有 11 筆 checkout link、2 筆訂單皆有會員；正式 `sync_shopify_order_webhook` 與 repo 20260904 版本內容相同（md5 一致）。套用後回讀：三個函式內容與 migration 檔 md5 一致；5 個 check constraint 已驗證；`guest_checkout_enabled` 為 `false`；`private.guest_order_contacts` 未授權 anon／authenticated、RLS 開啟；`claim_guest_orders` 只授權 authenticated。
- 未執行：`dhktmpcvtoxcicqkwgpn` 未觸碰；未部署 Edge Function `shopify-orders-webhook`（舊版呼叫新 RPC 相容，因 `p_contact_email` 有預設值）；未設定 `TURNSTILE_SECRET_KEY`。§8 的正式設定仍待查證。
- 部署順序：合併前先把 migration 套用到正式 Supabase，再部署 webhook 程式（Vercel 與 Edge Function）。呼叫端在舊 RPC 上會不帶 `p_contact_email` 重試，訂單同步不會中斷，但這只是保險。
- 審查修正（PR #37）：認領競態的 upsert 條件、`p_contact_email` 為空不送與 `PGRST202` 退回、Turnstile `hostname`／`action` 檢查（`TURNSTILE_ALLOWED_HOSTNAMES`）。

## 訪客結帳設計（2026-10-16，分支 `claude/guest-checkout-plan`）

只新增設計文件 `docs/GUEST_CHECKOUT_PLAN.md`，未修改程式碼或 migration，也未查詢或變更任何正式服務。

- 阻塞點已確認：`sync_shopify_order_webhook` 找不到會員 link 就回 `unlinked` 並提早結束（不寫 orders、不建立發票工作）；`orders.user_id`、`shopify_checkout_links.user_id` 為 `not null`；upsert 條件 `excluded.user_id = orders.user_id` 對 null 不成立；webhook 解析器不讀訂單 Email。
- 方案重點：link 與 orders 加 `checkout_kind`、`user_id` 可為 null；訪客 Email 存 `private.guest_order_contacts`；訪客購物車需 Turnstile、不得帶折扣碼、以 `site_settings.guest_checkout_enabled` 控制上線；認領只比對**已驗證**的 Email；查詢 API 只回傳限縮欄位並限速。
- 未實作原因：需重建正式訂單同步 RPC、新增免登入 API，且依賴尚未查證的正式設定（Supabase Email 確認、Shopify 顧客聯絡方式、實際 webhook 端點）。見設計文件 §8、§10。

## Tailwind CSS 4 遷移與完整稽核（2026-10-16，分支 `claude/tailwind4-full-audit`）

接續 CI 修復分支，移除剩餘 25 項開發依賴稽核問題，CI 恢復為單一 `npm audit --audit-level=moderate`。合併含 PR #30 的 `main` 時，以同一流程（先移除 v3 無效 class、再跑升級工具、再套用修正）重新遷移 `main` 版本的 `src/`，而非手動合併 class 字串；對 `main` 未改動的檔案，該流程輸出與本分支先前結果一致。

1. **Tailwind CSS 3.4 → 4.3**：以官方 `@tailwindcss/upgrade` 轉換後人工修正。`tailwind.config.ts` 併入 `src/index.css` 的 `@theme`；PostCSS 改用 `@tailwindcss/postcss`，移除 `autoprefixer`。
   - 升級工具誤改的非 class 值已還原：Google 按鈕 `theme: 'outline'`、`Button` 的 `variant: 'outline'`。
   - 為維持 v3 畫面而加入的相容設定（皆在 `src/index.css`，含註解）：預設邊框色、placeholder 色、按鈕 pointer、表單欄位底色；v3 預設色票（使用到的色系）與 rem 行高；`space-x/y` 的 v3 選擇器；網站自訂樣式放到 `@layer utilities` 末端以保留 v3 cascade；漸層加 `/srgb` 保持 v3 的 sRGB 插值。
   - 刪除 `index.css` 中與 Tailwind 內建／主題重複的 `.bg-brand`、`.bg-brand-ink`、`.text-brand`、`.border-brand`（升級工具把 `text-[#5B3D48]` 等改成 `text-brand`，重複定義會蓋過 `border-t-transparent` 等設定）及 `.line-clamp-1/2/3`（v3 把響應式 variant 輸出在自訂 CSS 之後，`md:line-clamp-none` 才能生效）。
   - 移除在 v3 中不存在、v4 才會生效的 class（`shadow-xs`／`shadow-2xs`、`backdrop-blur-xs`、`drop-shadow-xs`、`scrollbar-none`），以免新增原本沒有的陰影、模糊或隱藏捲軸；`.shadow-xs`（v3 的 `shadow-sm`）加入扁平設計的去陰影清單。
   - 26 組「基礎 `leading-*` 搭配響應式 `md:text-*`」補上 v3 等效的 `md:leading-*`（v4 中 `leading-*` 會優先於 `text-*` 的行高）。
   - 保留 promotion 頁 spinner 的 `border-3`：v3 下此 class 無效、spinner 沒有邊框而不可見，v4 讓它顯示；這是唯一刻意的畫面變更。
2. **Vercel CLI**：最新 64.2.0 仍經 `@vercel/*` → ts-morph → fast-glob → micromatch 帶入 `braces`（無修補版本），因此不升級而是移除 devDependency；`dev:vercel` 改為 `npx --yes vercel@64 dev`。原本只為 Vercel CLI 依賴樹存在的 `overrides` 全部移除，lock 中其他套件版本未變。

### 本次本機驗證

Node.js v26.3.1、npm 11.16.0；另以 `npx npm@10.9.4` 模擬 CI 的 npm 10。

| 檢查 | 結果 |
| --- | --- |
| 乾淨目錄 `npx npm@10.9.4 ci --ignore-scripts`（lock 未被改寫）與 `npm ci`（npm 11） | 通過 |
| `npm audit --audit-level=moderate`（npm 11 與 npm 10） | 0 項 |
| `npm run typecheck` | 通過 |
| `npx tsc -p tsconfig.app.json --noEmit` | 27 項錯誤，與 `main` 基準相同（既有問題，見待處理 3） |
| `npm test -- --run`（合併 PR #30／#31 後） | 41 個檔案、365 個測試全部通過 |
| `npm run build` | 通過；仍有主 chunk 超過 500 kB 的警告 |
| `npm run verify:content` | 通過，檢查 157 個檔案 |
| `npm run verify:supabase` | 靜態基線通過 |
| 畫面比對：`main`（v3，含 PR #30）與本分支合併結果（v4）dev server，本機 Chrome headless，1440×900 與 375×812；首頁、商品頁、商品列表、搜尋、購物車側欄、登入、註冊、會員（未登入）、優惠活動、訂單查詢、部落格、社群、熱門好評、退換貨、FAQ、客服 | 32 組整頁截圖逐像素比對皆 0 差異（退換貨桌機首輪有 531 px 的載入時序差，重跑兩次皆 0）；逐元素 computed style 僅剩等效表示差異（漸層顯式 stop 位置、透明 ring 層） |

未比對：已登入會員頁、管理後台、hover／focus 等互動狀態。GitHub Actions 在 Node 22 上的結果以 PR 的 CI 執行為準。

## 2026-10-16 基本運費統一為 NT$146（分支 `claude/shipping-fee-146`）

參照 LUCISSI 網站（`LUCISSI_website/config/brands/lucissi.manifest.json`：黑貓宅急便常溫宅配 `standardFee` 146，2026-10-11 驗證）。本店 Shopify 結帳本來就收 $146，網站卻沿用舊初始值 80，購物車顯示的運費比結帳低。

- 程式碼：`src/domain/shipping.ts` 的 `DEFAULT_SHIPPING_FEE` 改為 146；後台 `SiteSettings` 預設值改用此常數。
- 資料庫：migration `supabase/migrations/20261016020514_unify_default_shipping_fee.sql`，2026-10-16 已以 MCP `apply_migration` 套用到正式 Supabase `tmqzkagkrzhioftvwbqo`（版本 `20261016020514`）；套用前回讀 80，套用後回讀 146。
- 正式 API：`https://lucissicare.com/api/shopify/discounts` 回讀 `siteSettings` 為 `{freeShippingThreshold: 1499, defaultShippingFee: 146}`。
- 免運門檻維持本店決定的 NT$1,499（LUCISSI 為 1,500，未跟著改）。
- Shopify 運費規則未變動（原本即 $146）。

## 2026-10-16 免運門檻統一為 NT$1,499（分支 `claude/guest-checkout-free-ship`，PR #35）

營運決定全站免運門檻為 NT$1,499、客服先只用 Email、訪客結帳開放（實作待發票設計）。

### 程式碼設定

- 新增 `src/domain/shipping.ts`：`DEFAULT_FREE_SHIPPING_THRESHOLD = 1499`、`DEFAULT_SHIPPING_FEE = 80`；`CartSidebar`、`src/lib/promotions.ts`（FREESHIP 後備改名「滿額免運」）、`api/shopify/discounts.ts`、後台 `SiteSettings` 共用此常數。
- 新增 migration `supabase/migrations/20261015225032_unify_free_shipping_threshold.sql`：把 `site_settings.free_shipping_threshold` 由舊初始值 1500 改為 1499，並把 `promotions` 的 FREESHIP 標題由「初夏免運專案」改為「滿額免運」。API 優先採用資料庫值，所以只改程式碼預設值不會改變顧客看到的門檻。

### 正式服務狀態（2026-10-16 查詢）

| 項目 | 狀態 |
| --- | --- |
| Supabase `tmqzkagkrzhioftvwbqo` 的 `free_shipping_threshold` | 1499（10/15 已由後台設定；套用本 migration 後回讀仍為 1499） |
| Supabase FREESHIP 促銷 | 2026-10-16 已以 MCP `apply_migration` 套用本 migration（正式資料庫 migration 版本 `20261015225032`，檔名同步）；回讀標題「滿額免運」、min_spend 1499 |
| Shopify 運費規則 | 已顯示「滿 $1499.00 免費」；運費 $146，2026-10-16 已將網站 `default_shipping_fee` 統一為 146（見下節） |

### 本次驗證

| 檢查 | 結果 |
| --- | --- |
| `npm test -- --run` | 367 測試全部通過（含新增 `src/domain/shipping.test.ts`） |
| `npm run verify:supabase` | 靜態基線通過（未對資料庫執行 migration） |
| `node scripts/verify-public-content.mjs` | 通過 |

### 同日 Shopify 後台修改（非程式碼）

- SAENGAK 凝膠、慕斯、濕巾、噴霧四件商品的副標、重點、規格成分、使用方式、圖文卡與說明，已依 NAS 原廠文件改寫並以 Storefront API 逐欄回讀一致；移除專利、純素、Dermatest 最高等級等無文件宣稱，慕斯 pH 改為 5.5、無香料。
- 20 件商品的「春季特別企劃」活動標籤已清除；涼感冰絲無痕內褲（7811043393603）副標改為中腰。
- 仍待處理：16 件內褲文案仍含「抗菌／權威機構／低敏」；舊版凝膠商品 7811130785859 仍寫「專利／低敏」。

## 2026-10-15 UX 審視修正（分支 `claude/website-design-ux-review-4438d6`）

提交 `f8013f4`，PR #30；2026-10-16 合併含 CI 修復的 `main`（`261a4d3`）後重新驗證。審視結果與進度畫板：https://claude.ai/artifact/FHj7kF1B3SL7VJEPceY2Eh （私人連結）。

### 程式碼變更

- 顧客可見的「確認中」文案、IG 假貼文分頁移除；客服頁、隱私、AdChoices、退換貨改以 `Company@lucissi.com` 說明（`src/content/site.ts` 的 `supportContact`）。退換貨「以 Email 受理」的流程描述待營運確認。
- 停用預設賣點、假促銷、★4.9、全標 NEW、預設尺寸表／版型值與 mock 商品後備；`ShopifyDescriptionViewer` 的成分、產地、檢驗、授權只呈現 Shopify 資料，缺資料的區塊隱藏。
- 有貨優先排序、商品頁預設有貨規格、尺寸／顏色篩選改用規格選項、搜尋標籤錯誤修正（`src/domain/algorithms.ts` 新增 `isProductSoldOut`、`sortAvailableFirst`、`pickInitialVariant`、`matchesVariantOption`）。
- `/order-status` 改為訂單查詢頁；`/product-preview` 只在開發環境載入。
- 手機商品頁固定購買列、規格樣式分開、購物車發票收合、清空需確認、搜尋頁窄版橫幅、首頁重複精選區移除、每頁分頁標題（`src/lib/pageTitle.ts`）。
- `scripts/verify-public-content.mjs` 加入「確認中」、假促銷、Dermatest／韓國授權等回歸字串。

### 本次驗證（合併後）

| 檢查 | 結果 |
| --- | --- |
| `npm test -- --run`（合併 CI 修復後） | 41 檔案、365 測試全部通過 |
| `npx tsc --noEmit -p tsconfig.app.json` | 27 個既有錯誤，與修改前基準相同，未新增 |
| `npm run build` | 通過 |
| `node scripts/verify-public-content.mjs` | 通過，157 個檔案 |
| 本機預覽（Vite dev，真實 Shopify Storefront 資料） | 桌機與 375px 手機檢查列表排序、預設規格、篩選、搜尋標籤、訂單查詢、購物車、手機購買列、分頁標題；`/api/*` 需 `vercel dev`，Vite 下回傳 500 屬環境限制 |

### 待處理（非程式碼）

- Shopify 商品文案需依原廠文件修正：凝膠與慕斯成分不符原廠成分表、慕斯 pH（原廠 5.5）、「專利」無文件、純素證書已於 2026-03-19 到期、內褲「低敏檢測／抗菌／拉伸測試」無檢測報告、15 件商品仍顯示「春季特別企劃」。
- ~~待決策：訪客結帳、全站唯一免運門檻、客服~~：2026-10-16 已決定（見最上方 PR #35 段落）；退換貨流程細節仍待營運確認。

## CI 修復（2026-10-15，分支 `claude/fix-ci-validate`）

GitHub Actions「Validate repository」自 2026-09-09 起在 `main` 與各 dependabot 分支皆失敗，本分支修復三個原因：

1. **`npm ci` 在 Node 22／npm 10 失敗**（`Missing: @tootallnate/once@2.0.0, smol-toml@1.5.2, undici@5.29.0, @fastify/busboy@2.1.1 from lock file`）。npm 10 無法正確套用部分以版本為鍵的 overrides。改為：`@tootallnate/once`、`smol-toml` 使用名稱鍵（各自只有 Vercel CLI 相關的消費者）；`undici` 改為巢狀於 `vercel` 之下，並對 `@vercel/sandbox` 保留 `^7.27.1`，避免把它降回 6.x。其餘仍可被 npm 10 接受的版本鍵 overrides 維持不變。已確認 lock 內仍是修補版本。
2. **`tests/invoice-guangmao-api.test.ts` 7 個失敗**：測試 `beforeEach` 補上僅供測試的假 `AmegoSellerTaxId`／`AmegoAppKey`／`AmegoIssuerNote`。`api/invoice/guangmao.ts` 的 Fail-Closed 憑證防護未修改，SEC-6 測試仍逐一刪除憑證並驗證回 500。未加入任何真實憑證。
3. **`npm audit`**：在不升級主版本的前提下修補——vitest 4.1.10→4.1.12、sharp 0.35.5、undici 6.29.1／7.30.1、smol-toml 1.9.1、js-yaml 4.3.2、brace-expansion、fast-uri、source-map-js。結果由 39 項降為 25 項（2 moderate、23 high），**正式（production）依賴為 0 項**。剩餘全部屬開發工具：
   - `braces`（GHSA-vfj7-8cjw-p6xm）目前沒有修補版本，經由 Tailwind CSS 3（chokidar、micromatch、fast-glob）及 Vercel CLI（`@vercel/*` → ts-morph → fast-glob）引入；
   - `postcss-selector-parser` <7.1.6，Tailwind CSS 3／postcss-nested 6 固定使用 6.x。
   修復需要 Tailwind CSS 4 遷移與 Vercel CLI 主版本更新，未執行 `npm audit fix --force`。
   因此 CI 稽核改為兩段：`npm audit --omit=dev --audit-level=moderate`（正式依賴）與 `npm audit --audit-level=critical`（全部依賴）。這是 CI 閘門的放寬，應在 Tailwind／Vercel CLI 升級後恢復完整 moderate 稽核。

### 本次本機驗證

Node.js v26.3.1、npm 11.16.0；另以 `npx npm@10.9.4` 模擬 CI 的 npm 10。

| 檢查 | 結果 |
| --- | --- |
| `npm ci`（npm 11）與乾淨目錄 `npm@10.9.4 ci --ignore-scripts`、`npm ls --all` | 通過 |
| `npm run typecheck` | 通過 |
| `npm test -- --run`（合併 PR #30／#31 後） | 41 個檔案、365 個測試全部通過 |
| `npm run build` | 通過；仍有主 chunk 超過 500 kB 的警告 |
| `npm run verify:content` | 通過，檢查 157 個檔案 |
| `npm run verify:supabase` | 靜態基線通過 |
| `npm audit --omit=dev --audit-level=moderate` | 0 項 |
| `npm audit --audit-level=critical` | 通過（25 項 moderate／high 皆為開發依賴，無 critical） |

GitHub Actions 在 Node 22 上的結果以 PR 的 CI 執行為準。

## 先前同步紀錄（2026-10-15）

### 同步內容

- 將原本未提交的本機網站改版、圖片與製圖工作紀錄保存為 `d485e99`。
- 合併遠端 `main` 的 5 個更新提交，最新基準為 `dc54236`，整合提交為 `c93b89e`；保留新版品牌、精選商品、超值組合與網域／回呼設定。
- 整合後應用程式、API 與測試內容和 `dc54236` 一致；沒有為此次備份改寫業務邏輯。
- 新增 README、AGENTS、項目記憶與本文件；素材提示詞、來源紀錄和製圖腳本一併保存。
- 修正 `.gitignore`，讓專案文件與 creative 資料可持續追蹤；`.env.local`、依賴、建置輸出、服務工作階段及本機診斷仍排除。
- 本次不包含正式資料庫、Shopify 後台資料或完整對話歷史的匯出；Git push 的最終結果以遠端提交與交接回覆為準。

### 當時驗證

本機 Node.js v24.14.0、npm 11.9.0；使用既有安裝依賴執行。CI 使用 Node.js 22，本次未另外重裝依賴。

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 指令通過；現有 script 是根目錄 `tsc --noEmit`，根 tsconfig 使用空 files 與 project references，不等同另外逐個 referenced project 執行完整型別檢查 |
| `npm test -- --run` | 40 個檔案：39 通過、1 失敗；356 個測試：349 通過、7 失敗 |
| `npm run build` | 通過；965 modules，主 chunk 約 510.15 kB，有超過 500 kB 的警告 |
| `npm run verify:content` | 通過，檢查 158 個檔案 |
| `npm run verify:supabase` | 靜態基線通過；不代表實際資料庫測試已執行 |
| `npm audit --audit-level=moderate` | 未通過：37 項（5 moderate、32 high） |
| 候選檔案金鑰檢查 | 未發現本機環境金鑰值或所檢查的常見 credential pattern；不是完整安全稽核 |
| `git diff --check` | 通過 |

## 已知待處理

1. ~~`tests/invoice-guangmao-api.test.ts` 的 7 個案例失敗~~：已於 CI 修復分支補上假憑證 fixture。
2. ~~依賴稽核剩餘 25 項開發依賴問題~~：已由 Tailwind CSS 4 遷移與移除 Vercel CLI devDependency 解決，CI 恢復完整 `npm audit --audit-level=moderate`。
3. 現有 typecheck script 應評估是否完整檢查 referenced projects。
4. 主 bundle 大於 500 kB；後續可評估拆分，不影響本次成功建置。
5. ~~`src/content/site.ts` 客服待確認文案~~：已於 UX 修正改為 Email 管道；電話與官方 LINE 仍待營運決定。

## 尚未驗證

本次沒有執行資料庫整合測試、真實付款／發票、瀏覽器完整回歸、正式 DNS／OAuth／webhook 或部署健康檢查；也未確認推送後平台自動部署的結果。歷史素材文件中的測試紀錄屬當時結果。
