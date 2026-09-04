import { jsonResponse } from '../_lib/security.js';
import { SHOPIFY_STORE_DOMAIN } from '../_lib/shopify-config.js';

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

const DEFAULT_IMAGE_MAP: Record<string, string> = {
  WELCOME100: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
  SAVE15: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
  FREESHIP: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&q=80&w=800',
  SPECIAL30: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
};

const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800';

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
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
            }
          }
        }
      }
    `;

    const shopifyRes = await fetch(`https://${domain}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': tokenData.access_token,
      },
      body: JSON.stringify({ query }),
    });

    const shopifyData = (await shopifyRes.json().catch(() => ({}))) as ShopifyGraphQLResponse;
    const nodes: ShopifyDiscountNode[] = shopifyData?.data?.codeDiscountNodes?.nodes || [];
    if (nodes.length > 0) {
      console.log('Shopify node 0:', JSON.stringify(nodes[0], null, 2));
    }

    const promotions = nodes
      .filter((n) => n.codeDiscount?.status === 'ACTIVE')
      .map((n) => {
        const cd = n.codeDiscount!;
        const code = cd.codes?.nodes?.[0]?.code || '';
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
      })
      .filter((p) => Boolean(p.code));

    return jsonResponse(
      {
        promotions,
        total: promotions.length,
        source: 'shopify_admin_api',
        store: domain,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('Fetch shopify discounts failed:', err);
    return jsonResponse({ error: err?.message || 'Failed to fetch discounts' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export default { fetch: (req: Request) => (req.method === 'OPTIONS' ? OPTIONS(req) : GET(req)) };
