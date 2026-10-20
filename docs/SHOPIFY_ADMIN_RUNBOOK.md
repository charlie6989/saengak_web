# Shopify 後台資料維護手冊

2026-10-18～19 經 Chrome 已登入的 Shopify 後台（商店 `gh2xgs-zf`，使用者授權）實際修改商品資料時，可行的做法與踩過的坑。寫入一律先給使用者看清單、核可後才套用，寫完再回讀確認。當次寫入的內容記錄在 `docs/shopify/`。

## 共同原則

- **不要手打要寫入的文字**：清單先存成 JSON，並用同一個雜湊函式算出每個值的雜湊；頁面內寫入前比對雜湊，不一致就停止。曾因手動轉寫把「瀝水孔」存成「瀕水孔」。
  ```js
  const h = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.codePointAt(0)) >>> 0, 7);
  ```
- **填值用原生 setter 加事件**，不要用 `execCommand('insertText')`，它曾把字打進品名欄：
  ```js
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
  ```
- **欄位多在 shadow DOM 裡**，用遞迴查找：
  ```js
  const deep = (root, sel) => { const out = []; const walk = (r) => { r.querySelectorAll(sel).forEach((e) => out.push(e)); r.querySelectorAll('*').forEach((e) => e.shadowRoot && walk(e.shadowRoot)); }; walk(root); return out; };
  ```
- **儲存**：頂部列「儲存」按鈕。填完先等約 1 秒再按；有時第一次按不生效，要確認出現「商品已儲存」，或「未儲存的變更」已消失。頁面還有未儲存變更時離開，會跳出 Leave site 對話框。
- **座標換算**：截圖座標與頁面 CSS 像素不同（2026-10-19 的視窗是截圖 = CSS × `1568 / innerWidth` ≈ 0.918），用 JS 算出位置後要換算再點。
- **回讀**：後台 JSON（`/store/gh2xgs-zf/products/<id>.json`、`/products/<id>/metafields.json`，在後台分頁內以 `fetch(..., { credentials: 'include' })` 讀取），以及公開 Storefront API（`node scripts/shopify-product-snapshot.mjs` 會匯出全部商品）。

## 各欄位做法

### 商品內容 JSON 欄位（`custom.size_chart`、`lifestyle_showcase`、`craft_details`）
- 元件是 `s-internal-quick-json-field`。用 textarea 開頭內容找出要改的欄位（例如以 `{"columns"` 或 `[{"size"` 開頭）。
- 要先點 shadow root 裡 `s-internal-quick-activator` 內的按鈕打開對話框，用原生 setter 填 textarea，再點 `slot="primary-action"` 的按鈕確認，最後存檔。

### 標籤
- 用「編輯標籤」按鈕打開挑選器：搜尋後取消勾選來移除；搜尋不到時點「新增「X」」建立新標籤，挑選器會自動關閉，要再開一次才能加下一個。滑鼠移上去出現的 × 曾移除到錯誤的標籤。

### 說明（descriptionHtml）
- 編輯器工具列的「顯示 HTML」切到 HTML 模式後是 CodeMirror：`deep(document, '.cm-content')[0].cmView.view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: html } })` 可整段替換；切換按鈕在 HTML 模式下的 aria-label 會改變，要用截圖位置點回一般模式再存檔。

### 清單型欄位（list.single_line_text_field，例如重點、使用方式）
- 元件是 `s-internal-quick-list`，每條是一個 `s-internal-quick-text-field` 內的 input，可直接用原生 setter 填。要增加條數時點 shadow root 裡 `accessibilitylabel="新增"` 的按鈕；一次只會多一條空白，填好後才能再加，按鈕也會重新產生，每次都要重新抓。

### 規格（選項）名稱
- 在「子類」區塊點選項列打開編輯器，選項值是一般 input，改完按「完成」再存檔；variant ID、SKU、價格與庫存不變。

### 大量內容的寫入
- 內容較多時，把 JSON 檔放進頁面上的代理 `<input type=file>`（Chrome 檔案上傳工具），在頁面內 `await file.text()` 讀取，免去手動貼上；讀入後先比對每個值的雜湊。

### SEO（搜尋引擎產品資訊）
- 卡片在頁面最底部，要捲到底才會渲染；標題文字在 shadow DOM 裡，`querySelectorAll` 找不到。
- 編輯鉛筆是 `deep(document, 'button')` 中 `aria-label="編輯"` 的最後一個可見按鈕，直接 `click()` 即可。
- 欄位：`input[name=seoTitle]`、`textarea[name=seoDescription]`。網站的商品頁標題、meta／og description 與分享預覽都會讀這兩個欄位（`src/lib/productMeta.ts`、`api/share/product.ts`）。

### 商品類別（Shopify 標準分類）
- 「類別」下拉在多媒體區塊下方。把標籤 `類別` 捲到畫面中央後，下拉框位置固定；點開後搜尋框會自動取得焦點。
- 搜尋要用繁中分類名稱（官方對照表：Shopify/product-taxonomy 的 `dist/zh-TW/categories.txt`）。
- 選項在 shadow DOM 裡，程式抓不到，要看放大截圖後依列位置點選。同名分類會有多列，例如搜尋「三角褲」依序是幼兒／女童／男童／女用／男用，女用在第 4 列。
- 選好後欄位會顯示「三角褲 於 女用內衣褲」這種「分類 於 上層」的標籤，確認後再存檔。有些商品下方會出現 Shopify 建議的分類，點建議列也可以套用。

