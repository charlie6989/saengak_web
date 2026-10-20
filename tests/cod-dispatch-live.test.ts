import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const token = vi.hoisted(() => vi.fn());
vi.mock('../api/shopify/discounts.js', () => ({ getShopifyAdminAccessToken: token }));
vi.mock('../api/_lib/shopify-config.js', () => ({ SHOPIFY_STORE_DOMAIN: 'gh2xgs-zf.myshopify.com', SHOPIFY_ADMIN_API_VERSION: '2026-07' }));
import { verifyLiveCodOrder } from '../api/_lib/cod-dispatch.js';
import { invoiceContext } from '../supabase/functions/shopify-orders-webhook/webhook.js';
const order = { id: 'gid://shopify/Order/123', updatedAt: '2026-10-21T01:00:00Z', test: false, cancelledAt: null,
  paymentGatewayNames: ['Cash on Delivery (COD)'], displayFinancialStatus: 'PENDING', displayFulfillmentStatus: 'UNFULFILLED',
  currentTotalPriceSet: { shopMoney: { amount: '826.00', currencyCode: 'TWD' } }, shippingLine: { title: '標準' } };
const verify = () => verifyLiveCodOrder(order.id, order.updatedAt, 826);
beforeEach(() => {
  vi.stubEnv('SHOPIFY_APP_CLIENT_ID', 'fixture'); vi.stubEnv('SHOPIFY_APP_CLIENT_SECRET', 'fixture'); token.mockResolvedValue('fixture-only');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { order } })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Live COD preflight (mocked Shopify, no writes)', () => {
  it('accepts exactly current whole unpaid COD order', async () => { await expect(verify()).resolves.toBeUndefined();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).query).not.toContain('mutation'); });
  it.each([{ test: true }, { cancelledAt: order.updatedAt }, { displayFinancialStatus: 'PAID' },
    { displayFinancialStatus: 'PARTIALLY_PAID' }, { displayFulfillmentStatus: 'PARTIALLY_FULFILLED' },
    { paymentGatewayNames: ['Cash on Delivery (COD)', 'manual'] }, { updatedAt: '2026-10-21T01:01:00Z' },
    { shippingLine: { title: '全家' } }, { currentTotalPriceSet: { shopMoney: { amount: '900', currencyCode: 'TWD' } } }
  ])('fails closed on changed state %j', async patch => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ data: { order: { ...order, ...patch } } }));
    await expect(verify()).rejects.toThrow('displayFulfillmentStatus' in patch ? 'COD_FULFILLMENT_REVIEW_REQUIRED' : 'COD_LIVE_ORDER_CHANGED');
  });
  it('fails closed on unavailable Shopify response', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ errors: ['unavailable'] })); await expect(verify()).rejects.toThrow('COD_SHOPIFY_UNAVAILABLE');
  });
  it.each([[undefined, undefined, 'unknown', null], [[], false, 'unknown', false], [['Cash on Delivery (COD)'], false, 'cod', false],
    [['Cash on Delivery (COD)', 'card'], false, 'mixed', false], [['card'], false, 'other', false], [['card'], 'false', 'other', null]
  ])('classifies gateway/test evidence strictly', (gateways, test, paymentKind, expectedTest) => {
    expect(invoiceContext(gateways, test)).toEqual({ paymentKind, test: expectedTest });
  });
});
