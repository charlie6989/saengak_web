import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: false,
}));

vi.mock('../src/components/feature/AuthCaptcha', () => ({
  isAuthCaptchaEnabled: true,
  default: ({ resetKey, action }: { resetKey: number; action?: string }) => (
    <div data-testid="turnstile-widget" data-reset-key={resetKey} data-action={action} />
  ),
}));

vi.mock('../src/contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/contexts/AuthContext')>()),
  useAuth: () => authState,
}));

vi.mock('../src/components/feature/Header', () => ({ default: () => null }));
vi.mock('../src/components/feature/Footer', () => ({ default: () => null }));

import SignedOutCheckoutActions, {
  getGuestCheckoutValidationError,
  isGuestCheckoutAvailable,
  type SignedOutCheckoutMode,
} from '../src/components/feature/SignedOutCheckoutActions';
import OrderStatusPage, {
  GuestOrderNotice,
  shouldShowGuestOrderNotice,
} from '../src/pages/order-status/page';
import { scheduleGuestOrderClaim } from '../src/contexts/AuthContext';

function renderActions(mode: SignedOutCheckoutMode, guestEmail = '', guestEmailError = '') {
  const noop = () => undefined;
  return renderToStaticMarkup(
    <SignedOutCheckoutActions
      mode={mode}
      guestEmail={guestEmail}
      guestEmailError={guestEmailError}
      emailFocusKey={0}
      isBusy={false}
      captchaResetKey={3}
      onGuestEmailChange={noop}
      onCaptchaTokenChange={noop}
      onMemberCheckout={noop}
      onChooseGuestCheckout={noop}
      onSubmitGuestCheckout={noop}
    />,
  );
}

function renderOrderStatus(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <OrderStatusPage />
    </MemoryRouter>,
  );
}

describe('signed-out checkout actions', () => {
  it('offers member and guest checkout before guest mode is chosen', () => {
    const html = renderActions('member');

    expect(html).toContain('登入結帳（使用會員優惠）');
    expect(html).toContain('訪客結帳');
    expect(html).not.toContain('guest-checkout-email');
    expect(html).not.toContain('turnstile-widget');
  });

  it('shows a required email field, Turnstile and the member-benefits notice in guest mode', () => {
    const html = renderActions('guest', 'guest@example.test');
    const emailInput = html.match(/<input[^>]*id="guest-checkout-email"[^>]*>/)?.[0] || '';

    expect(emailInput).toContain('type="email"');
    expect(emailInput).toContain('required');
    expect(emailInput).toContain('value="guest@example.test"');
    expect(html).toContain('data-testid="turnstile-widget"');
    expect(html).toContain('data-reset-key="3"');
    expect(html).toContain('data-action="guest_checkout"');
    // 手機 16px 避免 iOS 自動放大
    expect(emailInput).toContain('text-base');
    expect(emailInput).toContain('aria-describedby="guest-checkout-email-help"');
    expect(emailInput).not.toContain('aria-invalid');
    expect(html).toContain('登入後可使用會員優惠');
    expect(html).toContain('以訪客身分前往結帳');
    expect(html).toContain('登入結帳（使用會員優惠）');
  });

  it('shows the email error next to the field and links it for assistive technology', () => {
    const html = renderActions('guest', 'bad', '請輸入有效的 Email');
    const emailInput = html.match(/<input[^>]*id="guest-checkout-email"[^>]*>/)?.[0] || '';

    expect(emailInput).toContain('aria-invalid="true"');
    expect(emailInput).toContain('aria-describedby="guest-checkout-email-error guest-checkout-email-help"');
    expect(html).toMatch(/<p id="guest-checkout-email-error"[^>]*role="alert"[^>]*>請輸入有效的 Email<\/p>/);
  });

  it('only offers guest checkout when signed out, enabled, and Turnstile is configured', () => {
    expect(isGuestCheckoutAvailable(false, true, true)).toBe(true);
    expect(isGuestCheckoutAvailable(true, true, true)).toBe(false);
    expect(isGuestCheckoutAvailable(false, false, true)).toBe(false);
    expect(isGuestCheckoutAvailable(false, true, false)).toBe(false);
  });

  it('validates the guest email and Turnstile token before submitting', () => {
    expect(getGuestCheckoutValidationError('', 'token')?.field).toBe('email');
    expect(getGuestCheckoutValidationError('not-an-email', 'token')?.message).toContain('有效的 Email');
    expect(getGuestCheckoutValidationError(`${'a'.repeat(250)}@x.tw`, 'token')?.field).toBe('email');
    expect(getGuestCheckoutValidationError('guest@example.test', '')).toMatchObject({
      field: 'captcha',
      message: expect.stringContaining('安全驗證'),
    });
    expect(getGuestCheckoutValidationError(' guest@example.test ', 'token')).toBeNull();
  });
});

describe('order-status thank-you page', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
  });

  it('shows the guest notice only when guest checkout is on and the visitor is signed out', () => {
    expect(shouldShowGuestOrderNotice(false, false, true)).toBe(true);
    expect(shouldShowGuestOrderNotice(false, false, false)).toBe(false);
    expect(shouldShowGuestOrderNotice(false, true, true)).toBe(false);
    expect(shouldShowGuestOrderNotice(true, false, true)).toBe(false);
  });

  it('keeps the signed-out page identical to the member version while the switch is off', () => {
    // 初次渲染時開關尚未讀取，等同關閉
    const html = renderOrderStatus('/order-status?order_id=gid://shopify/Order/1001');

    expect(html).not.toContain('guest-order-notice');
    expect(html).not.toContain('href="/register"');
    expect(html).toContain('聯絡客服');
  });

  it('explains how a guest finds the order, with register and login links', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GuestOrderNotice />
      </MemoryRouter>,
    );

    expect(html).toContain('若以訪客身分結帳');
    expect(html).toContain('訂單確認信');
    expect(html).toContain('訂單狀態');
    expect(html).toContain('同一個 Email 註冊');
    expect(html).toContain('href="/register"');
    expect(html).toContain('href="/login"');
  });

  it('shows members their orders link', () => {
    authState.user = { id: 'member-1' };
    const html = renderOrderStatus('/order-status?order_id=gid://shopify/Order/1001');

    expect(html).not.toContain('guest-order-notice');
    expect(html).toContain('查看我的訂單');
  });
});

describe('guest order claim on sign-in', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const session = (id: string) => ({ user: { id } }) as never;

  it('claims guest orders once per user after SIGNED_IN, outside the auth callback', async () => {
    const claim = vi.fn().mockResolvedValue(1);
    const claimed = new Set<string>();

    expect(scheduleGuestOrderClaim('SIGNED_IN', session('u1'), claimed, claim)).toBe(true);
    expect(claim).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(claim).toHaveBeenCalledTimes(1);

    expect(scheduleGuestOrderClaim('SIGNED_IN', session('u1'), claimed, claim)).toBe(false);
    expect(scheduleGuestOrderClaim('SIGNED_IN', session('u2'), claimed, claim)).toBe(true);
    await vi.runAllTimersAsync();
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it('ignores other auth events and missing sessions', async () => {
    const claim = vi.fn();
    const claimed = new Set<string>();

    expect(scheduleGuestOrderClaim('TOKEN_REFRESHED', session('u1'), claimed, claim)).toBe(false);
    expect(scheduleGuestOrderClaim('SIGNED_OUT', null, claimed, claim)).toBe(false);
    expect(scheduleGuestOrderClaim('SIGNED_IN', null, claimed, claim)).toBe(false);
    await vi.runAllTimersAsync();
    expect(claim).not.toHaveBeenCalled();
  });
});
