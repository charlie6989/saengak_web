import { describe, expect, it } from 'vitest';
import {
  REQUIRED_TAPPAY_DOMAINS,
  REQUIRED_WEBHOOK_TOPICS,
  evaluateSandboxCase,
  evaluateSandboxSuite,
} from './commerce-sandbox-lib.mjs';

function baseEvidence(scenario) {
  const orderId = { success: '9554194432293', failed: '9554194432294', cancelled: '9554194432295' }[scenario];
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
      orderId: `gid://shopify/Order/${orderId}`,
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
      shopifyOrderId: `gid://shopify/Order/${orderId}`,
      amountTwd: 680,
    },
    webhook: {
      subscriptions: REQUIRED_WEBHOOK_TOPICS,
      eventAccepted: true,
    },
    supabase: {
      projectRef: 'tmqzkagkrzhioftvwbqo',
      orderLinked: true,
      shopifyOrderId: `gid://shopify/Order/${orderId}`,
      paymentStatus: scenario === 'success' ? 'paid' : scenario,
      amountTwd: 680,
    },
    logistics: scenario === 'success' ? {
      provider: 'shipany',
      appInstalled: true,
      accountBound: true,
      checkoutMethodVerified: true,
      shopifyFulfillmentWrittenBack: true,
      shopifyOrderId: `gid://shopify/Order/${orderId}`,
      shopifyFulfillmentGid: 'gid://shopify/Fulfillment/99112233',
      supabaseFulfillmentGid: 'gid://shopify/Fulfillment/99112233',
      shopifyTrackingUrl: 'https://tracking.example.com/test',
      supabaseTrackingUrl: 'https://tracking.example.com/test',
    } : {
      provider: 'shipany',
      appInstalled: true,
      accountBound: true,
      shopifyFulfillmentWrittenBack: false,
      shopifyFulfillmentGid: null,
      supabaseFulfillmentGid: null,
      shopifyTrackingUrl: null,
      supabaseTrackingUrl: null,
    },
    invoice: scenario === 'success' ? {
      providerConfigured: true,
      authoritativeProviderEvent: true,
      provider: 'amego',
      status: 'issued',
      providerStatus: 99,
      shopifyOrderId: `gid://shopify/Order/${orderId}`,
      providerOrderId: 'S9554194432293',
      invoiceNumber: 'AA12345678',
      amountTwd: 680,
    } : {
      providerConfigured: true,
      authoritativeProviderEvent: false,
      status: 'not-issued',
      providerOrderId: null,
      invoiceNumber: null,
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
    evidence.logistics.shopifyTrackingUrl = 'https://127.0.0.1/order/test';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({
      id: 'fulfillment_projection',
      status: 'fail',
    }));
  });

  it('rejects Waaship after ShipAny was selected', () => {
    const evidence = baseEvidence('success');
    evidence.logistics.provider = 'waaship';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({ id: 'logistics_provider', status: 'fail' }));
  });

  it('rejects an empty or malformed fulfillment GID', () => {
    const evidence = baseEvidence('success');
    evidence.logistics.shopifyFulfillmentGid = '';
    evidence.logistics.supabaseFulfillmentGid = '';
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({ id: 'fulfillment_projection', status: 'fail' }));
  });

  it('rejects an invoice from another order or amount', () => {
    const evidence = baseEvidence('success');
    evidence.invoice.providerOrderId = 'S9554194439999';
    evidence.invoice.amountTwd = 679;
    const report = evaluateSandboxCase(evidence);
    expect(report.gates).toContainEqual(expect.objectContaining({ id: 'invoice_projection', status: 'fail' }));
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
      provider: 'shipany',
      appInstalled: true,
      accountBound: true,
      shopifyFulfillmentWrittenBack: true,
      shopifyFulfillmentGid: 'gid://shopify/Fulfillment/99112233',
      supabaseFulfillmentGid: 'gid://shopify/Fulfillment/99112233',
      shopifyTrackingUrl: 'https://tracking.example.com/should-not-exist',
      supabaseTrackingUrl: 'https://tracking.example.com/should-not-exist',
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
