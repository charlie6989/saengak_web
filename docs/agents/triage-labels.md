# Triage Labels & Workflow Mapping (Issue 標籤與分流角色)

本文件定義專案中使用的 GitHub / Task 標籤及其對應的 Agent 操作權限與流程。

## 1. 規範標籤 (Canonical Triage Labels)

| 標籤 (Label) | 角色與意義 | Agent 處置邏輯 |
| --- | --- | --- |
| `needs-triage` | 新建立的 Issue，尚未經評估或分類 | 優先檢視需求完整度並進行排錯評估 |
| `ready-for-agent` | 已確認規格，可直接交由 AI Agent 執行 | 可自動進入開發與實作階段 |
| `p0-launch-blocker` | 上線前 P0 必完成任務（如結帳、金物流、資安） | 最高的開發與修復優先級 |
| `bug` | 系統缺陷或異常 | 檢視完整日誌、重現問題並撰寫測試修復 |
| `feature` | 新功能開發 | 先進行領域模型設計與模組規劃再實作 |
| `documentation` | 規格書或文件更新 | 更新 `docs/` 與 `docs/agents/domain-docs.md` |

## 2. Agent 分流規則 (Triage Rules for Agents)

1. 當任務含有 `p0-launch-blocker` 或 `bug` 時， Agent 應嚴格遵循 `docs/MAIN_SPECIFICATION.md` 與 PSR-12 / TypeScript 嚴格型態限制。
2. 完成任務後，應標記對應的 Issue 狀態變更。
