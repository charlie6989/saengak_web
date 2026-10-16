import { jsonResponse } from '../_lib/security.js';
import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import {
  PARTNER_ID_REMOTE,
  getPartnerSecret,
  normalizePartnerEmail,
  verifyPartnerSignature,
} from '../_lib/partner-member.js';

/**
 * 供 LUCISSI 母站伺服器呼叫：這個 Email 是否為已驗證 Email 的 LUCISSI CARE 會員。
 * 僅接受簽章正確的伺服器對伺服器請求，回應只有 `{ isMember }`。
 */
export async function POST(request: Request): Promise<Response> {
  const secret = getPartnerSecret();
  if (!secret) {
    return jsonResponse({ error: 'Partner membership is not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signed = request.headers.get('X-Partner-Id') === PARTNER_ID_REMOTE && verifyPartnerSignature({
    secret,
    timestamp: request.headers.get('X-Partner-Timestamp'),
    signature: request.headers.get('X-Partner-Signature'),
    rawBody,
  });
  if (!signed) {
    return jsonResponse({ error: 'Invalid partner signature' }, { status: 401 });
  }

  let parsed: { email?: unknown } | null = null;
  try {
    parsed = JSON.parse(rawBody) as { email?: unknown };
  } catch {
    parsed = null;
  }
  const email = normalizePartnerEmail(parsed?.email);
  if (!email) {
    return jsonResponse({ error: 'Provide a valid email' }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonResponse({ error: 'Membership lookup is unavailable' }, { status: 503 });
  }

  const { data, error } = await adminClient.rpc('partner_member_exists', { p_email: email });
  if (error) {
    console.error('partner member lookup failed', error.message);
    return jsonResponse({ error: 'Membership lookup is unavailable' }, { status: 503 });
  }

  return jsonResponse({ isMember: data === true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'POST') return POST(request);
  return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
}

export default { fetch: handler };
