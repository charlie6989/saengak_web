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
 * 驗證請求 Origin 是否合法（防禦 CSRF）
 * 嚴格白名單：缺少 Origin 標頭一律視為不合法來源並拒絕（Fail-Closed），
 * 避免無 Origin 的伺服器對伺服器 / 腳本呼叫繞過白名單檢查。
 */
export function isOriginAllowed(requestOrigin: string | null, request: Request): boolean {
  if (!requestOrigin) return false;

  const effectiveOrigin = getEffectiveOrigin(request);
  if (requestOrigin === effectiveOrigin) return true;
  try {
    if (requestOrigin === new URL(request.url).origin) return true;
  } catch {
    // ignore
  }

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
  return allowedOrigins.includes(requestOrigin);
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
