# SAENGAK 機密設定與權限移交指南

> 更新日期：2026-08-13
> 本文件不包含任何金鑰值、密碼、Token、Cookie 或客戶資料。

## 1. 移交原則

- 原始碼包與機密設定包必須分開傳送。
- 機密設定包必須加密；解密密碼必須透過不同管道傳送。
- 優先邀請接手者加入 Shopify、Supabase、TapPay 與 Vercel 團隊，讓每個人使用自己的帳號與最小權限，不共享 owner 登入密碼或瀏覽器 session。
- Supabase secret key／legacy `service_role` 會繞過 RLS，只能存在 backend 或平台 secrets，不得放在 React、`VITE_*`、Git、聊天、Email 或未加密文件。
- TapPay Partner Key、Shopify Admin access token、Webhook Secret 與 Supabase secret key 在完成移交後應輪替；舊值在新設定完成並驗證後撤銷。
- 不移交 Vercel OIDC token、CLI access token、Cookie、瀏覽器 session、OTP、個人 Keychain 或付款資料；這些應由接手者重新登入取得。

## 2. 2026-08-13 本機／平台盤點

### 2.1 Vercel Production 可見變數

下列名稱可由目前 Vercel project `saengak-web-d2ux` 讀回，值在平台顯示為 encrypted：

- `VITE_PUBLIC_SHOPIFY_TAGS_ENABLED`
- `VITE_PUBLIC_SHOPIFY_STOREFRONT_ENABLED`
- `SAENGAK_TEST_SESSION_SECRET`
- `SAENGAK_TEST_PASSWORD`
- `SAENGAK_TEST_USERNAME`
- `VITE_PUBLIC_CHECKOUT_SUPABASE_KEY`
- `VITE_PUBLIC_CHECKOUT_SUPABASE_URL`
- `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_SUPABASE_URL`

本次加密設定包會保存 Vercel production `env pull` 的快照，供帳戶持有人控制下的復原與比對。測試帳號密碼與 session secret 上線前應重新產生；公開 launch 後若移除 TestAccessGate，應一併移除不再需要的測試變數（註：TestAccessGate 僅在雲端發布環境生效，本地開發環境 localhost 預設直通免驗證）。

### 2.2 本機 `.env.local`

本機只發現 `VERCEL_OIDC_TOKEN`。它屬短效／機器授權資料，不納入移交包；接手者應使用自己的 Vercel 帳號或團隊權限重新登入。

### 2.3 Supabase

正式 project ref：`tmqzkagkrzhioftvwbqo`。

