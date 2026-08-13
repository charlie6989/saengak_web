const acceptedTopics = new Set([
  'orders/create',
  'orders/paid',
  'orders/updated',
  'orders/fulfilled',
  'orders/cancelled',
]);

const financialStatuses = new Set([
  'pending',
  'authorized',
  'partially_paid',
  'paid',
  'partially_refunded',
  'refunded',
  'voided',
]);

export const MAX_WEBHOOK_BODY_BYTES = 1_048_576;

export class WebhookBodyTooLargeError extends Error {}

export async function readRequestBodyWithLimit(
  request: Request,
  maximumBytes = MAX_WEBHOOK_BODY_BYTES,
): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new WebhookBodyTooLargeError('Webhook body exceeds the byte limit');
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new WebhookBodyTooLargeError('Webhook body exceeds the byte limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export interface ShopifyOrderSyncInput {
  p_webhook_id: string;
  p_topic: string;
  p_shopify_store_domain: string;
  p_shopify_order_gid: string;
  p_shopify_cart_token: string;
  p_order_number: string;
  p_total_amount: string;
  p_currency_code: string;
  p_status: string;
  p_payment_status: string;
  p_shipping_method: string;
  p_fulfillment_status: string;
  p_shopify_created_at: string;
  p_shopify_updated_at: string;
  p_triggered_at: string;
  p_line_items: ShopifyOrderLineInput[];
  p_fulfillments: ShopifyFulfillmentInput[];
}

interface ShopifyOrderLineInput {
  shopifyLineItemGid: string;
  productId: string;
  productVariantGid: string;
  productName: string;
  quantity: number;
  price: string;
  imageUrl: string;
}

interface ShopifyFulfillmentInput {
  shopifyFulfillmentGid: string;
  status: string;
  trackingCompany: string;
  trackingNumbers: string[];
  trackingUrls: string[];
  createdAt: string;
  updatedAt: string;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;

const identifier = (value: unknown): string | undefined => {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return undefined;
};

const positiveMoney = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? normalized : undefined;
};

const isoTimestamp = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
};

const boundedText = (value: unknown, maximumLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';

const isPrivateIpv4 = (hostname: string): boolean => {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || a >= 224;
};

const isPrivateHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') || normalized.endsWith('.internal') ||
    normalized === '::' || normalized === '::1' || /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    isPrivateIpv4(normalized);
};

export const httpsUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      !isPrivateHostname(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const stringList = (value: unknown, maximumItems: number, maximumLength: number): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .slice(0, maximumItems)
    .map((item) => boundedText(item, maximumLength))
    .filter(Boolean))];
};

function parseFulfillments(value: unknown): ShopifyFulfillmentInput[] | undefined {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 50) return undefined;

  const fulfillments = value.map((rawFulfillment) => {
    const fulfillment = asRecord(rawFulfillment);
    if (!fulfillment) return undefined;

    const fulfillmentId = identifier(fulfillment.id);
    const status = boundedText(fulfillment.status, 40).toLowerCase();
    const createdAt = isoTimestamp(fulfillment.created_at);
    const updatedAt = isoTimestamp(fulfillment.updated_at);
    if (!fulfillmentId || !/^[a-z][a-z_]{0,39}$/.test(status) || !createdAt || !updatedAt) {
      return undefined;
    }

    const fallbackTrackingNumber = boundedText(fulfillment.tracking_number, 160);
    const fallbackTrackingUrl = httpsUrl(fulfillment.tracking_url);
    const trackingNumbers = stringList(fulfillment.tracking_numbers, 20, 160);
    const trackingUrls = Array.isArray(fulfillment.tracking_urls)
      ? [...new Set(fulfillment.tracking_urls.slice(0, 20).map(httpsUrl).filter(Boolean))] as string[]
      : [];

    if (fallbackTrackingNumber && !trackingNumbers.includes(fallbackTrackingNumber)) {
      trackingNumbers.unshift(fallbackTrackingNumber);
    }
    if (fallbackTrackingUrl && !trackingUrls.includes(fallbackTrackingUrl)) {
      trackingUrls.unshift(fallbackTrackingUrl);
    }

    return {
      shopifyFulfillmentGid: toGid('Fulfillment', fulfillmentId),
      status,
      trackingCompany: boundedText(fulfillment.tracking_company, 160),
      trackingNumbers,
      trackingUrls,
      createdAt,
      updatedAt,
    };
  });

  return fulfillments.some((fulfillment) => !fulfillment)
    ? undefined
    : fulfillments as ShopifyFulfillmentInput[];
}

const toGid = (type: string, id: string) => `gid://shopify/${type}/${id}`;

export const normalizeShopifyDomain = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

export const isAcceptedShopifyOrderTopic = (topic: string | null): topic is string =>
  Boolean(topic && acceptedTopics.has(topic));

