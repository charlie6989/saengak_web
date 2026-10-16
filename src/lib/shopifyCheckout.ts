import type { ShopifyCheckoutLine } from '../domain/algorithms';
import type { InvoicePreference } from '../domain/invoice';
import { isSupabaseConfigured, supabase } from './supabase';

export const LUCISSI_CARE_SHOPIFY_DOMAIN = 'gh2xgs-zf.myshopify.com';

export const isShopifyCheckoutConfigured = true;

interface ShopifyCheckoutResponse {
  checkoutUrl?: string;
  orderTrackingLinked?: boolean;
  checkoutKind?: 'member' | 'guest';
  invalidDiscountCodes?: string[];
  error?: string;
  code?: string;
  details?: unknown;
}

/** 訪客結帳需要的資料；只在未登入且後台開啟 guest_checkout_enabled 時使用。 */
export interface GuestCheckoutDetails {
  email: string;
  turnstileToken: string;
}

/** 帶有 API 錯誤碼的結帳錯誤，讓介面依錯誤碼決定是否開啟登入視窗。 */
export class ShopifyCheckoutError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ShopifyCheckoutError';
    this.code = code;
  }
}

/** 需要顧客登入才能繼續的錯誤碼。 */
export const LOGIN_REQUIRED_ERROR_CODES: ReadonlySet<string> = new Set([
  'MEMBER_LOGIN_REQUIRED',
  'MEMBER_SESSION_INVALID',
  'GUEST_DISCOUNT_REQUIRES_LOGIN',
]);

const guestCheckoutErrorMessages: Record<string, string> = {
  TURNSTILE_UNAVAILABLE: '訪客結帳的安全驗證服務暫時無法使用，請稍後再試，或改用會員結帳。',
  TURNSTILE_TOKEN_REQUIRED: '請先完成安全驗證，再進行訪客結帳。',
  TURNSTILE_VERIFICATION_FAILED: '安全驗證未通過或已逾時，請重新完成驗證後再試。',
  GUEST_DISCOUNT_REQUIRES_LOGIN: '優惠券與折扣碼僅限會員使用，請登入後結帳。',
  GUEST_EMAIL_REQUIRED: '請輸入有效的 Email，訂單確認信會寄到這個信箱。',
  GUEST_ORDER_LINK_UNAVAILABLE: '目前無法建立訪客訂單紀錄，已停止結帳。請稍後再試，或改用會員結帳。',
  GUEST_ORDER_LINK_FAILED: '目前無法建立訪客訂單紀錄，已停止結帳。請稍後再試，或改用會員結帳。',
};

function collectDetailText(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectDetailText);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectDetailText);
  }
  return [];
}

export function getShopifyCheckoutErrorMessage(
  data: ShopifyCheckoutResponse,
  status: number,
): string {
  const details = collectDetailText(data.details);
  const diagnosticText = [data.error, ...details].filter(Boolean).join(' ');

  if (
    data.code === 'SHOPIFY_STOREFRONT_LOCKED' ||
    /online store channel is locked/i.test(diagnosticText)
  ) {
    return 'Shopify 商店尚未解鎖，暫時無法進入 TapPay 結帳。請先在 Shopify 啟用 Online Store。';
  }

  if (data.code && guestCheckoutErrorMessages[data.code]) {
    return guestCheckoutErrorMessages[data.code];
  }

  if (status === 401) {
    if (data.code === 'MEMBER_LOGIN_REQUIRED') {
      return '結帳前請先登入會員，登入後購物車內容會保留。';
    }
    if (data.code === 'MEMBER_SESSION_INVALID') {
      return '會員登入狀態已失效，請重新登入後再結帳。';
    }
    return '結帳服務驗證失敗，請重新整理後再試。';
  }

  if (data.code === 'MEMBERSHIP_AUTH_UNAVAILABLE') {
    return '會員驗證服務暫時無法使用，已停止結帳。請稍後再試。';
  }

  if (
    data.code === 'MEMBER_ORDER_LINK_UNAVAILABLE' ||
    data.code === 'MEMBER_ORDER_LINK_FAILED'
  ) {
    return '目前無法把 Shopify 訂單綁定到會員帳號，已停止結帳。請稍後再試。';
  }

  if (data.code === 'INVOICE_PREFERENCE_PERSISTENCE_FAILED') {
    return '目前無法安全保存發票資料，已停止結帳。請稍後再試。';
  }

  return details[0] || data.error || `建立 Shopify 購物車失敗 (${status})`;
}

