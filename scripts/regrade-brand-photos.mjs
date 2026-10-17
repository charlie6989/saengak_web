// Calm Care photo regrade: pull pink/rose casts in light and mid tones toward warm neutral,
// leaving darks (plum props), greens/teals (Saengak packaging) and most skin tones alone.
// Usage: node scripts/regrade-brand-photos.mjs <repo-root> <out-dir> [file ...]   (writes regraded copies; review, then copy over public/images/lucissi-v5/)
import { readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const [repo, outDir, ...only] = process.argv.slice(2);
const sharp = createRequire(path.join(repo, 'package.json'))('sharp');
const dir = path.join(repo, 'public/images/lucissi-v5');
mkdirSync(outDir, { recursive: true });

// Measured: pink walls/props sit at hue 6–12°, sat 0.21–0.27; skin and lips are 0.4+ saturated.
const CENTER = 8, FULL = 10, ZERO = 28, TARGET_HUE = 34, HUE_PULL = 0.85, DESAT = 0.55;
const smooth = (x) => x * x * (3 - 2 * x);

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

const files = only.length ? only : readdirSync(dir).filter((n) => n.endsWith('.webp'));
for (const f of files) {
  const src = path.join(dir, f);
  const meta = await sharp(src).metadata();
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, l] = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (s < 0.02) continue;
    const dist = Math.min(Math.abs(h - CENTER), 360 - Math.abs(h - CENTER));
    const hw = dist <= FULL ? 1 : dist >= ZERO ? 0 : 1 - smooth((dist - FULL) / (ZERO - FULL));
    const lw = l <= 0.3 ? 0 : l >= 0.55 ? 1 : smooth((l - 0.3) / 0.25);
    const sw = s <= 0.32 ? 1 : s >= 0.45 ? 0 : 1 - smooth((s - 0.32) / 0.13);
    const w = hw * lw * sw;
    if (w === 0) continue;
    const signed = h > 180 ? h - 360 : h;
    const nh = (signed + (TARGET_HUE - signed) * HUE_PULL * w + 360) % 360;
    const [r, g, b] = hslToRgb(nh, s * (1 - DESAT * w), l);
    data[i] = Math.round(r * 255); data[i + 1] = Math.round(g * 255); data[i + 2] = Math.round(b * 255);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: 82, effort: 5 })
    .toFile(path.join(outDir, f));
  console.log(f, `${meta.width}x${meta.height}`);
}
