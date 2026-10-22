# CI、PR #73 與正式交易驗收紀錄

查核日期：2026-10-23（Asia/Taipei）。執行順序為 main CI → PR #73 衝突與審查 → 正式金流／黑貓 COD → 訪客結帳／全家。此文件不記錄金鑰、個資、付款工具或原始訂單 payload。

## ShipAny API 試用與唯讀實測（2026-10-23，最新）

- 使用者確認開始使用後，直接回讀 API Pro 為「使用中」，完整官方文件已可取得。後台顯示 2026-11-06 自動續期，方案為 NT$398／月、14 天試用；未取消續期。
- 已確認官方規格有獨立指定代收額，與商品申報價值分開；運單列表及既有 Shopify 匯入原運單的單筆查詢均回 HTTP 200。查詢期間為 2026-08-01 至 2026-10-23，列表共 14 筆且沒有下一頁。
- 14 筆均為草稿／取消，沒有 COD 金額或託運號。CARE #1007 單筆讀回與後台相符，但仍是非 COD 全家草稿；商品價值 2,720 元不能代替代收額，不能作黑貓正向驗收。
- 已解除「沒有 API／不知道是否可讀 App 原單」的疑問。仍缺真正 COD 原單、生效／改額／送達時金額保證、跨店可靠識別及實際黑貓服務映射；目前程式尚未接入 ShipAny 讀取器。本輪沒有變更正式功能旗標、Webhook、訂單或金流。
- 公開 repository 僅記錄查核結論，不保存完整受限 API 文件、原始回應、個資或憑證。詳見 [逐單來源與剩餘驗收](SHIPANY_COD_AMOUNT_SOURCE.md)。

## COD 關閉狀態部署（2026-10-23，接續）

- 使用者要求處理合併與部署；功能關閉不再作為保留 Draft 的理由。PR #73 已合併至 main `7362920d04a8c45b6eed051d2a36f4e7c48bbbd1`；[main CI 39860327330](https://github.com/charlie6989/saengak_web/actions/runs/39860327330) 成功。
- 已先在正式 Supabase 套用 repository 的兩份 COD migration，版本對齊 `20261021000000`、`20261022000000`。回讀 policy：`enabled=false`、`collection_enabled=false`、`starts_at=null`；新 RPC 僅 service_role 可執行。舊 webhook 呼叫仍可省略有預設值的新參數。
- Vercel Production 光貿 release=false，四個新 COD 旗標未設定，依程式預設關閉。移除尚未啟用的五分鐘 COD cron，保留既有每日發票排程；啟用時需另驗證並加入 COD 排程及告警。
- 正式 Vercel 部署 `dpl_828qF5PhmSVSWHxvCkw6GHG8gYZP` READY，SHA 為上述 merge commit，`lucissicare.com`／`www.lucissicare.com` alias 已指向此部署；crons 回讀只有既有每日光貿工作。公開站檢查 24 pass／0 fail，COD API 未授權請求回 401。這只證明部署及存取邊界，不是收款或開票驗收。
- Supabase Edge `amego-invoice-dispatch` v3、`shopify-orders-webhook` v9 已部署 ACTIVE，保留既有驗證模式及程式內 token／HMAC 檢查；前者新增禁止 Edge 首次開立 COD 的防護。DB 回讀 collection evidence=0、COD invoice jobs=0，關閉政策下 claim 回 null。
- 本輪新增變更只有排程配置與文件，相關 22 項 API／webhook／訂閱測試通過。沒有新增 Shopify 物流訂閱、修改 Flow、建立訂單、收款或開票。正式實單及供應商金額條件仍待完成。

## 已完成：main CI 與 Vite

