import type { ShopifyCheckoutLine } from '../domain/algorithms';
import type { InvoicePreference } from '../domain/invoice';
import { isSupabaseConfigured, supabase } from './supabase';

export const SAENGAK_SHOPIFY_DOMAIN = 'gh2xgs-zf.myshopify.com';

export const isShopifyCheckoutConfigured = true;

interface ShopifyCheckoutResponse {
  checkoutUrl?: string;
  orderTrackingLinked?: boolean;
  error?: string;
  code?: string;
  details?: unknown;
}

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
  if (checkoutUrl.hostname.toLowerCase() !== SAENGAK_SHOPIFY_DOMAIN) {
    throw new Error('Shopify 結帳商店不符，已停止導向以保護訂單');
  }
  return checkoutUrl.toString();
}

export async function createShopifyCheckout(
  lines: ShopifyCheckoutLine[],
  invoicePreference: InvoicePreference,
): Promise<string> {
  if (!isShopifyCheckoutConfigured) {
    throw new Error('Shopify checkout 尚未設定');
  }

  if (!isSupabaseConfigured) {
    throw new Error('會員驗證服務尚未設定，暫時無法結帳。');
  }

  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error || !sessionData.session?.access_token) {
    throw new Error('結帳前請先登入會員，登入後購物車內容會保留。');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionData.session.access_token}`,
  };

  const response = await fetch(
    `/api/create-shopify-cart`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ lines, invoicePreference }),
    },
  );

  const data = await response.json().catch(() => ({})) as ShopifyCheckoutResponse;
  if (!response.ok) {
    throw new Error(getShopifyCheckoutErrorMessage(data, response.status));
  }

  if (!data.checkoutUrl) {
    throw new Error('Shopify 未回傳 checkoutUrl');
  }

  assertMemberOrderTracking(data, true);

  return validateShopifyCheckoutUrl(data.checkoutUrl);
}
