---
name: upload-products-to-shopify
description: 使用 Shopify App Admin API (Client Credentials Grant 動態憑證) 自動化批次上架商品。自動解析指定目錄下的文案 (CSV / Markdown / _URL.txt) 與無品牌高清圖檔，依截圖或指定售價/數量精準更新商品，透過 GraphQL stagedUploadsCreate 與 productCreate 快速完成商品建立。
---

# Upload Products to Shopify Skill (Shopify 商品自動化上架與文案產出技能)

當使用者在對話中輸入 `/upload-products-to-shopify <目錄路徑>`，或提出「幫我上架商品」、「上架此資料夾」、「產出文案並發布到 Shopify」時，AI Agent 必須遵循本技能的標準資料處理與文案產出規範，並**主動呼叫 `run_command` 執行上架程序**，回報商品連結與規格狀態。

---

## 🏷️ 1. 商品分類規範 (Strict Category Classification Protocol)

所有產出之文案 CSV（`Type` / `Product Category` 欄位）及 Shopify 後台商品類別，**一律強制歸類為以下 5 大主要分類之一**；若無法符合則標記為 `未分類`：

1. **`女性護理`**：私密保養、女性護理噴霧、緊緻精華等護理用品。
2. **`每日清潔`**：私密沐浴露、潔淨慕斯、日常清潔等用品。
3. **`深層修護`**：深層修復精華、高階修護膜、滋潤滋養系列。
4. **`舒適穿著`**：純棉內褲、無痕內褲、生理安全褲、蕾絲內衣、居家穿著。
5. **`益生菌私密舒緩凝膠`**：專屬益生菌私密凝膠、舒緩保濕凝膠品項。
* **`未分類`**：無法匹配以上 5 項之商品，填寫 `未分類`。

---

## 📄 2. 資料來源處理與品牌中立化規範 (Data Source Ingestion & Neutrality Protocol)

> [!IMPORTANT]
> 本規範嚴格對齊 [`shopify-universal-csv`](../shopify-universal-csv/SKILL.md) 核心標準。

### 2.1 資料來源角色界定 (內部參考 vs 前台文案)
- 目錄下的 `_URL.txt`、`來源資訊/`、AiPrice 下載文字檔、截圖 OCR 文字與原圖檔，**僅作為 AI 萃取「真實顏色、尺寸、庫存數量、價格」的內部依據**。
- **嚴禁行為**：絕對不可將內部來源字樣（如「來源店鋪：LUCISSI...」、「商品來源：蝦皮商品頁」、「蝦皮賣家後臺確認庫存」、「蝦皮售價」等）寫入公開前台的 `Body (HTML)`、`Title`、`Tags` 或 Shopify 商品資料中！

### 2.2 嚴格品牌中立與去識別化
- **全面移除**：原品牌名稱（如 `LUCISSI`、`medion` 等）、來源平台字眼（如 `蝦皮`、`Shopee` 等）、內部賣場代號、Emoji 表情符號（如 🌹、✨、🌸、🎀 等）、以及「現貨」、「24小時出貨」等拍賣促銷字樣。
- **統一品牌與狀態**：
  - `Vendor` 一律固定填寫 **`SAENGAK`**。
  - `Published` 預設為 **`FALSE`**。
  - `Status` 預設為 **`DRAFT`**（待審核草稿）。

---

## ✍️ 3. Shopify 高質感結構化文案產出規範 (Rich Copywriting Protocol)

依據 [`shopify-universal-csv`](../shopify-universal-csv/SKILL.md) 類別路由標準，產出專業、優雅且具說服力的繁體中文電商文案：

### 3.1 商品標題命名原則 (Title Format)
- 格式：`[核心品名] [版型/特色亮點] [多色/多尺寸可選]`（以**半形空白**分隔，不使用 `｜` 符號）
- 範例：`細帶簡約純棉女款內褲 親膚透氣雙層底襠 多色可選`、`高腰蕾絲無痕女內著 優雅貼合日常款 多尺寸選擇`。

### 3.2 商品描述結構 (Body HTML Standard)
必須包含以下 4 大結構化 HTML 區塊，不可留空或隨意填寫：

