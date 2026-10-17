# 第二張商品圖（Daylight Linen）提示詞範本與流程

訂定日期：2026-10-18。規格依據 `docs/PRODUCT_IMAGE_STYLE.md` 的「情境圖方向（第二張）」。本檔是試做（06、13、21、23）後整理的固定做法；成果圖與來源紀錄在同資料夾的 `provenance.json`。**尚未上傳 Shopify，等使用者核可試做。**

## 先選方法

| 商品類型 | 方法 | 理由 |
| --- | --- | --- |
| 內著、布料 | **A. AI 整張重繪**（以主圖＋原圖為參考） | 折疊後的布料形狀無法用去背照合成，需要模型重新擺放。 |
| 瓶罐、盒裝 | **B. AI 空景＋實品去背合成**（預設） | 包裝字樣與瓶身直接用原廠像素，不經生成模型，符合規範的「去背合成優先」。 |
| 瓶罐備選 | A. AI 整張重繪 | 光影較自然；試做中 21、23 的字樣核對正確，但仍屬生成像素，每張都要逐字核。 |

兩種方法的參考圖固定給兩張，順序如下：
1. `creative/product-v1/main/{編號}.jpg`（已上架主圖，提供正確外形與顏色）
2. 該商品 `provenance.json` 的 `source_image`（原廠照，提供細節；背景與道具要模型忽略）

Canva 匯入方式：兩張圖都在 Shopify CDN，用 `upload-asset-from-url` 匯入即可（主圖網址見 `creative/product-v1/provenance.json` 的 `shopify` 欄位檔名）。

## A. AI 整張重繪（內著）

```
Product photo edit for an e-commerce second image. Keep the exact same <garment> from the references: <顏色>, <布料>, <腰頭／蕾絲／印花／蝴蝶結等細節，逐項列出>, — identical color, fabric texture, <lace pattern / print / waistband lettering "<原字>">, cut and proportions. Do not redesign, recolor, respell or add anything to the garment.<若有字樣：If the lettering cannot be reproduced exactly, keep the waistband turned so the lettering is not visible rather than inventing letters.> Reference 1 is the clean studio shot (use for exact shape and color); reference 2 is the original photo (use only for <detail>; <show ONLY the <color> one;> ignore its <要移除的背景與道具>).
Scene: the <garment> <neatly folded into a soft square | laid softly folded in half> on a smooth ivory linen cloth with a natural fine weave, <a corner of pale blush linen (#E7D6D4) folded beneath on one side | a folded pale blush linen napkin (#E7D6D4) just beside it>, slightly overhead three-quarter angle showing <要特寫的細節>.
Soft natural daylight from the upper left, delicate soft shadows falling to the lower right with a faint plum tint, no hard black shadows. Calm, quiet, uncluttered; the <garment> is the clear hero, about 55–60% of the frame, centered slightly high, nothing cropped.
No <other> text, no logos, no stickers, no flowers, no pearls, no paper, no plants, no props, no other brands, no hands, no body. Square 1:1, photorealistic premium natural catalog photography, no haze, no yellow cast, no collage, no border, no watermark.
```

`aspectRatio: SQUARE_1_1`。輸出 1264×1264，放大到 1600×1600、JPEG q90。

## B. 瓶罐：AI 空景＋實品合成

1. 空景提示詞（不給參考圖）：

```
Empty product photography set, no product. <A pale warm stone washbasin ledge seen at eye level | A light oak vanity tray seen from a slight high angle>, <a neatly folded ivory linen hand towel with a fine natural weave | a soft open pale blush (#E7D6D4) linen zip pouch and a folded ivory linen cloth> at the far <left/right> edge, <a soft pale blush (#E7D6D4) plaster wall | an ivory linen-textured wall> behind. The center of the <surface> is completely clear and empty, ready for a <bottle> to be placed there. Soft natural daylight from the upper left, soft shadows to the lower right, no hard black shadows. Calm, quiet, uncluttered, premium natural catalog photography. No bottles, no products, no faucet, no plants, no flowers, no mirror, no text, no logos, no people. Square 1:1, photorealistic, no haze, no yellow cast, no border, no watermark.
```

2. 原廠照去背、合成（商品像素不動）：

```sh
swiftc -O scripts/product-images/cutout.swift -o .tmp/cutout
.tmp/cutout source.jpg .tmp/cut.png largest
python3 scripts/product-images/scene.py bg.png .tmp/cut.png out.jpg CX BASE_Y HEIGHT [CAST_LEN] [CAST_RISE]
# 試做參數：21 → 680 992 700 0.55 0.06；23 → 640 930 640 0.5 0.04（座標以 1264 空景為準）
```

`scene.py` 在整張畫布上算接觸陰影與向右下的投影（梅紫調），避免陰影邊界被裁出硬邊；輸出 1600×1600。

## Canva 匯出全尺寸

`get-generate-image-job` 只回 200px 縮圖。全尺寸做法：在自己的暫存設計（試做用 `DAHYTPORdmA`）`add_page` 1264×1264 → `insert_fill` 生成圖 → commit → `export-design` PNG。不要動其他工作階段的設計。

## 上架前必查（試做實際抓到的問題）

- **腰頭與包裝字樣逐字核**：13 的 AI 輸出把 CHESSOLYMPIAD 的 I 寫成小寫 i（已在原圖上手工改回大寫 I，只動那一個字母）。**已上架的主圖 13 也有同樣的小寫 i**，需對照實品確認是否要重做主圖。
- 瓶身「Saengak」的 k 本來就繞到瓶身側面，看起來像「Saengal」——原廠照也是如此，不算錯字。
- 合成圖檢查瓶底：接觸陰影要壓在瓶底下，不可浮空；投影邊緣不可有直線硬邊。
- 顏色對主圖：不調飽和、不美白；06 是偏淡紫的白，不可變成純白。
- 1:1 商品卡縮圖下主角仍清楚；無文字、貼紙、他牌道具、手或身體。
