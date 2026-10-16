/**
 * Cloudflare Turnstile 伺服器端驗證（siteverify）
 * 依據 docs/GUEST_CHECKOUT_PLAN.md §3.1：訪客結帳不需登入，必須在 API 端驗證 Turnstile token。
 * 未設定 TURNSTILE_SECRET_KEY 或 Cloudflare 無法連線時一律 fail-closed。
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;
const DEFAULT_ALLOWED_HOSTNAMES = ['lucissicare.com', 'www.lucissicare.com', 'localhost'];

export const TURNSTILE_GUEST_CHECKOUT_ACTION = 'guest_checkout';

export type TurnstileVerification = 'verified' | 'rejected' | 'unavailable';

export function getTurnstileSecretKey(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || undefined;
}

// TURNSTILE_ALLOWED_HOSTNAMES（逗號分隔）會取代預設清單，例如 Vercel Preview 或測試金鑰回傳的主機名稱。
function allowedHostnames(): Set<string> {
  const configured = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_HOSTNAMES);
}

export function parseTurnstileToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const token = value.trim();
  return token && token.length <= MAX_TOKEN_LENGTH ? token : undefined;
}

/**
 * 除了 success，還要求 hostname 在允許清單內；若 Cloudflare 回傳 action，必須等於 expectedAction。
 * 沒有 action 時放行，讓 Cloudflare 測試金鑰仍可使用。
 */
export async function verifyTurnstileToken(
  token: string,
  options: { remoteIp?: string; expectedAction?: string } = {},
): Promise<TurnstileVerification> {
  const { remoteIp, expectedAction } = options;
  const secret = getTurnstileSecretKey();
  if (!secret) return 'unavailable';

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!response.ok) return 'unavailable';
    const result = await response.json().catch(() => null) as {
      success?: unknown;
      hostname?: unknown;
      action?: unknown;
    } | null;
    if (!result) return 'unavailable';
    if (result.success !== true) return 'rejected';

    const hostname = typeof result.hostname === 'string' ? result.hostname.trim().toLowerCase() : '';
    if (!hostname || !allowedHostnames().has(hostname)) return 'rejected';

    const action = typeof result.action === 'string' ? result.action : '';
    if (expectedAction && action && action !== expectedAction) return 'rejected';
    return 'verified';
  } catch {
    return 'unavailable';
  }
}
