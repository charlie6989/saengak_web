# SAENGAK Phase 2 後端中樞 — 稽核、修正與規格定版報告

> 報告日期：2026-08-20
> 稽核範圍：`implementation_plan.md` / `walkthrough.md`（Antigravity brain）聲稱之 Phase 2 Serverless Commerce 後端中樞 vs `C:\Projects\saengak_web` 實際程式碼
> 稽核方法：`/diagnosing-bugs` 紀律——對每項可疑聲稱建立「可紅可綠」的可執行驗證迴圈（直接 import 正式程式碼執行斷言），不憑閱讀推測下結論
> 驗證基準（修正後）：`npm test` **360/360 通過**、`npm run typecheck` **零錯誤**、`npm run build` **通過 (2.5s)**

---

## 1. 執行摘要 (Executive Summary)

原報告聲稱的表層指標**屬實**：所有檔案存在、52 個測試檔 353 個測試通過、typecheck 與 build 乾淨。但逐項稽核發現 **1 項 Critical、3 項 High、2 項 Medium、1 項 Low** 缺陷——最嚴重者為「發票 Outbox 實質寫不進資料庫，電子發票永遠不會開立」，且多項「安全驗證」在密鑰未設定時會靜默放行（Fail-Open）。

**所有發現已於本日全數修正**，並補上迴歸測試防止回退；五份權威規格書（`00_DECISION_LOG`、`MAIN_SPECIFICATION`、`CHECKOUT_PAYMENT_SPEC`、`VERCEL_MIGRATION_SPEC`、`MODULES`）已同步定版，新增三條治理鐵則。

---

## 2. 稽核發現與修正對照

### 2.1 🔴 Critical — 發票 Outbox 寫入路徑錯誤（發票實質不會開立）

| 項目 | 內容 |
| --- | --- |
| **現象** | `api/_lib/supabase-admin.ts` 之 `enqueueAmegoInvoiceJob()` 以 `.from('amego_invoice_jobs')` 直寫資料表 |
| **根因** | 該表實際位於 `private.amego_invoice_jobs`（migration `20260813045204`），且明確 `revoke all` 於 public/anon/authenticated；PostgREST 預設僅曝露 `public` schema，直寫必然失敗 |
| **危害** | 錯誤被 `catch {}` 靜默吞掉、退回記憶體暫存；Serverless instance 回收後發票工作消失——顧客付款成功、訂單建立，**但電子發票永遠不會開立**，且無任何告警 |
| **證據方式** | Schema 比對：同批 migration 的 `transaction_logs` 特意建於 `public` schema 供直接存取，證明 private/public 差異是既有設計而非巧合 |
| **修正** | 新增 `public.enqueue_amego_invoice_job` RPC（migration `20260820000003`）：以 `shopify_order_gid` 冲突鍵冪等 upsert、終態工作不被覆寫、僅 `service_role` 可 EXECUTE；`enqueueAmegoInvoiceJob()` 改走 RPC，失敗改為 `console.error` 明確記錄 |
| **測試** | `supabase/tests/database/enqueue_amego_invoice_job.test.sql`（6 項 pgTAP 斷言：函式存在、權限隔離、寫入落地、冪等不重複） |

### 2.2 🟠 High — 三處安全檢查 Fail-Open（密鑰缺失即隱性放行）

以臨時測試直接執行正式程式碼證實（4/4 命中），全數改為 Fail-Closed：

| 位置 | 原行為（Fail-Open） | 修正後（Fail-Closed） |
| --- | --- | --- |
| `api/_lib/security.ts` `isOriginAllowed` | 缺 `Origin` header 直接 `return true` 放行——非瀏覽器的伺服器對伺服器呼叫可繞過整個白名單 | 缺 Origin 一律 **403** |
| `api/webhooks/shopify.ts` | `SHOPIFY_WEBHOOK_SECRET` 未設定時整段跳過 HMAC 驗證，未簽章 payload 被當合法處理 | 密鑰缺失一律 **500** 拒絕 + 告警日誌 |
| `api/cron/reconcile.ts`、`api/invoice/guangmao.ts` | `CRON_SECRET`/`AmegoDispatchToken` 未設定時任何匿名呼叫者可觸發**對帳與自動退款** | 密鑰缺失一律 **500** 拒絕 + 告警日誌 |

