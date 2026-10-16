import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  getShopifyAdminAccessToken: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('../api/_lib/supabase-admin.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/_lib/supabase-admin.js')>()),
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));
vi.mock('../api/shopify/discounts.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/shopify/discounts.js')>()),
  getShopifyAdminAccessToken: mocks.getShopifyAdminAccessToken,
}));

import {
  checkLucissiMembership,
  normalizePartnerEmail,
  signPartnerRequest,
  verifyPartnerSignature,
} from '../api/_lib/partner-member.js';
import { POST as memberStatus } from '../api/partner/member-status.js';
import { POST as claimPerk, generatePerkCode } from '../api/promotions/lucissi-member-perk.js';
import { isMemberPerkDiscount } from '../api/shopify/discounts.js';

const SECRET = 'x'.repeat(40);
const PERK_ID = 'gid://shopify/DiscountCodeNode/555';

function signedRequest(body: string, options: { id?: string; timestamp?: string; secret?: string } = {}) {
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  return new Request('https://lucissicare.com/api/partner/member-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Partner-Id': options.id ?? 'lucissi',
      'X-Partner-Timestamp': timestamp,
      'X-Partner-Signature': signPartnerRequest(options.secret ?? SECRET, timestamp, body),
    },
    body,
  });
}

beforeEach(() => {
  vi.stubEnv('PARTNER_MEMBER_SECRET', SECRET);
  vi.stubEnv('PARTNER_MEMBER_STATUS_URL', 'https://lucissi.com/api/partner/member-status');
  vi.stubEnv('LUCISSI_MEMBER_PERK_DISCOUNT_ID', PERK_ID);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'publishable');
  vi.stubEnv('SHOPIFY_APP_CLIENT_ID', 'client');
  vi.stubEnv('SHOPIFY_APP_CLIENT_SECRET', 'secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('partner signature', () => {
  it('accepts a fresh, correctly signed body and rejects tampering or stale requests', () => {
    const body = '{"email":"a@b.test"}';
    const ts = '1800000000';
    const signature = signPartnerRequest(SECRET, ts, body);
    expect(verifyPartnerSignature({ secret: SECRET, timestamp: ts, signature, rawBody: body, nowSeconds: 1800000100 })).toBe(true);
    expect(verifyPartnerSignature({ secret: SECRET, timestamp: ts, signature, rawBody: '{"email":"c@d.test"}', nowSeconds: 1800000100 })).toBe(false);
    expect(verifyPartnerSignature({ secret: SECRET, timestamp: ts, signature, rawBody: body, nowSeconds: 1800000400 })).toBe(false);
    expect(verifyPartnerSignature({ secret: SECRET, timestamp: ts, signature: null, rawBody: body })).toBe(false);
  });

  it('normalizes emails and rejects invalid ones', () => {
    expect(normalizePartnerEmail('  A@B.Test ')).toBe('a@b.test');
    expect(normalizePartnerEmail('not-an-email')).toBeUndefined();
    expect(normalizePartnerEmail(42)).toBeUndefined();
  });
});

describe('checkLucissiMembership', () => {
  it('sends a signed request and maps the answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ isMember: true }), { status: 200 }));
    await expect(checkLucissiMembership('A@B.test', fetchImpl)).resolves.toBe('member');
    const [, init] = fetchImpl.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Partner-Id']).toBe('lucissi-care');
    expect(init.body).toBe('{"email":"a@b.test"}');
    expect(verifyPartnerSignature({
      secret: SECRET,
      timestamp: headers['X-Partner-Timestamp'],
      signature: headers['X-Partner-Signature'],
      rawBody: init.body as string,
    })).toBe(true);
  });

  it('returns unavailable when misconfigured or the partner fails', async () => {
    vi.stubEnv('PARTNER_MEMBER_SECRET', 'short');
    await expect(checkLucissiMembership('a@b.test', vi.fn())).resolves.toBe('unavailable');
    vi.stubEnv('PARTNER_MEMBER_SECRET', SECRET);
    await expect(checkLucissiMembership('a@b.test', vi.fn().mockResolvedValue(new Response('no', { status: 500 })))).resolves.toBe('unavailable');
    await expect(checkLucissiMembership('a@b.test', vi.fn().mockResolvedValue(new Response('{"isMember":"yes"}')))).resolves.toBe('unavailable');
    await expect(checkLucissiMembership('a@b.test', vi.fn().mockResolvedValue(new Response('{"isMember":false}')))).resolves.toBe('not_member');
  });
});

