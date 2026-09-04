import { jsonResponse, isOriginAllowed } from '../_lib/security.js';
import { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_VERSION } from '../_lib/shopify-config.js';
import { getSiteSetting } from '../_lib/supabase-admin.js';

interface ShopifyDiscountNode {
  id: string;
  metafieldImage?: {
    id?: string;
    value?: string;
    reference?: {
      image?: {
        url?: string;
        altText?: string;
      };
      url?: string;
    };
  };
  metafieldTag?: {
    value?: string;
  };
  metafieldSubtitle?: {
    value?: string;
  };
  codeDiscount?: {
    title?: string;
    status?: string;
    summary?: string;
    startsAt?: string;
    endsAt?: string;
    appliesOncePerCustomer?: boolean;
    usageLimit?: number | null;
    asyncUsageCount?: number;
    combinesWith?: {
      orderDiscounts?: boolean;
      productDiscounts?: boolean;
      shippingDiscounts?: boolean;
    };
    codes?: {
      nodes?: Array<{ code?: string }>;
    };
    customerGets?: {
      value?: {
        percentage?: number;
        discountAmount?: {
          amount?: string | number;
          currencyCode?: string;
        };
      };
    };
    minimumRequirement?: {
      greaterThanOrEqualToSubtotal?: {
        amount?: string | number;
      };
      greaterThanOrEqualToQuantity?: string | number;
    };
  };
}

interface ShopifyTokenResponse {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  [key: string]: any;
}

interface ShopifyGraphQLResponse {
  data?: {
    codeDiscountNodes?: {
      nodes?: ShopifyDiscountNode[];
    };
  };
  errors?: Array<{ message: string; [key: string]: any }>;
}

interface ShopifyGraphQLByCodeResponse {
  data?: {
    codeDiscountNodeByCode?: ShopifyDiscountNode | null;
  };
  errors?: Array<{ message: string; [key: string]: any }>;
}

export interface ShopifyPromotion {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'welcome' | 'discount' | 'shipping' | 'member';
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  min_spend: number;
  min_quantity: number | null;
  starts_at: string;
  ends_at?: string;
  badge_text: string;
  image_url: string;
  is_active: boolean;
  applies_once_per_customer: boolean;
  usage_limit: number | null;
  async_usage_count: number;
  combines_with: {
    order_discounts: boolean;
    product_discounts: boolean;
    shipping_discounts: boolean;
  };
}

const DEFAULT_IMAGE_MAP: Record<string, string> = {
  WELCOME100: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
  SAVE15: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
  FREESHIP: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&q=80&w=800',
  SPECIAL30: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
};

const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800';

// DiscountCodeBasic / DiscountCodeFreeShipping 共用欄位選取。
// 被「批次查詢全部折扣」(codeDiscountNodes) 與「以代碼查詢單一折扣」(codeDiscountNodeByCode)
// 兩處 GraphQL query 共用，避免重複維護兩份幾乎一樣的欄位選取。
const CODE_DISCOUNT_FIELDS = `
  ... on DiscountCodeBasic {
    title
    status
    summary
    startsAt
    endsAt
    appliesOncePerCustomer
    usageLimit
    asyncUsageCount
    combinesWith {
      orderDiscounts
      productDiscounts
      shippingDiscounts
    }
    codes(first: 5) { nodes { code } }
    customerGets {
      value {
        ... on DiscountPercentage { percentage }
        ... on DiscountAmount { amount { amount currencyCode } }
      }
    }
    minimumRequirement {
      ... on DiscountMinimumSubtotal {
        greaterThanOrEqualToSubtotal { amount }
      }
      ... on DiscountMinimumQuantity {
        greaterThanOrEqualToQuantity
      }
    }
  }
  ... on DiscountCodeFreeShipping {
    title
    status
    summary
    startsAt
    endsAt
    appliesOncePerCustomer
    usageLimit
    asyncUsageCount
    combinesWith {
      orderDiscounts
      productDiscounts
      shippingDiscounts
    }
    codes(first: 5) { nodes { code } }
    minimumRequirement {
      ... on DiscountMinimumSubtotal {
        greaterThanOrEqualToSubtotal { amount }
      }
      ... on DiscountMinimumQuantity {
        greaterThanOrEqualToQuantity
      }
    }
  }
`;

