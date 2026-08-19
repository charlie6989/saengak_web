import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const checkedExtensions = new Set(['.css', '.html', '.js', '.map', '.ts', '.tsx']);
const forbiddenContent = [
  ['legacy Shopify shop', 'ekfvih-rz.myshopify.com'],
  ['legacy brand', 'LUCISSI'],
  ['legacy brand', 'VAGI'],
  ['legacy brand email', '@lucissi.com'],
  ['unrelated brand email', '@innercare.com'],
  ['placeholder telephone', '0800-123-456'],
  ['placeholder address', '信義路五段123號456樓'],
  ['unsupported safety promise', '安全保證'],
  ['unsupported universal testing claim', '每一款產品都經過嚴格測試'],
  ['unsupported medical partnership claim', '與醫療專家合作'],
  ['unsupported market-trust claim', '深受韓國市場信賴'],
  ['unsupported retail placement claim', '新世界百貨江南店'],
  ['unsupported first-purchase discount', '85折優惠'],
  ['unsupported automatic discount claim', '優惠碼將自動套用到您的帳戶'],
  ['unsupported promotion code', 'NEWMEMBER30'],
  ['unsupported promotion code', 'FREESHIP50'],
  ['unsupported promotion code', 'BUNDLE25'],
  ['unsupported promotion code', 'BIRTHDAY40'],
  ['unsupported promotion code', 'REFER20'],
  ['unsupported promotion code', 'SPRING35'],
  ['unsupported medical service claim', '享受專業醫師和護理師的線上諮詢服務'],
  ['unsupported testimonial claim', '用戶真實分享'],
  ['bundled mock identity', 'demo@example.com'],
  ['bundled mock identity', 'test@gmail.com'],
  ['bundled mock identity', 'user@test.com'],
  ['bundled mock address', '台北市信義區信義路五段7號'],
  ['bundled private key', '-----BEGIN PRIVATE KEY-----'],
  ['bundled live secret prefix', 'sk_live_'],
  ['bundled Shopify admin token prefix', 'shpat_'],
  ['bundled Supabase secret prefix', 'sb_secret_'],
];

async function collectFiles(target) {
  const entries = await readdir(target, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else if (checkedExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

const roots = [path.join(projectRoot, 'src'), path.join(projectRoot, 'public'), path.join(projectRoot, 'dist')];
const files = [path.join(projectRoot, 'index.html')];
for (const root of roots) {
  try {
    await access(root);
    files.push(...await collectFiles(root));
  } catch {
    // Optional build/public roots may not exist yet.
  }
}
const failures = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const [label, needle] of forbiddenContent) {
    if (content.toLowerCase().includes(needle.toLowerCase())) {
      failures.push(`${path.relative(projectRoot, file)}: ${label} (${needle})`);
    }
  }
}

if (failures.length > 0) {
  console.error('Public content verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public content verification passed (${files.length} files checked).`);
