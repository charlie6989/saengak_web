import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  buildWebhookSubscriptionPlan, COD_COLLECTION_WEBHOOK_TOPICS,
  LUCISSI_CARE_ORDER_WEBHOOK_URI, REQUIRED_ORDER_WEBHOOK_TOPICS,
} from '../scripts/shopify-webhooks-lib.mjs';

const uri = LUCISSI_CARE_ORDER_WEBHOOK_URI;
const existing = REQUIRED_ORDER_WEBHOOK_TOPICS.map(topic => ({ topic, uri }));
// Exercise the actual CLI without any inherited Shopify credentials or network.
const dryRun = (...args: string[]) => JSON.parse(execFileSync(process.execPath,
  ['scripts/sync-shopify-webhooks.mjs', ...args], { encoding: 'utf8', env: {} }));

describe('COD webhook rollout remains opt-in', () => {
  it('ordinary maintenance leaves the existing six subscriptions unchanged', () => {
    const plan = buildWebhookSubscriptionPlan(existing, uri);
    expect(plan).toHaveLength(6);
    expect(plan.every(item => item.action === 'present')).toBe(true);
    expect(dryRun().requiredTopics).toEqual(REQUIRED_ORDER_WEBHOOK_TOPICS);
  });
  it('explicit COD selection plans both delivery topics without duplicating order topics', () => {
    const topics = dryRun('--include-cod-collection').requiredTopics;
    const plan = buildWebhookSubscriptionPlan(existing, uri, topics);
    expect(plan.filter(item => item.action === 'create').map(item => item.topic))
      .toEqual(COD_COLLECTION_WEBHOOK_TOPICS);
    expect(plan.filter(item => item.action === 'present')).toHaveLength(6);
  });
  it('an existing COD subscription at a different destination blocks rollout', () => {
    const plan = buildWebhookSubscriptionPlan([
      ...existing, { topic: COD_COLLECTION_WEBHOOK_TOPICS[0], uri: 'https://example.test/old' },
    ], uri, [...REQUIRED_ORDER_WEBHOOK_TOPICS, ...COD_COLLECTION_WEBHOOK_TOPICS]);
    expect(plan.find(item => item.topic === COD_COLLECTION_WEBHOOK_TOPICS[0])?.action).toBe('conflict');
  });
});
