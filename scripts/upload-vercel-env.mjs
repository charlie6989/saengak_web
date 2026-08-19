import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');

if (!fs.existsSync(envLocalPath)) {
  console.error(`找不到檔案: ${envLocalPath}`);
  process.exit(1);
}

const content = fs.readFileSync(envLocalPath, 'utf-8');
const lines = content.split(/\r?\n/);

const variablesToUpload = [];
const skippedEmpty = [];
const skippedIgnored = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;

  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();

  // 移除前後引號
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  // 忽略 Vercel 自動生成的內部 Token
  if (key === 'VERCEL_OIDC_TOKEN') {
    skippedIgnored.push({ key, reason: 'Vercel 內部 OIDC Token' });
    continue;
  }

  // 空值不予上傳
  if (!value || value.length === 0) {
    skippedEmpty.push(key);
    continue;
  }

  variablesToUpload.push({ key, value });
}

console.log('====================================================');
console.log('  Vercel 環境變數同步上傳腳本 (.env.local -> Vercel)');
console.log('====================================================\n');

console.log(`[讀取完成] 總計解析出:`);
console.log(`- 待上傳/覆蓋變數: ${variablesToUpload.length} 個`);
console.log(`- 忽略空值變數: ${skippedEmpty.length} 個 (${skippedEmpty.join(', ')})`);
if (skippedIgnored.length > 0) {
  console.log(`- 忽略系統變數: ${skippedIgnored.map((i) => i.key).join(', ')}`);
}
console.log('\n開始透過 Vercel CLI 逐一同步上傳 (目標: Production, Preview)...\n');

const successList = [];
const failedList = [];

for (let i = 0; i < variablesToUpload.length; i++) {
  const { key, value } = variablesToUpload[i];
  process.stdout.write(`[${i + 1}/${variablesToUpload.length}] 上傳 ${key} ... `);

  try {
    // 透過 stdin 傳遞 value 避免特殊字元或引號跳脫問題
    execSync(
      `npx vercel env add ${key} production,preview --force --yes`,
      {
        cwd: rootDir,
        input: value,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }
    );
    console.log('✓ 成功 (已覆蓋/更新)');
    successList.push(key);
  } catch (err) {
    console.log(`✗ 失敗: ${err.message}`);
    failedList.push({ key, error: err.message });
  }
}

console.log('\n====================================================');
console.log('  上傳結果統計');
console.log('====================================================');
console.log(`✅ 成功上傳: ${successList.length} 個變數`);
if (failedList.length > 0) {
  console.log(`❌ 失敗變數: ${failedList.length} 個`);
  failedList.forEach((f) => console.log(`  - ${f.key}: ${f.error}`));
}
console.log(`⏭️  跳過空值: ${skippedEmpty.length} 個`);
skippedEmpty.forEach((k) => console.log(`  - ${k}`));
console.log('====================================================\n');
