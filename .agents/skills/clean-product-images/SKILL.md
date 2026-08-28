---
name: clean-product-images
description: 商品圖片去品牌名稱與浮水印處理。自動讀取目錄或 _URL.txt，下載 1024x1024 高清原圖並無痕修復浮水印，原圖有幾張就精準生成對應數量的無品牌高品質 JPG (*.jpg) 圖檔。
---

# Clean Product Images Skill (商品圖片自動去品牌與浮水印並轉 JPG)

當使用者在對話中輸入 `/clean-product-images <目錄路徑>`，或提出「去品牌名稱」、「去除浮水印」、「生成乾淨主圖」、「轉成 jpg」、「修圖」時，AI Agent 必須**直接主動呼叫 `run_command` 執行修圖程序**，無需讓使用者手動輸入指令。

---

## 📁 標準目錄結構規範 (統一存放於 `product/` 下)

所有商品圖檔處理一律存放於專案根目錄的 `product/<商品專屬資料夾>/` 下：

```text
product/
└── <商品專屬資料夾名稱>/
    ├── _URL.txt                 # 商品來源網址與原圖連結紀錄
    ├── 主圖/                    # 高清去品牌圖檔目錄 (修圖輸出位置)
    │   ├── 原始_主圖_01.webp     # 原始高清原圖備份 (1024x1024)
    │   ├── 主圖_01_無品牌.jpg    # 極致無痕修復後之標準 JPG
    │   └── ...
    └── 規格圖/                  # 高清去品牌規格選單圖 (修圖輸出位置)
        ├── 原始_規格_01.webp     # 原始高清規格原圖備份 (1024x1024)
        ├── 規格_選項_1_無品牌.jpg # 極致無痕修復後之標準 JPG
        └── ...
```

---

## 🚫 嚴格禁止事項 (Negative Invariants)

1. **嚴禁任何模糊、毛玻璃感 (Frosted Glass) 或邊界塗抹**：
   - 絕對禁止直接使用大範圍擴散式 Inpainting 抹平牛皮紙、布料或實景紋理。
2. **嚴禁繪製任何大面積實心方塊或側邊欄色塊**：
   - 絕對禁止在自然實拍圖上畫任何全高/寬幅的實心矩形色塊，避免破壞實景背景。
3. **嚴禁對無浮水印原圖做破壞性修改**：
   - 經檢測無任何文字或浮水印特徵的區域，必須 **100% 保持原始原圖像素與畫質**（0 像素更動）。
4. **嚴禁模糊或擦除左側規格文字**：
   - 底部規格橫條（如 MEDION 凝膠）左側之中文規格名稱、容量說明、顏色圓點等，必須 100% 清晰完整保留。

---

## 🤖 核心演算法與修復規範 (Flawless Texture Cloning Protocol)

所有圖片處理必須嚴格依循 [`clean_product_images.py`](file:///c:/Projects/saengak_web/.agents/skills/clean-product-images/scripts/clean_product_images.py) 的三大核心技術：

### 1. 多尺度模板精準鎖定 (Multi-Scale Template Matching)
- **浮水印模板資源**：使用 `resources/lucissi_template.png`。
- **比對機制**：使用 Canny 邊緣多尺度模板比對 (`cv2.matchTemplate` + `cv2.TM_CCOEFF_NORMED`)，精確辨識左上角與右下角浮水印的精確邊界框 $(x, y, w, h)$。
- **零誤判**：未達閾值之乾淨區域一律跳過，絕不觸發任何修改。

### 2. 緊鄰背景材質直接取樣擴展覆蓋 (Tight Adjacent Texture Cloning)
- **解決毛玻璃與模糊感**：
  - 捨棄純數值擴散的 Inpainting，改採**緊鄰環境背景材質取樣克隆**。
  - **取樣範圍**：嚴格控制在文字框周圍 **緊鄰 10~20px** 的同質背景（不多取、不外擴過寬），保持材質連續性。
  - **光影對齊**：自動計算取樣材質與文字底層的光影梯度差進行補償 (`color_diff`)。
  - **極微羽化**：僅在邊緣施加 1px 極微羽化，確保牛皮紙皺褶、纖維紋理與布料紋理 100% 清晰自然、零接縫。

### 3. 底部全幅橫條 Banner 嚴格識別
- **觸發條件**：
  - 底部最末數行色條標準差 $\text{std} < 12$。
  - 左側 ($x \in 5\%\sim 15\%$)、中間 ($x \in 45\%\sim 55\%$)、右側 ($x \in 85\%\sim 95\%$) 的色彩差異 $\Delta E < 6.0$（確認整條為全幅純色 Banner）。
  - 橫條高度合理（佔整圖高度 $10\text{px} < h_{\text{banner}} \le 16\%$）。
- **處理方式**：
  - 僅填補右側品牌區（$x \ge 52\%$），以橫條背景色平滑填色，左側中文規格品名 100% 完整保留。

### 4. 雙層原圖目錄搜尋順序 (Raw Asset Hierarchy)
1. 子目錄原圖：`主圖/原始_*.webp`、`規格圖/原始_*.webp`
2. 根目錄原圖：`主圖_*.webp`、`SKU 属性图_*.webp`
3. 遠端 HD 原圖：從 `_URL.txt` 自動下載 1024x1024 高解析原圖。
- 嚴禁在已被編輯過的舊 `.jpg` 上二度修圖。

---

## 執行指令

```powershell
# 單一商品目錄處理
python ".agents/skills/clean-product-images/scripts/clean_product_images.py" "product/<目標商品資料夾>"

# 全庫商品批次處理
python ".agents/skills/clean-product-images/scripts/clean_product_images.py"
```