- 本機 Supabase CLI 尚未登入，無法讀出 remote Edge Function secret 名稱或值。
- Supabase production secrets 通常不能用「把 owner token 一起複製」的方式安全移交；應邀請接手者加入 project，再由帳戶持有人在 Dashboard／受控密碼管理器交付或輪替必要值。
- 前端只可使用 `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 或必要的 legacy anon key；不得使用 `sb_secret_*`／`service_role`。
- Edge Functions 可能需要：`ShopifyDomain`、`ShopifyStorefrontApiVersion`、`StorefrontAccessToken`、`ShopifyWebhookSecret`、`CheckoutAllowedOrigins`、`CheckoutReleaseEnabled`，以及 Supabase 平台提供的 backend defaults。
- Amego worker 另需要 `AmegoInvoiceReleaseEnabled`、`AmegoMode`、`AmegoSellerTaxId`、`AmegoAllowedSellerTaxIds`、`AmegoAppKey`、`AmegoDispatchToken`。所有值只放 Supabase Secrets 與 `.env.local`；正式開通前 release flag 維持 `false`。（註：測試統編 `12345678`、正式統編 `90014835`，App Key 不得明文寫入規格書）。
- ShipAny 採 Shopify App 原生整合，repo／Vercel／Supabase 不應出現 ShipAny API key；超商與承運商設定需登入 [ShipAny Taiwan Portal](https://portal-tw.shipany.io/user/login) (管理帳號：`charlie.liu6989@gmail.com`) 進行操作。
- `CheckoutReleaseEnabled` 是 server-side kill switch，預設必須為 `false`；只有 sandbox 三情境、binding、DB 與 owner-system readback 全部通過且核准上線後，才可設為精確字串 `true`。
- 接手者取得權限後，先以 `supabase secrets list --project-ref tmqzkagkrzhioftvwbqo` 讀回名稱與 digest，再決定輪替；不要把 secret value 寫回 repo。

### 2.4 Shopify

目標商店：`gh2xgs-zf.myshopify.com`（My Store 7）。

需要移交或重新建立的權限／設定：

- Shopify collaborator／staff access，採最小權限。
- Storefront access token 或 tokenless Storefront 設定。
- `SAENGAK Order Sync` custom app 與 `read_orders` scope。
- Admin API access token（若 webhook 同步工具需要）；不得放在前端或交接文件。
- Shopify webhook client secret／`ShopifyWebhookSecret`。
- 五個既有訂單 webhook subscriptions，以及部署退款處理程式後新增的 `REFUNDS_CREATE`；六個 production endpoint subscriptions 都須回讀。
- Theme `145031036995` 的來源與 storefront redirect 設定。

若 Shopify Admin 不再顯示既有 token 明文，應建立新 token、更新 Supabase/Vercel secrets、驗證新 token，再撤銷舊 token；不要嘗試從瀏覽器 Cookie 或 session 擷取 owner 權限。

### 2.5 TapPay

TapPay 為 Shopify Payment App 流程，正式權限應透過 TapPay Portal 與 Shopify 商家設定移交。需要核對：

- TapPay 帳戶成員／角色。
- SAENGAK Shopify 商家設定與 MGID。
- Partner ID、Partner Key 或其他 server-side credential（若實際架構需要）。
- 四個必要 domain 與 sandbox／live mode。
- success／failed／cancelled 測試紀錄與同一 Shopify Order ID 對帳。

TapPay 金鑰不應放在 React/Vite 前端。若 Portal 不允許再次顯示舊值，請由 owner 產生新值並走輪替驗收，不要以截圖、聊天或 email 傳送。

## 3. 接手者所需的建議角色

| 平台 | 建議方式 | 不應移交 |
| --- | --- | --- |
| GitHub | repository collaborator／team | owner PAT、SSH private key |
| Vercel | project member，最小 deployment／env 權限 | OIDC token、owner CLI session |
| Supabase | project member，依工作分配 Developer／Read-only | owner access token、service role 放入前端 |
| Shopify | collaborator／staff role | owner 密碼、Cookie、OTP |
| TapPay | Portal member／商家角色 | owner 密碼、Partner Key 明文聊天 |
| ShipAny／Amego | 各自建立成員帳號；App Key 只進 Supabase secret | 共用主帳號密碼、App Key 明文聊天、付款資料 |

## 4. 加密包使用方式

加密檔使用 AES-256-CBC、PBKDF2 與高迭代次數封裝。解密密碼存於原 Mac 的 macOS Keychain，service 名稱會記錄在交接包的 manifest；不要把密碼和加密檔放在同一個雲端資料夾或訊息中。

解密範例：

```bash
security find-generic-password -a "$USER" -s "<manifest 中的 Keychain service>" -w > /tmp/saengak-handoff-passphrase
chmod 600 /tmp/saengak-handoff-passphrase
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass file:/tmp/saengak-handoff-passphrase \
  -in SAENGAK_SECRET_CONFIG_2026-08-13.tar.enc | tar -xf -
rm -f /tmp/saengak-handoff-passphrase
```

只應在接手者自己控制、具磁碟加密的電腦解密。完成匯入後刪除明文 `.env`，並把值存入 Vercel／Supabase／密碼管理器的 secrets 功能。

## 5. 移交完成驗證

- [ ] 接手者使用自己的帳號登入各平台。
- [ ] 所有 platform/project/store 身分與本文件一致。
- [ ] 新金鑰只存在正確 backend secrets；前端 bundle 沒有 secret／service role。
- [ ] 舊的共享或 owner-only credential 已輪替或撤銷。
- [ ] `npm run verify:binding`、production probe 與 commerce sandbox 驗收重新通過。
- [ ] 解密後的暫存檔已安全刪除，沒有提交到 Git。
