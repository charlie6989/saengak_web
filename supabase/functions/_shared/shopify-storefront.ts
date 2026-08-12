export const SAENGAK_SHOPIFY_DOMAIN = 'gh2xgs-zf.myshopify.com';
export const SAENGAK_STOREFRONT_API_VERSION = '2026-07';

export function normalizeShopifyDomain(rawDomain: string | undefined): string {
  return (rawDomain ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

export function resolveShopifyDomain(rawDomain: string | undefined): string {
  const configuredDomain = normalizeShopifyDomain(rawDomain);

  // SAENGAK checkout is intentionally pinned to one Shopify store. Ignore an
  // obsolete override so a stale Edge Function secret cannot send customers
  // to a different merchant account.
  return configuredDomain.toLowerCase() === SAENGAK_SHOPIFY_DOMAIN
    ? configuredDomain.toLowerCase()
    : SAENGAK_SHOPIFY_DOMAIN;
}

export function isValidShopifyDomain(domain: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(domain);
}

export function resolveStorefrontApiVersion(rawVersion: string | undefined): string {
  const version = rawVersion?.trim();
  return version && /^20\d{2}-(01|04|07|10)$/.test(version)
    ? version
    : SAENGAK_STOREFRONT_API_VERSION;
}

export function shouldIncludeStorefrontInventory(rawFlag: string | undefined): boolean {
  return rawFlag?.trim().toLowerCase() === 'true';
}

export function buildStorefrontHeaders(
  storefrontAccessToken: string | undefined,
  buyerIp?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (storefrontAccessToken?.trim()) {
    headers['X-Shopify-Storefront-Access-Token'] = storefrontAccessToken.trim();
  }

  if (buyerIp?.trim()) {
    headers['Shopify-Storefront-Buyer-IP'] = buyerIp.trim();
  }

  return headers;
}

export function buildStorefrontUrl(domain: string, apiVersion: string): string {
  return `https://${domain}/api/${apiVersion}/graphql.json`;
}
