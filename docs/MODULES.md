# SAENGAK 現階段模塊與架構基線

> 更新日期：2026-08-20 (對齊 `MAIN_SPECIFICATION.md` 最新架構，已剔除舊版 Shopify Checkout 跳轉與 API 直連庫存鎖定機制)

## 模塊責任與狀態

| 模塊 | 內容責任 | 對應架構與規則 | 階段狀態 |
| --- | --- | --- | --- |
| 商品目錄與庫存 | 展示名稱、價格、規格、即時庫存 | 實體庫存權威為 **SiteGiant ERP**，透過 Shopify App 自動雙向同步。前端一律直接查詢 Shopify Storefront API。**（已廢棄由 Vercel API 直連 SiteGiant 進行庫存鎖定與 2PC 的機制）**。 | Phase 1 就緒 |
| 購物車／結帳 | 購物車狀態保存與結帳流程 | **自建 React Checkout (Option B)**，不跳轉 Shopify Checkout。結帳金額以伺服器端 (`api/checkout.ts`) 重算為唯一權威。前端結帳頁 (`src/pages/checkout/`：身分流程、TapPay 付款表單、3DS callback、Error Fallback) 與後端中樞均已落地。 | Phase 2 程式碼已落地（待部署與沙盒驗收） |
| 結帳身分 | 會員登入與訪客購買 | 採用「混合模式」，優先鼓勵登入但支援訪客結帳，並以「手機號碼」作為跨訂單歸戶/歷史查詢的依據。 | Phase 2 前端流程已落地（OTP 歸戶查詢待建） |
| 金流支付 | 信用卡授權扣款 | TapPay Direct Pay SDK (SAQ A-EP，卡號零落地)，由 Vercel API (`api/_lib/tappay.ts`) 進行伺服器端扣款、Record 二次查核、Refund 補償與 3DS callback 處理。 | Phase 2 程式碼已落地（待 TapPay 沙盒實單） |
| 訂單中樞 | 交易防重複與訂單建立 | 透過 Supabase `transaction_logs` 實作冪等性防護與八態狀態機（migration `20260820000001`）。扣款成功後建立 Shopify 訂單；建單失敗自動 Refund；逾時交易由 `api/cron/reconcile.ts` 每 15 分鐘對帳補償。 | Phase 2 程式碼已落地（migration 待套用） |
| 物流／發票 | 超商/宅配與電子發票 | Shopify 內建 ShipAny App 進行履行與門市選單；光貿電子發票經 `public.enqueue_amego_invoice_job` RPC 寫入 private Outbox，由 `api/invoice/guangmao.ts` Worker 每 5 分鐘派送並回讀 `invoice_status=99`。 | Phase 2 發票程式碼已落地；ShipAny 待安裝綁定 |
| 營運後台 | 統一的營運監控與參數管理 | 在同一個 React 專案下建立 `/admin` 路由（`AdminLayout`/`Dashboard`/`OrderList`/`ProductList`/`SiteSettings`），透過 Supabase Auth 嚴格檢查 `app_metadata.role === 'admin'`（`src/router/AdminGuard.tsx`），搭配 RLS 保護參數設定（`site_settings`，migration `20260820000002`）。商品與訂單皆為唯讀模式以防衝突。 | Phase 3 程式碼已落地（待部署與管理員帳號授權） |

## 公開內容與安全守門

- **內容盤點**：公司名稱、隱私條款、退換貨、聯絡資訊集中在 `src/content/site.ts` 統一管理，若有修改需重新執行 `npm run verify:content`。
- **資安邊界**：嚴守 `MAIN_SPECIFICATION.md` 定義之安全不變量，敏感資料（如 TapPay Partner Key、Shopify Admin Token）僅存放於伺服器環境變數，絕對零落地。
- **降級監控**：任何前端 API 失敗並回退展示假資料（Mock/Fallback）時，必須發送 Sentry 事件，杜絕靜默故障。
