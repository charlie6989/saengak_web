import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 取得 Request 的實際 Origin。
 * 僅信任 Request 物件自身建構出的 URL（對應實際路由抵達的主機），
 * 嚴禁採信 `x-forwarded-host`／`x-forwarded-proto` 等用戶端可任意夾帶、偽造的標頭來推算來源，
 * 避免白名單比對被這類可轉發標頭繞過（SEC-3 稽核修正：原實作以 x-forwarded-host 計算「有效
 * Origin」後，又拿它與 requestOrigin 互相比對放行，等同讓夾帶相同偽造標頭的跨域請求繞過白名單）。
 */
export function getEffectiveOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return 'https://saengak.com.tw';
  }
}

/**
 * 驗證請求 Origin 是否合法（防禦 CSRF 與惡意跨域呼叫）
 * 1. 若有 Origin 標頭：僅接受「與本次請求真實 URL 同源」或「命中白名單」兩種情況放行，
 *    一律採完整比對，不再信任可被任意夾帶偽造的 x-forwarded-host 標頭。
 * 2. 若無 Origin 標頭：
 *    - 依據 W3C/Fetch 規範，瀏覽器同源 GET/HEAD 請求不附帶 Origin 標頭，
 *      此時以 Referer 標頭、Sec-Fetch-Site 或主機同源判定予以合法放行。
 *    - 若帶有非白名單之外站 Referer 則嚴格阻擋。
 *    - 主機同源判定一律對白名單清單完整比對（含由白名單反推出的 Host 清單），
 *      不再使用 `includes()`/`endsWith()` 等子字串比對（原本 `host.endsWith('.vercel.app')`
 *      會放行任何 Vercel 專案的 preview 網址，範圍過寬，已收斂為僅允許明確清單內的主機）。
 */
export function isOriginAllowed(requestOrigin: string | null, request: Request): boolean {
  // 預設允許清單
  const defaultAllowed = [
    'https://saengak.com.tw',
    'https://www.saengak.com.tw',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  const customAllowed = (process.env.CheckoutAllowedOrigins ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = [...new Set([...defaultAllowed, ...customAllowed])];

  // 由白名單清單反推出對應的 Host（含埠號）清單，供無 Origin 標頭時的同源判定使用，
  // 一律完整比對，避免任意子網域或名稱中帶有允許字樣的惡意主機被誤判為合法來源。
  const allowedHosts = new Set(
    allowedOrigins
      .map((origin) => {
        try {
          return new URL(origin).host;
        } catch {
          return null;
        }
      })
      .filter((host): host is string => Boolean(host)),
  );

  const effectiveOrigin = getEffectiveOrigin(request);

  // 1. 若請求附帶 Origin 標頭（跨域請求或瀏覽器 POST/PUT 請求）
  if (requestOrigin) {
    if (requestOrigin === effectiveOrigin) return true;
    return allowedOrigins.includes(requestOrigin);
  }

  // 2. 若缺少 Origin 標頭（瀏覽器同源 GET 請求或本機伺服器內部調用）
  // 檢查 Referer 標頭
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) return true;
      if (refererOrigin === effectiveOrigin) return true;
      // 帶有非白名單的外站 Referer 嚴格拒絕
      return false;
    } catch {
      return false;
    }
  }

  // 檢查 Sec-Fetch-Site 標頭
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
    return true;
  }

  // 針對唯讀安全方法 (GET / HEAD)，嚴格比對 Host 是否命中白名單（完整比對，非子字串包含）
  const method = request.method?.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    if (allowedOrigins.includes(effectiveOrigin)) return true;

    const host = (request.headers.get('host') || '').toLowerCase();
    if (host && allowedHosts.has(host)) return true;
  }

  return false;
}

/**
 * 安全的字串 Timing-Safe 比較
 */
export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(String(left)).digest();
  const rightHash = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

/**
 * 計算 Payload 之 SHA-256 Hash
 */
export function hashPayload(payload: unknown): string {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * 取得用戶端識別 Key (基於 IP 或 Token)
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    '127.0.0.1'
  );
}

/**
 * 產生一致的 JSON Response (含安全標頭與 no-store)
 */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

/**
 * 交易 Payload 個資最小化與敏感資料遮蔽 (Zero-Card-Storage & Minimal PII)
 */
export function sanitizeTransactionPayload(rawPayload: Record<string, unknown>): Record<string, unknown> {
  const {
    items,
    shippingMethod,
    invoiceType,
    currency,
    subtotal,
    shippingFee,
    totalAmount,
    userId,
    // 嚴格剔除 prime, card_number, cvv, 完整姓名電話等
  } = rawPayload;

  return {
    items: Array.isArray(items)
      ? items.map((item: any) => ({
          variantId: String(item.variantId ?? item.id ?? ''),
          quantity: Number(item.quantity ?? 1),
        }))
      : [],
    shippingMethod: typeof shippingMethod === 'string' ? shippingMethod : 'standard',
    invoiceType: typeof invoiceType === 'string' ? invoiceType : 'personal',
    currency: currency ?? 'TWD',
    subtotal: Number(subtotal ?? 0),
    shippingFee: Number(shippingFee ?? 0),
    totalAmount: Number(totalAmount ?? 0),
    userId: typeof userId === 'string' ? userId : null,
  };
}
