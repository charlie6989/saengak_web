import { existsSync, readFileSync } from 'node:fs';

const expectedSupabaseRef = 'tmqzkagkrzhioftvwbqo';
const expectedSupabaseOrigin = `https://${expectedSupabaseRef}.supabase.co`;
const forbiddenSupabaseRefs = new Map([
  ['dhktmpcvtoxcicqkwgpn', 'lucissi.com 的另一個正式站'],
]);
const expectedVercelProject = 'saengak-web-d2ux';
const errors = [];
const scopeArgumentIndex = process.argv.indexOf('--scope');
const scope = scopeArgumentIndex === -1 ? 'all' : process.argv[scopeArgumentIndex + 1];

if (!['all', 'supabase', 'vercel'].includes(scope)) {
  console.error('Usage: node scripts/verify-project-binding.mjs [--scope all|supabase|vercel]');
  process.exit(2);
}

const linkedRefPath = 'supabase/.temp/project-ref';
const linkedRef = existsSync(linkedRefPath)
  ? readFileSync(linkedRefPath, 'utf8').trim()
  : '';

if (scope === 'all' || scope === 'supabase') {
  if (!linkedRef) {
    errors.push(`找不到 ${linkedRefPath}`);
  } else if (linkedRef !== expectedSupabaseRef) {
    const owner = forbiddenSupabaseRefs.get(linkedRef);
    errors.push(
      owner
        ? `Supabase ref ${linkedRef} 屬於${owner}，不可部署 SAENGAK`
        : `Supabase ref ${linkedRef} 不是 SAENGAK 預期的 ${expectedSupabaseRef}`,
    );
  }
}

const legacyVercelProjectPath = '.vercel/project.json';
const repositoryVercelProjectPath = '.vercel/repo.json';
let vercelProjectName = '';
if (existsSync(legacyVercelProjectPath)) {
  const vercelProject = JSON.parse(readFileSync(legacyVercelProjectPath, 'utf8'));
  vercelProjectName = vercelProject.projectName ?? '';
} else if (existsSync(repositoryVercelProjectPath)) {
  const vercelRepository = JSON.parse(readFileSync(repositoryVercelProjectPath, 'utf8'));
  const rootProject = vercelRepository.projects?.find((project) => project.directory === '.')
    ?? vercelRepository.projects?.[0];
  vercelProjectName = rootProject?.name ?? '';
}

if ((scope === 'all' || scope === 'vercel') && vercelProjectName !== expectedVercelProject) {
  errors.push(
    `Vercel project ${vercelProjectName || '(missing)'} 不是 ${expectedVercelProject}`,
  );
}

if (scope === 'all' || scope === 'vercel') {
  for (const envName of [
    'VITE_PUBLIC_CHECKOUT_SUPABASE_URL',
    'VITE_PUBLIC_SUPABASE_URL',
  ]) {
    const value = process.env[envName] ?? '';
    if (!value) {
      errors.push(`缺少 ${envName}，無法證明 Vercel 綁定到 SAENGAK Supabase`);
      continue;
    }
    try {
      const parsed = new URL(value);
      if (parsed.origin !== expectedSupabaseOrigin
        || parsed.pathname !== '/'
        || parsed.username
        || parsed.password
        || parsed.search
        || parsed.hash) {
        errors.push(`${envName} 必須精確指向 ${expectedSupabaseOrigin}`);
      }
    } catch {
      errors.push(`${envName} 不是有效 URL`);
    }
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  scope,
  supabaseRef: scope === 'all' || scope === 'supabase' ? linkedRef : 'not-checked',
  vercelProject: scope === 'all' || scope === 'vercel'
    ? vercelProjectName || 'not-linked-locally'
    : 'not-checked',
}, null, 2));
