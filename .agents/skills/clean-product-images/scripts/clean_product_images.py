import os
import sys
import shutil
import urllib.request
import cv2
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

# 載入模板
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TPL_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), "resources", "lucissi_template.png")

tpl_img = None
tpl_grad = None
if os.path.exists(TPL_PATH):
    with open(TPL_PATH, 'rb') as f:
        arr = np.frombuffer(f.read(), dtype=np.uint8)
        tpl_img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if tpl_img is not None:
            tpl_grad = cv2.Canny(tpl_img, 50, 150)

def imread_unicode(p):
    with open(p, 'rb') as f:
        arr = np.frombuffer(f.read(), dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def imwrite_unicode(p, img):
    ext = os.path.splitext(p)[1]
    _, buf = cv2.imencode(ext, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    with open(p, 'wb') as f:
        f.write(buf)

def detect_watermark_in_roi(roi):
    if tpl_grad is None:
        return False, None
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi
    img_grad = cv2.Canny(gray, 50, 150)
    th, tw = tpl_grad.shape
    
    best_val = -1
    best_loc = None
    best_scale = 1.0
    
    for scale in np.linspace(0.7, 1.4, 8):
        rw, rh = int(tw * scale), int(th * scale)
        if rh > img_grad.shape[0] or rw > img_grad.shape[1]:
            continue
        resized_tpl = cv2.resize(tpl_grad, (rw, rh))
        res = cv2.matchTemplate(img_grad, resized_tpl, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        if max_val > best_val:
            best_val = max_val
            best_loc = max_loc
            best_scale = scale
            
    if best_val > 0.24:
        bw, bh = int(tw * best_scale), int(th * best_scale)
        bx, by = best_loc
        return True, (bx, by, bw, bh)
    return False, None

def patch_repair_box(roi, box):
    """
    極致無痕材質克隆：從緊鄰周圍背景（不擴展過寬過大）取樣真實材質紋理，
    消除 Inpainting 產生的毛玻璃/模糊感，100% 保留皺褶紙質與布料紋理。
    """
    rh, rw = roi.shape[:2]
    bx, by, bw, bh = box
    
    # 緊湊邊界，外擴 2px
    x1 = max(0, bx - 2)
    y1 = max(0, by - 2)
    x2 = min(rw, bx + bw + 3)
    y2 = min(rh, by + bh + 3)
    pw = x2 - x1
    ph = y2 - y1
    
    # 決定緊鄰取樣來源（優先緊鄰下方、其次緊鄰上方、緊鄰左方）
    if y2 + ph <= rh:
        sy1, sy2 = y2, y2 + ph
        sx1, sx2 = x1, x2
    elif y1 - ph >= 0:
        sy1, sy2 = y1 - ph, y1
        sx1, sx2 = x1, x2
    elif x1 - pw >= 0:
        sy1, sy2 = y1, y2
        sx1, sx2 = x1 - pw, x1
    else:
        sy1, sy2 = y1, y2
        sx1, sx2 = x2, min(rw, x2 + pw)
        pw = sx2 - sx1
        x2 = x1 + pw

    src_patch = roi[sy1:sy2, sx1:sx2].astype(float)
    target_roi = roi[y1:y2, x1:x2].astype(float)
    
    # 局部環境光影與色差校準
    color_diff = np.mean(target_roi[:2, :], axis=(0, 1)) - np.mean(src_patch[:2, :], axis=(0, 1))
    adjusted_patch = np.clip(src_patch + color_diff, 0, 255)
    
    # 極微 1px 羽化，確保邊緣完全無接縫且紋理完全清晰
    mask = np.ones((ph, pw), dtype=np.float32)
    mask[0, :] = 0.3
    mask[-1, :] = 0.3
    mask[:, 0] = 0.3
    mask[:, -1] = 0.3
    mask = cv2.GaussianBlur(mask, (3, 3), 0.8)
    mask = np.repeat(mask[:, :, np.newaxis], 3, axis=2)
    
    blended = adjusted_patch * mask + target_roi * (1.0 - mask)
    res_roi = roi.copy()
    res_roi[y1:y2, x1:x2] = np.clip(blended, 0, 255).astype(np.uint8)
    return res_roi

def clean_watermark(full_img):
    h, w = full_img.shape[:2]
    res = full_img.copy()

    # 1. 底部全幅橫條 Banner 檢測（如 MEDION 凝膠）
    is_bottom_banner = False
    bottom_strip = full_img[h - 10:h - 2, int(w * 0.4):int(w * 0.6)]
    if np.std(bottom_strip) < 12:
        c_left = np.mean(full_img[h - 5, int(w * 0.05):int(w * 0.15)], axis=0)
        c_mid = np.mean(full_img[h - 5, int(w * 0.45):int(w * 0.55)], axis=0)
        c_right = np.mean(full_img[h - 5, int(w * 0.85):int(w * 0.95)], axis=0)
        
        diff_l = np.linalg.norm(c_left - c_mid)
        diff_r = np.linalg.norm(c_right - c_mid)
        
        if diff_l < 6.0 and diff_r < 6.0:
            bg_color = np.median(bottom_strip, axis=(0, 1)).astype(np.uint8)
            banner_top = h - 1
            for y in range(h - 5, int(h * 0.75), -1):
                diff = np.mean(np.abs(full_img[y, int(w * 0.45):int(w * 0.55)].astype(float) - bg_color))
                if diff > 15:
                    banner_top = y + 1
                    break
            
            if 10 < (h - banner_top) <= int(h * 0.16):
                is_bottom_banner = True
                cv2.rectangle(res, (int(w * 0.52), banner_top), (w, h), bg_color.tolist(), -1)

    # 2. 左上角角隅浮水印檢測與緊鄰材質覆蓋 (LUCISSI)
    tl_h, tl_w = int(h * 0.16), int(w * 0.32)
    tl_roi = res[0:tl_h, 0:tl_w]
    found_tl, box_tl = detect_watermark_in_roi(tl_roi)
    if found_tl:
        repaired_tl = patch_repair_box(tl_roi, box_tl)
        res[0:tl_h, 0:tl_w] = repaired_tl

    # 3. 右下角角隅浮水印檢測與緊鄰材質覆蓋 (LUCISSI)
    if not is_bottom_banner:
        br_y1, br_y2 = int(h * 0.84), h
        br_x1, br_x2 = int(w * 0.68), w
        br_roi = res[br_y1:br_y2, br_x1:br_x2]
        found_br, box_br = detect_watermark_in_roi(br_roi)
        if found_br:
            repaired_br = patch_repair_box(br_roi, box_br)
            res[br_y1:br_y2, br_x1:br_x2] = repaired_br

    return res

def natural_sort_key(s):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def clean_entire_product_folder(target_dir):
    dir_name = os.path.basename(target_dir)
    print(f"\n[*] 處理目錄: {dir_name}")

    main_dir = os.path.join(target_dir, "主圖")
    spec_dir = os.path.join(target_dir, "規格圖")
    os.makedirs(main_dir, exist_ok=True)
    os.makedirs(spec_dir, exist_ok=True)

    urls = []
    for u_candidate in [os.path.join(target_dir, "_URL.txt"), os.path.join(main_dir, "_URL.txt")]:
        if os.path.exists(u_candidate):
            with open(u_candidate, 'r', encoding='utf-8') as f:
                urls = [line.strip() for line in f if line.strip().startswith('http')]
            if urls: break

    # 原圖收集
    parent_mains = sorted([os.path.join(target_dir, f) for f in os.listdir(target_dir) if f.startswith('主圖_') and f.endswith('.webp')], key=natural_sort_key)
    sub_mains = sorted([os.path.join(main_dir, f) for f in os.listdir(main_dir) if (f.startswith('原始_') or f.startswith('主圖_')) and f.endswith('.webp')], key=natural_sort_key)
    main_raw_files = sub_mains if sub_mains else parent_mains

    parent_specs = sorted([os.path.join(target_dir, f) for f in os.listdir(target_dir) if (f.startswith('SKU') or f.startswith('規格')) and f.endswith('.webp')], key=natural_sort_key)
    sub_specs = sorted([os.path.join(spec_dir, f) for f in os.listdir(spec_dir) if (f.startswith('原始_') or f.startswith('規格') or f.startswith('SKU')) and f.endswith('.webp')], key=natural_sort_key)
    spec_raw_files = sub_specs if sub_specs else parent_specs

    if urls and (len(main_raw_files) == 0 or len(spec_raw_files) == 0):
        downloaded = []
        for i, url in enumerate(urls, 1):
            url_hd = url.split("?")[0] + "?v=1024x1024" if "1024x1024" not in url else url
            temp_p = os.path.join(target_dir, f"_temp_download_{i:02d}.webp")
            try:
                urllib.request.urlretrieve(url_hd, temp_p)
            except Exception:
                try: urllib.request.urlretrieve(url, temp_p)
                except Exception: continue
            downloaded.append(temp_p)
        if downloaded:
            main_raw_files = downloaded[:5]
            spec_raw_files = downloaded[5:]

    for idx, raw_path in enumerate(main_raw_files, 1):
        img = imread_unicode(raw_path)
        if img is None: continue
        cleaned = clean_watermark(img)
        out_name = f"主圖_{idx:02d}_無品牌.jpg"
        out_path = os.path.join(main_dir, out_name)
        imwrite_unicode(out_path, cleaned)
        print(f"  [主圖 {idx}] -> {out_name}")

    for idx, raw_path in enumerate(spec_raw_files, 1):
        img = imread_unicode(raw_path)
        if img is None: continue
        cleaned = clean_watermark(img)
        out_name = f"規格_選項_{idx}_無品牌.jpg"
        out_path = os.path.join(spec_dir, out_name)
        imwrite_unicode(out_path, cleaned)
        print(f"  [規格 {idx}] -> {out_name}")

    for f in os.listdir(target_dir):
        if f.startswith('_temp_download_'):
            try: os.remove(os.path.join(target_dir, f))
            except: pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        clean_entire_product_folder(sys.argv[1])
    else:
        prod_root = 'c:/Projects/saengak_web/product'
        dirs = [os.path.join(prod_root, d) for d in os.listdir(prod_root) if os.path.isdir(os.path.join(prod_root, d))]
        for i, d in enumerate(dirs, 1):
            clean_entire_product_folder(d)
        print("\n🎉 全數商品目錄無痕修復完成！")
