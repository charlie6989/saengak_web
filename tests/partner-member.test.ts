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
import { POST as claimPerk } from '../api/promotions/lucissi-member-perk.js';
import { generatePerkCode, isMemberPerkCode, isMemberPerkTitle } from '../api/_lib/member-perk-code.js';
import { readOrderForPerk, settleMemberPerkAfterOrder } from '../api/_lib/member-perk.js';
import { isMemberPerkDiscountNode } from '../api/shopify/discounts.js';
import { POST as claimPromotion } from '../api/promotions/claim.js';

const SECRET = 'x'.repeat(40);

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
  vi.stubEnv('LUCISSI_MEMBER_PERK_ENABLED', 'true');
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

type PerkRow = { status: string; coupon_code: string; updated_at?: string } | null;

function perkAdminClient(options: { existing?: PerkRow; paidOrders?: unknown[]; insertError?: { code: string } | null }) {
  const calls = { insert: vi.fn(), deletes: [] as unknown[][], updates: [] as unknown[] };
  const from = vi.fn((table: string) => {
    if (table === 'partner_member_perks') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: options.existing ?? null, error: null }) }) }),
        insert: (row: unknown) => {
          calls.insert(row);
          return Promise.resolve({ error: options.insertError ?? null });
        },
        delete: () => ({ eq: (...a: unknown[]) => ({ eq: (...b: unknown[]) => { calls.deletes.push([...a, ...b]); return Promise.resolve({ error: null }); } }) }),
        update: (values: Record<string, unknown>) => {
          calls.updates.push(values);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: { coupon_code: (calls.insert.mock.calls[0]?.[0] as any)?.coupon_code, status: values.status, expires_at: values.expires_at }, error: null }),
                }),
              }),
            }),
          };
        },
      };
    }
    return {
      select: () => ({ eq: () => ({ or: () => ({ limit: vi.fn().mockResolvedValue({ data: options.paidOrders ?? [], error: null }) }) }) }),
    };
  });
  return { client: { from }, calls };
}

function perkRequest() {
  return new Request('https://lucissicare.com/api/promotions/lucissi-member-perk', {
    method: 'POST',
    headers: { Origin: 'https://lucissicare.com', Authorization: 'Bearer token' },
  });
}

function signedInAs(user: Record<string, unknown> | null, rpcError: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: 0, error: rpcError });
  mocks.createClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'invalid' } }) },
    rpc,
  });
  return rpc;
}

const shopifyOk = (data: unknown) => new Response(JSON.stringify({ data }));

