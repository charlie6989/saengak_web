# Issue Tracker Configuration (Issue 追蹤器配置)

本文件定義專案 `saengak_web` 的任務與 Issue 追蹤機制。

## 1. 系統類型 (System)
- **類型**: GitHub Issues
- **整合方式**: GitHub CLI (`gh` 命令行工具) 及 GitHub Web Interface
- **Repository URL**: `https://github.com/charlie6989/saengak_web` (或專案對應 GitHub 遠端)

## 2. Agent 執行規範 (Agent Operating Rules)

1. **讀取與建立**: Agent 在進行複雜任務時，優先讀取 GitHub Issues 的內容或關聯描述。
2. **Issue 語法與連結**: 提交 Commit 或 PR 時，應參照 Issue 編號（例如 `Fixes #123` 或 `Relates to #45`）。
3. **任務拆解**: 大型需求應透過小顆粒度的 Issue 或 CheckList 進行分階段追蹤。
