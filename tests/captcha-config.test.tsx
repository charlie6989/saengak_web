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
