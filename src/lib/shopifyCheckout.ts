import type { ShopifyCheckoutLine } from '../domain/algorithms';
import { isSupabaseConfigured, supabase } from './supabase';

export const SAENGAK_SHOPIFY_DOMAIN = 'gh2xgs-zf.myshopify.com';

const checkoutSupabaseUrl = (
  import.meta.env.VITE_PUBLIC_CHECKOUT_SUPABASE_URL ||
  import.meta.env.VITE_PUBLIC_SUPABASE_URL ||
  ''
).replace(/\/$/, '');

const checkoutPublishableKey =
  import.meta.env.VITE_PUBLIC_CHECKOUT_SUPABASE_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const membershipSupabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');

export const isShopifyCheckoutConfigured = Boolean(
  checkoutSupabaseUrl && checkoutPublishableKey,
);

interface ShopifyCheckoutResponse {
  checkoutUrl?: string;
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
    return '結帳服務驗證失敗，請重新整理後再試。';
  }

  return details[0] || data.error || `建立 Shopify 購物車失敗 (${status})`;
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

export async function createShopifyCheckout(lines: ShopifyCheckoutLine[]): Promise<string> {
  if (!isShopifyCheckoutConfigured) {
    throw new Error('Shopify checkout 尚未設定');
  }

  const headers: Record<string, string> = {
    apikey: checkoutPublishableKey,
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured && membershipSupabaseUrl === checkoutSupabaseUrl) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  }

  const response = await fetch(
    `${checkoutSupabaseUrl}/functions/v1/create-shopify-cart`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ lines }),
    },
  );

  const data = await response.json().catch(() => ({})) as ShopifyCheckoutResponse;
  if (!response.ok) {
    throw new Error(getShopifyCheckoutErrorMessage(data, response.status));
  }

  if (!data.checkoutUrl) {
    throw new Error('Shopify 未回傳 checkoutUrl');
  }

  return validateShopifyCheckoutUrl(data.checkoutUrl);
}
