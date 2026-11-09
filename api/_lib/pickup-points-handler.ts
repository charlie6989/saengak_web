/**
 * GET /api/pickup-points?carrier=familymart&q=民生
 * （Vercel Hobby 函式數量已滿，經 vercel.json 改寫到 api/shopify/discounts.ts?resource=pickup-points。）
 *
 * 只在 site_settings.store_pickup_enabled 為 true 時提供；回應只含門市代碼、名稱與地址，不含物流商內部資料。
 *
 * 管理員診斷：GET /api/pickup-points?diagnose=1，帶管理員的 Supabase 登入 token（Authorization: Bearer）。
 * 不受開關限制，回傳各物流商門市資料檔的結構與解析結果，用來依實際格式調整解析器；不含任何金鑰。
 */
import {
  STORE_PICKUP_PREVIEW_FLAG,
  isPickupCarrier,
  isStorePickupPreviewOverride,
  type PickupPoint,
} from '../../src/domain/pickupPoints.js';
import { jsonResponse } from './security.js';
import { getSiteSetting, getSupabaseAdminClient } from './supabase-admin.js';
import { diagnoseShipAnyLocations, searchShipAnyPickupPoints, supabaseTokenStore, type PickupPointDeps } from './shipany-pickup-points.js';

const MAX_QUERY_LENGTH = 40;

export function pickupPointDepsFromEnvironment(env: Record<string, string | undefined> = process.env): PickupPointDeps | null {
  const db = getSupabaseAdminClient();
  const secret = env.SHIPANY_CLIENT_KEY?.trim();
  if (!db || typeof (db as { rpc?: unknown }).rpc !== 'function' || !secret) return null;
  return { tokenStore: supabaseTokenStore(db, secret) };
}

/** 只接受 app_metadata.role 為 admin 的 Supabase 登入 token。 */
export async function isAdminRequest(request: Request): Promise<boolean> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/)?.[1];
  const db = getSupabaseAdminClient();
  if (!token || !db) return false;
  try {
    const { data, error } = await db.auth.getUser(token);
    return !error && data?.user?.app_metadata?.role === 'admin';
  } catch {
    return false;
  }
}

async function handleDiagnosis(
  request: Request,
  corsHeaders: Record<string, string>,
  deps: PickupPointDeps | null,
  adminCheck: (request: Request) => Promise<boolean>,
): Promise<Response> {
  const headers = { ...corsHeaders, 'Cache-Control': 'no-store' };
  if (!(await adminCheck(request))) {
    return jsonResponse({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }, { status: 403, headers });
  }
  if (!deps) {
    return jsonResponse({ error: 'Store list is unavailable', code: 'PICKUP_POINTS_UNAVAILABLE' }, { status: 503, headers });
  }
  try {
    return jsonResponse({ sources: await diagnoseShipAnyLocations(deps) }, { status: 200, headers });
  } catch (error) {
    // 錯誤代碼只含程式定義的 SHIPANY_PICKUP_* 字串，不含 token。
    const code = error instanceof Error && /^SHIPANY_PICKUP_[A-Z0-9_]+$/.test(error.message) ? error.message : 'UNKNOWN';
    return jsonResponse({ error: 'Store list is unavailable', code }, { status: 503, headers });
  }
}

/**
 * 正式開關 site_settings.store_pickup_enabled；另外在 Vercel Preview 部署且設定
 * VITE_STORE_PICKUP_PREVIEW_ENABLED=true 時視為開啟（供店主在預覽網址測試，正式站不受影響）。
 */
export async function isStorePickupEnabled(env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (isStorePickupPreviewOverride(env[STORE_PICKUP_PREVIEW_FLAG], env.VERCEL_ENV === 'preview')) return true;
  return (await getSiteSetting<boolean>('store_pickup_enabled')) === true;
}

export async function handlePickupPointSearch(
  request: Request,
  corsHeaders: Record<string, string>,
  deps: PickupPointDeps | null = pickupPointDepsFromEnvironment(),
  adminCheck: (request: Request) => Promise<boolean> = isAdminRequest,
): Promise<Response> {
  if (new URL(request.url).searchParams.get('diagnose') === '1') {
    return handleDiagnosis(request, corsHeaders, deps, adminCheck);
  }

  if (!(await isStorePickupEnabled())) {
    return jsonResponse({ error: 'Store pickup is not available', code: 'STORE_PICKUP_DISABLED' }, { status: 404, headers: corsHeaders });
  }

  const params = new URL(request.url).searchParams;
  const carrier = params.get('carrier');
  const query = (params.get('q') ?? '').trim();
  if (!isPickupCarrier(carrier) || !query || query.length > MAX_QUERY_LENGTH) {
    return jsonResponse({ error: 'Provide a store type and a search keyword', code: 'PICKUP_SEARCH_INVALID' }, { status: 400, headers: corsHeaders });
  }

  if (!deps) {
    return jsonResponse({ error: 'Store list is unavailable', code: 'PICKUP_POINTS_UNAVAILABLE' }, { status: 503, headers: corsHeaders });
  }

  try {
    const results = await searchShipAnyPickupPoints(deps, carrier, query);
    const points: PickupPoint[] = results.map(({ carrier: c, code, name, address, city, district }) => ({
      carrier: c,
      code,
      name,
      address,
      ...(city ? { city } : {}),
      ...(district ? { district } : {}),
    }));
    // jsonResponse 一律不快取；門市清單由伺服器記憶體快取 24 小時。
    return jsonResponse({ points }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('門市清單讀取失敗:', error instanceof Error ? error.message : 'unknown');
    return jsonResponse({ error: 'Store list is unavailable', code: 'PICKUP_POINTS_UNAVAILABLE' }, { status: 503, headers: corsHeaders });
  }
}
