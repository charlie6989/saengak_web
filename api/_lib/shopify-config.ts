const normalizeShopDomain = (value: string): string =>
  value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();

export const SHOPIFY_STORE_DOMAIN = normalizeShopDomain(
  process.env.SHOPIFY_STORE_DOMAIN ||
  process.env.VITE_PUBLIC_SHOPIFY_STORE_DOMAIN ||
  'gh2xgs-zf.myshopify.com',
);

// Storefront tokens are public by Shopify design, but production can still
// override the checked-in storefront token without importing browser code.
export const SHOPIFY_STOREFRONT_PUBLIC_TOKEN =
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.VITE_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  '9862bdf1a7178bd589dd83a130a3e24b';

export const SHOPIFY_API_VERSION =
  process.env.SHOPIFY_STOREFRONT_API_VERSION ||
  process.env.VITE_PUBLIC_SHOPIFY_API_VERSION ||
  '2026-07';

// Admin API 版本獨立於 Storefront API 版本，讓兩者未來可各自調整。
export const SHOPIFY_ADMIN_API_VERSION =
  process.env.SHOPIFY_ADMIN_API_VERSION ||
  process.env.SHOPIFY_STOREFRONT_API_VERSION ||
  process.env.VITE_PUBLIC_SHOPIFY_API_VERSION ||
  '2026-07';
