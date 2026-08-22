import { describe, expect, it } from 'vitest';
import {
  REQUIRED_ORDER_WEBHOOK_TOPICS,
  SAENGAK_ORDER_WEBHOOK_URI,
  buildWebhookSubscriptionPlan,
  normalizeShopifyDomain,
  redactWebhookSubscriptionPlan,
  redactWebhookUri,
  validateWebhookConfiguration,
} from './shopify-webhooks-lib.mjs';

describe('Shopify webhook subscription plan', () => {
  it('normalizes and locks configuration to the dedicated SAENGAK shop and Vercel API', () => {
    expect(normalizeShopifyDomain('https://GH2XGS-ZF.myshopify.com/'))
      .toBe('gh2xgs-zf.myshopify.com');
    expect(validateWebhookConfiguration({
      shopDomain: 'gh2xgs-zf.myshopify.com',
      apiVersion: '2026-07',
      webhookUri: SAENGAK_ORDER_WEBHOOK_URI,
    })).toMatchObject({
      shopDomain: 'gh2xgs-zf.myshopify.com',
      apiVersion: '2026-07',
    });
    expect(validateWebhookConfiguration({
      shopDomain: 'gh2xgs-zf.myshopify.com',
      apiVersion: '2026-07',
      webhookUri: SAENGAK_ORDER_WEBHOOK_URI.replace('www.saengak.com.tw/', 'www.saengak.com.tw:443/'),
    }).webhookUri).toBe(SAENGAK_ORDER_WEBHOOK_URI);
  });

  it('refuses another shop or webhook destination', () => {
    expect(() => validateWebhookConfiguration({
      shopDomain: 'lucissi.myshopify.com',
      apiVersion: '2026-07',
      webhookUri: SAENGAK_ORDER_WEBHOOK_URI,
    })).toThrow('非 SAENGAK');

    expect(() => validateWebhookConfiguration({
      shopDomain: 'gh2xgs-zf.myshopify.com',
      apiVersion: '2026-07',
      webhookUri: 'https://example.com/webhook',
    })).toThrow('SAENGAK Production');
  });

  it.each([
    `https://user:secret@${new URL(SAENGAK_ORDER_WEBHOOK_URI).host}${new URL(SAENGAK_ORDER_WEBHOOK_URI).pathname}`,
    `${SAENGAK_ORDER_WEBHOOK_URI}?token=secret`,
    `${SAENGAK_ORDER_WEBHOOK_URI}#secret`,
    SAENGAK_ORDER_WEBHOOK_URI.replace('www.saengak.com.tw/', 'www.saengak.com.tw:444/'),
  ])('refuses sensitive or non-default URI components: %s', (webhookUri) => {
    expect(() => validateWebhookConfiguration({
      shopDomain: 'gh2xgs-zf.myshopify.com',
      apiVersion: '2026-07',
      webhookUri,
    })).toThrow('SAENGAK Production');
  });

  it('creates only missing topics and never duplicates existing subscriptions', () => {
    const plan = buildWebhookSubscriptionPlan([
      { topic: 'ORDERS_CREATE', uri: SAENGAK_ORDER_WEBHOOK_URI },
      { topic: 'ORDERS_PAID', uri: 'https://old.example.com/webhook' },
    ], SAENGAK_ORDER_WEBHOOK_URI);

    expect(plan).toContainEqual({ topic: 'ORDERS_CREATE', action: 'present' });
    expect(plan).toContainEqual({
      topic: 'ORDERS_PAID',
      action: 'conflict',
      existingUris: ['https://old.example.com/webhook'],
    });
    expect(plan.filter((item) => item.action === 'create').map((item) => item.topic))
      .toEqual(REQUIRED_ORDER_WEBHOOK_TOPICS.slice(2));
  });

  it('reports a conflict when desired and stale URIs coexist for one topic', () => {
    const staleUri = 'https://old.example.com/webhook?token=secret';
    const plan = buildWebhookSubscriptionPlan([
      { topic: 'ORDERS_PAID', uri: SAENGAK_ORDER_WEBHOOK_URI },
      { topic: 'ORDERS_PAID', uri: staleUri },
    ], SAENGAK_ORDER_WEBHOOK_URI);

    expect(plan).toContainEqual({
      topic: 'ORDERS_PAID',
      action: 'conflict',
      existingUris: [staleUri],
    });
  });

  it('redacts credentials, path, query, and fragment before a plan is logged', () => {
    const secretUri = 'https://user:password@old.example.com/private/token?key=secret#fragment';
    const redactedPlan = redactWebhookSubscriptionPlan([{
      topic: 'ORDERS_PAID',
      action: 'conflict',
      existingUris: [secretUri, 'not a URL'],
    }]);

    expect(redactWebhookUri(secretUri)).toBe('https://old.example.com/[redacted]');
    expect(redactedPlan).toEqual([{
      topic: 'ORDERS_PAID',
      action: 'conflict',
      existingUris: ['https://old.example.com/[redacted]', '[invalid webhook URI]'],
    }]);
    expect(JSON.stringify(redactedPlan)).not.toMatch(/user|password|private|token|secret|fragment/);
  });
});
