import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  findShipAnyPickupPoint: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

vi.mock('../api/_lib/supabase-admin.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/supabase-admin.js')>();
  return { ...actual, getSupabaseAdminClient: mocks.getSupabaseAdminClient };
});

vi.mock('../api/_lib/shipany-pickup-points.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/shipany-pickup-points.js')>();
  return { ...actual, findShipAnyPickupPoint: mocks.findShipAnyPickupPoint };
});

import { POST } from '../api/create-shopify-cart.js';
import { resetMemoryDatabase, setMemorySiteSetting } from '../api/_lib/supabase-admin.js';

const STORE = {
  carrier: 'familymart',
  code: 'F001234',
  name: '全家台北民生店',
  address: '台北市松山區民生東路四段1號',
  courier: 'FamilyMart',
};

function memberRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/create-shopify-cart', {
    method: 'POST',
    headers: { Origin: 'https://saengak.com.tw', Authorization: 'Bearer valid-member-token' },
    body: JSON.stringify({
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1234567890', quantity: 1 }],
      ...body,
    }),
  });
}

describe('建立結帳：超商取貨門市', () => {
  let capturedVariables: any;

  beforeEach(() => {
    resetMemoryDatabase();
    vi.restoreAllMocks();
    mocks.findShipAnyPickupPoint.mockReset();
    capturedVariables = null;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
    process.env.SHIPANY_CLIENT_KEY = 'test-client-key';
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'member-123', email: 'member@example.com' } }, error: null }),
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { name: '王大明', phone: '0912345678', address: '106 台北市大安區忠孝東路四段100號5樓' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedVariables = JSON.parse(options.body).variables;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            cartCreate: {
              cart: { id: 'gid://shopify/Cart/test_cart_pickup_store', checkoutUrl: 'https://gh2xgs-zf.myshopify.com/cart/c/test_pickup', totalQuantity: 1 },
              userErrors: [],
            },
          },
        }),
      };
    }) as typeof fetch;
  });

  it('預填門市地址並記錄門市，不帶會員住家地址', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    mocks.findShipAnyPickupPoint.mockResolvedValue(STORE);

    const response = await POST(memberRequest({ pickupPoint: { carrier: 'familymart', code: 'F001234', name: '偽造名稱' } }));
    expect(response.status).toBe(200);
    expect(mocks.findShipAnyPickupPoint).toHaveBeenCalledWith(expect.anything(), 'familymart', 'F001234');

    const address = capturedVariables.input.buyerIdentity.deliveryAddressPreferences[0].deliveryAddress;
    expect(address).toMatchObject({
      address1: '[F001234] 台北市松山區民生東路四段1號',
      company: '全家台北民生店',
      province: '台北市',
      city: '松山區',
      lastName: '王',
      firstName: '大明',
      phone: '+886912345678',
    });

    const attrs = Object.fromEntries(capturedVariables.input.attributes.map((a: any) => [a.key, a.value]));
    expect(attrs).toMatchObject({
      _delivery_method: 'pickup',
      _pickup_carrier: 'familymart',
      _pickup_code: 'F001234',
      _pickup_name: '全家台北民生店',
      _pickup_address: '台北市松山區民生東路四段1號',
      _pickup_courier: 'FamilyMart',
    });
    expect(attrs._shipping_address1).toBeUndefined();
  });

  it('開關關閉時拒絕超商取貨', async () => {
    const response = await POST(memberRequest({ pickupPoint: { carrier: 'familymart', code: 'F001234' } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'STORE_PICKUP_DISABLED' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('門市不在門市清單時拒絕', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    mocks.findShipAnyPickupPoint.mockResolvedValue(undefined);
    const response = await POST(memberRequest({ pickupPoint: { carrier: 'familymart', code: 'F999999' } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'PICKUP_POINT_INVALID' });
  });

  it('格式錯誤的門市直接拒絕，不查詢門市清單', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    for (const pickupPoint of [{ carrier: 'lawson', code: 'F001234' }, { carrier: 'familymart', code: 'bad code!' }, 'F001234']) {
      const response = await POST(memberRequest({ pickupPoint }));
      expect(response.status).toBe(400);
    }
    expect(mocks.findShipAnyPickupPoint).not.toHaveBeenCalled();
  });

  it('門市清單無法讀取時回報暫時無法使用', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    mocks.findShipAnyPickupPoint.mockRejectedValue(new Error('SHIPANY_PICKUP_TRANSPORT_UNAVAILABLE'));
    const response = await POST(memberRequest({ pickupPoint: { carrier: 'familymart', code: 'F001234' } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'PICKUP_POINTS_UNAVAILABLE' });
  });
});
