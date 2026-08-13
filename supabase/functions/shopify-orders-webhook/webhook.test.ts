import { describe, expect, it } from 'vitest';
import {
  httpsUrl,
  parseShopifyOrderWebhook,
  readRequestBodyWithLimit,
  verifyShopifyWebhookHmac,
} from './webhook';

const metadata = {
  webhookId: 'b54557e4-bdd9-4b37-8a5f-bf7d70bcd043',
  topic: 'orders/paid',
  shopDomain: 'saengak.myshopify.com',
  triggeredAt: '2026-07-19T04:00:01Z',
};

const payload = {
  id: 9554194432293,
  cart_token: 'cart-token-123456',
  name: '#1001',
  current_total_price: '680.00',
  currency: 'twd',
  financial_status: 'paid',
  fulfillment_status: null,
  shipping_lines: [{ title: '7-ELEVEN 超商取貨' }],
  fulfillments: [],
  created_at: '2026-07-19T03:59:00Z',
  updated_at: '2026-07-19T04:00:00Z',
  line_items: [{
    id: 111222333,
    product_id: 444555666,
    variant_id: 777888999,
    name: '深層修護私密清潔露',
    quantity: 1,
    price: '680.00',
  }],
};

describe('Shopify order webhook validation', () => {
  it('rejects webhook bodies above the configured byte limit', async () => {
    const request = new Request('https://example.test/webhook', {
      method: 'POST',
      body: '123456',
    });
    await expect(readRequestBodyWithLimit(request, 5)).rejects.toThrow('byte limit');
  });

  it('rejects private, local, credential-bearing and non-HTTPS tracking URLs', () => {
    expect(httpsUrl('https://carrier.example/track/1')).toBe('https://carrier.example/track/1');
    expect(httpsUrl('https://127.0.0.1/admin')).toBeUndefined();
    expect(httpsUrl('https://localhost/')).toBeUndefined();
    expect(httpsUrl('https://user:pass@carrier.example/track')).toBeUndefined();
    expect(httpsUrl('http://carrier.example/track')).toBeUndefined();
  });
  it('verifies a valid HMAC and rejects a changed body', async () => {
    const secret = 'test-secret';
    const rawBody = JSON.stringify(payload);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const hmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

    await expect(verifyShopifyWebhookHmac(rawBody, hmac, secret)).resolves.toBe(true);
    await expect(verifyShopifyWebhookHmac(`${rawBody} `, hmac, secret)).resolves.toBe(false);
  });

  it('normalizes a paid order into a trusted database input', () => {
    expect(parseShopifyOrderWebhook(payload, metadata)).toMatchObject({
      p_webhook_id: metadata.webhookId,
      p_topic: 'orders/paid',
      p_shopify_order_gid: 'gid://shopify/Order/9554194432293',
      p_order_number: '#1001',
      p_total_amount: '680.00',
      p_currency_code: 'TWD',
      p_status: 'paid',
      p_payment_status: 'paid',
      p_shipping_method: '7-ELEVEN 超商取貨',
      p_fulfillment_status: 'unfulfilled',
      p_fulfillments: [],
      p_line_items: [{
        shopifyLineItemGid: 'gid://shopify/LineItem/111222333',
        productId: 'gid://shopify/Product/444555666',
        productVariantGid: 'gid://shopify/ProductVariant/777888999',
        quantity: 1,
      }],
    });
  });

  it('normalizes provider-neutral tracking details from a fulfillment update', () => {
    const result = parseShopifyOrderWebhook({
      ...payload,
      fulfillment_status: 'fulfilled',
      fulfillments: [{
        id: 99112233,
        status: 'success',
        tracking_company: 'ShipAny / T-CAT',
        tracking_number: 'TCAT-123456',
        tracking_numbers: ['TCAT-123456'],
        tracking_url: 'https://example.test/track/TCAT-123456',
        tracking_urls: ['https://example.test/track/TCAT-123456'],
        created_at: '2026-07-19T05:00:00Z',
        updated_at: '2026-07-19T05:01:00Z',
      }],
    }, { ...metadata, topic: 'orders/fulfilled' });

    expect(result).toMatchObject({
      p_status: 'completed',
      p_fulfillment_status: 'fulfilled',
      p_fulfillments: [{
        shopifyFulfillmentGid: 'gid://shopify/Fulfillment/99112233',
        status: 'success',
        trackingCompany: 'ShipAny / T-CAT',
        trackingNumbers: ['TCAT-123456'],
        trackingUrls: ['https://example.test/track/TCAT-123456'],
      }],
    });
  });

  it('drops unsafe tracking links and rejects malformed fulfillment data', () => {
    const result = parseShopifyOrderWebhook({
      ...payload,
      fulfillments: [{
        id: 99112234,
        status: 'success',
        tracking_company: 'Carrier',
        tracking_number: 'SAFE-123',
        tracking_url: 'javascript:alert(1)',
        created_at: '2026-07-19T05:00:00Z',
        updated_at: '2026-07-19T05:01:00Z',
      }],
    }, { ...metadata, topic: 'orders/updated' });

    expect(result?.p_fulfillments[0].trackingUrls).toEqual([]);
    expect(parseShopifyOrderWebhook({
      ...payload,
      fulfillments: [{ id: null, status: 'success' }],
    }, metadata)).toBeUndefined();
  });

  it('maps cancellation and rejects unsupported or incomplete payloads', () => {
    expect(parseShopifyOrderWebhook(
      { ...payload, financial_status: 'voided', cancelled_at: '2026-07-19T04:00:00Z' },
      { ...metadata, topic: 'orders/cancelled' },
    )).toMatchObject({ p_status: 'cancelled', p_payment_status: 'voided' });

    expect(parseShopifyOrderWebhook({ ...payload, cart_token: null }, metadata)).toBeUndefined();
    expect(parseShopifyOrderWebhook(payload, { ...metadata, topic: 'orders/delete' })).toBeUndefined();
  });
});