describe('POST /api/promotions/lucissi-member-perk', () => {
  const member = { id: 'u1', email: 'Member@Example.test', email_confirmed_at: '2026-10-01T00:00:00Z' };

  it('claims guest orders first, then issues a single-use discount bound to the member', async () => {
    const rpc = signedInAs(member);
    const { client, calls } = perkAdminClient({});
    mocks.getSupabaseAdminClient.mockReturnValue(client);
    mocks.getShopifyAdminAccessToken.mockResolvedValue('admin-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ isMember: true })))
      .mockResolvedValueOnce(shopifyOk({ customers: { nodes: [{ id: 'gid://shopify/Customer/9' }] } }))
      .mockResolvedValueOnce(shopifyOk({ discountCodeFreeShippingCreate: { codeDiscountNode: { id: 'gid://shopify/DiscountCodeNode/77' }, userErrors: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await claimPerk(perkRequest());
    const body = (await response.json()) as any;
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('claim_guest_orders');
    expect(calls.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', email_normalized: 'member@example.test', status: 'pending' }));
    expect(body.perk.status).toBe('issued');
    expect(body.perk.coupon_code).toMatch(/^LC[A-Z2-9]{10}$/);

    const input = JSON.parse(fetchMock.mock.calls[2][1].body).variables.input;
    // Shopify rejects appliesOnOneTimePurchase/appliesOnSubscription on shops without subscriptions
    expect(input).not.toHaveProperty('appliesOnOneTimePurchase');
    expect(input).not.toHaveProperty('appliesOnSubscription');
    expect(input).toMatchObject({ code: body.perk.coupon_code, usageLimit: 1, appliesOncePerCustomer: true, context: { customers: { add: ['gid://shopify/Customer/9'] } } });
    expect(input.title).toBe(`LUCISSI 會員首單免運｜${body.perk.coupon_code}`);
    expect(calls.updates[0]).toMatchObject({ status: 'issued', shopify_discount_id: 'gid://shopify/DiscountCodeNode/77' });
  });

  it('returns an issued code again, and reports a fresh pending claim as in progress', async () => {
    signedInAs(member);
    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({ existing: { status: 'issued', coupon_code: 'LCEXISTING01', updated_at: new Date().toISOString() } }).client);
    expect((await (await claimPerk(perkRequest())).json()) as any).toMatchObject({ success: true, alreadyClaimed: true, perk: { coupon_code: 'LCEXISTING01' } });

    const pending = perkAdminClient({ existing: { status: 'pending', coupon_code: 'LCPENDING001', updated_at: new Date().toISOString() } });
    mocks.getSupabaseAdminClient.mockReturnValue(pending.client);
    const response = await claimPerk(perkRequest());
    expect(response.status).toBe(409);
    expect(((await response.json()) as any).code).toBe('PERK_IN_PROGRESS');
    expect(pending.calls.insert).not.toHaveBeenCalled();
  });

  it('treats a concurrent insert as in progress instead of returning its code', async () => {
    signedInAs(member);
    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({ insertError: { code: '23505' } }).client);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ isMember: true }))));
    const response = await claimPerk(perkRequest());
    expect(response.status).toBe(409);
    expect(((await response.json()) as any).code).toBe('PERK_IN_PROGRESS');
  });

  it('refuses members with a paid order, non-members, unverified emails and failed guest claims', async () => {
    signedInAs(member);
    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({ paidOrders: [{ id: 'o1' }] }).client);
    expect((await claimPerk(perkRequest())).status).toBe(409);

    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({}).client);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ isMember: false }))));
    const notMember = await claimPerk(perkRequest());
    expect(notMember.status).toBe(403);
    expect(((await notMember.json()) as any).code).toBe('NOT_LUCISSI_MEMBER');

    signedInAs(member, { message: 'boom' });
    expect((await claimPerk(perkRequest())).status).toBe(503);

    signedInAs({ ...member, email_confirmed_at: null });
    expect((await claimPerk(perkRequest())).status).toBe(403);
  });

  it('removes the pending claim when Shopify cannot create the discount', async () => {
    signedInAs(member);
    const { client, calls } = perkAdminClient({});
    mocks.getSupabaseAdminClient.mockReturnValue(client);
    mocks.getShopifyAdminAccessToken.mockResolvedValue('admin-token');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ isMember: true })))
      .mockResolvedValueOnce(shopifyOk({ customers: { nodes: [{ id: 'gid://shopify/Customer/9' }] } }))
      .mockResolvedValueOnce(shopifyOk({ discountCodeFreeShippingCreate: { codeDiscountNode: null, userErrors: [{ message: 'denied' }] } })));
    const response = await claimPerk(perkRequest());
    expect(response.status).toBe(502);
    expect(calls.deletes[0]).toEqual(['user_id', 'u1', 'status', 'pending']);
    expect(calls.updates).toHaveLength(0);
  });

  it('stays off until the server switch is enabled', async () => {
    vi.stubEnv('LUCISSI_MEMBER_PERK_ENABLED', '');
    signedInAs(member);
    mocks.getSupabaseAdminClient.mockReturnValue(perkAdminClient({}).client);
    expect((await claimPerk(perkRequest())).status).toBe(503);
  });
});