共同模式：`if (secret) { verify }`——把「密鑰不存在」與「驗證通過」混為一談。與 `MAIN_SPECIFICATION` §5.2 安全不變量第 1 條「預設封閉」直接牴觸。四項均以 `tests/checkout-backend.test.ts` 第 9 節「Fail-Closed 迴歸測試」鎖定。

### 2.3 🟠 High — 對帳排程從未真正被排程

`api/cron/reconcile.ts` 端點存在，但 `vercel.json` 無 `crons` 宣告——Vercel 不會自動呼叫，「定期對帳」為純手動端點。

**修正**：`vercel.json` 補上：

```json
"crons": [
  { "path": "/api/cron/reconcile",  "schedule": "*/15 * * * *" },
  { "path": "/api/invoice/guangmao", "schedule": "*/5 * * * *" }
]
```

### 2.4 🟡 Medium — 兩套限流實作並存，端點誤接弱版

- 端點實際 import 的 `api/_lib/rate-limit.ts`：**固定視窗**計數器（非文件聲稱的滑動視窗）、Upstash 失敗不回報 Sentry。
- 更完整的 `api/_lib/ratelimit.ts`（Upstash Lua Script 原子滑動視窗、in-memory 降級 + Sentry 回報、IP/會員雙軌）反而是**死碼**，無任何端點引用。

**修正**：刪除弱版 `rate-limit.ts`；`checkout.ts`／`confirm.ts`／`status.ts` 統一接回 `ratelimit.ts`，維持原閾值（結帳 5 次/分、confirm 10 次/分、輪詢 20 次/分、會員 10 次/時），429 回應附正確 `Retry-After`。

### 2.5 🟡 Medium — 測試覆蓋誇大

- 原 353 個測試全程未設定 Supabase 環境變數 → `getSupabaseAdminClient()` 恆為 `null`，**整個 Supabase 整合層（含 Critical 缺陷）從未被測試觸及**。
- `checkoutHandler` 只測 4 條錯誤路徑，「扣款成功→建單→補償」主線從未整合測試。
- `scripts/run-db-tests.mjs` 漏排既有的 `transaction_logs.test.sql`——該 pgTAP 測試**從未被 `npm run test:db` 執行過**。

**修正**：
- 補「金流成功→建單成功→寫入發票 Outbox」Happy Path 整合測試（含金額斷言：990 小計 + 100 運費）。
- 補「建單失敗→自動 TapPay Refund→`COMPENSATED`」補償整合測試。
- `run-db-tests.mjs` 補列 `transaction_logs.test.sql` 與新 RPC 測試，斷言數 141 → **171**。

### 2.6 🟢 Low — 冪等 Hash 未涵蓋發票偏好

同一 `Idempotency-Key` 更換發票抬頭/統編/載具不會觸發 422。**修正**：`payloadHash` 納入 `invoicePreference`，補 422 測試。

---

## 3. 稽核確認屬實的部分（無需修正）

- 售價權威重算：Storefront GraphQL 批次查詢、售罄防護、滿 1500 免運/超商 60/宅配 100 運費規則。
- TapPay 整合：pay-by-prime、3DS `payment_url` 分支、Record API 二次查核（不信任前端回傳值）、Refund。
- `note_attributes` 僅帶 `transaction_id`/`idempotency_key`（零個資）；`financial_status: 'paid'` 建單。
- `transaction_logs` 八態狀態機、RLS Deny-All、service_role 專屬權限。
- `confirm.ts` 3DS 流程：後端二次查核 → 建單 → 失敗補償，與規格一致。

---

## 4. 變更檔案清單

### 程式碼修正
| 檔案 | 變更 |
| --- | --- |
| `api/_lib/supabase-admin.ts` | 發票 Outbox 改走 `enqueue_amego_invoice_job` RPC |
| `api/_lib/security.ts` | 缺 Origin 一律拒絕 (403) |
| `api/webhooks/shopify.ts` | HMAC 密鑰缺失 Fail-Closed (500) |
| `api/cron/reconcile.ts` | CRON_SECRET 缺失 Fail-Closed (500) |
| `api/invoice/guangmao.ts` | AmegoDispatchToken/CRON_SECRET 缺失 Fail-Closed (500) |
| `api/checkout.ts` | 接回滑動視窗限流；Hash 納入發票偏好 |
| `api/checkout/confirm.ts`、`api/checkout/status.ts` | 接回滑動視窗限流 |
| `api/_lib/rate-limit.ts` | **刪除**（弱版重複實作） |
| `vercel.json` | 補 `crons` 排程宣告 |

