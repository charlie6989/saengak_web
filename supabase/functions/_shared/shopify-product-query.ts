const SHOPIFY_PRODUCT_GID = /^gid:\/\/shopify\/Product\/[1-9]\d*$/;
const SHOPIFY_PRODUCT_NUMERIC_ID = /^[1-9]\d*$/;

export type ShopifyProductIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

export function parseShopifyProductIds(
  value: unknown,
  maximumIds = 50,
): ShopifyProductIdsResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'Product IDs are required and must be a non-empty array' };
  }
  if (value.length > maximumIds) {
    return { ok: false, error: `At most ${maximumIds} product IDs are allowed` };
  }

  const ids: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      return { ok: false, error: 'Every product ID must be a string' };
    }
    if (SHOPIFY_PRODUCT_NUMERIC_ID.test(candidate)) {
      ids.push(`gid://shopify/Product/${candidate}`);
      continue;
    }
    if (SHOPIFY_PRODUCT_GID.test(candidate)) {
      ids.push(candidate);
      continue;
    }
    return { ok: false, error: 'Every product ID must be an exact Shopify Product GID or numeric ID' };
  }

  return { ok: true, ids };
}

export function buildShopifyProductsQuery(
  includeRestrictedFields: boolean,
  includeInventory: boolean,
): string {
  const productFields = includeRestrictedFields ? 'tags' : '';
  const variantFields = includeInventory ? 'quantityAvailable' : '';

  return `
    query GetProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          description
          descriptionHtml
          handle
          ${productFields}
          productType
          vendor
          createdAt
          updatedAt
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                availableForSale
                ${variantFields}
                selectedOptions {
                  name
                  value
                }
                image {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;
}
