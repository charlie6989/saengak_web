import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: supabaseMock.getSession },
    rpc: supabaseMock.rpc,
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          supabaseMock.eq(...args);
          return { maybeSingle: supabaseMock.maybeSingle };
        },
      }),
    }),
  },
}));

vi.mock('../src/lib/sentry', () => ({
  captureExceptionSafe: vi.fn(),
}));

import {
  createShopifyCheckout,
  fetchGuestCheckoutEnabled,
  getShopifyCheckoutErrorMessage,
  GUEST_CHECKOUT_DISABLED_ERROR_CODES,
  LOGIN_REQUIRED_ERROR_CODES,
  ShopifyCheckoutError,
  shouldReportCheckoutError,
} from '../src/lib/shopifyCheckout';
import { claimGuestOrders } from '../src/lib/guestOrders';
import { captureExceptionSafe } from '../src/lib/sentry';
import { defaultInvoicePreference } from '../src/domain/invoice';

const lines = [{ merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1 }];
const checkoutUrl = 'https://gh2xgs-zf.myshopify.com/checkouts/cn/example';

function mockFetchResponse(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return {
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createShopifyCheckout guest requests', () => {
  it('sends a guest request without a session, carrying guestEmail and turnstileToken', async () => {
    const fetchMock = mockFetchResponse(200, {
      checkoutUrl,
      orderTrackingLinked: false,
      checkoutKind: 'guest',
    });

    const result = await createShopifyCheckout(
      lines,
      defaultInvoicePreference,
      ['MEMBER10'],
      { email: '  guest@example.test ', turnstileToken: 'turnstile-token' },
    );

    expect(supabaseMock.getSession).not.toHaveBeenCalled();
    const { headers, body } = sentRequest(fetchMock);
    expect(headers.Authorization).toBeUndefined();
    expect(body).toMatchObject({
      lines,
      guestEmail: 'guest@example.test',
      turnstileToken: 'turnstile-token',
    });
    expect(body).not.toHaveProperty('discountCodes');
    // orderTrackingLinked=false 不會擋住訪客結帳
    expect(result).toEqual({ checkoutUrl, invalidDiscountCodes: [], checkoutKind: 'guest' });
  });

  it('still requires a member session when no guest details are given', async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = mockFetchResponse(200, { checkoutUrl, orderTrackingLinked: true });

    const error = await createShopifyCheckout(lines, defaultInvoicePreference).catch((e) => e);

    expect(error).toBeInstanceOf(ShopifyCheckoutError);
    expect(error.code).toBe('MEMBER_LOGIN_REQUIRED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends member requests with Authorization and discount codes and checks order tracking', async () => {
    supabaseMock.getSession.mockResolvedValue({
      data: { session: { access_token: 'member-token' } },
      error: null,
    });
    const fetchMock = mockFetchResponse(200, { checkoutUrl, orderTrackingLinked: true, checkoutKind: 'member' });

    const result = await createShopifyCheckout(lines, defaultInvoicePreference, ['MEMBER10']);

    const { headers, body } = sentRequest(fetchMock);
    expect(headers.Authorization).toBe('Bearer member-token');
    expect(body.discountCodes).toEqual(['MEMBER10']);
    expect(body).not.toHaveProperty('guestEmail');
    expect(result.checkoutKind).toBe('member');
  });

  it('stops a member checkout whose order was not linked', async () => {
    supabaseMock.getSession.mockResolvedValue({
      data: { session: { access_token: 'member-token' } },
      error: null,
    });
    mockFetchResponse(200, { checkoutUrl, orderTrackingLinked: false });

    await expect(createShopifyCheckout(lines, defaultInvoicePreference))
      .rejects.toThrow('無法把 Shopify 訂單綁定到會員帳號');
  });

  it('surfaces the API error code on guest failures', async () => {
    mockFetchResponse(403, {
      error: 'Verification challenge failed',
      code: 'TURNSTILE_VERIFICATION_FAILED',
    });

    const error = await createShopifyCheckout(
      lines,
      defaultInvoicePreference,
      undefined,
      { email: 'guest@example.test', turnstileToken: 'used-token' },
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ShopifyCheckoutError);
    expect(error.code).toBe('TURNSTILE_VERIFICATION_FAILED');
    expect(error.message).toContain('安全驗證未通過');
  });
});

describe('guest checkout error messages', () => {
  it.each([
    ['TURNSTILE_UNAVAILABLE', 503, '安全驗證服務暫時無法使用'],
    ['TURNSTILE_TOKEN_REQUIRED', 400, '請先完成安全驗證'],
    ['TURNSTILE_VERIFICATION_FAILED', 403, '安全驗證未通過'],
    ['GUEST_DISCOUNT_REQUIRES_LOGIN', 400, '僅限會員使用，請登入後結帳'],
    ['GUEST_EMAIL_REQUIRED', 400, '請輸入有效的 Email'],
    ['GUEST_ORDER_LINK_UNAVAILABLE', 503, '無法建立訪客訂單紀錄'],
    ['GUEST_ORDER_LINK_FAILED', 502, '無法建立訪客訂單紀錄'],
  ])('maps %s to Traditional Chinese', (code, status, expected) => {
    const message = getShopifyCheckoutErrorMessage({ error: 'english error', code }, status);
    expect(message).toContain(expected);
    expect(message).not.toContain('english error');
  });

  it('opens the login dialog only for codes that need a member session', () => {
    expect(LOGIN_REQUIRED_ERROR_CODES.has('GUEST_DISCOUNT_REQUIRES_LOGIN')).toBe(true);
    expect(LOGIN_REQUIRED_ERROR_CODES.has('MEMBER_LOGIN_REQUIRED')).toBe(true);
    expect(LOGIN_REQUIRED_ERROR_CODES.has('TURNSTILE_UNAVAILABLE')).toBe(false);
    expect(LOGIN_REQUIRED_ERROR_CODES.has('GUEST_ORDER_LINK_FAILED')).toBe(false);
  });
});

describe('guest checkout error handling', () => {
  it('hides guest checkout when the server says it is off or unverifiable', () => {
    expect(GUEST_CHECKOUT_DISABLED_ERROR_CODES.has('MEMBER_LOGIN_REQUIRED')).toBe(true);
    expect(GUEST_CHECKOUT_DISABLED_ERROR_CODES.has('TURNSTILE_UNAVAILABLE')).toBe(true);
    expect(GUEST_CHECKOUT_DISABLED_ERROR_CODES.has('TURNSTILE_VERIFICATION_FAILED')).toBe(false);
  });

  it.each([
    'MEMBER_LOGIN_REQUIRED',
    'MEMBER_SESSION_INVALID',
    'GUEST_DISCOUNT_REQUIRES_LOGIN',
    'TURNSTILE_TOKEN_REQUIRED',
    'TURNSTILE_VERIFICATION_FAILED',
    'GUEST_EMAIL_REQUIRED',
  ])('does not report expected customer-side error %s to Sentry', (code) => {
    expect(shouldReportCheckoutError(code)).toBe(false);
  });

  it.each([
    undefined,
    'TURNSTILE_UNAVAILABLE',
    'GUEST_ORDER_LINK_UNAVAILABLE',
    'GUEST_ORDER_LINK_FAILED',
    'MEMBER_ORDER_LINK_FAILED',
  ])('reports server-side error %s', (code) => {
    expect(shouldReportCheckoutError(code)).toBe(true);
  });
});

describe('fetchGuestCheckoutEnabled', () => {
  it('reads the public guest_checkout_enabled setting', async () => {
    supabaseMock.maybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    await expect(fetchGuestCheckoutEnabled()).resolves.toBe(true);
    expect(supabaseMock.eq).toHaveBeenCalledWith('key', 'guest_checkout_enabled');
  });

  it.each([
    [{ data: { value: false }, error: null }],
    [{ data: { value: 'true' }, error: null }],
    [{ data: null, error: null }],
    [{ data: null, error: { message: 'boom' } }],
  ])('treats anything but a true value as disabled (%o)', async (result) => {
    supabaseMock.maybeSingle.mockResolvedValue(result);
    await expect(fetchGuestCheckoutEnabled()).resolves.toBe(false);
  });

  it('treats a failed request as disabled', async () => {
    supabaseMock.maybeSingle.mockRejectedValue(new Error('offline'));
    await expect(fetchGuestCheckoutEnabled()).resolves.toBe(false);
  });
});

describe('claimGuestOrders', () => {
  it('calls the claim_guest_orders RPC and returns the claimed count', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 2, error: null });
    await expect(claimGuestOrders()).resolves.toBe(2);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('claim_guest_orders');
  });

  it('does not throw or report expected errors such as an undeployed function', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    await expect(claimGuestOrders()).resolves.toBeNull();
    expect(captureExceptionSafe).not.toHaveBeenCalled();
  });

  it('reports unexpected errors without throwing', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    await expect(claimGuestOrders()).resolves.toBeNull();
    expect(captureExceptionSafe).toHaveBeenCalledTimes(1);

    supabaseMock.rpc.mockRejectedValue(new Error('network down'));
    await expect(claimGuestOrders()).resolves.toBeNull();
  });
});
