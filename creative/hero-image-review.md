# SAENGAK 主圖改版規格

2026-09-08。已使用 Nano Banana 2（gemini-3.1-flash-image）生成六張情境圖及一張合成背景，並以 Photoroom 正式 API 保留真實噴霧商品主體合成。七張最終 WebP 已接入本機網站。已驗證 Gemini、Photoroom Sandbox 及正式 API；沒有把 Sandbox 圖放入網站。原始商品卡／Shopify 商品媒體未變更，未部署。

## 統一攝影方向

以現有網站奶油白 #F8F5F1、霧粉 #E7D6D4、梅紫 #5B3D48 為介面基礎；攝影採暖白、低飽和鼠尾草綠、淺木與棉麻。柔和側窗光、自然接觸陰影、真實材質，不做模糊拼貼或懸浮商品。文字由網頁呈現，避免生成文字和假包裝。

商品主體使用經確認的原始商品照：Photoroom 去背與邊緣處理，Nano Banana 2 製作符合內容且具留白的場景，再保留原商品主體合成並校正陰影。情境照可由 Nano Banana 2 直接生成；不為使用 API 而對完整人物情境做無必要去背。Sandbox 浮水印輸出只供預覽，不放入正式網站。

## 初始盤點與改圖規格（改版前證據）

| 位置 | 目前證據／風險 | 改圖內容與構圖 |
| --- | --- | --- |
| 首頁五張輪播 | Cafe24 遠端圖片；alt 未表達個別主題；mobile 欄位原本未使用。初始發現手機來源誤用；最終已改為本機主題輪播 | 逐張確認原產品與文案後，分別用日常照護、溫和清潔、外出攜帶、舒適穿著、品牌全系列構圖；每張主題須以商品資料為準。桌面與手機分別設計，避免只裁切寬圖 |
| 首頁「女性日常護理目錄」 | 原廠遠端橫幅上另覆蓋網頁文案，須確認原圖有無文字衝突 | 真實全系列商品置於下方或側邊；中央保留乾淨文字區，沿用柔和窗光 |
| 首頁 Solution 情境照 | Readdy 提示詞是一般女性居家照 | 成年女性於日常居家空間整理照護用品；自然動作與肌膚質感，不刻意擺拍；直式，底部保留標題區 |
| 首頁舒適穿著橫幅 | Readdy 提示詞含 antibacterial，與畫面可證明的內容無直接關係 | 真實內著或布料細節與折疊棉麻，呼應親膚、透氣、材質；不以圖像暗示抗菌認證；左右預留文案空間 |
| 首頁 SAENGAK Talk | 提示詞混用朋友談心與醫療諮詢情境 | 兩位成年女性在居家客廳自然交談，平視視角；避免白袍、診所和暗示專業資格；人物臉部遠離底部文案卡 |
| About 首圖 | 已目視：左側留白，右側多張產品照柔化拼貼，光線與比例不一致 | 保留左側文案留白；右側改為同一空間、同一光向的真實商品組合，減少拼貼感 |
| About about-care | 本機既有商品素材，尚待逐張檢視 | 商品與日常照護場景；維持原標籤、瓶型、比例 |
| About daily-companion | 本機既有素材，尚待逐張檢視 | 外出收納情境，尺寸以真實商品為準，避免生成誤導攜帶比例 |
| About innersen-balance | 本機既有素材，尚待逐張檢視 | 先確認品牌及商品歸屬，再用安靜居家場景呼應舒適與平衡 |
| Search 預設主圖 | 執行中使用 Readdy；本機 search-hero.jpg 已目視，含非實際瓶罐與不自然文字，不應直接作替代 | 使用已確認商品的全系列橫幅，避免以一般化妝品代替私密照護商品 |
| Search 分類：私密護理／日常清潔／深層修護 | 各自本機圖；分類和 Shopify collection 圖有覆寫優先順序 | 每類僅使用實際對應商品；以濕潤陶瓷、乾爽棉巾等區分情境，不暗示未證實療效 |
| Search 分類：舒適穿著 | 已目視：棉麻布料自然、色調接近整體 | 可保留材質方向；要展示具體商品時改用對應原始內著照片 |
| Blog：日常私密護理 | 已目視：毛巾、碟子、葉片，色調自然但資訊指向較弱 | 簡潔洗手台與乾淨毛巾呼應日常清潔，植物僅作背景，不暗示配方成分 |
| Blog：內著選購指南 | 本機既有素材，待檢視 | 真實布料織紋與車縫細節，呼應透氣、摩擦、洗護 |
| Blog：編輯透明原則 | 本機既有素材，待檢視 | 桌面、筆記與原始商品標籤的查閱情境；避免虛構證書或研究報告 |
| 其他 Blog／Community 文章 | Shopify 動態文章圖與通用 fallback | 依文章 handle／主題指定情境圖，避免所有文章缺圖時都套清潔主題 |
| 商品詳情、商品卡、促銷 | Shopify／後台動態圖片 | 逐 SKU 核對真實包裝、變體、容量、顏色後才加工；不批量覆寫商品來源資料 |
| 登入相關頁 | 重設密碼的 Readdy 圖經核對是品牌 Logo，應保留 | 同色系安靜居家環境，避免商品廣告與身份驗證表單競爭 |

