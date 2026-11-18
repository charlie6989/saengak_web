import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GA4_MEASUREMENT_ID,
  initAnalytics,
  isAnalyticsHost,
  isTrackedPath,
  resetAnalyticsForTest,
  resolveMeasurementId,
  trackPageView,
} from '../src/lib/analytics';

function fakeEnvironment(hostname: string) {
  const appended: Array<{ src: string; async: boolean }> = [];
  const doc = {
    title: '頁面標題｜LUCISSI CARE',
    createElement: () => ({ src: '', async: false }),
    head: { appendChild: (node: { src: string; async: boolean }) => appended.push(node) },
  } as unknown as Document;
  const win = { location: { hostname, origin: `https://${hostname}` } } as unknown as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  return { win, doc, appended };
}

const calls = (win: { dataLayer?: unknown[] }) => (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

afterEach(() => resetAnalyticsForTest());

describe('GA4 analytics', () => {
  it('uses the CARE measurement ID unless overridden or switched off', () => {
    expect(resolveMeasurementId(undefined)).toBe(DEFAULT_GA4_MEASUREMENT_ID);
    expect(resolveMeasurementId('G-ABCDEF1234')).toBe('G-ABCDEF1234');
    expect(resolveMeasurementId('off')).toBeNull();
    expect(resolveMeasurementId('UA-123')).toBeNull();
  });

  it('only loads on the production domain', () => {
    expect(isAnalyticsHost('lucissicare.com')).toBe(true);
    expect(isAnalyticsHost('www.lucissicare.com')).toBe(true);
    expect(isAnalyticsHost('saengak-web-d2ux-abc.vercel.app')).toBe(false);
    expect(isAnalyticsHost('localhost')).toBe(false);

    const preview = fakeEnvironment('saengak-web-d2ux-abc.vercel.app');
    expect(initAnalytics(preview.win, preview.doc)).toBe(false);
    expect(preview.appended).toHaveLength(0);
  });

  it('skips admin and auth callback pages', () => {
    expect(isTrackedPath('/')).toBe(true);
    expect(isTrackedPath('/product/7810527723587')).toBe(true);
    expect(isTrackedPath('/admin')).toBe(false);
    expect(isTrackedPath('/admin/orders')).toBe(false);
    expect(isTrackedPath('/auth/confirm')).toBe(false);
    expect(isTrackedPath('/reset-password')).toBe(false);
  });

  it('loads gtag once with automatic page views off, then sends page_view itself', () => {
    const { win, doc, appended } = fakeEnvironment('lucissicare.com');
    expect(initAnalytics(win, doc)).toBe(true);
    expect(initAnalytics(win, doc)).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ async: true, src: `https://www.googletagmanager.com/gtag/js?id=${DEFAULT_GA4_MEASUREMENT_ID}` });
    expect(calls(win)[1]).toEqual(['config', DEFAULT_GA4_MEASUREMENT_ID, { send_page_view: false }]);

    trackPageView('/products', '?category=x', win, doc);
    trackPageView('/admin', '', win, doc);
    const events = calls(win).filter((args) => args[0] === 'event');
    expect(events).toEqual([
      ['event', 'page_view', { page_location: 'https://lucissicare.com/products?category=x', page_path: '/products?category=x', page_title: '頁面標題｜LUCISSI CARE' }],
    ]);
  });

  it('is allowed by the site CSP and disclosed on the privacy page', () => {
    const csp = (JSON.parse(readFileSync('vercel.json', 'utf8')).headers as Array<{ headers: Array<{ key: string; value: string }> }>)
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === 'Content-Security-Policy')!.value;
    expect(csp).toMatch(/script-src [^;]*https:\/\/www\.googletagmanager\.com/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
    expect(readFileSync('src/pages/privacy/page.tsx', 'utf8')).toContain('Google Analytics');
  });
});
