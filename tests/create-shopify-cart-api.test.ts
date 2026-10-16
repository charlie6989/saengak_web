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

const shopifyCartResponse = () => new Response(JSON.stringify({
  data: {
    cartCreate: {
      cart: { id: cartId, checkoutUrl, totalQuantity: 1 },
      userErrors: [],
      warnings: [],
    },
  },
}), { status: 200, headers: { 'content-type': 'application/json' } });

function mockGuestCheckoutNetwork(turnstile: Response | Error): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      if (turnstile instanceof Error) throw turnstile;
      return turnstile.clone();
    }
    return shopifyCartResponse();
  }));
}

const turnstileResult = (success: boolean) => new Response(JSON.stringify({ success }), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

function enableGuestCheckout(): void {
  mocks.getSiteSetting.mockImplementation(async (key: string) => (
    key === 'guest_checkout_enabled' ? true : null
  ));
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-test-secret';
}

function guestBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...checkoutBody(),
    guestEmail: 'guest@example.test',
    turnstileToken: 'turnstile-token',
    ...overrides,
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
    delete process.env.TURNSTILE_SECRET_KEY;
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

  it('exposes a Vercel Web API default handler and blocks guest checkout', async () => {
    const response = await vercelHandler.fetch(request(checkoutBody()));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(data.code).toBe('MEMBER_LOGIN_REQUIRED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('blocks an invalid or expired Supabase member session', async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'JWT expired' },
        }),
      },
    });

    const response = await POST(request(checkoutBody(), 'expired-member-token'));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(data.code).toBe('MEMBER_SESSION_INVALID');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed when membership authentication is not configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_PUBLIC_SUPABASE_URL;
    delete process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

    const response = await POST(request(checkoutBody(), 'valid-member-token'));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(data.code).toBe('MEMBERSHIP_AUTH_UNAVAILABLE');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed when a member cart cannot be persisted with the service role', async () => {
    const response = await POST(request(checkoutBody(), 'valid-member-token'));
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(data.code).toBe('MEMBER_ORDER_LINK_UNAVAILABLE');
    expect(data.checkoutUrl).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
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
    expect(data.checkoutKind).toBe('member');

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
      checkout_kind: 'member',
    }), { onConflict: 'shopify_store_domain,shopify_cart_token' });
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0],
    );
  });

  describe('guest checkout', () => {
    it('keeps requiring sign-in while the launch switch is off', async () => {
      mocks.getSiteSetting.mockImplementation(async (key: string) => (
        key === 'guest_checkout_enabled' ? false : null
      ));
      process.env.TURNSTILE_SECRET_KEY = 'turnstile-test-secret';

      const response = await POST(request(guestBody()));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(data.code).toBe('MEMBER_LOGIN_REQUIRED');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('does not downgrade an invalid member session to guest checkout', async () => {
      enableGuestCheckout();
      mocks.createClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } }),
        },
      });

      const response = await POST(request(guestBody(), 'expired-member-token'));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(data.code).toBe('MEMBER_SESSION_INVALID');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('fails closed when the Turnstile secret is not configured', async () => {
      enableGuestCheckout();
      delete process.env.TURNSTILE_SECRET_KEY;

      const response = await POST(request(guestBody()));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(data.code).toBe('TURNSTILE_UNAVAILABLE');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('requires a Turnstile token', async () => {
      enableGuestCheckout();

      const response = await POST(request(guestBody({ turnstileToken: undefined })));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(400);
      expect(data.code).toBe('TURNSTILE_TOKEN_REQUIRED');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects member discount codes', async () => {
      enableGuestCheckout();

      const response = await POST(request(guestBody({ discountCodes: ['WELCOME100'] })));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(400);
      expect(data.code).toBe('GUEST_DISCOUNT_REQUIRES_LOGIN');
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'not-an-email', `${'a'.repeat(250)}@example.test`])(
      'requires a valid guest email (%s)',
      async (guestEmail) => {
        enableGuestCheckout();

        const response = await POST(request(guestBody({ guestEmail })));
        const data = await response.json() as Record<string, unknown>;

        expect(response.status).toBe(400);
        expect(data.code).toBe('GUEST_EMAIL_REQUIRED');
        expect(fetch).not.toHaveBeenCalled();
      },
    );

    it('rejects a failed Turnstile challenge before writing anything', async () => {
      enableGuestCheckout();
      mockGuestCheckoutNetwork(turnstileResult(false));
      const upsert = vi.fn().mockResolvedValue({ error: null });
      const rpc = vi.fn().mockResolvedValue({ error: null });
      mocks.getSupabaseAdminClient.mockReturnValue({ rpc, from: vi.fn().mockReturnValue({ upsert }) });

      const response = await POST(request(guestBody()));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(403);
      expect(data.code).toBe('TURNSTILE_VERIFICATION_FAILED');
      expect(upsert).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });

    it('fails closed when Turnstile cannot be reached', async () => {
      enableGuestCheckout();
      mockGuestCheckoutNetwork(new Error('network down'));
      const upsert = vi.fn().mockResolvedValue({ error: null });
      mocks.getSupabaseAdminClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue({ upsert }) });

      const response = await POST(request(guestBody()));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(data.code).toBe('TURNSTILE_UNAVAILABLE');
      expect(upsert).not.toHaveBeenCalled();
    });

    it('verifies Turnstile and links the cart without a member', async () => {
      enableGuestCheckout();
      mockGuestCheckoutNetwork(turnstileResult(true));
      const upsert = vi.fn().mockResolvedValue({ error: null });
      const from = vi.fn().mockReturnValue({ upsert });
      mocks.getSupabaseAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: null }), from });

      const response = await POST(request(guestBody()));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(data).toMatchObject({ checkoutUrl, orderTrackingLinked: false, checkoutKind: 'guest' });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalledWith('profiles');

      const [turnstileUrl, turnstileInit] = vi.mocked(fetch).mock.calls[0] ?? [];
      expect(String(turnstileUrl)).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const turnstileForm = new URLSearchParams(String(turnstileInit?.body));
      expect(turnstileForm.get('secret')).toBe('turnstile-test-secret');
      expect(turnstileForm.get('response')).toBe('turnstile-token');

      const storefrontBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)) as {
        variables: { input: {
          attributes: Array<{ key: string; value: string }>;
          buyerIdentity: Record<string, unknown>;
          discountCodes?: unknown;
        } };
      };
      const linkToken = storefrontBody.variables.input.attributes.find(
        (attribute) => attribute.key === '_saengak_member_link_token',
      )?.value;
      expect(linkToken).toMatch(/^[0-9a-f-]{36}$/i);
      expect(storefrontBody.variables.input.buyerIdentity).toEqual({
        countryCode: 'TW',
        email: 'guest@example.test',
      });
      expect(storefrontBody.variables.input.discountCodes).toBeUndefined();
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        shopify_cart_token: linkToken,
        user_id: null,
        checkout_kind: 'guest',
      }), { onConflict: 'shopify_store_domain,shopify_cart_token' });
      expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(fetch).mock.invocationCallOrder[1],
      );
    });
  });
});