StorySection 目前未由首頁引用，brand-story 路由導向 About，應避免替未使用元件重複製圖。product-preview 的 Unsplash 圖也需先確認是否為實際公開路徑及用途。

## 生成提示詞共用約束

Editorial lifestyle photography for a Korean feminine daily-care brand. Warm ivory, muted sage, subtle dusty rose, pale wood and natural cotton. Soft window light from one consistent direction, realistic texture and contact shadows. A coherent everyday setting with restrained props. No embedded text, invented logos, certificates, exaggerated clinical claims, floating objects, collage seams or over-smoothed skin. Preserve every supplied product's original packaging, label, shape, color and proportions. Compose around the actual page copy and a separate mobile safe area.

每張補上：段落標題、正文摘要、真實產品參考、場景動作、主體位置、文字安全区、桌機／手機比例、禁止改動項目。

## 驗收

- 逐張對照相鄰文案、分類及商品資料，校對包裝文字與比例。
- 同時檢查桌機與手機裁切、文字對比、主體是否被 Header 或文案遮擋。
- 檢查手指、瓶口、布料邊緣、透視、陰影與拼接。
- 新圖以版本化檔名存入 public/images；保留來源、提示詞、模型與處理紀錄，不記錄金鑰。
- 最終圖通過視覺檢查後才更換來源；檢查載入、尺寸及格式，不使用 Sandbox 圖作正式素材。

## API 前置條件與文件

需要在本機 .env.local 設定 GEMINI_API_KEY，不得加 VITE_ 前綴。Photoroom 金鑰僅供本機／伺服器端流程，不能寫入前端與此文件。

- Gemini 圖像 API：https://ai.google.dev/gemini-api/docs/image-generation
- Photoroom API：https://docs.photoroom.com/
- Photoroom Sandbox：https://docs.photoroom.com/image-editing-api-plus-plan/sandbox-mode


## 最終實作

- 首頁五個主題：日常清潔、真實噴霧商品、舒適材質、女性對話、品牌理念。加入可讀中文標題與目的地、暫停與手動切換，遵循減少動態效果設定。
- 首頁目錄、Solution、Talk、About 四處圖片、Search 分類及三篇既有文章封面使用本機七張 WebP；文章依 handle 對應，未知文章仍保留其原封面，無封面才用中性編輯圖片。
- 手機首頁圖片與文案分區，About 手機商品圖也與文字分開，避免遮住商品。首頁與 Search 補上固定 Header 的頂部空間。
- 凝膠分類使用不含其他商品的日常照護情境，避免誤放噴霧包裝。
- 品牌 Logo、動態商品卡、動態促銷圖與其他未知文章維持原來源；StorySection 未使用，不製圖；Instagram 靜態示意資料維持原樣。
- 最終素材總計約 1.25 MB；提示詞與來源見 hero-image-prompts.json、hero-image-provenance.json。商品主體直接取自商店噴霧原圖，未由 Gemini 重畫。

## 本機重製入口

金鑰已保存在被 Git 忽略的 .env.local（權限 600），不含 VITE_ 前綴，不加入前端 bundle。scripts/hero-image-api.mjs 提供 generate、compose、photoroom 三種操作。generate 使用 Gemini；compose 使用 Photoroom 正式 API 去背、保留主體與加入柔和陰影；photoroom 可傳 sandbox 做預覽。輸出先寫入 .tmp/image-audit，目視驗收與 WebP 壓縮後才複製到 public/images/editorial-v2。

本輪 Photoroom 第一張居中合成未使用；右側 padding 0.56 曾返回 400，改用 paddingLeft 0.45、paddingRight 0.04、horizontalAlignment right 後成功。生成及加工均已實際執行，不只是串接範本。

## 驗證結果

TypeScript、Vite 正式建置及現有 website-modification-checklist 的 14 個測試通過。Playwright（本環境未提供 Browser 技能）於 localhost:3000 驗證 1440×1000 與 390×844；五張輪播、CTA 導頁、About、Search、Community、Blog 的新圖解碼與橫向溢出均檢查。建置仍有既有 bundle >500 kB 提醒；開發環境 favicon.ico 404 不影響主圖。dist 與 creative 共 50 個文字檔通過三組金鑰的洩漏掃描。
