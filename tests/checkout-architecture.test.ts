import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryPath = fileURLToPath(new URL('..', import.meta.url));

describe('Shopify Checkout architecture', () => {
  it('does not deploy the retired direct-payment checkout stack', () => {
    const retiredPaths = [
      'api/checkout.ts',
      'api/checkout/confirm.ts',
      'api/checkout/status.ts',
      'api/cron/reconcile.ts',
      'api/_lib/tappay.ts',
      'api/_lib/shopify-admin.ts',
      'src/pages/_deprecated_checkout',
    ];

    for (const path of retiredPaths) {
      expect(existsSync(`${repositoryPath}/${path}`), path).toBe(false);
    }
  });

  it('keeps invoice dispatch scheduled without restoring the retired reconciliation job', () => {
    const configuration = JSON.parse(
      readFileSync(`${repositoryPath}/vercel.json`, 'utf8'),
    ) as { crons?: Array<{ path?: string }> };
    const paths = configuration.crons?.map((cron) => cron.path) ?? [];

    expect(paths).toContain('/api/invoice/guangmao');
    expect(paths).not.toContain('/api/cron/reconcile');
  });

  it('preserves the Shopify cart, webhook and invoice entry points', () => {
    for (const path of [
      'api/create-shopify-cart.ts',
      'api/webhooks/shopify.ts',
      'api/invoice/guangmao.ts',
    ]) {
      expect(existsSync(`${repositoryPath}/${path}`), path).toBe(true);
    }
  });
});