```html
<p>[商品簡介段落：優雅描述商品核心設計、面料觸感、穿著/使用體驗與版型優勢，約 60-120 字]。</p>

<h3>商品特色</h3>
<ul>
  <li><strong>[特色 1]</strong>：[說明重點，如親膚面料、透氣排汗等]。</li>
  <li><strong>[特色 2]</strong>：[說明重點，如立體剪裁、無痕貼合等]。</li>
  <li><strong>[特色 3]</strong>：[說明重點，如多色系設計、細緻車縫等]。</li>
</ul>

<h3>規格說明</h3>
<ul>
  <li><strong>商品材質/成分</strong>：[主面料與細節材質，如 95% 棉 + 5% 彈性纖維；底襠 100% 棉]</li>
  <li><strong>商品版型/規格</strong>：[如 低腰細帶半包臀款 / 30ml 凝膠]</li>
  <li><strong>商品顏色/款式</strong>：[列出實際提供之選項]</li>
  <li><strong>尺寸建議</strong>：[如 M (40-50kg) / L (50-60kg) / XL (60-70kg)]</li>
</ul>

<h3>洗滌與保養建議</h3>
<p>[提供中肯之洗滌方式或保存方式，例如：建議使用冷水與中性洗劑手洗，或裝入細網洗衣袋機洗；請置於陰涼通風處自然晾乾]。</p>
```
*(註：保養/清潔品項第四區塊為 `<h3>使用方式與注意事項</h3>`)*

### 3.3 類別安全宣稱準則 (Compliance Guidelines)
- **女性保養品/私密凝膠**：清楚整理適用部位、容量、成分、使用步驟與保存方式；**嚴禁自行產生醫療、美白、抗痘、殺菌或 100% 療效保證宣稱**。
- **女性衣著/內著**：如實整理款式、尺寸、顏色、材質與版型；**不自行捏造未確認之特殊機能**。

---

## 💰 4. 價格、庫存、多規格與 SKU 規範 (Pricing, Inventory & Multi-Variant Protocol)

1. **價格判定優先級**：
   - 使用者指示 > 截圖/原網頁真實售價 > 來源檔案數值。
   - `Variant Price` 填入實際售價；`Variant Compare At Price` 填入劃線原價（若無則留空）。
2. **多規格排列 (Multi-Variant Dimension)**：
   - 內著類使用：`Option1 Name=顏色`、`Option2 Name=尺寸`。
   - 保養品類使用：`Option1 Name=規格` 或 `容量`。
   - 每個規格組合獨立一列，並填入由來源資訊比對出之真實 `Variant Inventory Qty`。
3. **防超賣與庫存追蹤**：
   - 上架時規格一律配置 `inventoryPolicy: DENY`（售罄即止）並啟用 `tracked: true`。
4. **唯一 SKU 自動編碼**：
   - 上架腳本自動依分類代碼（如 `SG-CW-...`、`SG-WH-...`）產生唯一 SKU，確保與 ERP 系統無縫對接。

---

## 📁 5. 標準目錄結構規範 (統一存放於 `product/` 下)

```text
product/
└── <商品專屬資料夾名稱>/
    ├── shopify-new-product.csv  # 標準 Shopify 格式文案 (繁中標題、Rich HTML、SAENGAK Vendor、多規格)
    ├── _URL.txt                 # 商品來源網址與原圖連結紀錄 (內部參考)
    ├── 來源資訊/                # 原始抓取資訊 (內部參考，非前台文案)
    ├── 主圖/                    # 高清去品牌無痕修復主圖 (主圖_01_無品牌.jpg ...)
    └── 規格圖/                  # (選用) 高清規格選單圖 (規格_01_無品牌.jpg ...)
```

---

## 🤖 6. AI Agent 自動執行三部曲 (Execution Workflow)

當收到處理或上架請求時，AI Agent 需依序執行：

### 步驟 1：圖片清理與去品牌化
若目錄尚未修圖，主動執行修圖腳本：
```powershell
python ".agents/skills/clean-product-images/scripts/clean_product_images.py" "<目標目錄路徑>"
```

### 步驟 2：解析來源資料並生成標準 CSV
依據 `shopify-universal-csv` 標準，讀取 `_URL.txt` 與來源規格，產出符合規範之 `product/<商品名稱>/shopify-new-product.csv`（包含去識別化標題、高品質結構化 HTML 內文、顏色/尺寸多規格列與對應庫存）。

### 步驟 3：主動執行上架與發布
```powershell
node ".agents/skills/upload-products-to-shopify/scripts/upload_shopify_product.mjs" "<目標目錄路徑>"
```
- **執行動作**：
  1. 使用 Client Credentials Grant 自動換發 24 小時動態 Token。
  2. 上傳 `主圖/` 與 `規格圖/` 高清圖片至 Shopify 媒體庫。
  3. 自動建立商品草稿（`DRAFT`），寫入結構化 HTML 內文與多規格售價、劃線價、庫存與唯一 SKU。
  4. 自動查詢並透過 `publishablePublish` **全數發布至所有銷售管道 (Online Store, POS, Headless 等)**。
  5. 回報商品名稱、Shopify ID、規格明細、圖片數量與後台預覽連結。

---

## 💡 使用者呼叫指令範例

* `/upload-products-to-shopify product/細帶簡約純棉內褲_...`
* `請依 shopify-universal-csv 規範生成文案並上架此目錄：product/高腰蕾絲無痕內褲`
* `幫我辨識價格、去浮水印並上架 product/01_女性護理私密凝膠，售價 89 原價 109`
