/**
 * ShipAny「物流服務點列表」：取得全家、7-11、萊爾富門市，供前台選店與建立結帳時驗證門市代碼。
 *
 * 流程（ShipAny API Platform v0.1.0，台灣）：
 * 1. GET /v3/courier-service-point-locations：每家物流商一筆，含門市資料檔 url 與已啟用的自取點類型。
 *    文件要求結帳前重新取得此清單，門市資料檔至少快取 24 小時，且只顯示與商品貯存類型相符的門市。
 * 2. 下載各物流商的門市資料檔並轉成 PickupPoint。
 *
 * 待確認（取得 API 金鑰後依實際回應調整）：門市資料檔的欄位名稱、自取點類型的 key 名稱。
 * 解析器刻意寬鬆並集中在 normalizeLocationFile，避免猜錯時影響其他程式；資料不合格的門市一律略過。
 *
 * 憑證：
 * - SHIPANY_CLIENT_KEY：Portal > 開發者 > API 密鑰的 Client Key（X-Api-Key）。
 * - SHIPANY_MERCHANT_TOKEN、SHIPANY_REFRESH_TOKEN：第一次使用的 merchant access／refresh token。
 *   refresh token 每次使用都會輪替且只能用一次，輪替後的最新一組存在 private.shipany_api_tokens。
 * - SHIPANY_API_BASE_URL（選填）：預設 https://open-tw.shipany.io（與 LUCISSI 讀取器相同）。
 */
import {
  isPickupCarrier,
  isValidPickupCode,
  parsePickupPoint,
  searchPickupPoints,
  type PickupCarrier,
  type PickupPoint,
} from '../../src/domain/pickupPoints.js';

export interface ShipAnyPickupPoint extends PickupPoint {
  /** 門市所屬物流商（ShipAny courier_api_type），供出貨對照 */
  courier: string;
}

export interface TokenStore {
  read(): Promise<{ accessToken: string | null; accessExpiresAt: string | null; refreshToken: string } | null>;
  rotate(previousRefresh: string | null, accessToken: string, accessExpiresAt: string, refreshToken: string): Promise<boolean>;
}

export interface PickupPointDeps {
  env?: Record<string, string | undefined>;
  transport?: typeof fetch;
  tokenStore: TokenStore;
  now?: () => number;
}

const DEFAULT_BASE = 'https://open-tw.shipany.io';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_LIST_BYTES = 200_000;
const MAX_LOCATION_FILE_BYTES = 25_000_000;
const LOCATION_CACHE_MS = 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_MARGIN_MS = 5 * 60 * 1000;

const fail = (code: string): never => {
  throw new Error(`SHIPANY_PICKUP_${code}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function baseUrl(env: Record<string, string | undefined>): string {
  const configured = env.SHIPANY_API_BASE_URL?.trim();
  if (!configured) return DEFAULT_BASE;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return fail('BASE_URL_INVALID');
  }
  if (url.protocol !== 'https:') fail('BASE_URL_INVALID');
  return url.origin;
}

function clientKey(env: Record<string, string | undefined>): string {
  const key = env.SHIPANY_CLIENT_KEY?.trim();
  if (!key || /\s/.test(key)) return fail('CREDENTIALS_UNCONFIGURED');
  return key;
}

async function readJson(response: Response, maxBytes: number): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) fail('RESPONSE_TOO_LARGE');
  const text = await response.text();
  if (text.length > maxBytes) fail('RESPONSE_TOO_LARGE');
  try {
    return JSON.parse(text);
  } catch {
    return fail('RESPONSE_INVALID');
  }
}

/** 取得有效的 access token；快到期時用 refresh token 換新並保存輪替後的一組。 */
export async function getShipAnyAccessToken(deps: PickupPointDeps): Promise<string> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const stored = await deps.tokenStore.read();
  if (stored?.accessToken && stored.accessExpiresAt && Date.parse(stored.accessExpiresAt) - ACCESS_TOKEN_MARGIN_MS > now()) {
    return stored.accessToken;
  }

  const refreshToken = stored?.refreshToken ?? env.SHIPANY_REFRESH_TOKEN?.trim();
  const currentAccess = stored?.accessToken ?? env.SHIPANY_MERCHANT_TOKEN?.trim();
  if (!refreshToken || !currentAccess) return fail('CREDENTIALS_UNCONFIGURED');

  const transport = deps.transport ?? fetch;
  let response: Response;
  try {
    response = await transport(`${baseUrl(env)}/auth/token/refresh`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': clientKey(env),
        Authorization: `Bearer ${currentAccess}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    return fail('TRANSPORT_UNAVAILABLE');
  }

  if (!response.ok) {
    // 另一個請求可能剛輪替過：重讀一次，若已有新的有效 token 就沿用。
    const latest = await deps.tokenStore.read();
    if (latest?.accessToken && latest.refreshToken !== refreshToken) return latest.accessToken;
    return fail(`TOKEN_REFRESH_${response.status}`);
  }

  const body = await readJson(response, MAX_LIST_BYTES);
  const data = isRecord(body) && isRecord(body.data) ? body.data : undefined;
  const accessToken = typeof data?.access_token === 'string' ? data.access_token : '';
  const nextRefresh = typeof data?.refresh_token === 'string' ? data.refresh_token : '';
  const expiresIn = typeof data?.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 0;
  if (!accessToken || !nextRefresh || !expiresIn) return fail('TOKEN_RESPONSE_INVALID');

  const expiresAt = new Date(now() + expiresIn * 1000).toISOString();
  const saved = await deps.tokenStore.rotate(stored ? refreshToken : null, accessToken, expiresAt, nextRefresh);
  if (!saved) {
    const latest = await deps.tokenStore.read();
    if (latest?.accessToken) return latest.accessToken;
  }
  return accessToken;
}