// 記憶體快取 Shopify Admin Access Token，避免每次請求都重新以 Client Credentials 換發
// (增加延遲並消耗 Shopify API 配額)。快取存活時間依 expires_in 扣除 60 秒安全緩衝。
let cachedAdminToken: { token: string; expiresAt: number } | null = null;

async function getShopifyAdminAccessToken(
  domain: string,
  clientId: string,
  clientSecret: string,
): Promise<string | undefined> {
  const now = Date.now();
  if (cachedAdminToken && cachedAdminToken.expiresAt > now) {
    return cachedAdminToken.token;
  }

  // 取得 Shopify Client Credentials Access Token
  const tokenRes = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as ShopifyTokenResponse;
  if (!tokenData.access_token) {
    console.warn('無法取得 Shopify Admin Token，回傳錯誤:', tokenData);
    return undefined;
  }

  const expiresInSeconds = typeof tokenData.expires_in === 'number' && tokenData.expires_in > 0
    ? tokenData.expires_in
    : 1500;
  cachedAdminToken = {
    token: tokenData.access_token,
    expiresAt: now + (expiresInSeconds - 60) * 1000,
  };

  return tokenData.access_token;
}

/**
 * 將單一 Shopify codeDiscountNode 轉換為前台用的 Promotion 物件。
 * 純函式：不打網路、不依賴 Request/Response，可單獨單元測試。
 * 若查無折扣代碼 (code) 則回傳 undefined。
 */
