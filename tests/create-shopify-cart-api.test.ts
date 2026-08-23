import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  getSiteSetting: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('../api/_lib/supabase-admin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  getSiteSetting: mocks.getSiteSetting,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

import vercelHandler, { POST } from '../api/create-shopify-cart.js';

const checkoutUrl = 'https://gh2xgs-zf.myshopify.com/checkouts/cn/test';
const cartId = 'gid://shopify/Cart/test-cart-token-123?key=public-key';

function request(body: Record<string, unknown>, accessToken?: string): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return new Request('http://localhost:3000/api/create-shopify-cart', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function checkoutBody(invoicePreference: Record<string, unknown> = {
  kind: 'personal',
  notificationEmail: '',
  carrier: 'none',
  carrierId: '',
}): Record<string, unknown> {
  return {
    lines: [{ merchandiseId: 'gid://shopify/ProductVariant/43639647502403', quantity: 1 }],
    invoicePreference,
  };
}

function mockShopifyCart(): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: {
      cartCreate: {
        cart: { id: cartId, checkoutUrl, totalQuantity: 1 },
        userErrors: [],
        warnings: [],
      },
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } })));
}

describe('create-shopify-cart Vercel API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getSupabaseAdminClient.mockReturnValue(null);
    mocks.getSiteSetting.mockResolvedValue(null);
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'member-123' } },
          error: null,
        }),
      },
    });
    mockShopifyCart();
  });

  it('exposes a Vercel Web API default handler and creates a guest Shopify cart', async () => {
    const response = await vercelHandler.fetch(request(checkoutBody()));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.checkoutUrl).toBe(checkoutUrl);
    expect(data.orderTrackingLinked).toBe(false);
  });

  it('fails closed when a member cart cannot be persisted with the service role', async () => {
    const response = await POST(request(checkoutBody(), 'valid-member-token'));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(data.code).toBe('MEMBER_ORDER_LINK_UNAVAILABLE');
    expect(data.checkoutUrl).toBeUndefined();
  });

  it('persists invoice metadata and the member-to-Shopify cart link before redirecting', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.getSupabaseAdminClient.mockReturnValue({
      rpc,
      from: vi.fn().mockReturnValue({ upsert }),
    });

    const response = await POST(request(checkoutBody({
      kind: 'company',
      notificationEmail: 'invoice@example.com',
      buyerName: '拜悠衣品有限公司',
      taxId: '24536806',
    }), 'valid-member-token'));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.orderTrackingLinked).toBe(true);

    const storefrontRequest = vi.mocked(fetch).mock.calls[0]?.[1];
    const storefrontBody = JSON.parse(String(storefrontRequest?.body)) as {
      variables: { input: { attributes: Array<{ key: string; value: string }> } };
    };
    const memberLinkToken = storefrontBody.variables.input.attributes.find(
      (attribute) => attribute.key === '_saengak_member_link_token',
    )?.value;
    expect(memberLinkToken).toMatch(/^[0-9a-f-]{36}$/i);

    expect(rpc).toHaveBeenCalledWith('save_checkout_invoice_preference', expect.objectContaining({
      p_shopify_cart_token: memberLinkToken,
    }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      shopify_cart_token: memberLinkToken,
      user_id: 'member-123',
    }), { onConflict: 'shopify_store_domain,shopify_cart_token' });
  });
});
