export const SAENGAK_SHOPIFY_DOMAIN = 'gh2xgs-zf.myshopify.com';
export const SAENGAK_SHOPIFY_API_VERSION = '2026-07';
export const SAENGAK_ORDER_WEBHOOK_URI =
  'https://tmqzkagkrzhioftvwbqo.supabase.co/functions/v1/shopify-orders-webhook';

export const REQUIRED_ORDER_WEBHOOK_TOPICS = [
  'ORDERS_CREATE',
  'ORDERS_PAID',
  'ORDERS_UPDATED',
  'ORDERS_FULFILLED',
  'ORDERS_CANCELLED',
];

export function normalizeShopifyDomain(value = '') {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function validateWebhookConfiguration({ shopDomain, apiVersion, webhookUri }) {
  const normalizedDomain = normalizeShopifyDomain(shopDomain);
  if (normalizedDomain !== SAENGAK_SHOPIFY_DOMAIN) {
    throw new Error(`拒絕操作非 SAENGAK Shopify 商店：${normalizedDomain || '(empty)'}`);
  }
  if (!/^20\d{2}-(01|04|07|10)$/.test(apiVersion)) {
    throw new Error(`無效的 Shopify API version：${apiVersion}`);
  }

  let parsedUri;
  try {
    parsedUri = new URL(webhookUri);
  } catch {
    throw new Error('Webhook URI 必須是有效 HTTPS URL');
  }
  if (
    parsedUri.protocol !== 'https:' ||
    parsedUri.hostname !== 'tmqzkagkrzhioftvwbqo.supabase.co' ||
    parsedUri.pathname !== '/functions/v1/shopify-orders-webhook' ||
    parsedUri.username !== '' ||
    parsedUri.password !== '' ||
    parsedUri.search !== '' ||
    parsedUri.hash !== '' ||
    parsedUri.port !== '' ||
    parsedUri.toString() !== SAENGAK_ORDER_WEBHOOK_URI
  ) {
    throw new Error('Webhook URI 必須指向 SAENGAK Production 的 shopify-orders-webhook');
  }

  return {
    shopDomain: normalizedDomain,
    apiVersion,
    webhookUri: parsedUri.toString(),
  };
}

export function buildWebhookSubscriptionPlan(existingSubscriptions, webhookUri) {
  return REQUIRED_ORDER_WEBHOOK_TOPICS.map((topic) => {
    const matchingTopic = existingSubscriptions.filter((subscription) => subscription.topic === topic);
    const staleUris = matchingTopic
      .filter((subscription) => subscription.uri !== webhookUri)
      .map((subscription) => subscription.uri);
    if (staleUris.length > 0) {
      return {
        topic,
        action: 'conflict',
        existingUris: [...new Set(staleUris)],
      };
    }
    if (matchingTopic.some((subscription) => subscription.uri === webhookUri)) {
      return { topic, action: 'present' };
    }
    return { topic, action: 'create' };
  });
}

export function redactWebhookUri(value) {
  try {
    const parsedUri = new URL(value);
    return `${parsedUri.protocol}//${parsedUri.host}/[redacted]`;
  } catch {
    return '[invalid webhook URI]';
  }
}

export function redactWebhookSubscriptionPlan(plan) {
  return plan.map((item) => (
    item.existingUris
      ? { ...item, existingUris: item.existingUris.map(redactWebhookUri) }
      : item
  ));
}
