"""LUCISSI CARE 'Daylight Linen' second-image compositor.
Places a real product cutout (pixels untouched) into an empty scene and draws the shadows.

usage:
  scene.py BG CUTOUT OUT stand CX BASE_Y HEIGHT [CAST_LEN] [CAST_RISE]
  scene.py BG CUTOUT OUT flat  CX CY LONG_SIDE [ROTATE_DEG]

stand: upright products (bottles, boxes, bundles sharing one baseline). CX/BASE_Y/HEIGHT are
       in BG pixels. Light is from the upper left, so each object's silhouette is projected to
       the right along the surface (CAST_LEN = run per unit of height, CAST_RISE = how far it
       climbs toward the wall), plus a contact line under every foot and soft occlusion.
flat:  products laid on the cloth, seen from above; soft lifted drop shadow to the lower right.
Output is 1600x1600 JPEG q92."""
import sys
from PIL import Image, ImageFilter, ImageChops
import numpy as np
from scipy.ndimage import gaussian_filter

PLUM = np.array([64, 44, 50], float)


def load_cut(path):
    cut = Image.open(path).convert('RGBA')
    cut = cut.crop(cut.split()[-1].point(lambda v: 255 if v > 24 else 0).getbbox())
    # tighten the matte 1px so no source-backdrop fringe survives
    a = cut.split()[-1].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    cut.putalpha(ImageChops.multiply(cut.split()[-1], a))
    return cut


def darken(bg, density):
    B = np.asarray(bg, float)
    d = np.clip(density, 0, 0.78)[..., None]
    shade = 0.5 * PLUM / 255 * 1.1 + 0.5 * 0.22   # half plum, half neutral: warm shadow without a purple rim
    return Image.fromarray(np.clip(B * (1 - d) + B * shade * d, 0, 255).astype('uint8'))


def stand(bg, cut, cx, base, H, cast=0.55, rise=0.06):
    N = bg.width
    k = H / cut.height
    cut = cut.resize((round(cut.width * k), round(H)), Image.LANCZOS)
    w, h = cut.size
    x, y = round(cx - w / 2), round(base - h)
    A = np.asarray(cut.split()[-1], float) / 255
    solid = A > 0.5
    # projected cast shadow: every solid pixel at height z lands at (x + z*cast, base - z*rise)
    ii, jj = np.nonzero(solid[::2, ::2]); ii, jj = ii * 2, jj * 2
    z = (h - 1 - ii).astype(float)
    sx = np.clip(np.round(x + jj + z * cast).astype(int), 0, N - 1)
    sy = np.clip(np.round(base - z * rise).astype(int), 0, N - 1)
    cast_m = np.zeros((N, N))
    np.maximum.at(cast_m, (sy, sx), (1 - z / h) ** 1.4)
    cast_m = gaussian_filter(gaussian_filter(cast_m, 2.5), N * 0.009)
    cast_m *= 0.34 / max(1e-6, cast_m.max())
    # contact: the lowest solid pixel of each column that actually touches the baseline
    cont = np.zeros((N, N))
    rows = np.where(solid.any(0), h - 1 - np.argmax(solid[::-1], 0), -1)
    for j, b in enumerate(rows):
        if b >= h - 1 - h * 0.03 and 0 <= x + j < N:
            cont[min(N - 1, y + b + 1), x + j] = 1
    tight = gaussian_filter(cont, (N * 0.0035, N * 0.005))
    wide = gaussian_filter(cont, (N * 0.010, N * 0.016))
    tight /= max(1e-6, tight.max()); wide /= max(1e-6, wide.max())
    canvas = darken(bg, cast_m + tight * 0.62 + wide * 0.30).convert('RGBA')
    canvas.alpha_composite(cut, (x, y))
    return canvas, (x, y, w, h)


def flat(bg, cut, cx, cy, L, rot=0):
    N = bg.width
    if rot:
        cut = cut.rotate(rot, resample=Image.BICUBIC, expand=True)
        cut = cut.crop(cut.split()[-1].getbbox())
    k = L / max(cut.size)
    cut = cut.resize((round(cut.width * k), round(cut.height * k)), Image.LANCZOS)
    w, h = cut.size
    x, y = round(cx - w / 2), round(cy - h / 2)
    m = np.zeros((N, N))
    A = np.asarray(cut.split()[-1], float) / 255
    dx, dy = round(N * 0.008), round(N * 0.014)
    ys, xs = slice(max(0, y + dy), min(N, y + dy + h)), slice(max(0, x + dx), min(N, x + dx + w))
    m[ys, xs] = A[: ys.stop - ys.start, : xs.stop - xs.start]
    m = gaussian_filter(m, N * 0.012) * 0.30 + gaussian_filter(m, N * 0.003) * 0.12
    canvas = darken(bg, m).convert('RGBA')
    canvas.alpha_composite(cut, (x, y))
    return canvas, (x, y, w, h)


def main():
    bgp, cutp, out, mode = sys.argv[1:5]
    nums = [float(v) for v in sys.argv[5:]]
    bg = Image.open(bgp).convert('RGB')
    cut = load_cut(cutp)
    canvas, box = (stand if mode == 'stand' else flat)(bg, cut, *nums)
    canvas.convert('RGB').resize((1600, 1600), Image.LANCZOS).save(out, quality=92)
    print(out, 'box', box)


if __name__ == '__main__':
    main()
