import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AuthModal from '../src/components/feature/AuthModal';
import {
  captchaTokenOptions,
  isAuthCaptchaReady,
} from '../src/components/feature/AuthCaptcha';

function renderAuthModal(mode: 'login' | 'register') {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AuthModal isOpen mode={mode} onClose={() => undefined} />
    </MemoryRouter>,
  );
}

function passwordInput(html: string) {
  return html.match(/<input[^>]*name="password"[^>]*>/)?.[0] || '';
}

describe('member auth UI safeguards', () => {
  it('shows Facebook login for Meta reviewers only with ?fblogin=1', async () => {
    const { isFacebookLoginEnabled } = await import('../src/lib/facebookAuth');
    expect(isFacebookLoginEnabled('')).toBe(false);
    expect(isFacebookLoginEnabled('?fblogin=0')).toBe(false);
    expect(isFacebookLoginEnabled('?fblogin=1')).toBe(true);
  });

  it('hides Facebook login until the Meta app is live', () => {
    const html = renderAuthModal('login');

    expect(html).not.toContain('Facebook');
    expect(html).toContain('Google');
  });

  it('does not reject existing short passwords in login mode', () => {
    const input = passwordInput(renderAuthModal('login'));

    expect(input.toLowerCase()).toContain('autocomplete="current-password"');
    expect(input.toLowerCase()).not.toContain('minlength=');
  });

  it('requires 12 characters when creating a new password', () => {
    const input = passwordInput(renderAuthModal('register'));

    expect(input.toLowerCase()).toContain('autocomplete="new-password"');
    expect(input.toLowerCase()).toContain('minlength="12"');
  });

  it('only includes a captcha token after a challenge succeeds', () => {
    expect(captchaTokenOptions('')).toEqual({});
    expect(captchaTokenOptions('verified-token')).toEqual({ captchaToken: 'verified-token' });
    expect(isAuthCaptchaReady('', false)).toBe(true);
    expect(isAuthCaptchaReady('', true)).toBe(false);
    expect(isAuthCaptchaReady('verified-token', true)).toBe(true);
  });
});