### 資料庫
| 檔案 | 變更 |
| --- | --- |
| `supabase/migrations/20260820000003_add_enqueue_amego_invoice_job_rpc.sql` | **新增** RPC migration |
| `supabase/tests/database/enqueue_amego_invoice_job.test.sql` | **新增** 6 項 pgTAP 斷言 |
| `scripts/run-db-tests.mjs` | 補列兩份漏排測試，斷言數 141 → 171 |

### 測試
| 檔案 | 變更 |
| --- | --- |
| `tests/checkout-backend.test.ts` | +7 測試：Happy Path、補償退款、發票偏好 422、Fail-Closed 迴歸 ×4 |

### 規格書（本次定版）
| 文件 | 更新重點 |
| --- | --- |
| `docs/00_DECISION_LOG.md` | 新增 §3.2 稽核修正記錄與三條治理鐵則；§4 Phase 2 狀態更新 |
| `docs/CHECKOUT_PAYMENT_SPEC.md` | §4 Hash 範圍定版、§5.1/5.2 落地標注、**新增 §5.3 發票 Outbox 寫入路徑**、§7.2/7.4/7.6 修正記錄、**新增 §7.8 Fail-Closed 鐵則**、**新增 §9 實作對照表** |
| `docs/VERCEL_MIGRATION_SPEC.md` | §2 路由對照表補齊落地狀態欄、§4.1 HMAC Fail-Closed、§4.1.1 crons 排程 |
| `docs/MAIN_SPECIFICATION.md` | §1.2.2 後端層落地狀態與共用函式庫、§1.2.6 CSP 表 TapPay/Turnstile 已放行、§4.2 Phase 2 進度重整 |
| `docs/MODULES.md` | 各模塊狀態由「待建」更新為「程式碼已落地（待部署/驗收）」，含營運後台 |

### 新增治理鐵則（記入 00_DECISION_LOG §3.2）
1. **密鑰缺失 Fail-Closed**：以密鑰為前提的安全檢查，密鑰未設定必須拒絕請求，嚴禁「有設定才驗證」。
2. **Private Schema 存取**：`private` schema 一律經 `public.*` RPC 存取，嚴禁 `.from()` 直寫；新 RPC 必附 pgTAP 權限測試。
3. **限流模組唯一性**：全站唯一實作 `api/_lib/ratelimit.ts`，嚴禁另建平行模組。

---

## 5. 驗證結果

| 驗證項目 | 修正前 | 修正後 |
| --- | --- | --- |
| `npm test` | 353/353（但主線與 Supabase 層未覆蓋） | **360/360**（含 Happy Path、補償、Fail-Closed 迴歸） |
| `npm run typecheck` | 通過 | **通過（零錯誤）** |
| `npm run build` | 通過 (2.50s) | **通過 (2.51s)** |
| `npm run test:db` (pgTAP) | 漏排 1 份測試檔 | 清單修正（141→171 斷言）；**本機無 Docker，待補跑** |

---

## 6. 部署前待辦（如實記錄，未完成不得宣稱上線就緒）

1. **本地 Supabase 環境跑 `npm run test:db`**：對真實 Postgres 驗證兩份 migration（`20260820000001~3`）與全部 171 項 pgTAP 斷言。
2. **Vercel 環境變數/Secrets 配置**：`TAPPAY_PARTNER_KEY`、`SHOPIFY_ADMIN_ACCESS_TOKEN`、`SHOPIFY_WEBHOOK_SECRET`、`CRON_SECRET`、`AmegoDispatchToken`、`UPSTASH_REDIS_REST_URL/TOKEN`、`SUPABASE_SERVICE_ROLE_KEY`、`CHECKOUT_RELEASE_ENABLED`（Fail-Closed 生效後，任何漏設會直接拒絕服務而非靜默放行——這是預期行為）。
3. **測試覆蓋已知缺口**：`api/invoice/guangmao.ts`「派送並回讀 99」與 `api/webhooks/shopify.ts`「合法簽章→完整投影」兩條主線尚無整合測試。
4. **後端 `@sentry/node` 接線**（`api/*` 異常上報）。
5. **ShipAny App 安裝綁定**、TapPay 沙盒實單、端到端商業驗收 (`verify:commerce`)。

---

*本報告由 2026-08-20 稽核與修正工作階段產出；權威修正記錄同步收錄於 `docs/00_DECISION_LOG.md` §3.2。*
