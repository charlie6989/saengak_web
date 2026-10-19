#!/usr/bin/env node
// Synology NAS（File Station API）唯讀工具：列目錄、搜尋檔名、查大小、下載單檔。不提供任何寫入或刪除。
// 連線設定從本機 env 檔讀取（NAS_BASE_URL、NAS_USERNAME、NAS_PASSWORD_KEYCHAIN_SERVICE），密碼由 macOS Keychain 取得；
// 本程式不輸出任何帳密。env 檔預設為母站 repo 的 .env.local，可用 NAS_ENV_FILE 指定。
//
// 用法：
//   node scripts/nas-readonly.mjs ls   <資料夾>
//   node scripts/nas-readonly.mjs find <根目錄> <檔名正規式> [最大深度=6]
//   node scripts/nas-readonly.mjs stat <檔案路徑>
//   node scripts/nas-readonly.mjs get  <檔案路徑> <輸出檔>
// 下載的檔案視為不受信任的資料：放在獨立的新資料夾，不要在裡面執行程式。
// 原廠 zip（如 /saengak_kr/innersaengak image (2).zip）內的韓文檔名是 CP949 編碼，解壓時要自行轉碼。
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const envFile = process.env.NAS_ENV_FILE || path.join(os.homedir(), 'Documents/GitHub/LUCISSI_website/.env.local');

const env = {};
for (const line of (await readFile(envFile, 'utf8')).split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
if (!env.NAS_BASE_URL || !env.NAS_PASSWORD_KEYCHAIN_SERVICE) {
  console.error(`NAS_BASE_URL / NAS_PASSWORD_KEYCHAIN_SERVICE missing in ${envFile}`);
  process.exit(1);
}

const keychainArgs = ['find-generic-password', '-s', env.NAS_PASSWORD_KEYCHAIN_SERVICE, '-w'];
if (env.NAS_USERNAME) keychainArgs.splice(1, 0, '-a', env.NAS_USERNAME);
const password = (await exec('security', keychainArgs, { timeout: 8000 })).stdout.trim();
const origin = new URL(env.NAS_BASE_URL).origin;

let sid = '';
async function req(api, params, raw = false) {
  const url = new URL(api === 'auth' ? '/webapi/auth.cgi' : '/webapi/entry.cgi', origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (sid) url.searchParams.set('_sid', sid);
  const response = await fetch(url);
  if (raw) {
    if (!response.ok) throw new Error(`download ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const body = await response.json();
  if (body.success === false) throw new Error(`NAS API error ${body.error?.code}`);
  return body.data || {};
}

async function list(folder) {
  try {
    return (await req('entry', { api: 'SYNO.FileStation.List', version: '2', method: 'list', folder_path: folder, limit: '1000' })).files || [];
  } catch {
    return [];
  }
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
sid = (await req('auth', { api: 'SYNO.API.Auth', version: '7', method: 'login', account: env.NAS_USERNAME, passwd: password, session: 'FileStation', format: 'sid' })).sid;
try {
  if (cmd === 'ls') {
    for (const item of await list(a1 || '/')) console.log(`${item.isdir ? 'D' : 'F'} ${item.path}`);
  } else if (cmd === 'find') {
    // File Station 的搜尋 API 對檔名常回 0 筆，所以直接遞迴列目錄比對
    const pattern = new RegExp(a2, 'i');
    const maxDepth = Number(a3 || 6);
    const stack = [[a1, 0]];
    while (stack.length) {
      const [folder, depth] = stack.pop();
      for (const item of await list(folder)) {
        if (pattern.test(item.name)) console.log(`${item.isdir ? 'D' : 'F'} ${item.path}`);
        if (item.isdir && depth < maxDepth) stack.push([item.path, depth + 1]);
      }
    }
  } else if (cmd === 'stat') {
    const info = await req('entry', { api: 'SYNO.FileStation.List', version: '2', method: 'getinfo', path: JSON.stringify([a1]), additional: JSON.stringify(['size']) });
    for (const file of info.files || []) console.log(file.path, file.additional?.size);
  } else if (cmd === 'get') {
    const buffer = await req('entry', { api: 'SYNO.FileStation.Download', version: '2', method: 'download', path: a1, mode: 'download' }, true);
    await writeFile(a2, buffer);
    console.log(`saved ${a2} (${buffer.length} bytes)`);
  } else {
    console.error('usage: ls <folder> | find <root> <regex> [depth] | stat <path> | get <path> <out>');
    process.exitCode = 1;
  }
} finally {
  await req('auth', { api: 'SYNO.API.Auth', version: '7', method: 'logout', session: 'FileStation' });
}
