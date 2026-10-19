# LUCISSI CARE / saengak_web

LUCISSI CARE 電商網站；Git repository 保留歷史名稱 `saengak_web`。程式設定的主要網域為 https://lucissicare.com。

## 接手入口

- [項目記憶](docs/PROJECT_MEMORY.md)：架構、品牌與網域決策、素材紀錄及操作邊界。
- [目前狀態](docs/PROJECT_STATUS.md)：各階段進度、驗證結果與待處理事項。
- [Shopify 商品資料紀錄](docs/shopify/README.md)：後台修改內容、資料來源與商品快照。
- [Shopify 後台維護手冊](docs/SHOPIFY_ADMIN_RUNBOOK.md)：後台自動化做法、踩過的坑與原廠資料（NAS）位置。
- [專案指引](AGENTS.md)：後續協作的閱讀入口。
- [環境變數範本](.env.example)：僅含名稱與範例，不含真實金鑰。

## 本機啟動

需要 Node.js >=22.12.0、npm >=10；CI 使用 Node.js 22。

```sh
npm ci
cp .env.example .env.local
# 向專案管理者取得設定後填入 .env.local
npm run dev
```

包含 Vercel API 的本機流程使用 `npm run dev:vercel`（透過 `npx` 執行 Vercel CLI 64.x，不安裝在專案依賴中）；先確認對應專案與環境設定。

## 驗證

```sh
npm run typecheck
npm test -- --run
npm run build
npm run verify:content
npm run verify:supabase
npm audit --audit-level=moderate
```

資料庫測試另用 `npm run test:db`，需要適當的本機 Supabase 測試環境。靜態檢查通過不代表正式付款、發票或外部服務已驗收。

## 內容範圍

Git 保存原始碼、資料庫 migrations、測試、公開圖片、素材提示詞與來源紀錄、專案記憶和狀態。金鑰、`.env.local`、服務登入狀態、依賴安裝目錄、建置輸出及本機暫存不納入 Git。正式服務資料與後台設定須由各服務另外管理。
