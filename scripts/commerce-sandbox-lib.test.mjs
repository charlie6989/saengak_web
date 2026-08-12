import { describe, expect, it } from 'vitest';
import {
  REQUIRED_TAPPAY_DOMAINS,
  REQUIRED_WEBHOOK_TOPICS,
  evaluateSandboxCase,
  evaluateSandboxSuite,
} from './commerce-sandbox-lib.mjs';

function baseEvidence(scenario) {
  return {
    scenario,
    environment: 'sandbox',
    shopify: {
      storeDomain: 'gh2xgs-zf.myshopify.com',
      planActive: true,
      onlineStoreEnabled: true,
      variantCheckoutVerified: true,
      checkoutUrl: 'https://gh2xgs-zf.myshopify.com/checkouts/test',
      orderCreated: true,
      orderId: `gid://shopify/Order/${scenario}`,
      financialStatus: scenario === 'success' ? 'paid' : 'pending',
      cancelled: scenario === 'cancelled',
      amountTwd: 680,
    },
    tappay: {
      appInstalled: true,
      merchantConfigured: true,
      mgidConfigured: true,
      domainsConfigured: REQUIRED_TAPPAY_DOMAINS,
      testMode: true,
      status: scenario,
      shopifyOrderId: `gid://shopify/Order/${scenario}`,
      amountTwd: 680,
    },
    webhook: {
      subscriptions: REQUIRED_WEBHOOK_TOPICS,
      eventAccepted: true,
    },
    supabase: {
      projectRef: 'tmqzkagkrzhioftvwbqo',
      orderLinked: true,
      shopifyOrderId: `gid://shopify/Order/${scenario}`,
      paymentStatus: scenario === 'success' ? 'paid' : scenario,
      amountTwd: 680,
    },
    logistics: scenario === 'success' ? {
      provider: 'waaship',
      appInstalled: true,
      accountBound: true,
      checkoutMethodVerified: true,
      shopifyFulfillmentWrittenBack: true,
      trackingUrl: 'https://tracking.example.com/test',
    } : {
      provider: 'waaship',
      appInstalled: true,
      accountBound: true,
      shopifyFulfillmentWrittenBack: false,
    },
    invoice: scenario === 'success' ? {
      providerConfigured: true,
      authoritativeProviderEvent: true,
      status: 'issued',
    } : {
      providerConfigured: true,
      authoritativeProviderEvent: false,
      status: 'not-issued',
    },
  };
}

describe('commerce sandbox reconciliation', () => {
  it('requires success, failed and cancelled evidence before launch', () => {
    const report = evaluateSandboxSuite([
      baseEvidence('success'),
      baseEvidence('failed'),
      baseEvidence('cancelled'),
    ]);
    expect(report.launchReady).toBe(true);
    expect(report.missingScenarios).toEqual([]);
  });

  it('fails when TapPay and Shopify amounts differ', () => {
    const evidence = baseEvidence('success');
    evidence.tappay.amountTwd = 679;
    const report = evaluateSandboxCase(evidence);
    expect(report.passed).toBe(false);
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'amount_reconciliation',
      status: 'fail',
    }));
  });

  it('rejects sensitive fields from the evidence file', () => {
    const evidence = baseEvidence('success');
    evidence.tappay.partnerKey = 'must-not-be-collected';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'evidence_privacy',
      status: 'fail',
    }));
  });

  it('rejects sensitive primitive values under neutral keys and arrays', () => {
    const evidence = baseEvidence('success');
    evidence.notes = ['safe', 'person@example.com'];
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'evidence_privacy',
      status: 'fail',
    }));
  });

  it('rejects a checkout URL on an untrusted HTTPS host', () => {
    const evidence = baseEvidence('success');
    evidence.shopify.checkoutUrl = 'https://evil.example/checkouts/test';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({ id: 'checkout_url', status: 'fail' }));
  });

  it('rejects a private tracking URL', () => {
    const evidence = baseEvidence('success');
    evidence.logistics.trackingUrl = 'https://127.0.0.1/order/test';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'fulfillment_projection',
      status: 'fail',
    }));
  });

  it('does not accept omitted payment outcomes as non-paid evidence', () => {
    const evidence = baseEvidence('failed');
    delete evidence.shopify.financialStatus;
    delete evidence.supabase.paymentStatus;
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({ id: 'payment_outcome', status: 'fail' }));
  });

  it('rejects a cancelled order that Shopify still reports as paid', () => {
    const evidence = baseEvidence('cancelled');
    evidence.shopify.financialStatus = 'paid';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({ id: 'payment_outcome', status: 'fail' }));
  });

  it('does not create fulfillment or invoice state for a failed payment', () => {
    const evidence = baseEvidence('failed');
    evidence.logistics = {
      provider: 'waaship',
      appInstalled: true,
      accountBound: true,
      shopifyFulfillmentWrittenBack: true,
      trackingUrl: 'https://tracking.example.com/should-not-exist',
    };
    evidence.invoice.status = 'issued';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'fulfillment_projection',
      status: 'fail',
    }));
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'invoice_projection',
      status: 'fail',
    }));
  });

  it('keeps the suite blocked when a required scenario is missing', () => {
    const report = evaluateSandboxSuite([baseEvidence('success'), baseEvidence('failed')]);
    expect(report.launchReady).toBe(false);
    expect(report.missingScenarios).toEqual(['cancelled']);
  });
});
