/**
 * 以 IndexNow 一次通知 Bing（與其他支援 IndexNow 的搜尋引擎）正式站 sitemap 的全部網址。
 * Google 不支援 IndexNow；Google 仍靠 sitemap 與 Search Console。
 *
 * 用法：npm run submit:indexnow            讀正式站 sitemap.xml 後送出
 *      npm run submit:indexnow -- --dry-run 只列出網址，不送出
 *
 * 金鑰檔 public/<key>.txt 必須已部署到正式站；送出前會先確認內容相符。
 */
const SITE = 'https://lucissicare.com';
const KEY = '1ef4c0132396ef415cb2a3f9269d845c';
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
const ENDPOINT = 'https://www.bing.com/indexnow';
const dryRun = process.argv.includes('--dry-run');

/** 只取 <url><loc>，不含 <image:loc>。 */
export function sitemapPageUrls(xml) {
  const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  return [...new Set(urls)].filter((url) => url.startsWith(`${SITE}/`) || url === SITE);
}

async function main() {
  const sitemap = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15_000) });
  if (!sitemap.ok) throw new Error(`sitemap.xml responded ${sitemap.status}`);
  const urlList = sitemapPageUrls(await sitemap.text());
  if (urlList.length === 0) throw new Error('sitemap.xml has no page URLs');
  console.log(`${urlList.length} URLs from ${SITE}/sitemap.xml`);

  if (dryRun) {
    for (const url of urlList) console.log(url);
    return;
  }

  const keyFile = await fetch(KEY_LOCATION, { signal: AbortSignal.timeout(15_000) });
  const keyText = keyFile.ok ? (await keyFile.text()).trim() : '';
  if (keyText !== KEY) throw new Error(`Key file ${KEY_LOCATION} is not live yet (HTTP ${keyFile.status}); deploy it first.`);

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: KEY_LOCATION, urlList }),
    signal: AbortSignal.timeout(30_000),
  });
  // 200 = 已收到；202 = 已收到、金鑰待驗證；其他狀態碼視為失敗
  console.log(`IndexNow ${ENDPOINT} responded ${response.status}`);
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow rejected the submission: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
