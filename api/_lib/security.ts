import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 取得 Request 的實際 Origin 或 Host
 */
export function getEffectiveOrigin(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return 'https://saengak.com.tw';
  }
}

/**
 * 驗證請求 Origin 是否合法（防禦 CSRF 與惡意跨域呼叫）
 * 1. 若有 Origin 標頭：進行嚴格白名單比對（禁止非授權跨域來源）。
 * 2. 若無 Origin 標頭：
 *    - 依據 W3C/Fetch 規範，瀏覽器同源 GET/HEAD 請求不附帶 Origin 標頭，
 *      此時以 Referer 標頭、Sec-Fetch-Site 或主機同源判定予以合法放行。
 *    - 若帶有非白名單之外站 Referer 則嚴格阻擋。
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

  // 1. 若請求附帶 Origin 標頭（跨域請求或瀏覽器 POST/PUT 請求）
  if (requestOrigin) {
    const effectiveOrigin = getEffectiveOrigin(request);
    if (requestOrigin === effectiveOrigin) return true;
    try {
      if (requestOrigin === new URL(request.url).origin) return true;
    } catch {
      // ignore
    }
    return allowedOrigins.includes(requestOrigin);
  }

  // 2. 若缺少 Origin 標頭（瀏覽器同源 GET 請求或本機伺服器內部調用）
  // 檢查 Referer 標頭
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) return true;
      if (refererOrigin === getEffectiveOrigin(request)) return true;
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

  // 針對唯讀安全方法 (GET / HEAD)，檢驗 Host 是否為允許主機
  const method = request.method?.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const effectiveOrigin = getEffectiveOrigin(request);
    if (allowedOrigins.includes(effectiveOrigin)) return true;

    const host = request.headers.get('host') || '';
    if (
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('saengak.com.tw') ||
      host.endsWith('.vercel.app')
    ) {
      return true;
    }
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
