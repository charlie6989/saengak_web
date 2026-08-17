# AGENTS.md - SAENGAK AI Agent Guidelines & Skills Integration

本檔案記錄 `saengak_web` 專案的 AI Agent 運作規範、Matt Pocock Skills 設定與權威架構對齊原則。

---

## 1. 語言與規範
- 所有說明、註解與紀錄均必須使用 **繁體中文 (Traditional Chinese)**。
- 程式碼遵循 TypeScript / Vite / React / Node API 規範；若涉及 PHP 微服務，嚴格遵循 PSR-12 標準。

---

## 2. 專案最高權威與架構對齊 (Authoritative Alignment)

> [!IMPORTANT]
> 本專案所有開發與修復必須嚴格遵照 [`docs/00_DECISION_LOG.md`](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md) 決策。

* **階段策略**: 第 1 階段專注於「商品展示 (Catalog & Product Details) 與 Vercel 部署上線」；自建結帳與金物流保留至第 2 階段。
* **庫存權威**: SiteGiant ERP 實體主檔，透過 SiteGiant Shopify App 與 Shopify 進行雙向同步；前端以 Shopify Storefront 為即時商品與庫存門戶。
* **物流方案**: Shopify 內建 ShipAny App 進行履行與門市選單 (自建 API 列為備用)。
* **結帳架構 (Phase 2)**: 自建 React Checkout (`Option B`)，由 Vercel Serverless API (`api/*`) 作為交易中樞。
* **金流授權 (Phase 2)**: TapPay Direct Pay SDK (卡號零落地 PCI-DSS SAQ A-EP) + Vercel 端扣款對帳。
* **電子發票 (Phase 2)**: 光貿電子發票 API 自動開立。
* **資料庫防禦**: Supabase 正式 ref 為 `tmqzkagkrzhioftvwbqo`，以 `auth.uid()` RLS 進行個資隔離。


---

## 3. Matt Pocock Agent Skills 設定 (`docs/agents/`)

專案已通過 `/setup-matt-pocock-skills` 完成完整初始化：

- **[Domain Docs Index](file:///c:/Projects/saengak_web/docs/agents/domain-docs.md)**: 涵蓋權威總表 [`00_DECISION_LOG.md`](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md)、主規格書 [`MAIN_SPECIFICATION.md`](file:///c:/Projects/saengak_web/docs/MAIN_SPECIFICATION.md)、各子規格書與 ADR 決策紀錄。
- **[Issue Tracker Config](file:///c:/Projects/saengak_web/docs/agents/issue-tracker.md)**: 使用 GitHub Issues 追蹤任務與需求。
- **[Triage Labels Config](file:///c:/Projects/saengak_web/docs/agents/triage-labels.md)**: 定義 canonical 標籤 (`needs-triage`, `ready-for-agent`, `p0-launch-blocker`) 處置邏輯。

---

## 4. 可用 Agent Skills (Available Skills)

* `/ask-matt`: 諮詢工程設計、架構原則與 TypeScript 最佳實踐。
* `/code-review`: 針對變更檔案進行嚴格的 Code Review 與資安檢視。
* `/codebase-design`: 規劃軟體模組結構與組件職責。
* `/diagnosing-bugs`: 遵循排錯四部曲（完整 log 檢視 -> 重現 -> Failing Test -> 修復）。
* `/domain-modeling`: 進行領域驅動設計 (DDD) 與資料庫 Schema / Type 定義。
* `/find-skills`: 搜尋與建議適用的 Agent Skill。
* `/grilling` / `/grill-me`: 互動式質問與設計決策驗收。
* `/handoff`: 產生開發進度與交接紀錄。
* `/prototype`: 快速進行 POC 與原型開發。

---

## 5. Agent 開發工作流程原則

1. **先查閱權威規格**: 任何改動前，必須優先讀取 [`docs/00_DECISION_LOG.md`](file:///c:/Projects/saengak_web/docs/00_DECISION_LOG.md) 與對應的領域規格書。
2. **完整性與不降級**: 嚴禁撕毀防護、回傳 Fake Data 或抹去既有測試；改動必須經由測試與型態檢查驗證。
3. **Log 優先除錯**: 除錯時必須先讀取完整錯誤日誌，禁止憑空猜測。
