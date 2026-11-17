// 配送方式與運費的單一來源，比照 LUCISSI 母站（LUCISSI_website config/brands/lucissi.manifest.json 的
// shippingDisplay，2026-11-13 回讀）。2026-11-17 店主決定 CARE 的物流與金流全部比照 LUCISSI：
// - 宅配：黑貓宅配 NT$146、順豐宅配 NT$130；
// - 超商取貨：7-11取貨、全家取貨、萊爾富取貨，各 NT$69，由 SiteGiant 開綠界 C2C 店到店運單；
// - 單筆滿 NT$1,500 免運，任何配送方式皆適用；
// - 付款：信用卡（Visa、Mastercard、JCB）與貨到付款；貨到付款累計 2 次拒收或逾期未取件，停止購買。
//   例外：CARE 保留 TapPay ATM 轉帳（2026-11-17 店主決定，LUCISSI 沒有）。
//
// label 必須與 Shopify 運費名稱完全相同：建立結帳時以名稱預選運費，ShipAny 規則、Shipy 隱藏規則與
// 「送達後標記已付款」Flow 也都以完整名稱比對。改名時要一起改這些地方（見 docs/STORE_PICKUP.md）。
// 金額是結帳頁運費的副本，實際收費仍以結帳頁為準；正式值可由 site_settings 覆寫（見 resolveShippingMethods）。

