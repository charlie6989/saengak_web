# LUCISSI ↔ LUCISSI CARE 會員資格互認（第 1 階段）

2026-10-17 使用者決定：兩站會員互通先做「同一個已驗證 Email、權益互認」，權益為**雙向首單免運**；互認對象只限 lucissi.com 官網會員（蝦皮買家不含）。兩站同屬拜悠衣品有限公司（統一編號 90014835）。母站程式庫為 `~/Documents/GitHub/LUCISSI_website`，兩邊必須實作完全相同的契約。

## 伺服器對伺服器 API

兩站各自提供：

```
POST /api/partner/member-status
Content-Type: application/json
X-Partner-Id: lucissi-care   （CARE 呼叫母站時）／ lucissi（母站呼叫 CARE 時）
X-Partner-Timestamp: <unix 秒>
X-Partner-Signature: hex(HMAC-SHA256(PARTNER_MEMBER_SECRET, `${timestamp}.${rawBody}`))

{"email":"member@example.com"}
```

| 狀態 | 回應 |
|---|---|
| 200 | `{"isMember": true}` 或 `{"isMember": false}`，不含其他資料 |
| 400 | Email 缺漏或格式錯誤 |
| 401 | `X-Partner-Id` 不符、簽章錯誤，或時間差超過 300 秒 |
| 503 | 未設定 `PARTNER_MEMBER_SECRET`（或少於 32 字元）、查詢服務不可用 |

- Email 先 trim、轉小寫再查。`isMember` 只在「該站有此 Email 的帳號，且 Email 已驗證、未刪除」時為 true。
- CARE 以 `public.partner_member_exists(p_email)`（只授權 `service_role`）查詢 `auth.users`。
- 呼叫端逾時 5 秒；失敗一律視為「暫時無法確認」，不視為非會員。

## CARE 端權益流程（`POST /api/promotions/lucissi-member-perk`）

1. 會員登入且 Email 已驗證；伺服器端 `LUCISSI_MEMBER_PERK_ENABLED=true`。
2. 已有 `issued`／`used`／`expired` 紀錄 → 回傳原本的代碼與狀態。2 分鐘內的 `pending` → 回應「建立中」；逾時的 `pending` 清除重來。
3. 先以會員身分同步呼叫 `claim_guest_orders()` 認領同 Email 的訪客訂單，再檢查付款完成的訂單（`payment_status` paid／partially_refunded，或 `status` paid／shipped／completed）；有就不符合（首單限定）。
4. 向母站確認同一 Email 是 LUCISSI 會員。
5. 寫入 `pending`（`user_id` 為主鍵，擋住同時重複領取），以 `discountCodeFreeShippingCreate` 建立**這位會員專屬**的 Shopify 免運折扣：名稱「LUCISSI 會員首單免運｜代碼」、單一代碼（`LC` 開頭 10 碼）、總使用 1 次、每位顧客 1 次、60 天到期、預設綁定該 Email 的 Shopify 顧客（找不到就建立）。建立是同步的，成功後才改為 `issued`；失敗刪除 `pending`。
6. 會員在購物車的「輸入折扣代碼」貼上使用。

**首單限定在結帳後強制執行**：訂單 webhook 收到這位會員（依 Email）第一筆付款訂單時，用了代碼 → `used`；沒用 → 以 `discountCodeDeactivate` 停用折扣並標記 `expired`。

**不會公開**：公開優惠列表與一般領券 API 以折扣名稱前綴與代碼格式排除會員折扣，不依賴環境變數。

## 上線步驟（CARE）

1. 確認 Shopify 應用程式具 `write_discounts`、`read_customers`、`write_customers` 權限。
2. 套用 migration `20261017120000_partner_member_perks.sql` 到正式 Supabase `tmqzkagkrzhioftvwbqo`。
3. Vercel（CARE）設定 `PARTNER_MEMBER_SECRET`（與母站相同、32 字元以上）、`PARTNER_MEMBER_STATUS_URL=https://lucissi.com/api/partner/member-status`、`LUCISSI_MEMBER_PERK_ENABLED=true`。
4. 以測試會員實際領取並結帳一次，確認綁定顧客的代碼能在結帳套用；若不能，設定 `LUCISSI_MEMBER_PERK_BIND_CUSTOMER=false`（仍是單次使用與到期）。
5. 母站完成同樣的 API 與設定後，兩站互相呼叫驗證；最後把 `VITE_PUBLIC_LUCISSI_MEMBER_PERK_ENABLED` 設為 `true` 並重新部署，才會顯示領取卡片。

## 尚未處理

- 每位會員一個 Shopify 折扣，折扣清單會隨領取人數增加；可依名稱前綴篩選。
- 第 2 階段（以 LUCISSI 帳號登入 CARE）與第 3 階段（共用點數）尚未開始。
