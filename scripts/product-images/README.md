# 商品主圖製作工具（Ivory Studio）

規格見 `docs/PRODUCT_IMAGE_STYLE.md`；2026-10-18 第一批成果與來源在 `creative/product-v1/`。這些工具只在本機 macOS 執行，不屬於網站建置流程。

需求：macOS 14 以上（Vision 前景遮罩）、Xcode Command Line Tools（`swiftc`）、Python 3 搭配 Pillow、NumPy、SciPy。

```sh
swiftc -O scripts/product-images/cutout.swift -o .tmp/cutout
.tmp/cutout source.jpg .tmp/cut.png all          # 去背；all / largest / 指定 instance 編號
python3 scripts/product-images/clean.py .tmp/cut.png .tmp/clean.png --erase 0,0,0.2,0.3   # 清掉道具、貼紙
python3 scripts/product-images/studio.py out.jpg 1600 flat .tmp/clean.png                   # 內著平拍
python3 scripts/product-images/studio.py out.jpg 1600 stand a.png:1 b.png:0.55              # 直立商品／組合
```

- `cutout.swift`：Vision 前景遮罩，輸出透明 PNG。
- `clean.py`：以比例座標擦除道具（`--erase`、`--poly`）、只保留最大連通區塊（`--keep`）、用周圍布色填補小貼紙（`--patch`），並柔化邊緣。
- `studio.py`：合成到標準象牙背景（左上光池、梅紫調陰影），控制商品佔比與位置；多個去背檔會共用底線並排，`:比例` 為相對高度。
- `scene.py`：第二張圖（Daylight Linen）用，把去背商品放進 AI 空景。`stand` 模式依每件物品輪廓畫向右下的投影與落地接觸陰影（組合商品各自有影子），`flat` 模式為俯拍平放的柔和投影；用法與各件參數見 `creative/product-v1/second/PROMPT_TEMPLATE.md`、`provenance.json`。

原圖背景雜亂或道具壓在商品上時，先以原圖為參考交給影像模型重繪（提示詞範本在 `creative/product-v1/provenance.json`），再用同一套 `cutout` → `studio` 合成，讓所有主圖背景一致。