export function assertMemberOrderTracking(
  data: ShopifyCheckoutResponse,
  hasMemberSession: boolean,
): void {
  if (hasMemberSession && data.orderTrackingLinked !== true) {
    throw new Error('目前無法把 Shopify 訂單綁定到會員帳號，已停止結帳。請稍後再試。');
  }
}

export function validateShopifyCheckoutUrl(rawCheckoutUrl: string): string {
  const checkoutUrl = new URL(rawCheckoutUrl);
  if (checkoutUrl.protocol !== 'https:') {
    throw new Error('Shopify 回傳了不安全的結帳網址');
  }
  if (checkoutUrl.hostname.toLowerCase() !== LUCISSI_CARE_SHOPIFY_DOMAIN) {
    throw new Error('Shopify 結帳商店不符，已停止導向以保護訂單');
  }
  return checkoutUrl.toString();
}

/**
 * 讀取公開設定 site_settings.guest_checkout_enabled；讀取失敗一律視為關閉。
 * 伺服器端仍會再檢查一次，前端只用來決定是否顯示「訪客結帳」。
 */
export async function fetchGuestCheckoutEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'guest_checkout_enabled')
      .maybeSingle();
    if (error) return false;
    return data?.value === true;
  } catch {
    return false;
  }
}

/**
 * 建立 Shopify 結帳。
 * - 會員：帶 Authorization，可使用折扣碼，回應必須確認訂單已綁定會員。
 * - 訪客（傳入 guest）：不帶 Authorization，送出 guestEmail 與 turnstileToken，不送折扣碼。
 */
export async function createShopifyCheckout(
  lines: ShopifyCheckoutLine[],
  invoicePreference: InvoicePreference,
  discountCodes?: string[],
  guest?: GuestCheckoutDetails,
): Promise<{ checkoutUrl: string; invalidDiscountCodes: string[]; checkoutKind: 'member' | 'guest' }> {
  if (!isShopifyCheckoutConfigured) {
    throw new Error('Shopify checkout 尚未設定');
  }

  const isGuest = Boolean(guest);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!isGuest) {
    if (!isSupabaseConfigured) {
      throw new Error('會員驗證服務尚未設定，暫時無法結帳。');
    }

    const { data: sessionData, error } = await supabase.auth.getSession();
    if (error || !sessionData.session?.access_token) {
      throw new ShopifyCheckoutError(
        '結帳前請先登入會員，登入後購物車內容會保留。',
        'MEMBER_LOGIN_REQUIRED',
      );
    }
    headers.Authorization = `Bearer ${sessionData.session.access_token}`;
  }

  const requestBody = guest
    ? {
        lines,
        invoicePreference,
        guestEmail: guest.email.trim(),
        turnstileToken: guest.turnstileToken,
      }
    : {
        lines,
        invoicePreference,
        ...(discountCodes && discountCodes.length > 0 ? { discountCodes } : {}),
      };

  const response = await fetch(
    `/api/create-shopify-cart`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  );

  const data = await response.json().catch(() => ({})) as ShopifyCheckoutResponse;
  if (!response.ok) {
    throw new ShopifyCheckoutError(getShopifyCheckoutErrorMessage(data, response.status), data.code);
  }

  if (!data.checkoutUrl) {
    throw new Error('Shopify 未回傳 checkoutUrl');
  }

  // 訪客訂單在結帳時不會綁定會員（orderTrackingLinked 為 false），只檢查會員結帳。
  assertMemberOrderTracking(data, !isGuest);

  return {
    checkoutUrl: validateShopifyCheckoutUrl(data.checkoutUrl),
    invalidDiscountCodes: Array.isArray(data.invalidDiscountCodes) ? data.invalidDiscountCodes : [],
    checkoutKind: isGuest ? 'guest' : 'member',
  };
}
