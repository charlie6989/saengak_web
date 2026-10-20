# 黑貓 COD 開票、付款與對帳修改方案

日期：2026-10-21（Asia/Taipei）。狀態：**第一階段程式與隔離本機測試已完成，待 PR 審查；未部署、未套用正式 migration、未修改正式設定，尚待會計確認與實單驗收**。

適用 CARE `gh2xgs-zf` 的黑貓常溫 COD。母站、全家取貨付款與其他付款方式不自動套用。本文件是後續修改依據，不表示目前正式流程已符合目標。

## 1. 決策基準與證據

- 目標：**發貨時開票 → 代收完成確認顧客付款 → ShipAny 匯款入帳獨立對帳**。
- 財政部買賣業問答指出：一般依發貨時點開票；預收款部分提前開票；書面約定須買受人承認始生效的交易有例外。COD 本身不是例外證明。會計仍須核對本店實際契約及適用規定。
- 官方來源：[買賣業開票時點](https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-q-and-a/national/business-tax/invoice/NEQ3G5w)、[營業稅法第 32 條](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340080)、[網購鑑賞期與發票寄發](https://www.etax.nat.gov.tw/etwmain/tax-info/network-transaction-taxtation-area/press/3vbAVgr)、[統一發票使用辦法（含電子發票退回／折讓）](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340082)。開立、通知及傳輸存證是不同階段，不能把上傳期限當成延後開票期限。
- 本輪重讀本機程式；後台證據沿用 2026-10-20 唯讀檢查，沒有再次登入或執行正式交易。當時 Flow 為 DELIVERED＋COD＋PENDING＋標準 → Mark order as paid；光貿配置值、waaship 開票設定及完整實單仍未驗收。

## 2. 第一階段範圍與操作

第一階段建議限 TWD、黑貓 COD、整單一次出貨、尚未取消、金額已確定的訂單。部分預收、分批出貨、混合付款、異常改單走人工會計處理；不是等整單出完才處理已發貨部分。若要自動支援分批，須先設計多張發票及品項／運費／折扣分攤，目前的一單一開票工作不足以承接。

| 時點 | 發票 | 付款 | 結算 |
|---|---|---|---|
| 訂單成立 | 保存偏好；不因草稿或物流單號開票 | pending | 未代收 |
| 倉庫執行發貨 | 核准出貨快照，立即開票並確認 provider 成功；與實際交運銜接 | 仍可 pending | 未代收 |
| 確認代收完成 | 不重複開票 | 核對代收額後標記 paid | 已代收、待撥款 |
| ShipAny 撥款及銀行入帳 | 不觸發開票 | 不再次標記付款 | 核對批次、費用、淨額及銀行入帳 |
| 拒收／取消／退貨 | 依已開票狀態、交易事實及會計規則處理 | 獨立處理付款／退款 | 記錄退運及費用差異 |

建議先用有權限的倉庫人員「確認本次出貨」作為明確的作業入口：核對訂單最新狀態、實際承運商、全量品項與金額，保存操作人、時間及出貨參考號，建立開票工作並指定派送，確認開立成功後交運。這是營運控制提案，具體發貨認定與例外由會計確認。

ShipAny 草擬、建立標籤、Shopify fulfillment 建立或 `orders/fulfilled` 事件均不能未驗證就當成實際發貨。若未來採自動事件，須驗證事件含義、延遲與可取得欄位，再接到同一套出貨核准邏輯。已交運卻開票失敗須立即列例外，不能倒填日期或等待隔天而無人處理。

## 3. 程式與資料庫修改清單

本節保留完整方案範圍；第一階段已實作的檔案、限制及切換順序見第 9 節。尚未實作的外部流程與設定不可視為已完成。資料庫以新增 migration 演進，沒有改寫歷史 migration。

| 範圍／檔案 | 現況與具體變更 |
|---|---|
| `supabase/functions/shopify-orders-webhook/webhook.ts`、`api/webhooks/shopify.ts` | 目前接收 orders/create、paid、updated、fulfilled、cancelled 及 refunds/create，沒有直接接收 fulfillment event。新增經驗證的 COD 分類、Shopify test 訊號與必要出貨證據的解析／投影；未知付款方式不得猜成 COD。維持原始本文 HMAC、CARE 商店限制、事件去重及亂序保護。若增加 topic，必須對應獨立 payload parser 與訂閱，不能拿 fulfillment payload 當 order payload。 |
| `sync_shopify_order_webhook`（現行定義見 `supabase/migrations/20261019215834_keep_invoice_preference_until_paid.sql`） | 將開票資格從付款處理區塊抽出：一般既有預付流程維持；符合本方案的 COD 由出貨核准建立工作。不可僅把 `paid` 改成 `paid OR fulfilled`。paid 區塊還包含優惠券結算，不能一起移到出貨時執行。COD 的 paid 事件不再成為新的開票入口；若代收時缺發票，列異常人工補救。 |
| 新增出貨核准資料與伺服器操作 | 建議 `cod_dispatch_confirmations` 保存商店、訂單、核准 ID、品項／數量／金額快照、操作人、作業時間、實際交運時間／證據（取得時）、承運商及追蹤號。建立受保護的後端入口與 service-role RPC，拒絕一般顧客存取；以訂單鎖及唯一鍵防重複核准。付款狀態不因核准出貨而改成 paid。 |
| 開票工作建立與派送資格 | 在核准出貨的交易內建立不可變發票快照與 `issue_basis`／來源參考；維持正式 release、test 排除、seller allowlist、取消檢查。補查所有 enqueue RPC／人工重試入口，避免繞過資格。既有工作只更新狀態而不一定更新 payload；金額變更必須核對快照版本，不能無聲沿用舊金額。 |
| `private.amego_invoice_jobs`、`order_invoices` | 現有 shopify_order_gid 唯一鍵適合第一階段整單一次開票。發貨、paid、重複 webhook 都指向同一工作；超時先查 provider 再重試。需要多張發票時，另案改為明確的銷售／出貨分段鍵，不可直接刪除唯一限制。 |
| 發票偏好保存 | 現行偏好會在建立工作後刪除；改為在快照成功保存後才刪除，與建立工作同一交易。不能因 COD 尚未 paid 又錯誤重建偏好。保留 120 天政策，過期或資料缺失的出貨轉人工，不默默把指定載具／統編降為一般個人發票。 |
| `api/invoice/guangmao.ts`、`supabase/functions/amego-invoice-dispatch/amego.ts` | 沿用 claim/lease、固定訂單識別、provider 回讀及結果投影。出貨操作呼叫受授權的指定工作派送，不暴露 dispatch token 到瀏覽器。不能把「已入佇列」當成「已開立」；明細、運費、折扣需精確相符，COD 金額不符轉人工，不靠猜測調整列掩蓋差異。 |
| `vercel.json` 與派送營運 | 每日 09:00 排程降為補漏／核對用途，主要開票跟隨出貨操作。重試機制需持久化並有告警；不可只靠 webhook 回應後的背景工作。依平台實際限制評估排程／佇列方案，不預設已可增加頻率或免費使用。 |
| 取消／退款及 `amego_allowance_lifecycle` | 未呼叫 provider 可取消待辦；結果不確定先查詢；已開票走會計審核。現行取消可能進 void_review、refunds/create 進 allowance_review，須核對是否符合電子發票個案處理，不能見取消就自動作廢。已付款、已開票及銀行入帳各自保存，不以單一 status 相互覆蓋。 |
| 操作畫面與交易紀錄 | 分別顯示「發票狀態／顧客付款狀態／ShipAny 結算狀態」。檢查 INVOICE_ISSUED 與既有 transaction_logs.status 的用法，避免提早開票覆蓋付款語義。提供失敗重查、人工核准及稽核紀錄，不提供可任意略過放行規則的按鈕。 |

## 4. Shopify Flow 調整方案

- 現行「COD 宅配送達後自動標記已付款」不能直接當成已驗證的代收成功流程。
- **建議第一階段**：上線切換時，將 DELIVERED 的動作改為標記「待核對 COD 代收」供營運處理；核對 ShipAny／黑貓的代收成功紀錄、訂單、追蹤號、幣別與全額後，由授權人員在 Shopify 標記 paid，保存證據與時間。既有通知或任務機制是否可用須實作時確認。
- **後續自動化**：只有供應商能提供已驗證、可信且含代收成功語義的事件／欄位，才能自動標記 paid；目前尚未證明 API、webhook 或 Shopify metafield 有這項能力。若只能拿到 DELIVERED，保留人工核對。
- 條件保留 CARE＋COD＋pending＋未取消，加上實際黑貓／追蹤號及全額代收證據；「標準」只當輔助篩選，不能單憑名稱辨識承運商。部分收款、短收、重複事件、拒收轉人工；全家到店不得套用。
- 不增加任何「發貨即標記 paid」動作。新開票流程就緒前，不單獨停用舊 Flow 並放行新出貨，以免留下無人開票的空窗。本次沒有修改或停用 Flow。

## 5. 光貿、waaship 與 ShipAny

| 系統 | 待查證與待調整 |
|---|---|
| 光貿 | 確認正式 seller、API key、模式、字軌、放行、載具／捐贈／公司發票、Email、日期時區、上傳存證與狀態查詢。以既有 CARE outbox → 光貿為建議唯一開票路徑，但必須先查完其他來源。日期依真實作業及會計規則，不以 ShipAny 撥款日取代，不倒填。核對實際開票結果及財政部存證結果，不只看 API 接受。 |
| waaship | 目前權限更新阻擋設定頁，不能判定是否正在自動開票。需由使用者處理適用授權或提供設定證據，盤點付款／出貨／完成／排程開票、人工開票及既有紀錄。若有重複來源，安排切換時僅保留一條自動開票；停用與時間點須另行授權，不能因 UI 被擋而認為背景已停用。 |
| ShipAny | Created → 草擬維持物流匯入用途；出貨／送達回寫提供物流資訊。核對代收成功證據的實際可得形式與延遲，先用可取得的後台紀錄人工核對，不虛構 API。月結／撥款與銀行對帳獨立；額度、標籤紙、取件安排仍是出貨前待辦。 |

建議第一階段用受權限保護的對帳表／帳務工具，未必立即開發新銀行整合。最少記錄商店、Shopify 訂單、ShipAny／追蹤號、預計與實際代收額、代收日期、撥款批次、各項扣費及憑證、其他調整、預計淨額、實際入帳日／金額、核對人及差異原因。一個撥款批次可涵蓋多張訂單；避免把同一批匯款費逐單重複扣除。計算依實際帳單中本次扣款方式，不能把另行支付的運費再扣一次。對帳不得呼叫開票或付款標記。

## 6. 待會計確認（不得當成已核准）

1. CARE 買賣契約是否適用一般發貨開票；若有例外，提供具體條款及依據。確認倉庫交運作業點、開票日期與時區。
2. 預收訂金、部分預付、分批出貨／缺貨拆單的開票金額與時點；第一階段遇到時的人工處理方式。
3. 運費、向顧客收取的 COD 費、折扣／優惠及平台扣費的發票與帳務處理。銷售發票金額不可直接以銀行收到的淨額代替。
4. 已開票未交運、拒收、退貨、跨期退回、部分退款、物流賠償、短收的作廢／折讓條件及必要證據；不直接沿用「取消就作廢」。
5. 物流代收款待撥的帳務科目、銀行入帳沖帳、費用憑證與批次分攤方式。
6. 若盤點發現既有應開未開或延遲開票，列出實際日期、金額及證據交會計處理，不自動補開、倒填或批次重送。

## 7. 文件修改範圍與文案草稿

- `docs/LOGISTICS_PAYMENTS_PLAN.md`：新增目標流程與切換條件；保留現行 Flow 的日期證據，將「已付款才開票／結算後開票」標為待取代，不能改寫成已上線。
- `docs/PROJECT_MEMORY.md`、`docs/PROJECT_STATUS.md`：記錄提案、會計待確認、程式驗證與正式驗收的差別；每次上線後再記錄實際結果。
- `docs/SHOPIFY_ADMIN_RUNBOOK.md`：實作時補倉庫出貨、開票確認、代收核對、Flow 例外、對帳與拒收處理 SOP。
- `docs/GUEST_CHECKOUT_LAUNCH_CHECKLIST.md`：補 COD 待付款已開票、載具／公司發票、重複事件、取消競態與退款驗收。
- Shopify 手動付款說明及實際可見 FAQ／訂單信件：盤點後同步修改，不能只改 Git 文件。候選文案：「商品送達時，請以現金支付訂單總額（含運費）給配送人員。電子發票將於商品出貨時依您結帳選擇的發票方式開立。」通知 Email／載具顯示依實際驗證補充。
- 歷史 migration 不改寫；以新 migration 的說明記錄新舊開票時點差別。README 已有物流文件入口，透過該入口連到本方案。

## 8. 實作順序、驗收與回復

1. 完成會計確認、唯一開票來源盤點、倉庫發貨與代收證據格式確認。既有在途／已付款／已開票 COD 逐單盤點，訂切換時間或訂單清單，不能批次重開。
2. 獨立 PR 實作新 migration、出貨核准、開票資格、受保護派送及操作狀態；新增功能預設關閉，先在隔離環境以假資料驗證。新增 migration 保持舊呼叫相容，未知資料拒絕開票；不可只放寬舊 paid gate。
3. 回歸重點：COD 建單不開票；草稿／標籤不開票；整單發貨即使 pending 也只開一次；paid 不重開；舊事件不回退；錯店／未知付款／測試單拒絕；取消與派送競態；provider 超時查回後不重開；改單金額不符轉人工；無載具／統編資料不靜默降級；付款／優惠券既有行為不被提早觸發。
4. 測試檔範圍：`webhook.test.ts`、`tests/shopify-webhook-api.test.ts`、`tests/shopify-webhook-auth.test.ts`、`tests/invoice-guangmao-api.test.ts`、`supabase/tests/database/cod_invoice_preference.test.sql`、`amego_invoice_outbox.test.sql`、`enqueue_amego_invoice_job.test.sql`、`amego_allowance_lifecycle.test.sql`，並新增出貨核准及對帳去重案例。CI 與本機 DB 測試不代替正式開票驗收。
5. 取得正式變更授權後，協調出貨暫停窗口，備份設定、套用 migration／部署、確認光貿與唯一開票路徑，再切 Flow 與顧客文案。完成受控首單的發貨、開票／存證／通知、代收、付款、入帳對帳證據後才放行常態運作。ShipAny 撥款較晚，驗收可分階段，但不得提前宣稱整條流程完成。
6. 故障時暫停新 COD 出貨或採會計核准的人工開票備援；關閉自動派送不代表可讓已發貨訂單等待。保存既有發票號碼、出貨核准與未決工作；恢復前先查 provider，禁止重建工作造成重複開票。不得把退回「入帳後才開票」作為回復方案。

第一階段程式與本機驗證如下；Flow、供應商設定、會計確認及正式驗收仍未完成。


## 9. 第一階段實作與審查邊界（2026-10-21）

| 已實作 | 審查重點 |
|---|---|
| `20261021000000_cod_dispatch_invoicing.sql` | 新增 private policy/context/confirmation 三表；預設 `enabled=false, starts_at=null`。核准、發票快照、工作及偏好移除在同一交易，訂單 advisory lock 與唯一鍵去重。API/RPC 僅限經驗證管理員；一般會員沒有表或 RPC 權限。 |
| `api/invoice/cod-dispatch.ts`、`api/_lib/cod-dispatch.ts` | GET 查狀態；POST 核准整單並呼叫指定工作的既有 Vercel worker。第一次核准與每次新的 provider mutation 前，唯讀回查 CARE Shopify 最新時間、全額、幣別、未付款／未履約／未取消、非 test 及標準配送。承運商及託運號由管理員實際核對後確認，尚無 ShipAny API 自動認證。 |
| `CodDispatchPanel.tsx`／訂單管理頁 | 查詢後核對整單金額、託運號及整單聲明。顯示發票／顧客付款／外部對帳三者。重試沿用核准 ID；沒有重新核准或略過門檻按鈕。只有 `issued` 且取得發票號碼才算開票確認。 |
| webhook 分類及所有 enqueue 防護 | 嚴格辨識標準 `Cash on Delivery (COD)`；混合、未知付款或 test 訊號缺失拒絕新範圍開票。新範圍 COD 的 paid 事件只處理付款與原有優惠券結算，不建第二張票；非 COD 已知非測試訂單保留原 paid 流程。 |
| provider 派送 | 保留先查詢再開立、固定 OrderId、lease 及 at-most-once mutation fence；資料庫 fence 錯誤確實阻止發送。COD 品項＋運費－折扣必須精確等於整單金額。開票不覆寫交易的付款狀態。 |

### 關閉狀態、版本與新舊訂單

- 三層閘門：API `COD_DISPATCH_ENABLED=false`；前端 `VITE_PUBLIC_COD_DISPATCH_ENABLED=false`；資料庫政策預設關閉且無切換時間。原有 `AmegoInvoiceReleaseEnabled`、憑證及 seller allowlist 仍要成立。
- `starts_at` 是訂單建立時間的切換界線，只有 CARE 新範圍適用。切換前舊單保持既有流程，必須先逐單盤點；不是本 PR 自動宣告舊流程稅務合規。暫停時保留切換界線，不能清空／移後 `starts_at`，否則會讓新 COD 回到舊 paid-only 路徑。
- 本 PR 的 webhook 增加 `p_invoice_context`。未來部署必須先套用 migration，再部署 webhook/API，最後經授權設定切換界線及啟用。migration 的預設參數接受舊呼叫；但舊版本沒有 context，在新範圍內不會開票。新 webhook 不會在 migration 缺失時靜默剝除證據降級，會回錯並等待重送。因此切換前必須確認版本與 webhook 同步。
- `vercel.json` 僅禁止本 PR 分支 `codex/cod-dispatch-invoicing` 自動部署；未修改遠端設定或其他分支的部署規則。本次不部署 preview／production。

### 首階段刻意保留的營運限制

- 僅整單、未履約、pending、TWD、黑貓常溫。已在 Shopify 建 fulfillment 即使尚未實際交運，也會被拒絕，須先調整並驗證作業順序；本 PR 不改 ShipAny 或 waaship。不得為通過檢查而偽改物流／付款狀態。
- 核准建立後 **10 分鐘內**才允許新的開票 mutation。工作內容／金額改變、取消、超時或無法查核最新訂單就停止新的開票；仍可回查已發出的同一工作。過期核准不提供自動延長或重建工作，須由授權人員與會計查核 provider 後另案處理。
- 既有每日排程沒有更改。Edge worker 沒有 Vercel 的 Shopify 即時前檢，因此只可回查 COD 已存在發票，不能首次開立 COD；主路徑是管理員操作觸發 Vercel worker。重試沿用原工作且受 10 分鐘限制，逾期可能保留 failed／人工處理狀態；通知／值班告警、實際交運證據附件與銀行對帳整合均未實作，正式放行前須建立人工值班與證據保存機制。
- Shopify 即時讀取與供應商寫入不是跨系統原子交易。資料庫鎖、取消旗標與 mutation fence 降低競態，但 provider 開始後的取消須回查並走既有作廢／折讓審核，不可保證撤回已送出的發票。
- 光貿／waaship 是否有重複自動開票尚待確認；本 PR 防重範圍是 CARE outbox，不代表可阻止其他應用開另一張發票。Flow 也仍維持先前正式設定，代收證據與付款時點待另行調整。
- 第 6 節所有會計待確認事項完整保留。這次沒有真實訂單、provider mutation、Flow 或服務商設定驗收；測試均使用 fixture／mock 與隔離本機 PostgreSQL。

### 本機驗證結果

- Vitest：59 個測試檔、567 項通過；新增 API 管理員／origin／開關、不可偽造 actor、即時 Shopify 狀態、整單金額、重試與 provider fence 測試，所有網路均為 mock。
- PostgreSQL：從原本機 schema 建立隔離副本，在副本重跑尚未套用 migration；275 項 pgTAP 通過（其中新 COD 39 項），涵蓋核准／付款分離、偏好保留、取消／改單、過期、混合付款／test／幣別、舊 enqueue 防護與存取權限。沒有修改原本機 postgres 或正式資料庫。
- 專案 `typecheck`、`build`、`verify:content`、`verify:supabase`、`git diff --check` 通過；`npm audit --audit-level=moderate` 零弱點。
- 額外直接執行 `tsc -p tsconfig.app.json` 與 `tsc -p tsconfig.node.json`，與 main 原始碼副本相比均無新增診斷；既有 app 24、node 41 個型別錯誤仍存在。既有 `npm run typecheck` 使用 root 空 files 加 references，不能當成這兩個子專案的完整型別驗證。
- 未做正式瀏覽器操作、實際 Shopify／ShipAny 訂單或光貿開票；不把 mock、資料庫測試與編譯成功當成正式端到端驗收。