export interface LocationSource {
  courierUid: string;
  courierApiType: string;
  url: string;
  enabledTypes: string[];
}

function parseLocationSources(body: unknown): LocationSource[] {
  const data = isRecord(body) && isRecord(body.data) ? body.data : undefined;
  if (!data || !Array.isArray(data.locations)) return fail('RESPONSE_INVALID');
  const sources: LocationSource[] = [];
  for (const entry of data.locations.slice(0, 50)) {
    if (!isRecord(entry)) continue;
    const { courier_uid: courierUid, courier_api_type: courierApiType, url } = entry;
    if (typeof courierUid !== 'string' || typeof courierApiType !== 'string' || typeof url !== 'string') continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    const types = isRecord(entry.detail_location_types) ? entry.detail_location_types : {};
    const enabledTypes = Object.entries(types)
      .filter(([, setting]) => isRecord(setting) && setting.enabled === true)
      .map(([type]) => type);
    sources.push({ courierUid, courierApiType, url: parsed.toString(), enabledTypes });
  }
  return sources;
}

/** 由自取點類型名稱判斷超商；無法判斷時回傳 undefined。 */
export function carrierFromLocationType(value: unknown): PickupCarrier | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().replace(/[\s_-]/g, '');
  if (/family|fami|全家/.test(normalized)) return 'familymart';
  if (/7eleven|711|seven|統一超商|小七/.test(normalized)) return 'seven-eleven';
  if (/hilife|萊爾富/.test(normalized)) return 'hilife';
  return undefined;
}

const FIELD_CANDIDATES = {
  code: ['code', 'store_code', 'storeCode', 'store_id', 'storeId', 'location_code', 'locationCode', 'point_code', 'pointCode', 'id'],
  name: ['name', 'store_name', 'storeName', 'location_name', 'locationName', 'title'],
  address: ['address', 'full_address', 'fullAddress', 'address_line', 'addressLine', 'addr'],
  city: ['city', 'county'],
  district: ['district', 'area', 'town'],
  type: ['type', 'location_type', 'locationType', 'brand', 'store_type', 'storeType', 'category'],
  storage: ['storage_types', 'storageTypes', 'storage_type', 'storageType'],
} as const;

