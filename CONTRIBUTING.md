# Contributing to SAENGAK Web

## 開發原則

- 先確認目前 branch、目標商店與 Supabase project，避免跨品牌或跨環境修改。
- 不把畫面、toast、部署 READY 或單一成功頁當作商務完成證據。
- 未取得 owner-system readback 時，維持 fail-closed 與 `launchReady=false`。
- 不在程式碼、Issue、PR、測試 fixture、截圖或 log 放入 secrets、個資、訂單或付款資料。

## 開發流程

1. 從最新目標 branch 建立短期 branch；建議使用 `feat/`、`fix/`、`docs/` 或 `chore/` 前綴。
2. 執行 `npm ci`，以 `.env.example` 建立自己的 `.env.local`。
3. 保持修改範圍聚焦，對安全或商務規則增加回歸測試。
4. 提交前至少執行：

```bash
npm run typecheck
npm test -- --run
npm run build
npm run verify:content
npm run verify:supabase
npm audit --audit-level=moderate
```

若修改 migrations/RLS，另執行 `npm run test:db`；若修改結帳、Webhook、物流或發票，依文件執行相應 sandbox 與 owner-system readback。

## Pull Request 要求

PR 必須說明：

- 修改內容與原因
- 使用者／營運影響
- 風險、回滾方式與未完成事項
- 實際執行的測試與結果
- UI 變更的桌機／手機截圖（不得含個資或後台機密）
- 是否影響 Shopify、Supabase、TapPay、物流、發票或 Vercel

不得在未驗收時勾選「可正式扣款」或要求直接部署 production。

## Database 與 migration

- 不修改既有已部署 migration 來假裝新增變更；應建立新的、可排序 migration。
- 不手動編輯 `supabase/.temp/project-ref` 假裝完成 link。
- apply 前保留 diff/dry-run，apply 後回讀 migration、function、RLS 與資料狀態。
- 測試必須 rollback，不能在正式專案製造測試客戶或訂單。

## Commit 建議

使用簡短、可審閱的命令式訊息，例如：

- `Add checkout release gate`
- `Fix webhook topic validation`
- `Document sandbox acceptance`

Repository owner 保留最終合併、部署及 release approval 權限。