import { DEFAULT_PICKUP_SHIPPING_FEE, type PickupCarrier } from './pickupPoints.js';
import { DEFAULT_FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from './shipping.js';

export type HomeMethodId = 'standard' | 'sf-home';

export interface HomeShippingMethod {
  id: HomeMethodId;
  /** Shopify 運費名稱 */
  label: string;
  fee: number;
}

export interface PickupShippingMethod {
  carrier: PickupCarrier;
  /** Shopify 運費名稱 */
  label: string;
  /** 顧客看到的物流服務名稱 */
  service: string;
  fee: number;
  /** 包裹尺寸與重量限制 */
  sizeNote: string;
}

/** 順豐宅配運費（程式預設值；site_settings.sf_home_shipping_fee 可覆寫）。 */
export const DEFAULT_SF_HOME_SHIPPING_FEE = 130;

export const STANDARD_HOME_LABEL = '黑貓宅配';
export const SF_HOME_LABEL = '順豐宅配';

const PICKUP_SIZE_NOTE = '三邊合計 105 公分以內、最長邊 45 公分以內';

/** 顯示順序比照 LUCISSI：7-11、全家、萊爾富。 */
export const PICKUP_METHOD_DEFINITIONS: ReadonlyArray<Omit<PickupShippingMethod, 'fee'>> = [
  { carrier: 'seven-eleven', label: '7-11取貨', service: '綠界 7-ELEVEN 交貨便', sizeNote: `${PICKUP_SIZE_NOTE}、10 公斤以下` },
  { carrier: 'familymart', label: '全家取貨', service: '綠界全家店到店', sizeNote: `${PICKUP_SIZE_NOTE}、10 公斤以下` },
  { carrier: 'hilife', label: '萊爾富取貨', service: '綠界萊爾富店到店', sizeNote: `${PICKUP_SIZE_NOTE}、5 公斤以下` },
];

/** 說明頁用的超商包裹限制摘要。 */
export const PICKUP_SIZE_SUMMARY = `${PICKUP_SIZE_NOTE}；7-11、全家 10 公斤以下，萊爾富 5 公斤以下`;

export const PICKUP_RATE_LABELS: readonly string[] = PICKUP_METHOD_DEFINITIONS.map((method) => method.label);

export interface ShippingMethods {
  freeShippingThreshold: number;
  /** 黑貓宅配在前，與 LUCISSI 的 standard 相同 */
  homeMethods: HomeShippingMethod[];
  /** 只有超商取貨開啟時才有內容 */
  pickupMethods: PickupShippingMethod[];
}

export interface ShippingMethodSettings {
  freeShippingThreshold?: number;
  defaultShippingFee?: number;
  sfHomeShippingFee?: number;
  pickupShippingFee?: number;
  pickupEnabled?: boolean;
}

const validFee = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

/** 依 site_settings 的正式值組出目前可用的配送方式；缺值或不合法時用程式預設值。 */
export function resolveShippingMethods(settings: ShippingMethodSettings = {}): ShippingMethods {
  const pickupFee = validFee(settings.pickupShippingFee, DEFAULT_PICKUP_SHIPPING_FEE);
  return {
    freeShippingThreshold: validFee(settings.freeShippingThreshold, DEFAULT_FREE_SHIPPING_THRESHOLD) || DEFAULT_FREE_SHIPPING_THRESHOLD,
    homeMethods: [
      { id: 'standard', label: STANDARD_HOME_LABEL, fee: validFee(settings.defaultShippingFee, DEFAULT_SHIPPING_FEE) },
      { id: 'sf-home', label: SF_HOME_LABEL, fee: validFee(settings.sfHomeShippingFee, DEFAULT_SF_HOME_SHIPPING_FEE) },
    ],
    pickupMethods: settings.pickupEnabled
      ? PICKUP_METHOD_DEFINITIONS.map((method) => ({ ...method, fee: pickupFee }))
      : [],
  };
}

export const isHomeMethodId = (value: unknown): value is HomeMethodId => value === 'standard' || value === 'sf-home';

export function homeMethodLabel(id: HomeMethodId): string {
  return id === 'sf-home' ? SF_HOME_LABEL : STANDARD_HOME_LABEL;
}

export function pickupMethodLabel(carrier: PickupCarrier): string {
  return PICKUP_METHOD_DEFINITIONS.find((method) => method.carrier === carrier)?.label ?? '';
}

/** 最便宜的宅配（送到收件地址）運費；結構化資料的運費用這個。 */
export function cheapestHomeFee(methods: ShippingMethods): number {
  return Math.min(...methods.homeMethods.map((method) => method.fee));
}

/** 宅配選項依運費由低到高；顧客沒選時預設最便宜的（與 LUCISSI 的 homeChoices 相同）。 */
export function sortedHomeMethods(methods: ShippingMethods): HomeShippingMethod[] {
  return [...methods.homeMethods].sort((a, b) => a.fee - b.fee);
}

export const formatTwd = (amount: number) => `NT$${amount.toLocaleString('en-US')}`;

/** 「黑貓宅配 NT$146、順豐宅配 NT$130、7-11取貨 NT$69…」 */
export function shippingFeeSummary(methods: ShippingMethods): string {
  return [...methods.homeMethods, ...methods.pickupMethods].map((method) => `${method.label} ${formatTwd(method.fee)}`).join('、');
}

/** 公告列與商品頁共用的一句話，例如「台灣宅配・超商取貨，單筆滿 NT$1,500 免運」。 */
export function shippingHeadline(methods: ShippingMethods): string {
  const kinds = methods.pickupMethods.length ? '宅配・超商取貨，' : '宅配';
  return `台灣${kinds}單筆滿 ${formatTwd(methods.freeShippingThreshold)} 免運`;
}

// 出貨時效（比照 LUCISSI 的配送說明）。
export const DISPATCH_PROMISE = '付款完成後（貨到付款為訂單成立後）1 個工作天內出貨，週末與國定假日不出貨（例如週五付款，將於下週一出貨）';
export const TRANSIT_PROMISE = '出貨後一般約 1–2 個工作天送達，追蹤資訊以出貨通知為準';

// 付款方式（比照 LUCISSI）。
export const PAYMENT_METHODS_SHORT = '可用信用卡（Visa、Mastercard、JCB）線上付款、ATM 轉帳，或選擇貨到付款。';
export const COD_REFUSAL_RULE = '貨到付款訂單累計 2 次拒收或逾期未取件，帳號將暫停購買，並自動取消尚未出貨的訂單。';

export interface DeliveryOptionLike {
  handle: string;
  title?: string | null;
  estimatedCost?: { amount?: string | number | null } | null;
}

/**
 * 建立結帳後要預選的 Shopify 運費（移植自 LUCISSI Lib/storefront/delivery-choice.ts）。
 * 結帳頁預設選最便宜的運費；超商取貨開放後最便宜的是超商運費，宅配顧客會被帶到超商、
 * 選 7-11 的顧客會落在全家。ShipAny 與運單依完整運費名稱判斷，所以要先選好。
 *
 * @param pickupLabel 顧客在購物車選的超商運費名稱；宅配為 undefined
 * @param homeLabel 顧客在購物車選的宅配運費名稱；沒有時選最便宜的宅配
 * @returns 要選的 handle；找不到合適的回傳 null（沿用 Shopify 預設）
 */
export function chooseDeliveryOption(
  options: DeliveryOptionLike[],
  pickupLabel: string | undefined,
  homeLabel?: string,
  pickupLabels: readonly string[] = PICKUP_RATE_LABELS,
): string | null {
  const valid = options.filter((option) => option && typeof option.handle === 'string' && option.handle);
  if (pickupLabel) return valid.find((option) => option.title === pickupLabel)?.handle ?? null;
  const pickups = new Set(pickupLabels);
  if (homeLabel && !pickups.has(homeLabel)) {
    const chosen = valid.find((option) => option.title === homeLabel);
    if (chosen) return chosen.handle;
  }
  const cost = (option: DeliveryOptionLike) => {
    const amount = Number(option.estimatedCost?.amount);
    return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
  };
  const home = valid.filter((option) => !pickups.has(option.title ?? '')).sort((a, b) => cost(a) - cost(b));
  return home[0]?.handle ?? null;
}
