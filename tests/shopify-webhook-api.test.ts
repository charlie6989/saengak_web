import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../api/_lib/supabase-admin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import vercelHandler, { rpcWithTransientJwtRetry } from '../api/webhooks/shopify.js';

const payload = {
  id: 9554194432293,
  cart_token: 'cart-token-123456',
  name: '#1001',
  current_total_price: '680.00',
  currency: 'twd',
  financial_status: 'paid',
  fulfillment_status: null,
  shipping_lines: [{ title: '標準配送' }],
  fulfillments: [],
  created_at: '2026-08-22T03:59:00Z',
  updated_at: '2026-08-22T04:00:00Z',
  line_items: [{
    id: 111222333,
    product_id: 444555666,
    variant_id: 777888999,
    name: '深層修護私密清潔露',
    quantity: 1,
    price: '680.00',
  }],
};

describe('Shopify webhook Vercel API', () => {
  beforeEach(() => {
    process.env.SHOPIFY_WEBHOOK_SECRET = 'webhook-test-secret';
    process.env.SHOPIFY_STORE_DOMAIN = 'gh2xgs-zf.myshopify.com';
    mocks.getSupabaseAdminClient.mockReturnValue(null);
  });

  it('fails closed instead of acknowledging an order that cannot be persisted', async () => {
    const rawBody = JSON.stringify(payload);
    const hmac = createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
      .update(rawBody, 'utf8')
      .digest('base64');
    const response = await vercelHandler.fetch(new Request(
      'https://www.saengak.com.tw/api/webhooks/shopify',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': 'orders/paid',
          'x-shopify-shop-domain': 'gh2xgs-zf.myshopify.com',
          'x-shopify-webhook-id': 'b54557e4-bdd9-4b37-8a5f-bf7d70bcd043',
          'x-shopify-triggered-at': '2026-08-22T04:00:01Z',
        },
        body: rawBody,
      },
    ));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(data.code).toBe('WEBHOOK_STORAGE_UNAVAILABLE');
    expect(data.ok).not.toBe(true);
  });

  it('retries once when Supabase reports a transient future-issued JWT', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST303', message: 'JWT issued at future' },
      })
      .mockResolvedValueOnce({ data: 'applied', error: null });

    const result = await rpcWithTransientJwtRetry(
      { rpc },
      'sync_shopify_order_webhook',
      { p_webhook_id: 'test-webhook' },
      0,
    );

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'applied', error: null });
  });
});