export function mapDiscountNodeToPromotion(n: ShopifyDiscountNode): ShopifyPromotion | undefined {
  const cd = n.codeDiscount!;
  const code = cd.codes?.nodes?.[0]?.code || '';
  if (!code) return undefined;

  const title = cd.title || code;
  const subtotal = Number(cd.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount || 0);

  let discountType: 'percentage' | 'fixed_amount' | 'free_shipping' = 'fixed_amount';
  let discountValue = 0;
  let badgeText = '';
  let category: 'welcome' | 'discount' | 'shipping' | 'member' = 'discount';

  const getsValue = cd.customerGets?.value as any;
  if (getsValue?.percentage !== undefined) {
    discountType = 'percentage';
    discountValue = Math.round(Number(getsValue.percentage) * 100);
    badgeText = `${discountValue}% OFF`;
  } else if (getsValue?.amount !== undefined) {
    discountType = 'fixed_amount';
    const rawAmt = typeof getsValue.amount === 'object' && getsValue.amount !== null
      ? getsValue.amount.amount
      : getsValue.amount;
    discountValue = Math.round(Number(rawAmt || 0));
    badgeText = `NT$ ${discountValue}`;
  } else if (getsValue?.discountAmount?.amount !== undefined) {
    discountType = 'fixed_amount';
    discountValue = Math.round(Number(getsValue.discountAmount.amount));
    badgeText = `NT$ ${discountValue}`;
  } else {
    discountType = 'free_shipping';
    discountValue = 0;
    badgeText = '全館免運';
  }

  const upperCode = code.toUpperCase();
  if (upperCode.includes('WELCOME') || title.includes('新會員') || title.includes('見面禮')) {
    category = 'welcome';
    badgeText = badgeText || '新客專享';
  } else if (discountType === 'free_shipping' || upperCode.includes('SHIP')) {
    category = 'shipping';
    badgeText = '全館免運';
  } else if (upperCode.includes('SPECIAL') || upperCode.includes('MEMBER') || title.includes('會員')) {
    category = 'member';
    badgeText = badgeText || '會員專屬';
  } else {
    category = 'discount';
  }

  // 後台自訂元欄位優先讀取
  const uploadedImageUrl = n.metafieldImage?.reference?.image?.url || n.metafieldImage?.reference?.url;
  const imageUrl = uploadedImageUrl || DEFAULT_IMAGE_MAP[upperCode] || DEFAULT_FALLBACK_IMAGE;

  const customBadge = n.metafieldTag?.value?.trim();
  if (customBadge) {
    badgeText = customBadge;
  }

  const customSubtitle = n.metafieldSubtitle?.value?.trim();
  const minQuantity = cd.minimumRequirement?.greaterThanOrEqualToQuantity
    ? Number(cd.minimumRequirement.greaterThanOrEqualToQuantity)
    : null;

  const subtitle = customSubtitle || cd.summary || (
    subtotal > 0
      ? `滿 NT$ ${subtotal.toLocaleString()} 可折抵`
      : minQuantity && minQuantity > 0
      ? `滿 ${minQuantity} 件可折抵`
      : '全館無門檻享用'
  );

  // 使用量限制 1：每位顧客限用一次 (appliesOncePerCustomer)
  // 勾選為 true (每人限用一次)；未勾選為 false (不限每人使用次數)
  const appliesOnce = cd.appliesOncePerCustomer === true;

  // 使用量限制 2：限制每個代碼的總使用次數上限 (usageLimit)
  // 勾選並填入數字為 number；未勾選為 null (不限總使用次數)
  const usageLimit = typeof cd.usageLimit === 'number' ? cd.usageLimit : null;
  const asyncUsageCount = typeof cd.asyncUsageCount === 'number' ? cd.asyncUsageCount : 0;

  // 組合 (Combinations)：是否可與其他折扣併用
  const combinesWith = {
    order_discounts: Boolean(cd.combinesWith?.orderDiscounts),
    product_discounts: Boolean(cd.combinesWith?.productDiscounts),
    shipping_discounts: Boolean(cd.combinesWith?.shippingDiscounts),
  };

  // 動態組裝說明文字，絕不寫死
  const ruleDetails: string[] = [];
  if (subtotal > 0) {
    ruleDetails.push(`最低消費 NT$ ${subtotal.toLocaleString()}`);
  } else if (minQuantity && minQuantity > 0) {
    ruleDetails.push(`最低購買滿 ${minQuantity} 件`);
  } else {
    ruleDetails.push('全館無門檻');
  }

  if (appliesOnce) {
    ruleDetails.push('每位顧客限用一次');
  } else {
    ruleDetails.push('不限每人使用次數');
  }

  if (usageLimit !== null) {
    ruleDetails.push(`全店總限量 ${usageLimit.toLocaleString()} 組`);
  }

  const canCombineAny = combinesWith.order_discounts || combinesWith.product_discounts || combinesWith.shipping_discounts;
  if (!canCombineAny) {
    ruleDetails.push('不可與其他折扣併用');
  } else {
    const comboNames: string[] = [];
    if (combinesWith.product_discounts) comboNames.push('商品折扣');
    if (combinesWith.order_discounts) comboNames.push('訂單折扣');
    if (combinesWith.shipping_discounts) comboNames.push('運費優惠');
    ruleDetails.push(`可與${comboNames.join('、')}併用`);
  }

  const description = `Shopify 官方活動，結帳時直接折抵。${ruleDetails.join(' • ')}。`;

  return {
    id: n.id,
    code,
    title,
    subtitle,
    description,
    category,
    discount_type: discountType,
    discount_value: discountValue,
    min_spend: subtotal,
    min_quantity: minQuantity,
    starts_at: cd.startsAt || new Date().toISOString(),
    ends_at: cd.endsAt || undefined,
    badge_text: badgeText,
    image_url: imageUrl,
    is_active: true,
    applies_once_per_customer: appliesOnce,
    usage_limit: usageLimit,
    async_usage_count: asyncUsageCount,
    combines_with: combinesWith,
  };
}

/**
 * 以單一折扣代碼向 Shopify Admin API 查詢權威資料並轉換為 Promotion。
 * 自包含、不依賴任何 Request/Response 物件，供其他 API (例如會員領券) import 使用。
 * 查無代碼、代碼非 ACTIVE、憑證未設定或換 token 失敗時一律回傳 undefined，不會 throw。
 */
