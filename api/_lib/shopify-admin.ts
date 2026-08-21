/**
 * Shopify Admin API & Storefront 權威計價模組
 * 依據 docs/00_DECISION_LOG.md 與 docs/CHECKOUT_PAYMENT_SPEC.md 規格：
 * - 售價權威：嚴禁信任前端金額，以 Storefront GraphQL 即時價格逐項重算
 * - 訂單建立：Shopify Admin API 建單，financial_status: 'paid'
 * - 個資最小化：note_attributes 僅保留 transaction_id 與 idempotency_key，卡號零落地
 */

import {
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
  SHOPIFY_API_VERSION,
} from '../../src/lib/shopify';

export interface CheckoutItemInput {
  variantId: string;
  quantity: number;
}

export interface VerifiedCheckoutItem {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  availableForSale: boolean;
}

export interface RecalculatedTotal {
  items: VerifiedCheckoutItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  currencyCode: string;
}

export interface CreateOrderCustomer {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface CreateOrderAddress {
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  city: string;
  province?: string;
  zip?: string;
  country?: string;
}

export interface CreateOrderInput {
  items: Array<{ variantId: string; quantity: number; price?: number }>;
  customer: CreateOrderCustomer;
  shippingAddress: CreateOrderAddress;
  shippingMethodTitle?: string;
  shippingMethodCode?: string;
  shippingFee: number;
  transactionId: string; // TapPay rec_trade_id
  idempotencyKey: string;
  noteAttributes?: Array<{ name: string; value: string }>;
  discountCode?: string;
  discountAmount?: number;
}

export interface ShopifyOrderResult {
  id: string; // GID 或數字 ID
  orderNumber: string;
  name: string;
  totalPrice: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  createdAt: string;
  rawOrder?: Record<string, unknown>;
}

export interface ShopifyAdminConfig {
  storeDomain?: string;
  adminAccessToken?: string;
  apiVersion?: string;
  storefrontToken?: string;
  fetcher?: typeof fetch;
}

/**
 * 取得 Shopify 設定
 */
export function getShopifyConfig(override?: Partial<ShopifyAdminConfig>): ShopifyAdminConfig {
  const storeDomain = (
    override?.storeDomain ||
    process.env.SHOPIFY_STORE_DOMAIN ||
    process.env.VITE_PUBLIC_SHOPIFY_STORE_DOMAIN ||
    SHOPIFY_STORE_DOMAIN ||
    'gh2xgs-zf.myshopify.com'
  ).replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const adminAccessToken = (
    override?.adminAccessToken ||
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
    ''
  );

  const storefrontToken = (
    override?.storefrontToken ||
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.VITE_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    SHOPIFY_STOREFRONT_PUBLIC_TOKEN ||
    ''
  );

  const apiVersion = (
    override?.apiVersion ||
    process.env.SHOPIFY_ADMIN_API_VERSION ||
    SHOPIFY_API_VERSION ||
    '2026-07'
  );

  return {
    storeDomain,
    adminAccessToken,
    storefrontToken,
    apiVersion,
    fetcher: override?.fetcher || fetch,
  };
}

/**
 * 將 Shopify ID 轉換為 GID
 */
export function toVariantGid(id: string): string {
  if (id.startsWith('gid://shopify/ProductVariant/')) return id;
  const numeric = id.replace(/\D/g, '');
  return `gid://shopify/ProductVariant/${numeric}`;
}

/**
 * 將 GID 轉換為純數字 ID
 */
export function toNumericId(id: string): string {
  return id.replace(/^gid:\/\/shopify\/[A-Za-z]+\//, '');
}

/**
 * 向 Storefront GraphQL 批次查詢 Variant 價格並進行伺服器端權威金額重算 (Server-Side Price Authority)
 */
export async function recalculateCheckoutTotal(
  items: CheckoutItemInput[],
  options: {
    shippingMethodCode?: string;
    discountCode?: string;
    configOverride?: Partial<ShopifyAdminConfig>;
  } = {}
): Promise<RecalculatedTotal> {
  if (!items || items.length === 0) {
    throw new Error('購物車商品不得為空');
  }

  for (const item of items) {
    if (!item.variantId) throw new Error('商品 Variant ID 不得為空');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error(`商品數量不合法: ${item.quantity}`);
    }
  }

  const config = getShopifyConfig(options.configOverride);
  const variantGids = items.map((i) => toVariantGid(i.variantId));

  const query = `
    query GetVariantPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          title
          sku
          availableForSale
          price {
            amount
            currencyCode
          }
          product {
            id
            title
            handle
          }
        }
      }
    }
  `;

  const storefrontUrl = `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`;
  const res = await (config.fetcher || fetch)(storefrontUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.storefrontToken || '',
    },
    body: JSON.stringify({
      query,
      variables: { ids: variantGids },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Shopify Storefront GraphQL HTTP 錯誤 ${res.status}`);
  }

  const result = (await res.json()) as any;
  if (result.errors) {
    const errorMsg = Array.isArray(result.errors)
      ? result.errors.map((e: any) => e.message).join(', ')
      : 'GraphQL 查詢錯誤';
    throw new Error(`Shopify Storefront Error: ${errorMsg}`);
  }

  const nodes = Array.isArray(result.data?.nodes) ? result.data.nodes : [];
  const variantMap = new Map<string, any>();
  for (const node of nodes) {
    if (node && node.id) {
      variantMap.set(node.id, node);
      variantMap.set(toNumericId(node.id), node);
    }
  }

  const verifiedItems: VerifiedCheckoutItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const node = variantMap.get(item.variantId) || variantMap.get(toVariantGid(item.variantId)) || variantMap.get(toNumericId(item.variantId));
    if (!node) {
      throw new Error(`商品規格不存在或已下架: ${item.variantId}`);
    }
    if (node.availableForSale === false) {
      throw new Error(`商品規格目前已售罄: ${node.product?.title || ''} (${node.title})`);
    }

    const unitPrice = Math.round(parseFloat(node.price?.amount || '0'));
    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;

    verifiedItems.push({
      variantId: node.id,
      productId: node.product?.id || '',
      productTitle: node.product?.title || '',
      variantTitle: node.title || '',
      sku: node.sku || '',
      unitPrice,
      quantity: item.quantity,
      totalPrice,
      availableForSale: node.availableForSale,
    });
  }

  // 運費規則計算：
  // 滿 1500 免運，否則超商 60，宅配 100
  let shippingFee = 100;
  const method = (options.shippingMethodCode || '').toLowerCase();
  if (subtotal >= 1500) {
    shippingFee = 0;
  } else if (method.includes('store') || method.includes('cvs') || method.includes('7-11') || method.includes('family')) {
    shippingFee = 60;
  } else {
    shippingFee = 100;
  }

  // 折扣計算 (若有)
  let discountAmount = 0;
  if (options.discountCode) {
    // 預留折扣碼驗證擴充
  }

  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

  return {
    items: verifiedItems,
    subtotal,
    shippingFee,
    discountAmount,
    totalAmount,
    currencyCode: 'TWD',
  };
}

let cachedAdminAccessToken = '';

async function fetchAdminAccessTokenWithClientCredentials(
  storeDomain: string,
  fetcher: typeof fetch
): Promise<string | null> {
  if (cachedAdminAccessToken) return cachedAdminAccessToken;

  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) return null;

  const url = `https://${storeDomain}/admin/oauth/access_token`;
  const res = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as any;
  if (data.access_token) {
    cachedAdminAccessToken = data.access_token;
    return cachedAdminAccessToken;
  }
  return null;
}

/**
 * 呼叫 Shopify Admin REST API 建立付款完成之訂單 (orders.json)
 */
export async function createShopifyOrder(
  input: CreateOrderInput,
  configOverride?: Partial<ShopifyAdminConfig>
): Promise<ShopifyOrderResult> {
  const config = getShopifyConfig(configOverride);
  
  let accessToken = config.adminAccessToken;
  if (!accessToken) {
    const fetchedToken = await fetchAdminAccessTokenWithClientCredentials(config.storeDomain, config.fetcher || fetch);
    if (fetchedToken) {
      accessToken = fetchedToken;
    }
  }

  if (!accessToken) {
    throw new Error('Shopify Admin Access Token 未設定且無法透過 Client Credentials 交換');
  }

  const adminUrl = `https://${config.storeDomain}/admin/api/${config.apiVersion}/orders.json`;

  const lineItems = input.items.map((item) => ({
    variant_id: Number(toNumericId(item.variantId)),
    quantity: item.quantity,
    ...(item.price !== undefined ? { price: String(item.price) } : {}),
  }));

  const noteAttributes = [
    { name: 'transaction_id', value: input.transactionId },
    { name: 'idempotency_key', value: input.idempotencyKey },
    { name: 'payment_gateway', value: 'TapPay Direct Pay' },
    ...(input.noteAttributes || []),
  ];

    const isSandboxMode = process.env.COMMERCE_SANDBOX_MODE === 'true' || process.env.VITE_PUBLIC_TAPPAY_ENV === 'sandbox';
    const baseTags = ['saengak_react_checkout', 'tappay_paid'];
    if (isSandboxMode) {
      baseTags.push('TEST_ORDER', 'DO_NOT_SHIP', 'DO_NOT_FULFILL', 'SANDBOX_TEST');
    }

    const payload = {
      order: {
        financial_status: 'paid',
        line_items: lineItems,
        customer: {
          email: input.customer.email,
          first_name: isSandboxMode ? `[TEST] ${input.customer.firstName || ''}`.trim() : (input.customer.firstName || ''),
          last_name: input.customer.lastName || '',
          phone: input.customer.phone || '',
        },
        shipping_address: {
          first_name: isSandboxMode ? `[TEST-請勿出貨] ${input.shippingAddress.firstName}` : input.shippingAddress.firstName,
          last_name: input.shippingAddress.lastName,
          phone: input.shippingAddress.phone,
          address1: isSandboxMode ? `[測試地址請勿派單] ${input.shippingAddress.address1}` : input.shippingAddress.address1,
          city: input.shippingAddress.city,
          province: input.shippingAddress.province || '',
          zip: input.shippingAddress.zip || '',
          country: input.shippingAddress.country || 'Taiwan',
        },
        shipping_lines: [
          {
            title: input.shippingMethodTitle || '標準運送',
            price: String(input.shippingFee),
            code: input.shippingMethodCode || 'STANDARD',
          },
        ],
        note_attributes: [
          ...noteAttributes,
          ...(isSandboxMode ? [{ name: 'is_sandbox_test', value: 'true' }, { name: 'fulfillment_instruction', value: 'DO_NOT_FULFILL' }] : []),
        ],
        tags: baseTags.join(','),
      },
    };

  const res = await (config.fetcher || fetch)(adminUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Shopify Admin 建單失敗 HTTP ${res.status}: ${errorText.slice(0, 300)}`);
  }

  const data = (await res.json()) as any;
  const order = data.order;
  if (!order || !order.id) {
    throw new Error('Shopify 建單回應未包含有效 Order ID');
  }

  return {
    id: `gid://shopify/Order/${order.id}`,
    orderNumber: String(order.order_number || order.name || order.id),
    name: String(order.name || `#${order.order_number}`),
    totalPrice: String(order.total_price || order.current_total_price || '0'),
    financialStatus: String(order.financial_status || 'paid'),
    fulfillmentStatus: order.fulfillment_status ? String(order.fulfillment_status) : null,
    createdAt: String(order.created_at || new Date().toISOString()),
    rawOrder: order,
  };
}
