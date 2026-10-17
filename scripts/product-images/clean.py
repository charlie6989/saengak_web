"""Clean a Vision cutout: erase prop boxes, keep largest component(s), tidy edges.
usage: clean.py IN OUT [--erase x0,y0,x1,y1]... [--poly x,y,x,y,...]... [--keep N] [--patch cx,cy,r]...
Coordinates are fractions of the image size."""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
a = sys.argv[1:]; src, out = a[0], a[1]; i = 2
erase, keep, patches, polys = [], 1, [], []
while i < len(a):
    if a[i] == '--erase': erase.append([float(v) for v in a[i+1].split(',')]); i += 2
    elif a[i] == '--poly': polys.append([float(v) for v in a[i+1].split(',')]); i += 2
    elif a[i] == '--keep': keep = int(a[i+1]); i += 2
    elif a[i] == '--patch': patches.append([float(v) for v in a[i+1].split(',')]); i += 2
    else: raise SystemExit('bad arg ' + a[i])
im = np.array(Image.open(src).convert('RGBA')).astype(float)
h, w = im.shape[:2]
for x0, y0, x1, y1 in erase:
    im[int(y0*h):int(y1*h), int(x0*w):int(x1*w), 3] = 0
for pts in polys:
    pm = Image.new('L', (w, h), 0)
    ImageDraw.Draw(pm).polygon([(pts[k]*w, pts[k+1]*h) for k in range(0, len(pts), 2)], fill=255)
    im[np.array(pm) > 0, 3] = 0
# patch: fill a small sticker/badge by diffusing the surrounding fabric colour inward (no texture invention)
yy, xx = np.mgrid[0:h, 0:w]
for cx, cy, r in patches:
    d = np.hypot(xx - cx*w, yy - cy*h)
    hole = d <= r*w
    rgb = im[..., :3].copy()
    ring = (d > r*w) & (d <= r*w*1.5)
    rgb[hole] = np.median(rgb[ring], axis=0)
    for _ in range(400):
        sm = ndimage.uniform_filter(rgb, size=(3, 3, 1))
        rgb[hole] = sm[hole]
    feather = np.clip((r*w*1.08 - d) / (r*w*0.08), 0, 1)[..., None]
    im[..., :3] = im[..., :3] * (1 - feather) + rgb * feather
m = im[..., 3] > 40
lab, n = ndimage.label(m)
if n:
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1][:keep]
    keepmask = np.isin(lab, order + 1)
    keepmask = ndimage.binary_fill_holes(keepmask) if keep == 1 else keepmask
    im[..., 3] = np.where(ndimage.binary_dilation(keepmask, iterations=2), im[..., 3], 0)
# soften the 1px fringe so the composite has no halo
alpha = Image.fromarray(im[..., 3].astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
res = Image.fromarray(np.clip(im[..., :3], 0, 255).astype('uint8')); res.putalpha(alpha)
res.save(out); print(out, n, 'components')
