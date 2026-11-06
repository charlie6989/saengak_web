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

  it('passes the order contact email to the order sync RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'applied', error: null });
    mocks.getSupabaseAdminClient.mockReturnValue({ rpc });
    const rawBody = JSON.stringify({ ...payload, email: 'guest@example.test' });
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
          'x-shopify-webhook-id': 'c54557e4-bdd9-4b37-8a5f-bf7d70bcd044',
          'x-shopify-triggered-at': '2026-08-22T04:00:01Z',
        },
        body: rawBody,
      },
    ));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('sync_shopify_order_webhook', expect.objectContaining({
      p_contact_email: 'guest@example.test',
    }));
  });

  it('keeps syncing orders when the database has not received the contact email migration', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: 'applied', error: null });
    mocks.getSupabaseAdminClient.mockReturnValue({ rpc });
    const rawBody = JSON.stringify({ ...payload, email: 'guest@example.test' });
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
          'x-shopify-webhook-id': 'd54557e4-bdd9-4b37-8a5f-bf7d70bcd045',
          'x-shopify-triggered-at': '2026-08-22T04:00:01Z',
        },
        body: rawBody,
      },
    ));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe('sync_shopify_order_webhook');
    expect(rpc.mock.calls[1][1]).not.toHaveProperty('p_contact_email');
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

  describe('failure visibility', () => {
    const SENSITIVE = 'Key (email)=(buyer@example.test) 王小明 0912345678';
    const send = () => {
      const rawBody = JSON.stringify(payload);
      const hmac = createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!).update(rawBody, 'utf8').digest('base64');
      return vercelHandler.fetch(new Request('https://lucissicare.com/api/webhooks/shopify', {
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
      }));
    };

    it('reports an order sync failure to Sentry without personal data and keeps the retryable status', async () => {
      const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      vi.stubEnv('SENTRY_DSN', 'https://publickey@o123.ingest.us.sentry.io/456');
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.getSupabaseAdminClient.mockReturnValue({
        rpc: vi.fn(async () => ({ data: null, error: { code: '23505', message: SENSITIVE, details: SENSITIVE } })),
      });

      const response = await send();

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('buyer@example.test');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('/api/456/envelope/');
      const body = String(init.body);
      expect(body).toContain('ORDER_SYNC_FAILED');
      expect(body).toContain('23505');
      expect(body).toContain('orders/paid');
      for (const fragment of ['buyer@example.test', '王小明', '0912345678', '深層修護私密清潔露']) {
        expect(body).not.toContain(fragment);
        expect(logged.mock.calls.flat().join(' ')).not.toContain(fragment);
      }

      logged.mockRestore();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it('does not echo exception text back in the response', async () => {
      vi.stubEnv('SENTRY_DSN', '');
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.getSupabaseAdminClient.mockReturnValue({
        rpc: vi.fn(async () => { throw new Error(SENSITIVE); }),
      });

      const response = await send();

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('buyer@example.test');
      expect(logged.mock.calls.flat().join(' ')).not.toContain('buyer@example.test');

      logged.mockRestore();
      vi.unstubAllEnvs();
    });
  });
});