describe('first-order settlement from the order webhook', () => {
  function settleClient(perk: Record<string, unknown> | null) {
    const updates: unknown[] = [];
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: perk, error: null }) }) }) }),
        update: (values: unknown) => { updates.push(values); return { eq: vi.fn().mockResolvedValue({ error: null }) }; },
      }),
    };
    return { client: client as any, updates };
  }
  const perk = { user_id: 'u1', coupon_code: 'LCABCDEFGHJK', shopify_discount_id: 'gid://shopify/DiscountCodeNode/77', status: 'issued' };

  it('reads email, status and discount codes from the order payload', () => {
    expect(readOrderForPerk({ email: ' A@B.test ', financial_status: 'PAID', discount_codes: [{ code: 'lcabcdefghjk' }] }))
      .toEqual({ email: 'a@b.test', financialStatus: 'paid', discountCodes: ['LCABCDEFGHJK'] });
    expect(readOrderForPerk({ financial_status: 'paid' })).toBeUndefined();
  });

  it('marks the perk used when the first paid order used the code', async () => {
    const { client, updates } = settleClient(perk);
    await expect(settleMemberPerkAfterOrder(client, { email: 'a@b.test', financialStatus: 'paid', discountCodes: ['LCABCDEFGHJK'] })).resolves.toBe('used');
    expect(updates[0]).toMatchObject({ status: 'used' });
  });

  it('deactivates the discount when the first paid order did not use it', async () => {
    const { client, updates } = settleClient(perk);
    mocks.getShopifyAdminAccessToken.mockResolvedValue('admin-token');
    const fetchMock = vi.fn().mockResolvedValue(shopifyOk({ discountCodeDeactivate: { codeDiscountNode: { id: perk.shopify_discount_id }, userErrors: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(settleMemberPerkAfterOrder(client, { email: 'a@b.test', financialStatus: 'paid', discountCodes: [] })).resolves.toBe('expired');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables).toEqual({ id: perk.shopify_discount_id });
    expect(updates[0]).toMatchObject({ status: 'expired' });
  });

  it('ignores unpaid orders and members without an issued perk', async () => {
    await expect(settleMemberPerkAfterOrder(settleClient(perk).client, { email: 'a@b.test', financialStatus: 'pending', discountCodes: [] })).resolves.toBe('none');
    await expect(settleMemberPerkAfterOrder(settleClient(null).client, { email: 'a@b.test', financialStatus: 'paid', discountCodes: [] })).resolves.toBe('none');
  });
});

describe('perk codes stay private', () => {
  it('generates codes from an unambiguous alphabet', () => {
    expect(generatePerkCode(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 31]))).toBe('LCABCDEFGHJ9');
    expect(isMemberPerkCode('lcabcdefghj9')).toBe(true);
    expect(isMemberPerkCode('FREESHIP')).toBe(false);
    expect(isMemberPerkTitle('LUCISSI 會員首單免運｜LCABCDEFGHJ9')).toBe(true);
  });

  it('identifies perk discounts by title or code without any environment variable', () => {
    expect(isMemberPerkDiscountNode({ id: 'x', codeDiscount: { title: 'LUCISSI 會員首單免運｜LC', codes: { nodes: [] } } } as any)).toBe(true);
    expect(isMemberPerkDiscountNode({ id: 'x', codeDiscount: { title: 'Anything', codes: { nodes: [{ code: 'LCABCDEFGHJ9' }] } } } as any)).toBe(true);
    expect(isMemberPerkDiscountNode({ id: 'x', codeDiscount: { title: '滿額免運', codes: { nodes: [{ code: 'FREESHIP' }] } } } as any)).toBe(false);
  });

  it('refuses to claim a perk code through the normal coupon flow', async () => {
    mocks.createClient.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) } });
    const response = await claimPromotion(new Request('https://lucissicare.com/api/promotions/claim', {
      method: 'POST',
      headers: { Origin: 'https://lucissicare.com', Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'LCABCDEFGHJ9' }),
    }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as any).code).toBe('PERK_CODE_NOT_CLAIMABLE');
  });
});
