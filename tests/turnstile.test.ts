import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TURNSTILE_GUEST_CHECKOUT_ACTION, verifyTurnstileToken } from '../api/_lib/turnstile.js';

function mockSiteverify(result: Record<string, unknown>): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })));
}

const verify = () => verifyTurnstileToken('turnstile-token', {
  expectedAction: TURNSTILE_GUEST_CHECKOUT_ACTION,
});

describe('Turnstile siteverify', () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-test-secret';
    delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  });

  it.each(['lucissicare.com', 'www.lucissicare.com', 'localhost', 'WWW.LUCISSICARE.COM'])(
    'accepts the default hostname %s with the guest checkout action',
    async (hostname) => {
      mockSiteverify({ success: true, hostname, action: 'guest_checkout' });
      await expect(verify()).resolves.toBe('verified');
    },
  );

  it('accepts a missing action so Cloudflare test keys keep working', async () => {
    mockSiteverify({ success: true, hostname: 'localhost' });
    await expect(verify()).resolves.toBe('verified');
  });

  it('rejects a different action', async () => {
    mockSiteverify({ success: true, hostname: 'lucissicare.com', action: 'login' });
    await expect(verify()).resolves.toBe('rejected');
  });

  it.each([undefined, '', 'evil.example', 'lucissicare.com.evil.example'])(
    'rejects hostname %s',
    async (hostname) => {
      mockSiteverify({ success: true, hostname, action: 'guest_checkout' });
      await expect(verify()).resolves.toBe('rejected');
    },
  );

  it('rejects an unsuccessful challenge', async () => {
    mockSiteverify({ success: false, hostname: 'lucissicare.com', action: 'guest_checkout' });
    await expect(verify()).resolves.toBe('rejected');
  });

  it('replaces the default hostnames with TURNSTILE_ALLOWED_HOSTNAMES', async () => {
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = ' preview.example.vercel.app , example.com ';
    mockSiteverify({ success: true, hostname: 'preview.example.vercel.app', action: 'guest_checkout' });
    await expect(verify()).resolves.toBe('verified');

    mockSiteverify({ success: true, hostname: 'lucissicare.com', action: 'guest_checkout' });
    await expect(verify()).resolves.toBe('rejected');
  });

  it('sends the secret, token and remote IP to siteverify', async () => {
    mockSiteverify({ success: true, hostname: 'lucissicare.com' });
    await verifyTurnstileToken('turnstile-token', { remoteIp: '203.0.113.5' });

    const form = new URLSearchParams(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(form.get('secret')).toBe('turnstile-test-secret');
    expect(form.get('response')).toBe('turnstile-token');
    expect(form.get('remoteip')).toBe('203.0.113.5');
  });

  it('is unavailable without a secret key', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    mockSiteverify({ success: true, hostname: 'lucissicare.com' });
    await expect(verify()).resolves.toBe('unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });
});
