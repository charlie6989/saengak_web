# SAENGAK 現階段模塊與架構基線

> 更新日期：2026-08-22 (對齊 `00_DECISION_LOG.md` §3.3：結帳架構第三度變動，回歸 Shopify Checkout 跳轉；自建 React Checkout／TapPay Direct Pay／`transaction_logs` 狀態機已廢棄；營運後台路由與 RLS 已接線)

## 模塊責任與狀態

| 模塊 | 內容責任 | 對應架構與規則 | 階段狀態 |
| --- | --- | --- | --- |
| 商品目錄與庫存 | 展示名稱、價格、規格、即時庫存 | 實體庫存權威為 **SiteGiant ERP**，透過 Shopify App 自動雙向同步。前端一律直接查詢 Shopify Storefront API。**（已廢棄由 Vercel API 直連 SiteGiant 進行庫存鎖定與 2PC 的機制）**。 | Phase 1 就緒 |
| 購物車／結帳 | 購物車狀態保存與結帳流程 | **跳轉 Shopify Checkout**（2026-08-21 起現行架構，見 `00_DECISION_LOG.md` §3.3）。購物車側邊欄收集發票偏好後，呼叫 `api/create-shopify-cart.ts` 建立 Shopify Cart 並取得 `checkoutUrl`，導向 Shopify Checkout 完成後續流程。~~自建 React Checkout (Option B) 與 `api/checkout.ts` 金額重算中樞~~已廢棄，僅存於 Git 歷史。 | 現行（`CheckoutReleaseEnabled` 總開關現況未確認，見 `00_DECISION_LOG.md` §3.3） |
| 結帳身分 | 會員登入與訪客購買 | 採用「混合模式」，優先鼓勵登入但支援訪客結帳；已登入會員建立 Cart 時由 `api/create-shopify-cart.ts` 驗證 session 並寫入 `shopify_checkout_links` 供訂單歸戶。「手機號碼」跨訂單查詢仍為規劃中之補充機制。 | 現行（OTP 歸戶查詢待建） |
| 金流支付 | 信用卡授權扣款 | **TapPay Shopify Payment App**，於 Shopify Checkout 頁面內完成授權扣款；SAENGAK 前端與後端皆不經手卡號。~~TapPay Direct Pay SDK 前端整合與 `api/_lib/tappay.ts` 伺服器端扣款~~已廢棄。 | 現行（待 TapPay 沙盒實單驗收） |
| 訂單中樞 | 訂單建立與投影 | Shopify 完成扣款後於 Shopify 端建立訂單，簽章 Webhook (`api/webhooks/shopify.ts`) 驗證後投影至 Supabase `orders`／`order_items`，供會員與後台唯讀查詢。~~Supabase `transaction_logs` 八態狀態機（migration `20260820000001`）與 `api/cron/reconcile.ts` 對帳補償~~屬已廢棄自建結帳中樞之殘留，未部署。 | 現行 |
| 物流／發票 | 超商/宅配與電子發票 | Shopify 內建 ShipAny App 進行履行與門市選單；光貿電子發票經 `public.enqueue_amego_invoice_job` RPC 寫入 private Outbox，由 `api/invoice/guangmao.ts` Worker 每 5 分鐘派送並回讀 `invoice_status=99`。（此模組不受結帳架構回歸影響） | 發票程式碼已落地；ShipAny 待安裝綁定 |
| 營運後台 | 統一的營運監控與參數管理 | `/admin` 路由（`AdminGuard` → `AdminLayout` → `Dashboard`/`ProductList`/`OrderList`/`SiteSettings`/`page`）已接上巢狀路由並強制檢查 `app_metadata.role === 'admin'`（`src/router/AdminGuard.tsx`）。`orders`／`order_items`／`order_invoices` 已補齊 admin 唯讀 RLS，`site_settings` 讀寫與 RLS 皆已套用正式庫（migration `20260822000001`，2026-08-22）。商品與訂單皆為唯讀模式以防與 ERP／Shopify 衝突。 | **已部署且已有授權管理員帳號** |

## 公開內容與安全守門

- **內容盤點**：公司名稱、隱私條款、退換貨、聯絡資訊集中在 `src/content/site.ts` 統一管理，若有修改需重新執行 `npm run verify:content`。
- **資安邊界**：嚴守 `MAIN_SPECIFICATION.md` 定義之安全不變量，敏感資料（如 TapPay Partner Key、Shopify Admin Token）僅存放於伺服器環境變數，絕對零落地。
- **降級監控**：任何前端 API 失敗並回退展示假資料（Mock/Fallback）時，必須發送 Sentry 事件，杜絕靜默故障。
