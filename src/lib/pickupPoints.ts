import { supabase, isSupabaseConfigured } from './supabase';
import {
  DEFAULT_PICKUP_SHIPPING_FEE,
  parsePickupPoint,
  type DeliveryMethod,
  type PickupCarrier,
  type PickupPoint,
} from '../domain/pickupPoints';

export interface StorePickupSettings {
  enabled: boolean;
  shippingFee: number;
}

const DISABLED: StorePickupSettings = { enabled: false, shippingFee: DEFAULT_PICKUP_SHIPPING_FEE };

/**
 * 讀取公開設定 site_settings.store_pickup_enabled、pickup_shipping_fee；讀取失敗一律視為關閉。
 * 建立結帳時伺服器會再檢查一次開關並以門市清單確認門市。
 */
export async function fetchStorePickupSettings(): Promise<StorePickupSettings> {
  if (!isSupabaseConfigured) return DISABLED;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['store_pickup_enabled', 'pickup_shipping_fee']);
    if (error || !Array.isArray(data)) return DISABLED;
    const values = Object.fromEntries(data.map((row: { key: string; value: unknown }) => [row.key, row.value]));
    const fee = values.pickup_shipping_fee;
    return {
      enabled: values.store_pickup_enabled === true,
      shippingFee: typeof fee === 'number' && Number.isFinite(fee) && fee >= 0 ? fee : DEFAULT_PICKUP_SHIPPING_FEE,
    };
  } catch {
    return DISABLED;
  }
}

export class PickupSearchError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'PickupSearchError';
  }
}

export async function searchPickupPoints(carrier: PickupCarrier, query: string, signal?: AbortSignal): Promise<PickupPoint[]> {
  const params = new URLSearchParams({ carrier, q: query.trim() });
  let response: Response;
  try {
    response = await fetch(`/api/pickup-points?${params}`, { method: 'GET', signal });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new PickupSearchError('無法連線到門市查詢服務，請檢查網路後再試。');
  }
  const data = (await response.json().catch(() => ({}))) as { points?: unknown; code?: string };
  if (!response.ok) {
    if (data.code === 'STORE_PICKUP_DISABLED') throw new PickupSearchError('超商取貨目前暫停服務，請改選宅配。', data.code);
    if (data.code === 'PICKUP_SEARCH_INVALID') throw new PickupSearchError('請輸入門市名稱、路名或區域。', data.code);
    throw new PickupSearchError('門市清單暫時無法讀取，請稍後再試，或改選宅配。', data.code);
  }
  return Array.isArray(data.points)
    ? data.points.map(parsePickupPoint).filter((point): point is PickupPoint => Boolean(point))
    : [];
}

const STORAGE_KEY = 'cart.deliverySelection';

export interface DeliverySelection {
  method: DeliveryMethod;
  pickupPoint: PickupPoint | null;
}

/** 記住上次選的配送方式與門市，方便回頭結帳；讀取失敗就用宅配。 */
export function loadDeliverySelection(): DeliverySelection {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { method: 'home', pickupPoint: null };
    const parsed = JSON.parse(raw) as { method?: unknown; pickupPoint?: unknown };
    const pickupPoint = parsePickupPoint(parsed.pickupPoint) ?? null;
    return { method: parsed.method === 'pickup' ? 'pickup' : 'home', pickupPoint };
  } catch {
    return { method: 'home', pickupPoint: null };
  }
}

export function saveDeliverySelection(selection: DeliverySelection): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // 無痕模式或儲存空間不可用：不影響結帳
  }
}