### 商品圖片（多媒體）
- 上傳：在頁面放一個代理 `<input type=file>`，用 Chrome 的檔案上傳工具把本機檔放進去，再用 `DataTransfer` 轉給 `s-internal-drop-zone` shadow root 內 `multiple` 的 file input，觸發不冒泡的 `change` 事件。新圖會排在最後。
- 圖片超過約 8 張時格子會收合成「+N」，要先點開，才找得到新圖。
- 排序：以 PointerEvent／MouseEvent 模擬拖曳（pointerdown → 20 次 pointermove → pointerup）到目標格，再讀縮圖檔名確認順序。
- 移除：勾選框要滑鼠移到圖上才會出現，用 JS 點勾選框不可靠，要用實際滑鼠點。勾選後區塊標題會變成「已選取 N 個檔案」（找區塊的程式要一併認得這個標題），右側出現「移除」。移除只是從商品拿掉，檔案仍在 Shopify 檔案庫；原圖也保存在 `creative/`。
- 製圖規範與工具：`docs/PRODUCT_IMAGE_STYLE.md`、`scripts/product-images/`；組合商品圖件數必須符合實際內容物（`creative/product-v1/bundle-fix/`）。

### 庫存
- 零庫存仍可下單的原因是規格的 `inventory_management` 為空（沒有追蹤庫存），不是庫存政策。上架規格都要開啟追蹤，並設為售完停止販售。可用後台 `products/<id>.json` 檢查 `variants[].inventory_management` 與 `inventory_policy`。

## 原廠資料來源（NAS，唯讀）

- 用 `node scripts/nas-readonly.mjs`（`ls`／`find`／`stat`／`get`）讀取，連線設定與密碼來自本機 env 檔與 Keychain，不進 Git。
- LUCISSI 內著尺寸圖：`/新品設計圖-eva/<SKU>/02-產品尺寸圖&細節圖&體驗圖/`。部分款式在蝦皮（`/01.buyyui設計/01.台灣蝦皮-Lucissi/…/<SKU>/`）或 MOMO（`/01.buyyui設計/06.台灣Momo/<SKU>_MOMO/`）資料夾。各 SKU 的 `Links/` 有供應商原始圖，包含原始尺码建议表。
- SAENGAK 原廠商品照（凝膠單支袋、濕巾單片、慕斯）在 `/saengak_kr/innersaengak image (2).zip`；其他原廠照與詳情頁在 `/saengak_kr/產品1`–`產品5`；證書與成分表見 `docs/PROJECT_MEMORY.md`。
- 商品 ID 與母 SKU 的對應見 `docs/shopify/size-charts.json`。

## 尚需使用者處理（2026-10-19）

- TapPay 在 Shopify 付款設定仍是測試模式，刷卡不會實際收款；PayPal 設定未完成。


## 黑貓 COD 全自動收款後開票（最新方案，未實作）

使用者已改選客人收貨付款後全自動開票。最新 [代收開票方案](COD_COLLECTION_INVOICE_PROPOSAL.md)取代下方人工出貨核准流程；ShipAny 收款介面與 DELIVERED 全額保證未確認，現有 Flow 的 paid 不可當獨立代收證據。正式設定未改，不能照下方舊 SOP 啟用。waaship 不列入新流程。

## 黑貓 COD 整單出貨作業草案（2026-10-21，歷史實作，已由新方向取代）

程式與限制見 [COD 修改方案第 9 節](COD_INVOICE_CHANGE_PLAN.md#9-第一階段實作與審查邊界2026-10-21)。正式切換前仍須完成會計、Flow 與唯一開票來源驗收。

1. 查核最新 Shopify 訂單：CARE、標準 COD、非測試、pending、未履約／未取消，核對所有品項、整單金額與發票偏好。部分付款／拆單／已建立 fulfillment 先走人工處理。
2. 倉庫確認黑貓常溫包裹、全量品項與託運號，在管理頁查詢後確認整單出貨並開票。此動作有開票副作用，只有正式另行放行後才能操作。
3. 確認狀態 issued 且有發票號碼，再銜接實際交運；pending／failed／provider_pending 都不等於已開立。逾時先查同一工作，不重建訂單、不重建開票工作；超過 10 分鐘、改單或取消交值班人員查核，已交運例外交會計處理。
4. 留存交運、發票／通知／存證及後續代收證據。付款必須依代收成功與全額核對；ShipAny 批次、費用及銀行淨額獨立對帳。現行 Flow 沒有因本 PR 改變，必須在正式切換時另行驗證與調整。
5. 已開票後拒收／取消／退款，先查 provider，再依會計規則審核作廢／折讓；不能直接把發票狀態當付款或銀行入帳狀態。


PR #73 複審補充：到期以伺服器實際時鐘判斷，畫面列出期限；10 分鐘約束新的開票授權，已送出工作仍可回查。終態或作廢工作不會從出貨按鈕再次派送。若 ShipAny／waaship 在產生單號時已建立 fulfillment，請停止並查核事件順序，不能刪除履約來繞過限制。已送出後遇取消／改單須查回光貿並按會計規則處理，不能假設可撤回外部請求。
