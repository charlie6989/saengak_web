import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import { isOriginAllowed, jsonResponse } from '../_lib/security.js';

const gidPattern = /^gid:\/\/shopify\/Order\/[1-9][0-9]*$/;
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
    if (request.method === 'GET') {
      const gid = new URL(request.url).searchParams.get('order');
      if (!gid || !gidPattern.test(gid)) return jsonResponse({ error: 'INVALID_ORDER' }, { status: 400 });
      const status = await db.rpc('get_cod_dispatch_status', { p_order_gid: gid });
      if (status.error) throw new Error('COD_STORAGE_ERROR');
      return jsonResponse(status.data);
    }
    return jsonResponse({ error: 'COD_DISPATCH_RETIRED' }, { status: 410 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Stable codes only: never echo database/provider payloads or credentials.
    const code = /^COD_[A-Z_]+$/.test(message) ? message : 'COD_OPERATION_FAILED';
    return jsonResponse({ error: code }, { status: 409 });
  }
}