export async function fetchShopifyPromotionByCode(code: string): Promise<ShopifyPromotion | undefined> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return undefined;

  const domain = SHOPIFY_STORE_DOMAIN || 'gh2xgs-zf.myshopify.com';
  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('SHOPIFY_APP_CLIENT_ID 或 SHOPIFY_APP_CLIENT_SECRET 未設定');
    return undefined;
  }

  try {
    const accessToken = await getShopifyAdminAccessToken(domain, clientId, clientSecret);
    if (!accessToken) {
      return undefined;
    }

    const query = `
      query GetShopifyDiscountByCode($code: String!) {
        codeDiscountNodeByCode(code: $code) {
          id
          metafieldImage: metafield(namespace: "custom", key: "promo_image") {
            id
            value
            reference {
              ... on MediaImage {
                id
                image {
                  url
                  altText
                }
              }
              ... on GenericFile {
                id
                url
              }
            }
          }
          metafieldTag: metafield(namespace: "custom", key: "tag_label") {
            value
          }
          metafieldSubtitle: metafield(namespace: "custom", key: "subtitle") {
            value
          }
          codeDiscount {
            ${CODE_DISCOUNT_FIELDS}
          }
        }
      }
    `;

    const shopifyRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables: { code: normalizedCode } }),
    });

    const shopifyData = (await shopifyRes.json().catch(() => ({}))) as ShopifyGraphQLByCodeResponse;
    const node = shopifyData?.data?.codeDiscountNodeByCode;
    if (!node || node.codeDiscount?.status !== 'ACTIVE') {
      return undefined;
    }

    return mapDiscountNodeToPromotion(node);
  } catch (err) {
    console.error('Fetch shopify discount by code failed:', err);
    return undefined;
  }
}

export async function GET(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const domain = SHOPIFY_STORE_DOMAIN || 'gh2xgs-zf.myshopify.com';
    const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('SHOPIFY_APP_CLIENT_ID 或 SHOPIFY_APP_CLIENT_SECRET 未設定');
      return jsonResponse({ error: 'Shopify credentials not configured' }, { status: 500, headers: corsHeaders });
    }

    const accessToken = await getShopifyAdminAccessToken(domain, clientId, clientSecret);
    if (!accessToken) {
      return jsonResponse({ error: 'Shopify authentication failed' }, { status: 502, headers: corsHeaders });
    }

    const query = `
      query GetShopifyDiscounts {
        codeDiscountNodes(first: 50) {
          nodes {
            id
            metafieldImage: metafield(namespace: "custom", key: "promo_image") {
              id
              value
              reference {
                ... on MediaImage {
                  id
                  image {
                    url
                    altText
                  }
                }
                ... on GenericFile {
                  id
                  url
                }
              }
            }
            metafieldTag: metafield(namespace: "custom", key: "tag_label") {
              value
            }
            metafieldSubtitle: metafield(namespace: "custom", key: "subtitle") {
              value
            }
            codeDiscount {
              ${CODE_DISCOUNT_FIELDS}
            }
          }
        }
      }
    `;

    const shopifyRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    });

    const shopifyData = (await shopifyRes.json().catch(() => ({}))) as ShopifyGraphQLResponse;
    const nodes: ShopifyDiscountNode[] = shopifyData?.data?.codeDiscountNodes?.nodes || [];

    const promotions = nodes
      .filter((n) => n.codeDiscount?.status === 'ACTIVE')
      .map(mapDiscountNodeToPromotion)
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const [freeShippingThresholdSetting, defaultShippingFeeSetting] = await Promise.all([
      getSiteSetting<number>('free_shipping_threshold'),
      getSiteSetting<number>('default_shipping_fee'),
    ]);
    const siteSettings = {
      freeShippingThreshold: typeof freeShippingThresholdSetting === 'number' ? freeShippingThresholdSetting : 1500,
      defaultShippingFee: typeof defaultShippingFeeSetting === 'number' ? defaultShippingFeeSetting : 80,
    };

    return jsonResponse(
      {
        promotions,
        total: promotions.length,
        source: 'shopify_admin_api',
        store: domain,
        siteSettings,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('Fetch shopify discounts failed:', err);
    return jsonResponse({ error: err?.message || 'Failed to fetch discounts' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': requestOrigin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export default { fetch: (req: Request) => (req.method === 'OPTIONS' ? OPTIONS(req) : GET(req)) };
