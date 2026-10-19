"""rowpng.py OUT CUT[:relheight] ... -> items on one baseline, transparent PNG (same layout rule as studio.py)."""
import sys
from PIL import Image
out = sys.argv[1]; items = []
for spec in sys.argv[2:]:
    p, _, s = spec.partition(':'); im = Image.open(p).convert('RGBA')
    im = im.crop(im.split()[-1].point(lambda v: 255 if v > 24 else 0).getbbox()); items.append((im, float(s or 1)))
H = 1200; gap = int(H * 0.06)
sc = [im.resize((max(1, int(im.width * H * s / im.height)), int(H * s)), Image.LANCZOS) for im, s in items]
W = sum(i.width for i in sc) + gap * (len(sc) - 1); gh = max(i.height for i in sc)
canvas = Image.new('RGBA', (W, gh), (0, 0, 0, 0)); x = 0
for i in sc:
    canvas.alpha_composite(i, (x, gh - i.height)); x += i.width + gap
canvas.save(out); print(out, canvas.size)
