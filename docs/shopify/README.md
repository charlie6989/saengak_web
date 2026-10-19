# Shopify 商品資料紀錄

商品資料存放在 Shopify（商店 `gh2xgs-zf`），不在程式碼裡。這個資料夾保存 2026-10-18～19 商品頁檢視後，對 Shopify 做過的修改內容、資料來源，以及修改後的商品快照。後台操作方式見 `docs/SHOPIFY_ADMIN_RUNBOOK.md`。

| 檔案 | 內容 |
|---|---|
| `products-snapshot.json` | 全部公開商品的現況：品名、副標、SEO、類別、商品內容欄位、圖片、規格與售完狀態。以 `node scripts/shopify-product-snapshot.mjs` 重新產生，可與 Git 歷史比對，看出後台被改了什麼。 |
| `content-fixes-2026-10-18.json` | 10 個改名（含 2026-10-19 的 #17）、20 個副標改寫、96 張失效內容圖的替換（失效網址 → 替換圖）。 |
| `size-charts.json` | 16 件內著與內衣的 `custom.size_chart`：母 SKU、NAS 原廠尺寸圖路徑、轉寫備註與更正紀錄（#19 XL 80C → 85C）。 |
| `categories-2026-10-19.json` | 26 件商品的 Shopify 標準分類與選擇理由。 |
| `seo-2026-10-19.json` | 17 件補寫的 SEO 標題與說明，以及撰寫原則。 |

相關素材與紀錄：
- 商品主圖、第二張與組合圖：`creative/product-v1/`（`main/`、`second/`、`bundle-fix/`，各有 `provenance.json`）。
- 商品頁檢視報告：`docs/audits/2026-10-18-product-detail-audit.html`（另有 Artifact：https://claude.ai/artifact/XkydPRfGaS1sukLYFsU6mG）。
- 進度與驗證紀錄：`docs/PROJECT_STATUS.md`；長期規則：`docs/PROJECT_MEMORY.md`。

## 檢視報告各項的處理狀態（2026-10-19）

| 報告項目 | 狀態 |
|---|---|
| 96 張失效內容圖 | 已替換並回讀（PR #59 另加前台失效圖退回相簿圖） |
| 售完的核心保養品 | 未處理，需營運決定補貨或下架；零庫存仍可下單的問題已修（開啟庫存追蹤） |
| 尺碼資訊 | 已依 NAS 原廠尺寸圖重寫 16 件，前台改為依資料決定欄位（PR #62、#63） |
| 無法佐證的宣稱、誤導圖片 | 寫死的宣稱已移除（PR #59）；單支凝膠與組合主圖改為實際件數（PR #64）；過期純素認證圖與外來評價截圖經使用者決定保留 |
| 改名與副標 | 已完成（10 個品名、20 個副標），品名與副標不用「性感」「收腹」「暖腹」 |
| 標籤、搜尋說明、類別 | 已修 #16／#17／#13 標籤與 SEO；26 件補上類別；17 件補寫 SEO，前台改讀 SEO 欄位（PR #66） |
| 仍待處理 | TapPay 測試模式、MEDION 凝膠說明仍為 SAENGAK 內容、多件售完 |
