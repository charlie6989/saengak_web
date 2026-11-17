import { describe, expect, it, vi } from 'vitest';
import {
  PICKUP_RATE_LABELS,
  cheapestHomeFee,
  chooseDeliveryOption,
  resolveShippingMethods,
  shippingFeeSummary,
  shippingHeadline,
  sortedHomeMethods,
} from '../src/domain/shippingMethods';
import {
  blockedOrderAction,
  orderCustomerId,
  orderGid,
  orderMarkedRefused,
} from '../src/domain/purchaseBlock';
import { emailPurchaseBlocked, enforcePurchaseBlock } from '../api/_lib/purchase-block';
import { preselectDeliveryOption } from '../api/create-shopify-cart';

describe('shipping methods aligned with LUCISSI', () => {
  it('lists 黑貓宅配 146, 順豐宅配 130 and three pickups at 69 with the LUCISSI rate names', () => {
    const methods = resolveShippingMethods({ pickupEnabled: true });
    expect(shippingFeeSummary(methods)).toBe('黑貓宅配 NT$146、順豐宅配 NT$130、7-11取貨 NT$69、全家取貨 NT$69、萊爾富取貨 NT$69');
    expect(PICKUP_RATE_LABELS).toEqual(['7-11取貨', '全家取貨', '萊爾富取貨']);
    expect(methods.freeShippingThreshold).toBe(1500);
    expect(shippingHeadline(methods)).toBe('台灣宅配・超商取貨，單筆滿 NT$1,500 免運');
    expect(methods.pickupMethods.find((m) => m.carrier === 'hilife')?.sizeNote).toContain('5 公斤以下');
  });

  it('defaults to the cheapest home courier and lets site settings override fees', () => {
    const methods = resolveShippingMethods({ defaultShippingFee: 150, sfHomeShippingFee: 160, pickupShippingFee: 70, pickupEnabled: true });
    expect(sortedHomeMethods(methods)[0].label).toBe('黑貓宅配');
    expect(cheapestHomeFee(methods)).toBe(150);
    expect(methods.pickupMethods.every((m) => m.fee === 70)).toBe(true);
    expect(resolveShippingMethods({ pickupEnabled: false }).pickupMethods).toEqual([]);
    expect(resolveShippingMethods({ sfHomeShippingFee: Number.NaN }).homeMethods[1].fee).toBe(130);
  });
});

describe('chooseDeliveryOption', () => {
  const options = [
    { handle: 'p1', title: '全家取貨', estimatedCost: { amount: '69' } },
    { handle: 'p2', title: '7-11取貨', estimatedCost: { amount: '69' } },
    { handle: 'h1', title: '黑貓宅配', estimatedCost: { amount: '146' } },
    { handle: 'h2', title: '順豐宅配', estimatedCost: { amount: '130' } },
  ];

  it('selects the pickup rate of the chosen chain, never another chain', () => {
    expect(chooseDeliveryOption(options, '7-11取貨')).toBe('p2');
    expect(chooseDeliveryOption(options, '萊爾富取貨')).toBeNull();
  });

  it('selects the chosen home courier, otherwise the cheapest home rate, never a pickup rate', () => {
    expect(chooseDeliveryOption(options, undefined, '黑貓宅配')).toBe('h1');
    expect(chooseDeliveryOption(options, undefined)).toBe('h2');
    // 舊名稱「標準」仍在時（Shopify 尚未改名），退回最便宜的宅配
    expect(chooseDeliveryOption([options[0], { handle: 's', title: '標準', estimatedCost: { amount: '146' } }], undefined, '黑貓宅配')).toBe('s');
  });
});

describe('preselectDeliveryOption', () => {
  it('reads the delivery groups and selects the matching rate', async () => {
    const post = vi.fn()
      .mockResolvedValueOnce({ data: { cart: { deliveryGroups: { nodes: [{ id: 'g1', deliveryOptions: [
        { handle: 'h2', title: '順豐宅配', estimatedCost: { amount: '130' } },
        { handle: 'p1', title: '全家取貨', estimatedCost: { amount: '69' } },
      ] }] } } } })
      .mockResolvedValueOnce({ data: { cartSelectedDeliveryOptionsUpdate: { userErrors: [] } } });
    await expect(preselectDeliveryOption(post, 'gid://shopify/Cart/1', { pickupLabel: '全家取貨' })).resolves.toBe(true);
    expect(post.mock.calls[1][1]).toEqual({ cartId: 'gid://shopify/Cart/1', selected: [{ deliveryGroupId: 'g1', deliveryOptionHandle: 'p1' }] });
  });

  it('never throws when the cart has no options or the request fails', async () => {
    await expect(preselectDeliveryOption(vi.fn().mockResolvedValue({ data: { cart: { deliveryGroups: { nodes: [] } } } }), 'c', {})).resolves.toBe(false);
    await expect(preselectDeliveryOption(vi.fn().mockRejectedValue(new Error('down')), 'c', {})).resolves.toBe(false);
  });
});

