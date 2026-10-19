"""Build multi-unit cutout groups for bundle main images.
usage: groups.py CUT_DIR   (CUT_DIR holds pouch.png, wipe.png, mousse.png cut from the factory packshots)
Writes app1/app2.png (1 or 2 gel pouches standing side by side; the "app" names are left over from
an applicator draft), wipe1/2/3.png (sachets fanned back-to-front, each back sachet peeking up-right)
and mousse1.png."""
import sys
from PIL import Image, ImageFilter

d = sys.argv[1]


def trim(im):
    a = im.split()[-1].point(lambda v: 255 if v > 24 else 0)
    return im.crop(a.getbbox())


def edge_shadow(front, strength=0.28, blur=10):
    # soft shadow the front item casts on the item behind it
    a = front.split()[-1]
    pad = blur * 3
    p = Image.new('L', (a.width + 2 * pad, a.height + 2 * pad), 0)
    p.paste(a, (pad, pad))
    sh = p.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * strength))
    layer = Image.new('RGBA', sh.size, (60, 40, 46, 0))
    layer.putalpha(sh)
    return layer, pad


def side_by_side(item, n, gap_ratio):
    gap = int(item.width * gap_ratio)
    W = item.width * n + gap * (n - 1)
    out = Image.new('RGBA', (W, item.height), (0, 0, 0, 0))
    for i in range(n):
        out.alpha_composite(item, (i * (item.width + gap), 0))
    return out


def fanned(item, n, dx_ratio, dy_ratio):
    # back items sit up and to the right; all share the same bottom-left anchor logic
    dx, dy = int(item.width * dx_ratio), int(item.height * dy_ratio)
    W = item.width + dx * (n - 1)
    H = item.height + dy * (n - 1)
    out = Image.new('RGBA', (W + 60, H + 60), (0, 0, 0, 0))
    # draw back to front
    for i in reversed(range(n)):
        x, y = dx * i, H - item.height - dy * i
        if i < n - 1:
            sh, pad = edge_shadow(item)
            out.alpha_composite(sh, (max(0, x - pad + 6), max(0, y - pad + 8)))
        out.alpha_composite(item, (x, y))
    return trim(out)


app = trim(Image.open(f'{d}/pouch.png').convert('RGBA'))
wipe = trim(Image.open(f'{d}/wipe.png').convert('RGBA'))
mousse = trim(Image.open(f'{d}/mousse.png').convert('RGBA'))
app.save(f'{d}/app1.png')
side_by_side(app, 2, 0.28).save(f'{d}/app2.png')
wipe.save(f'{d}/wipe1.png')
for n in (2, 3):
    g = fanned(wipe, n, 0.16, 0.07)
    g.save(f'{d}/wipe{n}.png')
mousse.save(f'{d}/mousse1.png')
for f in ('app1', 'app2', 'wipe1', 'wipe2', 'wipe3', 'mousse1'):
    im = Image.open(f'{d}/{f}.png')
    print(f, im.size)
