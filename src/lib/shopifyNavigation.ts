export const SAENGAK_SHOPIFY_HOST = 'gh2xgs-zf.myshopify.com';

const SHOPIFY_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildShopifyArticleUrl(blogHandle: unknown, articleHandle: unknown): string | null {
  if (typeof blogHandle !== 'string' || typeof articleHandle !== 'string') return null;
  if (!SHOPIFY_HANDLE.test(blogHandle) || !SHOPIFY_HANDLE.test(articleHandle)) return null;
  return `https://${SAENGAK_SHOPIFY_HOST}/blogs/${blogHandle}/${articleHandle}`;
}
