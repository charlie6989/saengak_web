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
  default: ({ resetKey }: { resetKey: number }) => (
    <div data-testid="turnstile-widget" data-reset-key={resetKey} />
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
import OrderStatusPage from '../src/pages/order-status/page';
import { scheduleGuestOrderClaim } from '../src/contexts/AuthContext';

function renderActions(mode: SignedOutCheckoutMode, guestEmail = '') {
  const noop = () => undefined;
  return renderToStaticMarkup(
    <SignedOutCheckoutActions
      mode={mode}
      guestEmail={guestEmail}
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
    expect(html).toContain('登入後可使用會員優惠');
    expect(html).toContain('以訪客身分前往結帳');
    expect(html).toContain('登入結帳（使用會員優惠）');
  });

  it('only offers guest checkout when signed out, enabled, and Turnstile is configured', () => {
    expect(isGuestCheckoutAvailable(false, true, true)).toBe(true);
    expect(isGuestCheckoutAvailable(true, true, true)).toBe(false);
    expect(isGuestCheckoutAvailable(false, false, true)).toBe(false);
    expect(isGuestCheckoutAvailable(false, true, false)).toBe(false);
  });

  it('validates the guest email and Turnstile token before submitting', () => {
    expect(getGuestCheckoutValidationError('', 'token')).toContain('有效的 Email');
    expect(getGuestCheckoutValidationError('not-an-email', 'token')).toContain('有效的 Email');
    expect(getGuestCheckoutValidationError(`${'a'.repeat(250)}@x.tw`, 'token')).toContain('有效的 Email');
    expect(getGuestCheckoutValidationError('guest@example.test', '')).toContain('安全驗證');
    expect(getGuestCheckoutValidationError(' guest@example.test ', 'token')).toBe('');
  });
});

describe('order-status thank-you page', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
  });

  it('explains how a guest finds the order', () => {
    const html = renderOrderStatus('/order-status?order_id=gid://shopify/Order/1001');

    expect(html).toContain('data-testid="guest-order-notice"');
    expect(html).toContain('訂單確認信');
    expect(html).toContain('訂單狀態');
    expect(html).toContain('同一個 Email 註冊');
    expect(html).toContain('href="/register"');
  });

  it('does not show the guest notice to signed-in members', () => {
    authState.user = { id: 'member-1' };
    const html = renderOrderStatus('/order-status?order_id=gid://shopify/Order/1001');

    expect(html).not.toContain('guest-order-notice');
    expect(html).toContain('查看我的訂單');
  });

  it('waits for the auth state before deciding', () => {
    authState.isLoading = true;
    const html = renderOrderStatus('/order-status?order_id=gid://shopify/Order/1001');

    expect(html).not.toContain('guest-order-notice');
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