function pick(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function pickText(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const value = pick(record, keys);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (isRecord(value)) {
    // 地址可能是物件（例如 { zh_tw: '...' }）：取第一個字串值。
    const first = Object.values(value).find((item) => typeof item === 'string');
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
}

/** 商品為常溫：門市有標示貯存類型時，只保留支援常溫的門市。 */
function supportsAmbient(record: Record<string, unknown>): boolean {
  const storage = pick(record, FIELD_CANDIDATES.storage);
  if (storage === undefined) return true;
  const values = Array.isArray(storage) ? storage : [storage];
  return values.some((item) => typeof item === 'string' && /normal|ambient|room|常溫/i.test(item));
}

function locationArray(file: unknown): unknown[] {
  if (Array.isArray(file)) return file;
  if (!isRecord(file)) return [];
  for (const key of ['data', 'locations', 'stores', 'points', 'results']) {
    const value = file[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      const nested = locationArray(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

/**
 * 把一家物流商的門市資料檔轉成 PickupPoint。
 * 門市自身有類型欄位時依類型判斷超商；沒有時，若該物流商只啟用一種超商，就全部歸到那一種。
 */
export function normalizeLocationFile(source: LocationSource, file: unknown): ShipAnyPickupPoint[] {
  const enabledCarriers = [...new Set(source.enabledTypes.map(carrierFromLocationType).filter(isPickupCarrier))];
  const fallbackCarrier = enabledCarriers.length === 1 ? enabledCarriers[0] : undefined;
  const points: ShipAnyPickupPoint[] = [];
  for (const item of locationArray(file)) {
    if (!isRecord(item) || !supportsAmbient(item)) continue;
    const typeCarrier = carrierFromLocationType(pickText(item, FIELD_CANDIDATES.type));
    const carrier = typeCarrier ?? fallbackCarrier;
    if (!carrier || (enabledCarriers.length > 0 && !enabledCarriers.includes(carrier))) continue;
    const point = parsePickupPoint({
      carrier,
      code: pickText(item, FIELD_CANDIDATES.code)?.trim(),
      name: pickText(item, FIELD_CANDIDATES.name),
      address: pickText(item, FIELD_CANDIDATES.address),
      city: pickText(item, FIELD_CANDIDATES.city),
      district: pickText(item, FIELD_CANDIDATES.district),
    });
    if (point) points.push({ ...point, courier: source.courierApiType });
  }
  return points;
}

type PickupIndex = Map<PickupCarrier, ShipAnyPickupPoint[]>;

let cachedIndex: { index: PickupIndex; expiresAt: number } | null = null;
let inflight: Promise<PickupIndex> | null = null;

export function resetPickupPointCache(): void {
  cachedIndex = null;
  inflight = null;
}

async function buildIndex(deps: PickupPointDeps): Promise<PickupIndex> {
  const env = deps.env ?? process.env;
  const transport = deps.transport ?? fetch;
  const accessToken = await getShipAnyAccessToken(deps);

  let listResponse: Response;
  try {
    listResponse = await transport(`${baseUrl(env)}/v3/courier-service-point-locations`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json', 'X-Api-Key': clientKey(env), Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return fail('TRANSPORT_UNAVAILABLE');
  }
  if (listResponse.status === 403) fail('NOT_SUBSCRIBED_OR_FORBIDDEN');
  if (!listResponse.ok) fail(`LIST_${listResponse.status}`);
  const sources = parseLocationSources(await readJson(listResponse, MAX_LIST_BYTES));

  const index: PickupIndex = new Map();
  for (const source of sources) {
    let fileResponse: Response;
    try {
      fileResponse = await transport(source.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
        headers: { Accept: 'application/json' },
      });
    } catch {
      continue;
    }
    if (!fileResponse.ok) continue;
    let file: unknown;
    try {
      file = await readJson(fileResponse, MAX_LOCATION_FILE_BYTES);
    } catch {
      continue;
    }
    for (const point of normalizeLocationFile(source, file)) {
      const list = index.get(point.carrier) ?? [];
      // 同一超商的門市可能出現在兩家物流商（例如 7-11 由黑貓與順豐都可配送），保留先出現的一筆。
      if (!list.some((existing) => existing.code === point.code)) list.push(point);
      index.set(point.carrier, list);
    }
  }
  if (index.size === 0) fail('NO_LOCATIONS');
  return index;
}

/** 取得門市索引；成功結果快取 24 小時，同時進行的請求共用一次下載。 */
export async function loadPickupIndex(deps: PickupPointDeps): Promise<PickupIndex> {
  const now = deps.now ?? Date.now;
  if (cachedIndex && cachedIndex.expiresAt > now()) return cachedIndex.index;
  if (!inflight) {
    inflight = buildIndex(deps)
      .then((index) => {
        cachedIndex = { index, expiresAt: now() + LOCATION_CACHE_MS };
        return index;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function searchShipAnyPickupPoints(
  deps: PickupPointDeps,
  carrier: PickupCarrier,
  query: string,
): Promise<ShipAnyPickupPoint[]> {
  const index = await loadPickupIndex(deps);
  return searchPickupPoints(index.get(carrier) ?? [], query) as ShipAnyPickupPoint[];
}

/** 建立結帳時以伺服器資料確認門市，不採信前台送來的名稱與地址。 */
export async function findShipAnyPickupPoint(
  deps: PickupPointDeps,
  carrier: PickupCarrier,
  code: string,
): Promise<ShipAnyPickupPoint | undefined> {
  if (!isValidPickupCode(code)) return undefined;
  const index = await loadPickupIndex(deps);
  return index.get(carrier)?.find((point) => point.code === code);
}

/** 以 Supabase service role 的 RPC 存取 private.shipany_api_tokens。 */
export function supabaseTokenStore(db: {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}): TokenStore {
  return {
    async read() {
      const { data, error } = await db.rpc('get_shipany_api_tokens');
      if (error) fail('TOKEN_STORE_UNAVAILABLE');
      const row = Array.isArray(data) ? data[0] : data;
      if (!isRecord(row) || typeof row.refresh_token !== 'string') return null;
      return {
        accessToken: typeof row.access_token === 'string' ? row.access_token : null,
        accessExpiresAt: typeof row.access_expires_at === 'string' ? row.access_expires_at : null,
        refreshToken: row.refresh_token,
      };
    },
    async rotate(previousRefresh, accessToken, accessExpiresAt, refreshToken) {
      const { data, error } = await db.rpc('rotate_shipany_api_tokens', {
        p_previous_refresh: previousRefresh,
        p_access_token: accessToken,
        p_access_expires_at: accessExpiresAt,
        p_refresh_token: refreshToken,
      });
      if (error) fail('TOKEN_STORE_UNAVAILABLE');
      return data === true;
    },
  };
}
