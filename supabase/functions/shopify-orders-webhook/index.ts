import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getPreferredSecretKey } from '../create-shopify-cart/auth.ts';
import {
  isAcceptedShopifyOrderTopic,
  isValidWebhookId,
  MAX_WEBHOOK_BODY_BYTES,
  parseShopifyOrderWebhook,
  readRequestBodyWithLimit,
  verifyShopifyWebhookHmac,
  WebhookBodyTooLargeError,
} from './webhook.ts';
import {
  normalizeShopifyDomain,
  resolveShopifyDomain,
} from '../_shared/shopify-storefront.ts';

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('ShopifyWebhookSecret') ?? '';
  const expectedShopDomain = resolveShopifyDomain(Deno.env.get('ShopifyDomain'));

  if (!webhookSecret) {
    return jsonResponse({ error: 'Webhook is not configured' }, 503);
  }

  let rawBody: string;
  try {
    rawBody = await readRequestBodyWithLimit(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof WebhookBodyTooLargeError) {
      return jsonResponse({ error: 'Webhook payload is too large' }, 413);
    }
    return jsonResponse({ error: 'Unable to read webhook payload' }, 400);
  }

  if (!await verifyShopifyWebhookHmac(
    rawBody,
    request.headers.get('X-Shopify-Hmac-Sha256'),
    webhookSecret,
  )) {
    return jsonResponse({ error: 'Invalid webhook signature' }, 401);
  }

  const webhookId = request.headers.get('X-Shopify-Webhook-Id');
  const topic = request.headers.get('X-Shopify-Topic');
  const shopDomain = normalizeShopifyDomain(request.headers.get('X-Shopify-Shop-Domain') ?? undefined);
  const triggeredAt = request.headers.get('X-Shopify-Triggered-At') ?? '';

  if (
    !isValidWebhookId(webhookId) ||
    !isAcceptedShopifyOrderTopic(topic) ||
    shopDomain !== expectedShopDomain
  ) {
    return jsonResponse({ error: 'Invalid webhook metadata' }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }
  const syncInput = parseShopifyOrderWebhook(payload, {
    webhookId,
    topic,
    shopDomain,
    triggeredAt,
  });
  if (!syncInput) {
    return jsonResponse({ error: 'Invalid order payload' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = getPreferredSecretKey(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('SUPABASE_SECRET_KEYS'),
  );
  if (!supabaseUrl || !secretKey) {
    return jsonResponse({ error: 'Order projection is unavailable' }, 503);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc('sync_shopify_order_webhook', syncInput);

  if (error) {
    console.error('Shopify order projection failed', {
      webhookId,
      topic,
      code: error.code,
    });
    return jsonResponse({ error: 'Order projection failed' }, 500);
  }

  return jsonResponse({ ok: true, result: data }, 200);
});
