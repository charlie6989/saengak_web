import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from 'posthog-js';
import {
  isAutomatedBrowser,
  posthogAllowed,
  redactPosthogEvent,
  redactSiteUrl,
  resolvePosthogKey,
  restoreCaptureIfUnmarked,
  sessionReplayAllowed,
  validPosthogKey,
} from '../src/lib/posthog';

const KEY = `phc_${'a'.repeat(43)}`;
const BROWSER = { userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1', webdriver: false, doNotTrack: null };

function storage(value: string | null = null) {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_k: string, v: string) => {
      stored = v;
    },
    removeItem: () => {
      stored = null;
    },
  };
}

function event(properties: Record<string, unknown>, setOnce?: Record<string, unknown>): CaptureResult {
  return { uuid: 'u', event: '$pageview', properties, $set_once: setOnce };
}

describe('posthog', () => {
  it('accepts only phc_ project keys and can be switched off', () => {
    expect(validPosthogKey(KEY)).toBe(true);
    for (const key of [undefined, '', 'phx_abc', 'phc_short', `${KEY} `]) expect(validPosthogKey(key)).toBe(false);
    expect(resolvePosthogKey(KEY)).toBe(KEY);
    expect(resolvePosthogKey('off')).toBeNull();
    // 專案建立前沒有預設金鑰：不載入
    expect(resolvePosthogKey('')).toBeNull();
  });

  it('loads only on the production domain for ordinary visitors', () => {
    expect(posthogAllowed('lucissicare.com', '', storage(), BROWSER, KEY)).toBe(true);
    expect(posthogAllowed('saengak-web-d2ux.vercel.app', '', storage(), BROWSER, KEY)).toBe(false);
    expect(posthogAllowed('lucissicare.com', '', storage(), BROWSER, null)).toBe(false);
    expect(posthogAllowed('lucissicare.com', '', storage('1'), BROWSER, KEY)).toBe(false);
    expect(posthogAllowed('lucissicare.com', '?ga_internal=1', storage(), BROWSER, KEY)).toBe(false);
    expect(posthogAllowed('lucissicare.com', '', storage(), { ...BROWSER, doNotTrack: '1' }, KEY)).toBe(false);
    expect(posthogAllowed('lucissicare.com', '', storage(), { ...BROWSER, webdriver: true }, KEY)).toBe(false);
    expect(isAutomatedBrowser({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).toBe(true);
  });

  it('keeps session replay off on pages that show or collect personal details', () => {
    for (const path of ['/login', '/register', '/profile', '/profile/orders', '/order-status', '/reset-password', '/admin/orders', '/auth/callback', '/welcome']) {
      expect(sessionReplayAllowed(path)).toBe(false);
    }
    for (const path of ['/', '/products', '/product/7829164785731', '/community', '/faq', '/customer-service']) {
      expect(sessionReplayAllowed(path)).toBe(true);
    }
  });

  it('strips query strings from site URLs but keeps category filters and other sites', () => {
    expect(redactSiteUrl('https://lucissicare.com/order-status?order_id=1019&email=a%40b.c', 'lucissicare.com')).toBe('https://lucissicare.com/order-status');
    expect(redactSiteUrl('https://lucissicare.com/products?category=x&q=y', 'lucissicare.com')).toBe('https://lucissicare.com/products?category=x');
    expect(redactSiteUrl('https://www.google.com/search?q=lucissi', 'lucissicare.com')).toBe('https://www.google.com/search?q=lucissi');
    expect(redactSiteUrl(42, 'lucissicare.com')).toBe(42);
  });

  it('redacts URLs in event and person properties, and drops admin pages', () => {
    const redacted = redactPosthogEvent(
      event(
        { $pathname: '/order-status', $current_url: 'https://lucissicare.com/order-status?order_id=1', $referrer: 'https://lucissicare.com/profile?tab=orders' },
        { $initial_current_url: 'https://lucissicare.com/?ga_internal=0&utm_source=line&fbclid=abc' },
      ),
      'lucissicare.com',
    );
    expect(redacted?.properties.$current_url).toBe('https://lucissicare.com/order-status');
    expect(redacted?.properties.$referrer).toBe('https://lucissicare.com/profile');
    expect(redacted?.$set_once?.$initial_current_url).toBe('https://lucissicare.com/?utm_source=line');
    expect(redactPosthogEvent(event({ $pathname: '/admin/orders' }), 'lucissicare.com')).toBeNull();
    expect(redactPosthogEvent(null, 'lucissicare.com')).toBeNull();
  });

  it('restores capture only when ?ga_internal=0 clears an earlier opt-out', () => {
    const optedOut = { has_opted_out_capturing: vi.fn(() => true), opt_in_capturing: vi.fn() };
    expect(restoreCaptureIfUnmarked(optedOut, '?ga_internal=0')).toBe(true);
    expect(optedOut.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });

    const capturing = { has_opted_out_capturing: vi.fn(() => false), opt_in_capturing: vi.fn() };
    expect(restoreCaptureIfUnmarked(capturing, '?ga_internal=0')).toBe(false);
    expect(capturing.opt_in_capturing).not.toHaveBeenCalled();

    const untouched = { has_opted_out_capturing: vi.fn(() => true), opt_in_capturing: vi.fn() };
    expect(restoreCaptureIfUnmarked(untouched, '')).toBe(false);
    expect(restoreCaptureIfUnmarked(untouched, '?ga_internal=1')).toBe(false);
    expect(untouched.opt_in_capturing).not.toHaveBeenCalled();
  });

  it('keeps the header account details (name, email) out of session replay', () => {
    const header = readFileSync(new URL('../src/components/feature/Header.tsx', import.meta.url), 'utf8');
    // 桌機下拉選單與手機選單各一處，兩處都要整塊排除
    const blocks = header.match(/<div className="[^"]*ph-no-capture[^"]*">[\s\S]{0,600}?user\.email/g) ?? [];
    expect(blocks).toHaveLength(2);
  });
});
