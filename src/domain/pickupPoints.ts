// 超商取貨（門市取件）共用規則：前台選店畫面、門市搜尋 API 與建立 Shopify 結帳共用。
// 2026-11-09 店主決定：開放全家、7-11、萊爾富；運費 NT$60，達全站免運門檻免運；同時提供取貨付款（顧客於結帳步驟選擇付款方式）。
// 正式開關為 site_settings.store_pickup_enabled（預設 false）。門市寫入 Shopify 的格式尚待 ShipAny 確認，見 docs/STORE_PICKUP.md。

export const PICKUP_CARRIERS = ['familymart', 'seven-eleven', 'hilife'] as const;
export type PickupCarrier = (typeof PICKUP_CARRIERS)[number];

export const PICKUP_CARRIER_LABELS: Record<PickupCarrier, string> = {
  familymart: '全家',
  'seven-eleven': '7-ELEVEN',
  hilife: '萊爾富',
};

/** 超商取貨運費的程式預設值（正式值可存在 site_settings.pickup_shipping_fee）。 */
export const DEFAULT_PICKUP_SHIPPING_FEE = 60;

export type DeliveryMethod = 'home' | 'pickup';

export interface PickupPoint {
  carrier: PickupCarrier;
  /** 物流商的門市代碼 */
  code: string;
  /** 門市名稱，例如「全家台北民生店」 */
  name: string;
  /** 門市地址（不含門市代碼） */
  address: string;
  city?: string;
  district?: string;
}

const PICKUP_CODE_PATTERN = /^[A-Za-z0-9-]{3,20}$/;
const MAX_TEXT = 120;
const hasControl = (value: string) => [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

export function isPickupCarrier(value: unknown): value is PickupCarrier {
  return typeof value === 'string' && (PICKUP_CARRIERS as readonly string[]).includes(value);
}

export function isValidPickupCode(value: unknown): value is string {
  return typeof value === 'string' && PICKUP_CODE_PATTERN.test(value);
}

function cleanText(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > max || hasControl(normalized)) return undefined;
  return normalized;
}

/** 只接受格式完整的門市資料；任何欄位不合法就回傳 undefined。 */
export function parsePickupPoint(value: unknown): PickupPoint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (!isPickupCarrier(raw.carrier) || !isValidPickupCode(raw.code)) return undefined;
  const name = cleanText(raw.name);
  const address = cleanText(raw.address, 200);
  if (!name || !address) return undefined;
  const city = cleanText(raw.city, 20);
  const district = cleanText(raw.district, 20);
  return {
    carrier: raw.carrier,
    code: raw.code,
    name,
    address,
    ...(city ? { city } : {}),
    ...(district ? { district } : {}),
  };
}

/**
 * Shopify 收件地址第一行。ShipAny API 文件（AddressInput.address_line）規定服務點地址須以
 * 「[門市代碼] 門市地址」開頭；Shopify App 匯入是否沿用同一格式仍待 ShipAny 確認。
 */
export function formatPickupAddressLine(point: Pick<PickupPoint, 'code' | 'address'>): string {
  return `[${point.code}] ${point.address}`;
}

/** 結帳頁收件地址的公司欄位，讓顧客與出貨人員一眼看出是哪家超商哪間門市。 */
export function formatPickupCompanyLine(point: Pick<PickupPoint, 'carrier' | 'name'>): string {
  const label = PICKUP_CARRIER_LABELS[point.carrier];
  return point.name.startsWith(label) ? point.name : `${label} ${point.name}`;
}

export function describePickupPoint(point: Pick<PickupPoint, 'carrier' | 'name' | 'code'>): string {
  return `${formatPickupCompanyLine(point)}（${point.code}）`;
}

const normalizeForSearch = (value: string) => value.toLowerCase().replace(/臺/g, '台').replace(/\s+/g, '');

/**
 * 以關鍵字搜尋門市：名稱、地址、門市代碼都比對；多個關鍵字以空白分隔，全部符合才算。
 * 結果依名稱排序並限制筆數，避免一次送出整份門市清單。
 */
export function searchPickupPoints(points: readonly PickupPoint[], query: string, limit = 30): PickupPoint[] {
  const terms = query.split(/\s+/).map(normalizeForSearch).filter(Boolean);
  if (terms.length === 0) return [];
  const matches = points.filter((point) => {
    const haystack = normalizeForSearch(`${point.name}${point.code}${point.city ?? ''}${point.district ?? ''}${point.address}`);
    return terms.every((term) => haystack.includes(term));
  });
  return matches
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
    .slice(0, Math.max(1, Math.min(limit, 50)));
}
