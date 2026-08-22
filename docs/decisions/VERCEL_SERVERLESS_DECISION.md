# SAENGAK 後端中樞架構升級決策 (ADR)

> 建立日期：2026-08-13
> 決策目標：整合前端與後端部署流程，提升開發效率，確立 Vercel 作為系統唯一 API 中樞。

> **⚠️ 2026-08-22 修正說明**：本文件「Vercel 作為系統唯一 API 中樞」之核心決策維持不變且已落地（`api/` 目錄現行承載 `create-shopify-cart.ts`、`webhooks/shopify.ts`、`invoice/guangmao.ts` 等實際運作中的路由）。但文中作為舉例之「自建結帳頁」、`api/checkout.ts` 已於 2026-08-21 隨結帳架構回歸 Shopify Checkout 而廢棄（見 `00_DECISION_LOG.md` §3.3），本文件保留原始論述作歷史決策脈絡紀錄，不再更新其論述內容。

## 1. 決策背景與核心挑戰

在 SAENGAK 的早期架構中，前端由 Vercel 託管，而後端的商業邏輯（如購物車處理、Shopify Webhook 接收）則部署在 **Supabase Edge Functions** (基於 Deno 執行環境)。

隨著專案規格的大幅擴張（我們即將導入自建結帳頁、SiteGiant ERP 庫存鎖定、TapPay 金流以及光貿電子發票），後端必須處理極度複雜的 API 協同作業 (API Orchestration)。此時，舊有架構的痛點便浮現出來：

**面臨的挑戰：**
1. **開發與部署割裂**：工程師需要分別管理 Vercel (負責前端) 與 Supabase CLI (負責後端 API) 兩套部署流程。這增加了維運成本，且容易造成前端與後端版本不同步。
2. **技術棧生態差異**：Supabase Edge Functions 使用 Deno，而團隊主要熟悉 Node.js 生態。這在串接外部傳統 NPM SDK（如金流、發票）時容易遇到套件相容性問題。
3. **PRD 規格要求**：最新的《Vercel Architecture PRD v1》明確指示，期望將系統中樞轉移至 Vercel Serverless (Free Tier) 以簡化架構，降低跨平台維護負擔。

## 2. 後端架構選項比較

| 評估項目 | 舊模式：Supabase Edge Functions | 新模式：Vercel Serverless API (本次決策) |
| :--- | :--- | :--- |
| **部署流程** | ❌ 雙重部署。前端上 Vercel，API 需透過命令列手動推送至 Supabase。 | ✅ **單一管道自動化**。前、後端程式碼在同一個 Repo，推播至 GitHub 後由 Vercel 一鍵自動部署並產生預覽網址。 |
| **開發體驗與生態** | ❌ 基於 Deno，部分 Node.js NPM 套件與模組可能需特殊處理或不相容。 | ✅ 基於標準 Node.js 環境，無縫相容所有第三方 SDK (TapPay, 光貿等)。 |
| **路由與架構一致性** | ❌ API 路由散落在 Supabase 專案中，與前端專案分離，追蹤困難。 | ✅ API 路由集中於專案的 `api/` 目錄，與前端緊密結合，形成標準的 Full-stack 架構。 |
| **基礎設施成本** | 🟢 包含在 Supabase 原有方案中。 | 🟢 完美利用 Vercel Free Tier 的 Serverless 額度，不增加額外支出。 |

## 3. 最終決策與技術價值

基於上述評估，管理與技術團隊決議 **「全面廢棄 Supabase Edge Functions，改以 Vercel Serverless API 完全掌控結帳與交易流程」**。

此決策帶來的巨大商業與技術價值：
1. **開發極速化**：團隊只需專注於單一 Codebase 與單一 CI/CD 流程，修改前端畫面與後端 API 能在同一次 PR (Pull Request) 中完成並驗證。
2. **降低維運複雜度**：除資料庫維持在 Supabase 外，所有的「運算」與「商業邏輯」全部收斂至 Vercel，系統邊界與責任劃分極度清晰。
3. **更強的第三方整合能力**：我們能毫無阻礙地在 Vercel API 中實作 SiteGiant ERP 的庫存鎖定、TapPay 扣款以及光貿發票的開立。

## 4. 風險控管與下一步

- **Timeout 限制**：Vercel Free Tier 對 API 執行時間有嚴格限制（通常為 10-15 秒）。因此，工程團隊在撰寫 `api/checkout.ts` 時，必須確保外部 API 呼叫（ERP、金流）加上嚴格的 Timeout 處理與重試機制。
- **後續行動**：工程團隊將在 Phase 3 刪除 `supabase/functions` 目錄下的舊有程式碼，並在根目錄建立 `api/` 資料夾，展開路由遷移工作。本決策的技術實作細節已同步更新至《Vercel Migration Spec》規格書中。
