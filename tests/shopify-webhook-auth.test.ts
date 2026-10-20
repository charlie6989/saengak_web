import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../api/_lib/supabase-admin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import webhookHandler, { verifyShopifyHmac } from '../api/webhooks/shopify.js';

const secret = 'webhook-auth-test-secret';
const rawBody = JSON.stringify({ id: 123456, total_price: '680.00' });
const signature = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
const invalidSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
const network = vi.fn();

function request(headers: Record<string, string> = {}) {
  return new Request('https://lucissicare.com/api/webhooks/shopify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-shopify-topic': 'orders/create',
      'x-shopify-shop-domain': 'gh2xgs-zf.myshopify.com',
      'x-shopify-hmac-sha256': signature,
      ...headers,
    },
    body: rawBody,
  });
}

describe('Shopify webhook authentication boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('SHOPIFY_STORE_DOMAIN', 'gh2xgs-zf.myshopify.com');
    vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', secret);
    vi.stubEnv('ShopifyWebhookSecret', '');
    vi.stubGlobal('fetch', network);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('accepts the signed raw body and rejects tampered bodies and signatures', () => {
    expect(verifyShopifyHmac(rawBody, signature, secret)).toBe(true);
    expect(verifyShopifyHmac(`${rawBody} `, signature, secret)).toBe(false);
    expect(verifyShopifyHmac(rawBody, invalidSignature, secret)).toBe(false);
    expect(verifyShopifyHmac(rawBody, 'short-signature', secret)).toBe(false);
  });

  it.each([
    ['missing', ''],
    ['incorrect but the same length', invalidSignature],
  ])('rejects a %s signature before accessing storage or the network', async (_, hmac) => {
    const response = await webhookHandler.fetch(request({ 'x-shopify-hmac-sha256': hmac }));

    expect(response.status).toBe(401);
    expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });

  it('rejects an unauthorized shop even when the signature is valid', async () => {
    const response = await webhookHandler.fetch(request({
      'x-shopify-shop-domain': 'other-store.myshopify.com',
    }));

    expect(response.status).toBe(403);
    expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });

  it('fails closed when neither signing-secret environment variable is configured', async () => {
    vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', '');
    vi.stubEnv('ShopifyWebhookSecret', '');
    const response = await webhookHandler.fetch(request());

    expect(response.status).toBe(500);
    expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
});