- 原 main `b6dffb6` 的 [CI 39585929256](https://github.com/charlie6989/saengak_web/actions/runs/39585929256) 在 moderate audit 因 Vite 7.3.6 的 launch-editor advisories 失敗；其他檢查通過。
- [PR #74](https://github.com/charlie6989/saengak_web/pull/74) 將 Vite 固定為 7.3.7 並同步 lock，保留完整 audit gate。PR CI 通過後合併為 `b3ed00878aec4168bb142073aca2d73e849025d6`；[main push CI 39857072277](https://github.com/charlie6989/saengak_web/actions/runs/39857072277) 全數成功，包含 Node 22 乾淨安裝、測試與 audit。
- 本機 npm 11 乾淨安裝、typecheck、57 檔／528 項測試、build、content（179 檔）、Supabase 靜態檢查通過；audit 0 vulnerabilities。既有大 chunk 警告仍存在。
- Vercel 正確 CARE 專案 `saengak-web-d2ux` 的正式部署 `dpl_5MLpnV8bzCcDLiYPc75CeRVhGtPg` 已 READY，SHA 為上述 main，alias 包含 `lucissicare.com`。2026-10-23 05:28 執行 `npm run verify:production`：24 項通過、0 失敗。這只確認公開路由、資產、安全標頭及拒絕無授權請求等表面行為，沒有測試正式交易。

## PR #73 審查處理

- 初次讀取遠端 head `a9af605`：Draft、有衝突，沒有 review threads 或 comments。已將 main 合併進 PR 分支，解決 `PROJECT_MEMORY.md`、`PROJECT_STATUS.md`、`LOGISTICS_PAYMENTS_PLAN.md` 的三處文件衝突，保留光貿正式配置／部署與 ShipAny 後續調查紀錄。
- 審查範圍：Webhook 原始本文簽章、商店與事件識別、耐久去重與撤回、訂單／整單履約／金額核對、DB 權限與關閉政策、發票最後放行、防重查回、獨立付款 lease、取消退款競態及管理員唯讀入口。
- 修正一項維運啟用邊界：原 PR 將兩個 COD 物流 topic 加入一般 webhook 同步的預設清單。現在普通同步只處理既有六種 topic，COD 須明確指定 `--include-cod-collection`；新增 CLI 無憑證 dry-run、既有訂閱不重建與衝突目的地阻擋測試。本輪未建立／修改 Shopify 訂閱。
- 更新訪客上線清單中「未實作／尚無黑貓契約確認」的過時敘述；逐單指定 COD 額及送達時生效版本仍待確認，不勾選實單驗收。
- PR 保留 Draft、分支自動部署仍關閉，未合併 PR #73。API、付款、UI 及 amount-mapping 旗標預設 false；DB collection policy 預設 false。尚未部署新程式或套用正式 migration。
- 部署順序是實際相容性條件：新版 webhook 傳入新增的 `p_invoice_context`，必須先準備相應 migration，再部署接收端；僅關閉 COD 旗標不能讓舊 RPC 自動接受新參數。

## 本輪 PR 分支驗證

- 合併 main 後原有 62 檔／619 項 Vitest 通過；維運邊界修正另增 3 項測試，最終 63 檔／622 項通過。typecheck、build、content（180 檔）、Supabase 靜態檢查通過，audit 0 vulnerabilities；遠端結果以 GitHub CI 為準。
- 隔離本機 PostgreSQL `cod_invoice_tests_20261023` 套用所需 migration：286 項 pgTAP、10 項真實多連線競態通過。未對正式 Supabase 或原本機應用 DB 套用 migration。
- 本機副本還原時只有四個既有 `graphql_public.graphql` extension ACL 缺項；其餘還原完成，11 組 pgTAP 完整 rollback，競態測試使用副本內的假資料。這不是正式物流／收款證據。
- 專案 `npm run typecheck` 不遍歷所有 referenced projects，不宣稱完整 TypeScript 零診斷。無實單、外部告警、排程處理量或瀏覽器完整回歸驗證。
- 遠端修正提交 `5c731e7` 的 [PR CI 39857982260](https://github.com/charlie6989/saengak_web/actions/runs/39857982260) 與 [branch CI 39857976912](https://github.com/charlie6989/saengak_web/actions/runs/39857976912) 均成功；GitHub 回讀 MERGEABLE、Draft=true，審查紀錄 `5621134303` 已提交。測試後已刪除本輪建立的本機拋棄 DB；原應用 DB 未修改。

## 正式狀態：本輪直接讀回

| 系統／來源 | 本輪證據 | 能證明的範圍 |
|---|---|---|
| CARE Supabase `tmqzkagkrzhioftvwbqo` | guest=false；運費 146／免運門檻 1500；最新 migration `20261019215834`；新 COD policy／evidence 表不存在 | 訪客與新 COD 自動化尚未啟用；沒有套用 PR #73 migration |
| CARE Shopify 訂單頁 | 10 筆舊訂單，最新 #1010；#1008–#1010 顯示已退款 | 尚無新的指定驗收訂單；不能將舊沙盒訂單作正式收款證據 |
| CARE 訂單投影 | 最新 #1010／#1009 cancelled/refunded；本輪查詢的四筆投影均沒有 fulfillment／invoice | 缺少可核對的實單物流、發票鏈路；這不是對所有 Shopify 訂單同步完整性的驗收 |
| Vercel Production | `AmegoInvoiceReleaseEnabled=false`；新 COD 四個旗標皆未設定；main 新部署 READY | 放行設定維持關閉。設定讀回及部署成功不代表正式光貿 API／寄信已驗收 |
| ShipAny Email | 10/22 15:59 是搜尋所得最新供應商回覆；原討論串最後一封為 18:44 技術追問 | 未收到追問後的 API schema、生效 COD 額與版本答覆；本輪沒有寄信或訂閱 API Pro |

Vercel MCP 在此團隊讀專案回 404；既有 CLI 成功定位 ID `prj_ZgDfZyy7zQB0ngJzCzsIhD88mw5E` 並完成唯讀回查。Shopify 連接器仍連母站 LUCISSI，因此 CARE 訂單清單使用正確商店的既有 Chrome 後台登入查看。沒有切換連接器或取用另一店資料代替 CARE。

## 仍阻擋正式驗收

1. **正式金流**：沒有指定實單或核定的測試金額。10/22 紀錄顯示 TapPay 正式 MGID 為 0、金流開通基本資訊未完成；本輪未重新登入 TapPay Portal，不能當作即時狀態，需在付款前刷新。使用者執行真實刷卡／付款後，才有收單端 transaction/capture 與 Shopify `test=false` 可交叉核對。
2. **黑貓金額來源**：運單 COD 額可獨立修改，而目前 adapter 只讀 Shopify 訂單總額。須取得原運單的可信、生效 COD 額及送達時版本，不能只把 `COD_SHIPANY_AMOUNT_MAPPING_VERIFIED` 改 true。實際 service GID、tracking company、shipping code 及完整貨件映射仍無樣本；[Shopify Fulfillment 文件](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Fulfillment) 的 service 可為 null，不能猜測識別值。
3. **發票**：正式 release=false；唯一開票來源、會計時點／跨期、光貿服務續用與 11–12 月字軌仍須驗證。10/21 帳務／字軌是歷史紀錄，本輪未刷新或繳費。不能以 Auth 郵件送達替代發票通知／財政部存證。
4. **切換**：需先盤點舊 Flow、在途／既有發票、切換界線，確認排程方案、權限、告警與退款處理責任；不得在證據未齊時交運後期待自動流程補救。

## 實單證據表（全部待執行）

| 驗收 | 必須取得的交叉證據 | 狀態 |
|---|---|---|
| 正式金流收款 | 指定 CARE 訂單、test=false、金額／幣別；收單交易成功／請款狀態與 Shopify paid 一致 | 待指定訂單及使用者付款 |
| 訂單同步 | 同一 Shopify GID 在 CARE orders／items／折扣／運費正確；重送不重複，亂序不倒退 | 尚無正式樣本 |
| 黑貓草稿與交運 | 訂單折扣後含運應收＝原 ShipAny 運單生效代收額；唯一託運號、版本、服務與完整品項 | 等規格與首筆實單 |
| 送達代收與付款投影 | 同一運單 DELIVERED＋當時生效金額證據；Shopify paid 回讀；ShipAny 撥款獨立核對 | 待真實配送／代收／月結 |
| 光貿發票 | 唯一 OrderId、正式發票號碼、金額與載具／統編／捐贈偏好正確；provider 與 CARE 投影一致 | release 關閉，未開票 |
| 通知與存證 | Shopify 訂單通知、光貿發票通知實際收到及財政部存證結果 | 未驗收 |
| 付款失敗／逾時 | 無誤標 paid；逾時先查原交易；不得二次扣款 | 待受控正式驗收 |
| 未付款／拒收／取消 | 非 COD 未付款不得出貨；未開票取消不開票；拒收不標 paid；撤回送達轉查核 | 本機測試通過，實際操作待驗收 |
| 全額／部分退款與跨期 | 收單退款結果／金額、Shopify refunded 或 partially_refunded、CARE 同步、發票作廢／折讓及通知一致 | 待指定交易與退款範圍 |

上述正式金流與黑貓實單完成後，才推進訪客結帳的正式 hostname／真人 Turnstile／資料保存決策、手機桌機與認領驗收，再另做全家方案／選店／門市資料／運費／實際取貨付款與退款驗收。全家到店狀態不得沿用黑貓 DELIVERED 收款語意。