export const isValidWebhookId = (value: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

function base64ToBytes(value: string): Uint8Array | undefined {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

export async function verifyShopifyWebhookHmac(
  rawBody: string,
  receivedHmac: string | null,
  secret: string,
): Promise<boolean> {
  if (!receivedHmac || !secret) return false;
  const decodedSignature = base64ToBytes(receivedHmac);
  if (!decodedSignature) return false;
  const signature = new Uint8Array(decodedSignature);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(rawBody),
  );
}

function mapOrderStatuses(payload: UnknownRecord, topic: string) {
  const rawFinancialStatus = typeof payload.financial_status === 'string'
    ? payload.financial_status.toLowerCase()
    : '';
  const paymentStatus = financialStatuses.has(rawFinancialStatus)
    ? rawFinancialStatus
    : rawFinancialStatus === 'expired'
      ? 'failed'
      : undefined;
  if (!paymentStatus) return undefined;

  const fulfillmentStatus = typeof payload.fulfillment_status === 'string'
    ? payload.fulfillment_status.toLowerCase()
    : '';

  let status = 'processing';
  if (topic === 'orders/cancelled' || payload.cancelled_at) status = 'cancelled';
  else if (paymentStatus === 'refunded') status = 'refunded';
  else if (paymentStatus === 'failed' || paymentStatus === 'voided') status = 'payment_failed';
  else if (fulfillmentStatus === 'fulfilled') status = 'completed';
  else if (fulfillmentStatus === 'partial') status = 'shipped';
  else if (paymentStatus === 'paid' || paymentStatus === 'partially_refunded') status = 'paid';

  return { status, paymentStatus };
}

function topicMatchesPayload(payload: UnknownRecord, topic: string): boolean {
  if (topic === 'orders/cancelled') return Boolean(isoTimestamp(payload.cancelled_at));
  if (topic === 'orders/paid') {
    const status = boundedText(payload.financial_status, 40).toLowerCase();
    return ['paid', 'partially_paid', 'partially_refunded'].includes(status);
  }
  if (topic === 'orders/fulfilled') {
    return boundedText(payload.fulfillment_status, 40).toLowerCase() === 'fulfilled' ||
      (Array.isArray(payload.fulfillments) && payload.fulfillments.length > 0);
  }
  return true;
}

export function parseShopifyOrderWebhook(
  rawPayload: unknown,
  metadata: {
    webhookId: string;
    topic: string;
    shopDomain: string;
    triggeredAt: string;
  },
): ShopifyOrderSyncInput | undefined {
  const payload = asRecord(rawPayload);
  if (
    !payload || !isAcceptedShopifyOrderTopic(metadata.topic) ||
    !topicMatchesPayload(payload, metadata.topic)
  ) return undefined;

  const orderId = identifier(payload.id);
  const cartToken = typeof payload.cart_token === 'string' ? payload.cart_token.trim() : '';
  const orderNumber = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : identifier(payload.order_number);
  const totalAmount = positiveMoney(payload.current_total_price ?? payload.total_price);
  const currencyCode = typeof payload.currency === 'string'
    ? payload.currency.trim().toUpperCase()
    : '';
  const createdAt = isoTimestamp(payload.created_at);
  const updatedAt = isoTimestamp(payload.updated_at);
  const triggeredAt = isoTimestamp(metadata.triggeredAt);
  const statuses = mapOrderStatuses(payload, metadata.topic);
  const shopDomain = normalizeShopifyDomain(metadata.shopDomain);
  const rawLineItems = Array.isArray(payload.line_items) ? payload.line_items : undefined;
  const fulfillments = parseFulfillments(payload.fulfillments);
  const rawFulfillmentStatus = boundedText(payload.fulfillment_status, 40).toLowerCase();
  const fulfillmentStatus = rawFulfillmentStatus || 'unfulfilled';
  const shippingLines = Array.isArray(payload.shipping_lines) ? payload.shipping_lines : [];
  const firstShippingLine = asRecord(shippingLines[0]);
  const shippingMethod = boundedText(
    firstShippingLine?.title ?? firstShippingLine?.code,
    160,
  );

  if (
    !orderId || !cartToken || !orderNumber || !totalAmount ||
    !/^[A-Z]{3}$/.test(currencyCode) || !createdAt || !updatedAt ||
    !triggeredAt || !statuses ||
    !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(shopDomain) ||
    !rawLineItems || rawLineItems.length === 0 || rawLineItems.length > 250 ||
    !/^(unfulfilled|partial|fulfilled|restocked)$/.test(fulfillmentStatus) ||
    !fulfillments
  ) {
    return undefined;
  }

  const lineItems = rawLineItems.map((rawItem) => {
    const item = asRecord(rawItem);
    if (!item) return undefined;
    const lineItemId = identifier(item.id);
    const productId = identifier(item.product_id);
    const variantId = item.variant_id == null ? undefined : identifier(item.variant_id);
    const productName = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim()
      : typeof item.title === 'string' ? item.title.trim() : '';
    const quantity = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity);
    const price = positiveMoney(item.price);

    if (
      !lineItemId || !productId || !productName || !Number.isInteger(quantity) ||
      quantity < 1 || quantity > 99 || !price
    ) {
      return undefined;
    }

    return {
      shopifyLineItemGid: toGid('LineItem', lineItemId),
      productId: toGid('Product', productId),
      productVariantGid: variantId ? toGid('ProductVariant', variantId) : '',
      productName,
      quantity,
      price,
      imageUrl: '',
    };
  });

  if (lineItems.some((item) => !item)) return undefined;

  return {
    p_webhook_id: metadata.webhookId,
    p_topic: metadata.topic,
    p_shopify_store_domain: shopDomain,
    p_shopify_order_gid: toGid('Order', orderId),
    p_shopify_cart_token: cartToken,
    p_order_number: orderNumber,
    p_total_amount: totalAmount,
    p_currency_code: currencyCode,
    p_status: statuses.status,
    p_payment_status: statuses.paymentStatus,
    p_shipping_method: shippingMethod,
    p_fulfillment_status: fulfillmentStatus,
    p_shopify_created_at: createdAt,
    p_shopify_updated_at: updatedAt,
    p_triggered_at: triggeredAt,
    p_line_items: lineItems as ShopifyOrderLineInput[],
    p_fulfillments: fulfillments,
  };
}
