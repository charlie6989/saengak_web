export {
  buildStorefrontHeaders,
  isValidShopifyDomain,
  normalizeShopifyDomain,
  resolveShopifyDomain,
  resolveStorefrontApiVersion,
} from '../_shared/shopify-storefront.ts';

export function getBuyerIp(headers: Headers): string | undefined {
  const forwardedIp = headers.get('cf-connecting-ip') || headers.get('x-forwarded-for');
  const buyerIp = forwardedIp?.split(',')[0]?.trim();
  return buyerIp || undefined;
}

export function extractShopifyCartToken(cartId: string): string | undefined {
  const marker = 'gid://shopify/Cart/';
  if (!cartId.startsWith(marker)) return undefined;
  const token = cartId.slice(marker.length).split('?')[0]?.trim();
  return token && token.length >= 8 ? token : undefined;
}
