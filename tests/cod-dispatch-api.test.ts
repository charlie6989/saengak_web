import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: vi.fn(), live: vi.fn(), worker: vi.fn(), credentials: vi.fn() }));
vi.mock('../api/_lib/supabase-admin.js', () => ({ getSupabaseAdminClient: mocks.db }));
vi.mock('../api/_lib/cod-dispatch.js', () => ({ verifyLiveCodOrder: mocks.live }));
vi.mock('../api/invoice/guangmao.js', () => ({ default: { fetch: mocks.worker }, getAmegoCredentials: mocks.credentials }));
import handler from '../api/invoice/cod-dispatch.js';
const body = { orderGid: 'gid://shopify/Order/123', confirmationId: '88888888-8888-4888-8888-000000000001',
  expectedUpdatedAt: '2026-10-21T01:00:00Z', expectedTotal: 826, trackingNumber: '123456789012', carrier: 'black_cat_ambient', wholeOrder: true };
let rpc: ReturnType<typeof vi.fn>;
let getUser: ReturnType<typeof vi.fn>;
function request(value: unknown = body, token = 'fixture-token', origin = 'https://lucissicare.com') {
  return new Request('https://lucissicare.com/api/invoice/cod-dispatch', { method: 'POST',
    headers: { authorization: token ? `Bearer ${token}` : '', origin, 'content-type': 'application/json' }, body: JSON.stringify(value) });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No network permitted')));
  vi.stubEnv('COD_DISPATCH_ENABLED', 'true'); vi.stubEnv('AmegoInvoiceReleaseEnabled', 'true'); vi.stubEnv('AmegoDispatchToken', 'fixture-worker-token');
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'verified-admin', app_metadata: { role: 'admin' } } }, error: null });
  rpc = vi.fn().mockResolvedValue({ data: { enabled: true, paymentStatus: 'pending', status: 'issued', invoiceNumber: 'AB12345678' }, error: null });
  mocks.db.mockReturnValue({ auth: { getUser }, rpc }); mocks.live.mockResolvedValue(undefined);
  mocks.worker.mockResolvedValue(new Response('{}')); mocks.credentials.mockReturnValue({});
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('COD admin dispatch boundary', () => {
  it('requires a bearer token before reading storage', async () => {
    expect((await handler.fetch(request(body, ''))).status).toBe(401); expect(mocks.db).not.toHaveBeenCalled();
  });
  it('rejects untrusted origin', async () => {
    expect((await handler.fetch(request(body, 'token', 'https://evil.example'))).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
  });
  it('checks server verified admin claim', async () => {
    getUser.mockResolvedValue({ data: { user: { app_metadata: { role: 'member' } } } });
    expect((await handler.fetch(request())).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
  });
  it('defaults disabled and never approves', async () => {
    vi.stubEnv('COD_DISPATCH_ENABLED', 'false'); expect((await handler.fetch(request())).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
  });
  it.each([{ wholeOrder: false }, { expectedTotal: 826.5 }, { trackingNumber: 'bad' }, { carrier: 'familymart' }, { confirmationId: 'bad' }])('rejects invalid request %j', async patch => {
    expect((await handler.fetch(request({ ...body, ...patch }))).status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });
  it('requires available invoice worker before saving approval', async () => {
    mocks.credentials.mockReturnValue(null); expect((await handler.fetch(request())).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
  });
  it('requires database cutover to be enabled', async () => {
    rpc.mockResolvedValue({ data: { enabled: false } }); expect((await handler.fetch(request())).status).toBe(503); expect(mocks.live).not.toHaveBeenCalled();
  });
  it('live changed order cannot create an approval', async () => {
    mocks.live.mockRejectedValue(new Error('COD_LIVE_ORDER_CHANGED'));
    expect((await handler.fetch(request())).status).toBe(409); expect(rpc).toHaveBeenCalledTimes(1); expect(mocks.worker).not.toHaveBeenCalled();
  });
  it('uses verified actor and returns pending payment independently of issued invoice', async () => {
    const response = await handler.fetch(request({ ...body, actorId: 'forged' }));
    expect(await response.json()).toMatchObject({ status: 'issued', paymentStatus: 'pending' });
    expect(rpc).toHaveBeenCalledWith('confirm_cod_dispatch', expect.objectContaining({ p_actor_id: 'verified-admin' }));
    expect(mocks.live).toHaveBeenCalledWith(body.orderGid, body.expectedUpdatedAt, body.expectedTotal);
    expect(mocks.worker).toHaveBeenCalledTimes(1);
  });
  it('retry reuses approval without creating a new live snapshot', async () => {
    rpc.mockResolvedValue({ data: { enabled: true, confirmationId: body.confirmationId } });
    expect((await handler.fetch(request())).status).toBe(200); expect(mocks.live).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('confirm_cod_dispatch', expect.objectContaining({ p_confirmation_id: body.confirmationId }));
  });
  it('does not leak database errors or dispatch after failed approval', async () => {
    rpc.mockResolvedValueOnce({ data: { enabled: true } }).mockResolvedValueOnce({ error: { message: 'private SQL credential detail' } });
    expect(await (await handler.fetch(request())).json()).toEqual({ error: 'COD_OPERATION_FAILED' }); expect(mocks.worker).not.toHaveBeenCalled();
  });
  it('reports durable approval when worker is temporarily unavailable', async () => {
    mocks.worker.mockResolvedValue(new Response('{}', { status: 503 }));
    expect(await (await handler.fetch(request())).json()).toEqual({ error: 'INVOICE_DISPATCH_UNAVAILABLE', approvalSaved: true });
  });
  it('GET only reads status', async () => {
    const response = await handler.fetch(new Request(`https://lucissicare.com/api/invoice/cod-dispatch?order=${encodeURIComponent(body.orderGid)}`, { headers: { authorization: 'Bearer token' } }));
    expect(response.status).toBe(200); expect(rpc).toHaveBeenCalledTimes(1); expect(mocks.worker).not.toHaveBeenCalled();
  });
});
