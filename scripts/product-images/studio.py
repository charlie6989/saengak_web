"""LUCISSI CARE 'Ivory Studio' main-image compositor.
usage: studio.py OUT SIZE MODE(flat|stand) CUTOUT[:scale] [CUTOUT[:scale] ...]
Multiple cutouts are laid out left-to-right sharing a baseline (bundles)."""
import sys
from PIL import Image, ImageFilter, ImageDraw, ImageChops
import numpy as np

IVORY = np.array([248, 245, 241], float)   # #F8F5F1
EDGE  = np.array([239, 233, 227], float)   # warm falloff toward edges
HI    = np.array([252, 250, 247], float)   # light pool, upper-left key light

def backdrop(n):
    y, x = np.mgrid[0:n, 0:n] / n
    # key light from upper-left: lighter pool at (0.38, 0.32)
    d = np.sqrt((x - 0.38) ** 2 + (y - 0.32) ** 2)
    t = np.clip(d / 0.95, 0, 1)[..., None]
    col = np.where(t < 0.35, HI + (IVORY - HI) * (t / 0.35), IVORY + (EDGE - IVORY) * ((t - 0.35) / 0.65))
    # very fine grain so it doesn't band
    rng = np.random.default_rng(7)
    col = col + rng.normal(0, 0.6, col.shape)
    return Image.fromarray(np.clip(col, 0, 255).astype('uint8'))

def trim(im):
    a = im.split()[-1]
    a = a.point(lambda v: 255 if v > 24 else 0)
    return im.crop(a.getbbox())

def shadow_flat(alpha, n):
    # soft lifted shadow for flat-lay garments: offset toward lower-right
    blur = max(4, int(n * 0.018))
    sh = alpha.filter(ImageFilter.GaussianBlur(blur))
    return sh.point(lambda v: int(v * 0.20)), (int(n * 0.006), int(n * 0.012))

def shadow_stand(alpha, n):
    # contact shadow ellipse at base + faint cast for standing products
    w, h = alpha.size
    sh = Image.new('L', (w, h), 0)
    ell = Image.new('L', (w + 200, 200), 0)
    ImageDraw.Draw(ell).ellipse([100 + w * 0.06, 80, 100 + w * 0.94, 120], fill=140)
    ell = ell.filter(ImageFilter.GaussianBlur(int(n * 0.012)))
    return ell, None

def main():
    out, size, mode = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    items = []
    for spec in sys.argv[4:]:
        path, _, sc = spec.partition(':')
        items.append((trim(Image.open(path).convert('RGBA')), float(sc or 1)))
    n = size
    canvas = backdrop(n).convert('RGBA')
    # target box: product group fits inside 74% x 68% of frame, optically centred slightly above middle
    box_w, box_h = n * 0.74, n * 0.68
    gap = n * 0.04
    # normalise heights within a bundle by relative scale, then fit group
    ref_h = max(im.height / sc for im, sc in items)
    scaled = []
    for im, sc in items:
        k = (ref_h * sc) / im.height if len(items) > 1 else 1
        scaled.append(im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS))
    gw = sum(i.width for i in scaled) + gap * (len(scaled) - 1)
    gh = max(i.height for i in scaled)
    f = min(box_w / gw, box_h / gh)
    scaled = [i.resize((int(i.width * f), int(i.height * f)), Image.LANCZOS) for i in scaled]
    gw = sum(i.width for i in scaled) + gap * (len(scaled) - 1)
    gh = max(i.height for i in scaled)
    x = (n - gw) / 2
    base = n * 0.5 + gh / 2 + (n * 0.02 if mode == 'stand' else -n * 0.01)
    for im in scaled:
        top = int(base - im.height)
        a = im.split()[-1]
        if mode == 'flat':
            sh, (dx, dy) = shadow_flat(a, n)
            layer = Image.new('RGBA', im.size, (72, 48, 56, 0)); layer.putalpha(sh)
            canvas.alpha_composite(layer, (int(x) + dx, top + dy))
        else:
            ell, _ = shadow_stand(a, n)
            layer = Image.new('RGBA', ell.size, (64, 44, 50, 0)); layer.putalpha(ell)
            canvas.alpha_composite(layer, (int(x) - 100, int(base) - 100))
        canvas.alpha_composite(im, (int(x), top))
        x += im.width + gap
    canvas.convert('RGB').save(out, quality=92)
    print(out)

main()
