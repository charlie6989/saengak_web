import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * LUCISSI ↔ LUCISSI CARE 會員資格互認（第 1 階段）的伺服器對伺服器契約。
 *
 * 兩站各自提供 `POST /api/partner/member-status`，並以同一把 `PARTNER_MEMBER_SECRET`
 * 對 `${timestamp}.${rawBody}` 做 HMAC-SHA256 簽章。回應只有 `{ isMember: boolean }`，
 * 不交換地址、訂單或其他個資。母站 LUCISSI_website 必須實作完全相同的格式。
 */

export const PARTNER_ID_SELF = 'lucissi-care';
export const PARTNER_ID_REMOTE = 'lucissi';
export const PARTNER_SIGNATURE_MAX_SKEW_SECONDS = 300;
export const PARTNER_SECRET_MIN_LENGTH = 32;
export const PARTNER_REQUEST_TIMEOUT_MS = 5000;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PartnerMembership = 'member' | 'not_member' | 'unavailable';

export function getPartnerSecret(): string | undefined {
  const secret = process.env.PARTNER_MEMBER_SECRET?.trim();
  return secret && secret.length >= PARTNER_SECRET_MIN_LENGTH ? secret : undefined;
}

export function normalizePartnerEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) return undefined;
  return email;
}

export function signPartnerRequest(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** 驗證對方送來的簽章與時間戳；任何不符一律回傳 false。 */
export function verifyPartnerSignature(options: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds?: number;
}): boolean {
  const { secret, timestamp, signature, rawBody } = options;
  if (!timestamp || !signature || !/^\d{9,12}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) {
    return false;
  }
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > PARTNER_SIGNATURE_MAX_SKEW_SECONDS) {
    return false;
  }
  const expected = Buffer.from(signPartnerRequest(secret, timestamp, rawBody), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * 詢問 LUCISSI 母站：這個已驗證的 Email 是不是 LUCISSI 會員。
 * 設定缺漏、逾時、簽章或格式錯誤時回傳 'unavailable'，由呼叫端決定如何告知會員。
 */
export async function checkLucissiMembership(email: string, fetchImpl: typeof fetch = fetch): Promise<PartnerMembership> {
  const secret = getPartnerSecret();
  const url = process.env.PARTNER_MEMBER_STATUS_URL?.trim();
  const normalizedEmail = normalizePartnerEmail(email);
  if (!secret || !url || !normalizedEmail) return 'unavailable';

  const rawBody = JSON.stringify({ email: normalizedEmail });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PARTNER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Id': PARTNER_ID_SELF,
        'X-Partner-Timestamp': timestamp,
        'X-Partner-Signature': signPartnerRequest(secret, timestamp, rawBody),
      },
      body: rawBody,
      signal: controller.signal,
    });
    if (!response.ok) return 'unavailable';
    const payload = await response.json().catch(() => null) as { isMember?: unknown } | null;
    if (typeof payload?.isMember !== 'boolean') return 'unavailable';
    return payload.isMember ? 'member' : 'not_member';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}