describe('POST /api/partner/member-status', () => {
  it('answers only isMember for a signed request', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.getSupabaseAdminClient.mockReturnValue({ rpc });
    const response = await memberStatus(signedRequest('{"email":" Member@Example.test "}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ isMember: true });
    expect(rpc).toHaveBeenCalledWith('partner_member_exists', { p_email: 'member@example.test' });
  });

  it('rejects wrong partner ids, bad signatures and missing secrets', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue({ rpc: vi.fn() });
    expect((await memberStatus(signedRequest('{"email":"a@b.test"}', { id: 'someone' }))).status).toBe(401);
    expect((await memberStatus(signedRequest('{"email":"a@b.test"}', { secret: 'y'.repeat(40) }))).status).toBe(401);
    expect((await memberStatus(signedRequest('{"email":"bad"}'))).status).toBe(400);
    vi.stubEnv('PARTNER_MEMBER_SECRET', '');
    expect((await memberStatus(signedRequest('{"email":"a@b.test"}'))).status).toBe(503);
  });
});

function perkAdminClient(options: { existing?: unknown; paidOrders?: unknown[]; insertError?: { code: string } | null }) {
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const from = vi.fn((table: string) => {
    if (table === 'partner_member_perks') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: options.existing ?? null, error: null }) }) }),
        insert,
        delete: () => ({ eq: deleteEq }),
      };
    }
    return {
      select: () => ({ eq: () => ({ or: () => ({ limit: vi.fn().mockResolvedValue({ data: options.paidOrders ?? [], error: null }) }) }) }),
    };
  });
  return { client: { from }, insert, deleteEq };
}

function perkRequest() {
  return new Request('https://lucissicare.com/api/promotions/lucissi-member-perk', {
    method: 'POST',
    headers: { Origin: 'https://lucissicare.com', Authorization: 'Bearer token' },
  });
}

function signedInAs(user: Record<string, unknown> | null) {
  mocks.createClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'invalid' } }) },
  });
}

describe('POST /api/promotions/lucissi-member-perk', () => {
  const member = { id: 'u1', email: 'member@example.test', email_confirmed_at: '2026-10-01T00:00:00Z' };

  it('issues a unique Shopify code to a verified LUCISSI member on their first CARE order', async () => {
    signedInAs(member);
    const { client, insert } = perkAdminClient({});
    mocks.getSupabaseAdminClient.mockReturnValue(client);
    mocks.getShopifyAdminAccessToken.mockResolvedValue('admin-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ isMember: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { discountRedeemCodeBulkAdd: { bulkCreation: { id: 'gid://x' }, userErrors: [] } } })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await claimPerk(perkRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.perk.coupon_code).toMatch(/^LC[A-Z2-9]{10}$/);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', coupon_code: body.perk.coupon_code }));
    const shopifyCall = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(shopifyCall.variables).toEqual({ discountId: PERK_ID, codes: [{ code: body.perk.coupon_code }] });
  });

  it('returns the existing code instead of issuing a second one', async () => {
    signedInAs(member);
    const { client, insert } = perkAdminClient({ existing: { coupon_code: 'LCEXISTING01', status: 'issued' } });
    mocks.getSupabaseAdminClient.mockReturnValue(client);
    const response = await claimPerk(perkRequest());
    expect(await response.json()).toMatchObject({ success: true, alreadyClaimed: true, perk: { coupon_code: 'LCEXISTING01' } });
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses members with a paid CARE order, non-members and unverified emails', async () => {
    signedInAs(member);
    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({ paidOrders: [{ id: 'o1' }] }).client);
    expect((await claimPerk(perkRequest())).status).toBe(409);

    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({}).client);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ isMember: false }))));
    const notMember = await claimPerk(perkRequest());
    expect(notMember.status).toBe(403);
    expect((await notMember.json()).code).toBe('NOT_LUCISSI_MEMBER');

    signedInAs({ ...member, email_confirmed_at: null });
    expect((await claimPerk(perkRequest())).status).toBe(403);
  });

  it('rolls back the claim when Shopify cannot create the code', async () => {
    signedInAs(member);
    const { client, deleteEq } = perkAdminClient({});
    mocks.getSupabaseAdminClient.mockReturnValue(client);
    mocks.getShopifyAdminAccessToken.mockResolvedValue('admin-token');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ isMember: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { discountRedeemCodeBulkAdd: { bulkCreation: null, userErrors: [{ message: 'denied' }] } } }))));
    const response = await claimPerk(perkRequest());
    expect(response.status).toBe(502);
    expect(deleteEq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('is unavailable until the perk discount is configured', async () => {
    vi.stubEnv('LUCISSI_MEMBER_PERK_DISCOUNT_ID', '');
    signedInAs(member);
    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({}).client);
    expect((await claimPerk(perkRequest())).status).toBe(503);
  });
});

describe('perk helpers', () => {
  it('generates codes from an unambiguous alphabet', () => {
    expect(generatePerkCode(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 31]))).toBe('LCABCDEFGHJ9');
  });

  it('identifies the perk discount so it stays out of public listings', () => {
    expect(isMemberPerkDiscount(PERK_ID)).toBe(true);
    expect(isMemberPerkDiscount('gid://shopify/DiscountCodeNode/1')).toBe(false);
  });
});
