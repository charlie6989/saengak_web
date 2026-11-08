/**
 * GET /api/pickup-points?carrier=familymart&q=民生
 * （Vercel Hobby 函式數量已滿，經 vercel.json 改寫到 api/shopify/discounts.ts?resource=pickup-points。）
 *
 * 只在 site_settings.store_pickup_enabled 為 true 時提供；回應只含門市代碼、名稱與地址，不含物流商內部資料。
 */
import { isPickupCarrier, type PickupPoint } from '../../src/domain/pickupPoints.js';
import { jsonResponse } from './security.js';
import { getSiteSetting, getSupabaseAdminClient } from './supabase-admin.js';
import { searchShipAnyPickupPoints, supabaseTokenStore, type PickupPointDeps } from './shipany-pickup-points.js';

const MAX_QUERY_LENGTH = 40;

export function pickupPointDepsFromEnvironment(): PickupPointDeps | null {
  const db = getSupabaseAdminClient();
  if (!db || typeof (db as { rpc?: unknown }).rpc !== 'function') return null;
  return { tokenStore: supabaseTokenStore(db) };
}

export async function isStorePickupEnabled(): Promise<boolean> {
  return (await getSiteSetting<boolean>('store_pickup_enabled')) === true;
}

export async function handlePickupPointSearch(
  request: Request,
  corsHeaders: Record<string, string>,
  deps: PickupPointDeps | null = pickupPointDepsFromEnvironment(),
): Promise<Response> {
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
    return jsonResponse(
      { points },
      { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
    );
  } catch (error) {
    console.error('門市清單讀取失敗:', error instanceof Error ? error.message : 'unknown');
    return jsonResponse({ error: 'Store list is unavailable', code: 'PICKUP_POINTS_UNAVAILABLE' }, { status: 503, headers: corsHeaders });
  }
}