describe('COD refusal purchase block', () => {
  const blockedSince = '2026-11-01T00:00:00Z';
  const order = (extra: Record<string, unknown>) => ({
    id: 555,
    created_at: '2026-11-10T00:00:00Z',
    financial_status: 'pending',
    fulfillment_status: null,
    customer: { id: 42, email: 'Buyer@Example.com' },
    tags: '',
    ...extra,
  });

  it('reads ids and refusal tags from the REST webhook payload', () => {
    expect(orderCustomerId(order({}))).toBe('gid://shopify/Customer/42');
    expect(orderGid(order({}))).toBe('gid://shopify/Order/555');
    expect(orderMarkedRefused(order({ tags: 'VIP, 拒收' }))).toBe(true);
    expect(orderMarkedRefused(order({ tags: '未取件' }))).toBe(true);
    expect(orderMarkedRefused(order({ tags: '拒收了' }))).toBe(false);
  });

  it('cancels unpaid new orders, sends paid or shipped ones to review and leaves older or refused orders', () => {
    expect(blockedOrderAction(order({}), blockedSince)).toBe('cancel');
    expect(blockedOrderAction(order({ financial_status: 'paid' }), blockedSince)).toBe('manual_review');
    expect(blockedOrderAction(order({ fulfillment_status: 'fulfilled' }), blockedSince)).toBe('manual_review');
    expect(blockedOrderAction(order({ created_at: '2026-10-01T00:00:00Z' }), blockedSince)).toBe('none');
    expect(blockedOrderAction(order({ tags: '拒收' }), blockedSince)).toBe('none');
    expect(blockedOrderAction(order({ cancelled_at: '2026-11-11T00:00:00Z' }), blockedSince)).toBe('none');
    expect(blockedOrderAction(order({}), null)).toBe('none');
  });

  it('syncs the tag with the lowercase email and records an automatic cancellation', async () => {
    const rpc = vi.fn(async (name: string) => (name === 'sync_order_refusal'
      ? { data: { refusals: 2, blockedSince }, error: null }
      : { data: 'cancelled', error: null }));
    const cancel = vi.fn().mockResolvedValue(undefined);
    await expect(enforcePurchaseBlock({ rpc }, order({}), { cancel })).resolves.toEqual({ action: 'cancelled' });
    expect(rpc.mock.calls[0]).toEqual(['sync_order_refusal', {
      p_order_id: 'gid://shopify/Order/555', p_customer_id: 'gid://shopify/Customer/42', p_refused: false, p_threshold: 2, p_customer_email: 'buyer@example.com',
    }]);
    expect(cancel).toHaveBeenCalledWith('gid://shopify/Order/555');
  });

  it('records a failed cancellation instead of throwing', async () => {
    const rpc = vi.fn(async (name: string) => (name === 'sync_order_refusal'
      ? { data: { refusals: 2, blockedSince }, error: null }
      : { data: 'cancel_failed', error: null }));
    await expect(enforcePurchaseBlock({ rpc }, order({}), { cancel: vi.fn().mockRejectedValue(new Error('no scope')) }))
      .resolves.toEqual({ action: 'cancel_failed' });
  });

  it('blocks checkout for a blocked email and fails open on errors', async () => {
    await expect(emailPurchaseBlocked({ rpc: vi.fn().mockResolvedValue({ data: { refusals: 2, blockedSince }, error: null }) }, 'a@b.co')).resolves.toBe(true);
    await expect(emailPurchaseBlocked({ rpc: vi.fn().mockResolvedValue({ data: { refusals: 1, blockedSince: null }, error: null }) }, 'a@b.co')).resolves.toBe(false);
    await expect(emailPurchaseBlocked({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'x' } }) }, 'a@b.co')).resolves.toBe(false);
    await expect(emailPurchaseBlocked({ rpc: vi.fn() }, '')).resolves.toBe(false);
  });
});
