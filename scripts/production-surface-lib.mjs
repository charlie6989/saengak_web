export const PRODUCTION_BASE_URL = 'https://saengak.com.tw';
export const SUPABASE_FUNCTIONS_BASE_URL = 'https://tmqzkagkrzhioftvwbqo.supabase.co/functions/v1';

export const REQUIRED_PRODUCTION_ROUTES = [
  '/',
  '/search',
  '/product/3',
  '/register',
  '/forgot-password',
  '/profile',
];

export const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'upgrade-insecure-requests',
];

const requiredHeaders = new Map([
  ['cross-origin-opener-policy', 'same-origin-allow-popups'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
]);

const protectedFunctions = [
  ['create-shopify-cart', 'POST'],
  ['get-articles', 'GET'],
  ['get-collections', 'GET'],
  ['get-products', 'GET'],
  ['get-products-by-tag', 'GET'],
  ['shopify-orders-webhook', 'POST'],
  ['smart-search', 'GET'],
];

function result(id, passed, message, details = {}) {
  return { id, passed, message, ...details };
}

function extractAssets(html) {
  const paths = new Set();
  for (const pattern of [
    /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi,
    /<link\b[^>]*\bhref="([^"]+\.css(?:\?[^"]*)?)"[^>]*>/gi,
  ]) {
    for (const match of html.matchAll(pattern)) paths.add(match[1]);
  }
  return [...paths];
}

function isExpectedAssetType(pathname, contentType) {
  if (pathname.endsWith('.js')) return /javascript/.test(contentType);
  if (pathname.endsWith('.css')) return /text\/css/.test(contentType);
  return true;
}

export async function verifyProductionSurface({
  fetchImpl = fetch,
  baseUrl = PRODUCTION_BASE_URL,
  functionsBaseUrl = SUPABASE_FUNCTIONS_BASE_URL,
} = {}) {
  const checks = [];
  const routeBodies = new Map();

  for (const route of REQUIRED_PRODUCTION_ROUTES) {
    const requestedUrl = new URL(route, baseUrl);
    try {
      const response = await fetchImpl(requestedUrl, {
        headers: { accept: 'text/html' },
        redirect: 'follow',
      });
      const body = await response.text();
      const responseUrl = new URL(response.url || requestedUrl);
      const contentType = response.headers.get('content-type') || '';
      const passed = response.status === 200
        && responseUrl.protocol === 'https:'
        && responseUrl.host === new URL(baseUrl).host
        && responseUrl.pathname === requestedUrl.pathname
        && /text\/html/.test(contentType)
        && /id=["']root["']/.test(body);
      checks.push(result(
        `route:${route}`,
        passed,
        passed ? `${route} 回傳可信的 HTTPS SPA shell` : `${route} 未通過正式路由檢查`,
        {
          status: response.status,
          requestedPathname: requestedUrl.pathname,
          responsePathname: responseUrl.pathname,
          responseUrl: responseUrl.href,
          contentType,
        },
      ));
      routeBodies.set(route, { body, response });
    } catch (error) {
      checks.push(result(`route:${route}`, false, `${route} 無法讀取`, {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  const root = routeBodies.get('/');
  if (root) {
    for (const [header, expected] of requiredHeaders) {
      const actual = root.response.headers.get(header) || '';
      checks.push(result(
        `header:${header}`,
        actual === expected,
        actual === expected ? `${header} 已正確設定` : `${header} 應為 ${expected}`,
        { actual },
      ));
    }

    const permissionsPolicy = root.response.headers.get('permissions-policy') || '';
    const permissionsPassed = ['camera=()', 'geolocation=()', 'microphone=()', 'payment=(self)']
      .every((directive) => permissionsPolicy.includes(directive));
    checks.push(result(
      'header:permissions-policy',
      permissionsPassed,
      permissionsPassed ? 'Permissions-Policy 已限制非必要瀏覽器能力' : 'Permissions-Policy 不完整',
      { actual: permissionsPolicy },
    ));

    const csp = root.response.headers.get('content-security-policy') || '';
    const missingCspDirectives = REQUIRED_CSP_DIRECTIVES.filter((directive) => !csp.includes(directive));
    checks.push(result(
      'header:content-security-policy',
      missingCspDirectives.length === 0,
      missingCspDirectives.length === 0 ? 'Content-Security-Policy 必要規則完整' : 'Content-Security-Policy 缺少必要規則',
      { missing: missingCspDirectives },
    ));

    const discoveredAssets = extractAssets(root.body);
    const assets = discoveredAssets.filter((asset) => new URL(asset, baseUrl).host === new URL(baseUrl).host);
    checks.push(result(
      'assets:discovered',
      assets.some((asset) => asset.includes('.js')) && assets.some((asset) => asset.includes('.css')),
      '首頁必須同時載入 JavaScript 與 CSS bundle',
      { assets, externalAssets: discoveredAssets.filter((asset) => !assets.includes(asset)) },
    ));

    for (const asset of assets) {
      const assetUrl = new URL(asset, baseUrl);
      try {
        const response = await fetchImpl(assetUrl, { redirect: 'follow' });
        const contentType = response.headers.get('content-type') || '';
        const passed = response.status === 200 && isExpectedAssetType(assetUrl.pathname, contentType);
        checks.push(result(
          `asset:${assetUrl.pathname}`,
          passed,
          passed ? `${assetUrl.pathname} 可讀` : `${assetUrl.pathname} bundle 不可用`,
          { status: response.status, contentType },
        ));
      } catch (error) {
        checks.push(result(`asset:${assetUrl.pathname}`, false, `${assetUrl.pathname} 無法讀取`, {
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }

  for (const [slug, method] of protectedFunctions) {
    const url = new URL(`${functionsBaseUrl.replace(/\/$/, '')}/${slug}`);
    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          origin: baseUrl,
        },
        body: method === 'POST' ? '{}' : undefined,
      });
      checks.push(result(
        `edge-auth:${slug}`,
        response.status === 401,
        response.status === 401
          ? `${slug} 正確拒絕缺少憑證的請求`
          : `${slug} 缺少憑證時應回傳 401`,
        { status: response.status },
      ));
    } catch (error) {
      checks.push(result(`edge-auth:${slug}`, false, `${slug} 無法完成未授權探針`, {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  const failed = checks.filter((check) => !check.passed);
  return {
    ok: failed.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    counts: { pass: checks.length - failed.length, fail: failed.length },
    checks,
  };
}
