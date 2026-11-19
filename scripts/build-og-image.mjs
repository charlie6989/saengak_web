// 產生網站預設分享圖 public/images/brand/og-image.png（1200×630）。
// 底圖用首頁品牌照片 home-brand.webp（左側本來就是留給文字的米白區），左側放 Primary 字標與系列說明。
// 系列說明的中文以系統字型 Noto Sans TC 繪製（librsvg 透過 fontconfig 找字型），沒有安裝時會改用其他字型，產圖後請目視確認。
// 字標 2026-11-19 起為正式版；日後若修改 public/images/brand/lucissi-care-primary.svg，重跑：node scripts/build-og-image.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const WIDTH = 1200;
const HEIGHT = 630;
const PLUM = '#5B3D48';
const PHOTO = path.join(root, 'public/images/lucissi-v5/home-brand.webp');
const LOGO = path.join(root, 'public/images/brand/lucissi-care-primary.svg');
const OUT = path.join(root, 'public/images/brand/og-image.png');

// 照片 1920×1072 → 上下各裁 32px 成 1.905:1 → 縮成 1200×630；左側米白區約 450px 寬。
const PANEL_CENTER_X = 225;
const LOGO_WIDTH = 330;

const photo = await sharp(PHOTO).extract({ left: 0, top: 32, width: 1920, height: 1008 }).resize(WIDTH, HEIGHT).toBuffer();

const logoSvg = await readFile(LOGO, 'utf8');
const logo = await sharp(Buffer.from(logoSvg), { density: 300 }).resize({ width: LOGO_WIDTH }).png().toBuffer();
const { height: logoHeight = 0 } = await sharp(logo).metadata();
const logoTop = Math.round(HEIGHT / 2 - logoHeight / 2 - 28);

const textTop = logoTop + logoHeight + 58;
const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <text x="${PANEL_CENTER_X}" y="${textTop}" text-anchor="middle" fill="${PLUM}"
    font-family="Noto Sans TC" font-weight="500" font-size="19" letter-spacing="2">私密保養・舒適內搭・生理期照護</text>
  <text x="${PANEL_CENTER_X}" y="${textTop + 38}" text-anchor="middle" fill="${PLUM}" fill-opacity="0.7"
    font-family="Noto Sans TC" font-weight="400" font-size="16" letter-spacing="2.5">lucissicare.com</text>
</svg>`);

await sharp(photo)
  .composite([
    { input: logo, left: Math.round(PANEL_CENTER_X - LOGO_WIDTH / 2), top: logoTop },
    { input: text, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9, palette: false })
  .toFile(OUT);

console.log(`Wrote ${path.relative(root, OUT)}`);
