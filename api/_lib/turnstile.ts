/**
 * Cloudflare Turnstile 伺服器端驗證（siteverify）
 * 依據 docs/GUEST_CHECKOUT_PLAN.md §3.1：訪客結帳不需登入，必須在 API 端驗證 Turnstile token。
 * 未設定 TURNSTILE_SECRET_KEY 或 Cloudflare 無法連線時一律 fail-closed。
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;

export type TurnstileVerification = 'verified' | 'rejected' | 'unavailable';

export function getTurnstileSecretKey(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || undefined;
}

export function parseTurnstileToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const token = value.trim();
  return token && token.length <= MAX_TOKEN_LENGTH ? token : undefined;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<TurnstileVerification> {
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
    const result = await response.json().catch(() => null) as { success?: unknown } | null;
    if (!result) return 'unavailable';
    return result.success === true ? 'verified' : 'rejected';
  } catch {
    return 'unavailable';
  }
}
