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

console.log('====================================================');
console.log('  Vercel 環境變數重置與同步工具 (.env.local -> Vercel)');
console.log('====================================================\n');

// 1. 取得 Vercel 雲端上現有的所有變數
console.log('[步驟 1/3] 正在讀取 Vercel 雲端現有環境變數列表...');
let rawEnvLsOutput = '';
try {
  rawEnvLsOutput = execSync('npx vercel env ls', {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (err) {
  console.error(`讀取 Vercel 環境變數失敗: ${err.message}`);
  process.exit(1);
}

const existingKeys = new Set();
const lsLines = rawEnvLsOutput.split(/\r?\n/);
let parsing = false;

for (const line of lsLines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('name') && trimmed.includes('value') && trimmed.includes('type')) {
    parsing = true;
    continue;
  }
  if (!parsing) continue;
  if (!trimmed || trimmed.startsWith('Common next commands')) break;

  const parts = trimmed.split(/\s+/);
  if (parts.length > 0 && parts[0]) {
    existingKeys.add(parts[0]);
  }
}

const existingKeyList = Array.from(existingKeys);
console.log(`- 雲端目前找到 ${existingKeyList.length} 個環境變數。\n`);

// 2. 批次清空 Vercel 雲端環境變數
if (existingKeyList.length > 0) {
  console.log(`[步驟 2/3] 開始清除 Vercel 雲端環境變數 (總計: ${existingKeyList.length} 個)...`);
  const envTargets = ['production', 'preview', 'development'];

  for (let i = 0; i < existingKeyList.length; i++) {
    const key = existingKeyList[i];
    process.stdout.write(`[${i + 1}/${existingKeyList.length}] 刪除 ${key} ... `);
    
    // 依序嘗試從 production, preview, development 刪除
    for (const envName of envTargets) {
      try {
        execSync(`npx vercel env rm ${key} ${envName} --yes`, {
          cwd: rootDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf-8',
        });
      } catch (e) {
        // 若該環境沒有此變數則忽略
      }
    }
    console.log('✓ 已清理');
  }
  console.log('\n✅ 雲端既有變數已全部清空完成！\n');
} else {
  console.log('[步驟 2/3] 雲端目前無現存變數，跳過刪除步驟。\n');
}

// 3. 解析 .env.local 並重新上傳至 Vercel
console.log('[步驟 3/3] 開始讀取 .env.local 並推送至 Vercel (Production & Preview)...');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const lines = envContent.split(/\r?\n/);

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

  // 移除引號
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

  // 空值跳過
  if (!value || value.length === 0) {
    skippedEmpty.push(key);
    continue;
  }

  variablesToUpload.push({ key, value });
}

console.log(`- 待上傳變數: ${variablesToUpload.length} 個`);
console.log(`- 跳過空值變數: ${skippedEmpty.length} 個 (${skippedEmpty.join(', ') || '無'})`);
if (skippedIgnored.length > 0) {
  console.log(`- 忽略內部變數: ${skippedIgnored.map((i) => i.key).join(', ')}`);
}
console.log('');

const uploadSuccess = [];
const uploadFailed = [];

for (let i = 0; i < variablesToUpload.length; i++) {
  const { key, value } = variablesToUpload[i];
  process.stdout.write(`[${i + 1}/${variablesToUpload.length}] 上傳 ${key} ... `);

  try {
    execSync(
      `npx vercel env add ${key} production,preview --force --yes`,
      {
        cwd: rootDir,
        input: value,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }
    );
    console.log('✓ 成功');
    uploadSuccess.push(key);
  } catch (err) {
    console.log(`✗ 失敗: ${err.message}`);
    uploadFailed.push({ key, error: err.message });
  }
}

console.log('\n====================================================');
console.log('  同步執行摘要報告');
console.log('====================================================');
console.log(`✅ 成功建立/同步: ${uploadSuccess.length} 個變數`);
if (uploadFailed.length > 0) {
  console.log(`❌ 失敗變數: ${uploadFailed.length} 個`);
  uploadFailed.forEach((f) => console.log(`  - ${f.key}: ${f.error}`));
}
console.log(`⏭️  跳過空值: ${skippedEmpty.length} 個`);
console.log('====================================================\n');
