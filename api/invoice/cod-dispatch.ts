import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import { isOriginAllowed, jsonResponse } from '../_lib/security.js';
import { verifyLiveCodOrder } from '../_lib/cod-dispatch.js';
import invoiceWorker, { getAmegoCredentials } from './guangmao.js';

const gidPattern = /^gid:\/\/shopify\/Order\/[1-9][0-9]*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default { fetch: handler };
export const GET = handler;
export const POST = handler;

async function handler(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  if (!isOriginAllowed(request.headers.get('origin'), request)) return jsonResponse({ error: 'ORIGIN_DENIED' }, { status: 403 });
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return jsonResponse({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const db = getSupabaseAdminClient();
  if (!db) return jsonResponse({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return jsonResponse({ error: 'AUTH_REQUIRED' }, { status: 401 });
    if (data.user.app_metadata?.role !== 'admin') return jsonResponse({ error: 'ADMIN_REQUIRED' }, { status: 403 });
    if (process.env.COD_DISPATCH_ENABLED !== 'true') return jsonResponse({ error: 'COD_DISPATCH_DISABLED' }, { status: 503 });
    if (request.method === 'GET') {
      const gid = new URL(request.url).searchParams.get('order');
      if (!gid || !gidPattern.test(gid)) return jsonResponse({ error: 'INVALID_ORDER' }, { status: 400 });
      const status = await db.rpc('get_cod_dispatch_status', { p_order_gid: gid });
      if (status.error) throw new Error('COD_STORAGE_ERROR');
      return jsonResponse(status.data);
    }
    const raw = await request.text();
    if (raw.length > 4096) return jsonResponse({ error: 'BODY_TOO_LARGE' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return jsonResponse({ error: 'INVALID_REQUEST' }, { status: 400 }); }
    if (!body || !gidPattern.test(body.orderGid) || !uuidPattern.test(body.confirmationId)
      || typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))
      || !Number.isSafeInteger(body.expectedTotal) || body.expectedTotal <= 0
      || typeof body.trackingNumber !== 'string' || !/^[0-9]{10,20}$/.test(body.trackingNumber)
      || body.carrier !== 'black_cat_ambient' || body.wholeOrder !== true) {
      return jsonResponse({ error: 'INVALID_REQUEST' }, { status: 400 });
    }
    // No durable approval is created when the worker is unavailable/disabled.
    const dispatchToken = process.env.AmegoDispatchToken;
    if (process.env.AmegoInvoiceReleaseEnabled !== 'true' || !dispatchToken || !getAmegoCredentials()) {
      return jsonResponse({ error: 'INVOICE_DISPATCH_UNAVAILABLE' }, { status: 503 });
    }
    const status = await db.rpc('get_cod_dispatch_status', { p_order_gid: body.orderGid });
    if (status.error || !status.data?.enabled) return jsonResponse({ error: 'COD_DISPATCH_DISABLED' }, { status: 503 });
    // An existing approval is immutable; retries only reconcile/dispatch that same operation.
    if (!status.data.confirmationId) await verifyLiveCodOrder(body.orderGid, body.expectedUpdatedAt, body.expectedTotal);
    const approved = await db.rpc('confirm_cod_dispatch', {
      p_order_gid: body.orderGid, p_confirmation_id: body.confirmationId, p_actor_id: data.user.id,
      p_expected_updated_at: body.expectedUpdatedAt, p_expected_total: body.expectedTotal,
      p_tracking_number: body.trackingNumber, p_carrier: body.carrier, p_whole_order: body.wholeOrder,
    });
    if (approved.error) throw new Error(approved.error.message);
    // Call the worker in-process. Never return the dispatch credential to the browser.
    const dispatched = await invoiceWorker.fetch(new Request('https://lucissicare.com/api/invoice/guangmao', {
      method: 'POST', headers: { authorization: `Bearer ${dispatchToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ shopifyOrderGid: body.orderGid }),
    }));
    if (!dispatched.ok) return jsonResponse({ error: 'INVOICE_DISPATCH_UNAVAILABLE', approvalSaved: true }, { status: 503 });
    const result = await db.rpc('get_cod_dispatch_status', { p_order_gid: body.orderGid });
    if (result.error) throw new Error('COD_STORAGE_ERROR');
    return jsonResponse(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Stable codes only: never echo database/provider payloads or credentials.
    const code = /^COD_[A-Z_]+$/.test(message) ? message : 'COD_OPERATION_FAILED';
    return jsonResponse({ error: code }, { status: 409 });
  }
}
