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

1. 會員登入且 Email 已驗證。
2. 已領過 → 回傳原本的代碼。
3. 在 CARE 已有付款完成的訂單（`payment_status` paid／partially_refunded，或 `status` paid／shipped／completed）→ 不符合（首單限定）。
4. 向母站確認同一 Email 是 LUCISSI 會員。
5. 先寫入 `public.partner_member_perks`（每位會員一筆，`user_id` 為主鍵），再以 `discountRedeemCodeBulkAdd` 在專屬 Shopify 折扣下新增一組 `LC` 開頭、10 碼的代碼；Shopify 失敗則刪除紀錄。
6. 會員在購物車的「輸入折扣代碼」貼上使用。

專屬折扣（`LUCISSI_MEMBER_PERK_DISCOUNT_ID`）不會出現在公開優惠列表，也不能經由一般領券 API 歸戶。

## 上線步驟（CARE）

1. Shopify `gh2xgs-zf` 建立運送折扣「LUCISSI 會員首單免運」：免運費、無最低消費、每位顧客限用一次、總使用次數不限（每組代碼由 API 個別新增）、不與其他折扣併用；記下 DiscountCodeNode gid。確認 Shopify 應用程式具 `write_discounts` 權限。
2. 套用 migration `20261017120000_partner_member_perks.sql` 到正式 Supabase `tmqzkagkrzhioftvwbqo`。
3. Vercel（CARE）設定 `PARTNER_MEMBER_SECRET`（與母站相同、32 字元以上）、`PARTNER_MEMBER_STATUS_URL=https://lucissi.com/api/partner/member-status`、`LUCISSI_MEMBER_PERK_DISCOUNT_ID`。
4. 母站完成同樣的 API 與設定後，兩站互相呼叫驗證；最後把 `VITE_PUBLIC_LUCISSI_MEMBER_PERK_ENABLED` 設為 `true` 並重新部署，才會顯示領取卡片。

## 尚未處理

- 代碼使用後，`partner_member_perks.status` 不會自動改為 `used`；單次使用由 Shopify 折扣設定保證。
- 第 2 階段（以 LUCISSI 帳號登入 CARE）與第 3 階段（共用點數）尚未開始。
