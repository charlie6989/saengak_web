import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@marsidev/react-turnstile', () => ({Turnstile: ({siteKey}: {siteKey: string}) => <span data-sitekey={siteKey} />}));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe('independent auth and guest CAPTCHA configuration', () => {
  it('guest-only setup leaves existing member authentication available', async () => {
    vi.stubEnv('VITE_PUBLIC_TURNSTILE_SITE_KEY', '');
    vi.stubEnv('VITE_PUBLIC_GUEST_CHECKOUT_TURNSTILE_SITE_KEY', 'guest-key');
    const m = await import('../src/components/feature/AuthCaptcha');
    expect(m.isAuthCaptchaEnabled).toBe(false);
    expect(m.isAuthCaptchaReady('')).toBe(true);
    expect(m.isGuestCheckoutCaptchaEnabled).toBe(true);
    expect(renderToStaticMarkup(<m.default resetKey={0} onTokenChange={() => {}} />)).toBe('');
    expect(renderToStaticMarkup(<m.default siteKey={m.guestCheckoutSiteKey} action="guest_checkout" resetKey={0} onTokenChange={() => {}} />)).toContain('data-sitekey="guest-key"');
  });
  it('auth-only configuration cannot expose guest checkout', async () => {
    vi.stubEnv('VITE_PUBLIC_TURNSTILE_SITE_KEY', 'auth-key');
    vi.stubEnv('VITE_PUBLIC_GUEST_CHECKOUT_TURNSTILE_SITE_KEY', '');
    const m = await import('../src/components/feature/AuthCaptcha');
    expect(m.isAuthCaptchaEnabled).toBe(true);
    expect(m.isAuthCaptchaReady('')).toBe(false);
    expect(m.isGuestCheckoutCaptchaEnabled).toBe(false);
  });
});

describe('captcha fallback when verification stalls', () => {
  it('wires failure callbacks and keeps the default prompt until it stalls', async () => {
    vi.resetModules();
    const seen: Array<Record<string, unknown>> = [];
    vi.doMock('@marsidev/react-turnstile', () => ({
      Turnstile: (props: Record<string, unknown>) => {
        seen.push(props);
        return <span data-turnstile />;
      },
    }));
    const m = await import('../src/components/feature/AuthCaptcha');
    const html = renderToStaticMarkup(
      <m.default siteKey="guest-key" action="guest_checkout" fallbackHint="也可以改用「登入結帳」。" resetKey={0} onTokenChange={() => {}} />,
    );
    expect(html).toContain('請完成安全驗證後繼續。');
    expect(html).not.toContain('重新驗證');
    const props = seen.at(-1)!;
    expect(props.options).toEqual({ action: 'guest_checkout', language: 'zh-tw' });
    for (const name of ['onError', 'onTimeout', 'onUnsupported', 'onExpire', 'onSuccess']) expect(typeof props[name]).toBe('function');
    expect(m.CAPTCHA_STALL_MS).toBeGreaterThanOrEqual(10000);
    expect(m.CAPTCHA_STUCK_MESSAGE).toContain('一般瀏覽模式');
    vi.doUnmock('@marsidev/react-turnstile');
  });
});
