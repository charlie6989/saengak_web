import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'member-token' } }, error: null }) },
    from: () => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { key: 'store_pickup_enabled', value: true },
            { key: 'pickup_shipping_fee', value: 60 },
          ],
          error: null,
        }),
      }),
    }),
  },
}));

import PickupPointSelector from '../src/components/feature/PickupPointSelector';
import {
  describePickupPoint,
  formatPickupAddressLine,
  formatPickupCompanyLine,
  parsePickupPoint,
  searchPickupPoints,
  type PickupPoint,
} from '../src/domain/pickupPoints';
import {
  fetchStorePickupSettings,
  isStorePickupPreviewEnabled,
  searchPickupPoints as searchApi,
  PickupSearchError,
} from '../src/lib/pickupPoints';
import { createShopifyCheckout, getShopifyCheckoutErrorMessage } from '../src/lib/shopifyCheckout';
import { defaultInvoicePreference } from '../src/domain/invoice';

const STORE: PickupPoint = {
  carrier: 'familymart',
  code: 'F001234',
  name: '全家台北民生店',
  address: '台北市松山區民生東路四段1號',
};

afterEach(() => vi.unstubAllGlobals());

describe('pickup point rules', () => {
  it('formats the Shopify address in the ShipAny service point format', () => {
    expect(formatPickupAddressLine(STORE)).toBe('[F001234] 台北市松山區民生東路四段1號');
    expect(formatPickupCompanyLine(STORE)).toBe('全家台北民生店');
    expect(formatPickupCompanyLine({ carrier: 'hilife', name: '民生店' })).toBe('萊爾富 民生店');
    expect(describePickupPoint(STORE)).toBe('全家台北民生店（F001234）');
  });

  it('rejects incomplete or malformed stores', () => {
    expect(parsePickupPoint(STORE)).toEqual(STORE);
    expect(parsePickupPoint({ ...STORE, carrier: 'lawson' })).toBeUndefined();
    expect(parsePickupPoint({ ...STORE, code: '[F1]' })).toBeUndefined();
    expect(parsePickupPoint({ ...STORE, address: '' })).toBeUndefined();
    expect(parsePickupPoint({ ...STORE, name: 'a\u0000b' })).toBeUndefined();
  });

  it('matches every keyword and treats 臺 and 台 alike', () => {
    const points: PickupPoint[] = [
      STORE,
      { carrier: 'familymart', code: 'F005678', name: '全家臺中公益店', address: '臺中市西區公益路1號' },
      { carrier: 'familymart', code: 'F009999', name: '全家台北南京店', address: '台北市中山區南京東路1號' },
    ];
    expect(searchPickupPoints(points, '台中').map((p) => p.code)).toEqual(['F005678']);
    expect(searchPickupPoints(points, '台北 民生').map((p) => p.code)).toEqual(['F001234']);
    expect(searchPickupPoints(points, 'f009999').map((p) => p.code)).toEqual(['F009999']);
    expect(searchPickupPoints(points, '   ')).toEqual([]);
  });
});

describe('PickupPointSelector', () => {
  const baseProps = {
    pickupPoint: null,
    homeShippingFee: 146,
    pickupShippingFee: 60,
    onMethodChange: () => undefined,
    onPickupPointChange: () => undefined,
  };

  it('shows both delivery methods with their fees and no store panel for home delivery', () => {
    const html = renderToStaticMarkup(<PickupPointSelector {...baseProps} method="home" />);
    expect(html).toContain('宅配到府');
    expect(html).toContain('超商取貨');
    expect(html).toContain('NT$146');
    expect(html).toContain('NT$60');
    expect(html).not.toContain('data-testid="pickup-point-panel"');
  });

  it('asks for a chain and a search keyword when no store is chosen', () => {
    const html = renderToStaticMarkup(<PickupPointSelector {...baseProps} method="pickup" />);
    expect(html).toContain('data-testid="pickup-point-panel"');
    for (const label of ['全家', '7-ELEVEN', '萊爾富']) expect(html).toContain(label);
    expect(html).toContain('id="pickup-point-query"');
    expect(html).toContain('取貨付款');
  });

  it('shows the chosen store with a change button', () => {
    const html = renderToStaticMarkup(<PickupPointSelector {...baseProps} method="pickup" pickupPoint={STORE} />);
    expect(html).toContain('data-testid="pickup-point-selected"');
    expect(html).toContain('全家台北民生店（F001234）');
    expect(html).toContain('更換');
    expect(html).not.toContain('id="pickup-point-query"');
  });
});

describe('store pickup client', () => {
  it('reads the switch and fee from public site settings', async () => {
    await expect(fetchStorePickupSettings()).resolves.toEqual({ enabled: true, shippingFee: 60 });
  });

  it('applies the preview switch only on a vercel.app preview address', () => {
    expect(isStorePickupPreviewEnabled('true', 'saengak-web-d2ux-git-x.vercel.app')).toBe(true);
    expect(isStorePickupPreviewEnabled('true', 'lucissicare.com')).toBe(false);
    expect(isStorePickupPreviewEnabled('true', 'www.lucissicare.com')).toBe(false);
    expect(isStorePickupPreviewEnabled(undefined, 'saengak-web-d2ux-git-x.vercel.app')).toBe(false);
    expect(isStorePickupPreviewEnabled('false', 'saengak-web-d2ux-git-x.vercel.app')).toBe(false);
  });

  it('searches through the store API and drops malformed rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ points: [STORE, { carrier: 'x' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchApi('familymart', ' 民生 ')).resolves.toEqual([STORE]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pickup-points?carrier=familymart&q=%E6%B0%91%E7%94%9F');
  });

  it('explains when store pickup is switched off', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'STORE_PICKUP_DISABLED' }), { status: 404 })));
    await expect(searchApi('familymart', '民生')).rejects.toBeInstanceOf(PickupSearchError);
  });

  it('sends only the chain and store code when checking out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      checkoutUrl: 'https://gh2xgs-zf.myshopify.com/checkouts/cn/example',
      memberOrderLinked: true,
      checkoutKind: 'member',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await createShopifyCheckout(
      [{ merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1 }],
      defaultInvoicePreference,
      undefined,
      undefined,
      { pickupPoint: STORE },
    ).catch(() => undefined);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.pickupPoint).toEqual({ carrier: 'familymart', code: 'F001234' });
  });

  it('has customer-facing messages for store pickup errors', () => {
    expect(getShopifyCheckoutErrorMessage({ code: 'PICKUP_POINT_INVALID' }, 400)).toContain('重新選擇門市');
    expect(getShopifyCheckoutErrorMessage({ code: 'STORE_PICKUP_DISABLED' }, 400)).toContain('改選宅配');
    expect(getShopifyCheckoutErrorMessage({ code: 'PICKUP_POINTS_UNAVAILABLE' }, 503)).toContain('門市清單');
  });
});
