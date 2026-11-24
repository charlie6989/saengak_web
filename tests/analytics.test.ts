import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GA4_MEASUREMENT_ID,
  INTERNAL_TRAFFIC_STORAGE_KEY,
  initAnalytics,
  isAnalyticsHost,
  isTrackedPath,
  resetAnalyticsForTest,
  resolveInternalTraffic,
  resolveMeasurementId,
  trackPageView,
} from '../src/lib/analytics';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function fakeEnvironment(hostname: string, search = '', storage: ReturnType<typeof memoryStorage> | undefined = memoryStorage()) {
  const appended: Array<{ src: string; async: boolean }> = [];
  const doc = {
    title: '頁面標題｜LUCISSI CARE',
    createElement: () => ({ src: '', async: false }),
    head: { appendChild: (node: { src: string; async: boolean }) => appended.push(node) },
  } as unknown as Document;
  const win = { location: { hostname, origin: `https://${hostname}`, search }, localStorage: storage } as unknown as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
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

  it('remembers the internal-traffic device flag until it is cleared', () => {
    const storage = memoryStorage();
    expect(resolveInternalTraffic('', storage)).toBe(false);
    expect(resolveInternalTraffic('?ga_internal=1', storage)).toBe(true);
    expect(storage.getItem(INTERNAL_TRAFFIC_STORAGE_KEY)).toBe('1');
    expect(resolveInternalTraffic('?category=x', storage)).toBe(true);
    expect(resolveInternalTraffic('?ga_internal=0', storage)).toBe(false);
    expect(resolveInternalTraffic('', storage)).toBe(false);
  });

  it('falls back to the URL flag when storage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(resolveInternalTraffic('?ga_internal=1', broken)).toBe(true);
    expect(resolveInternalTraffic('', broken)).toBe(false);
    expect(resolveInternalTraffic('?ga_internal=1', undefined)).toBe(true);
  });

  it('marks every hit as internal traffic on a flagged device', () => {
    const storage = memoryStorage();
    storage.setItem(INTERNAL_TRAFFIC_STORAGE_KEY, '1');
    const { win, doc } = fakeEnvironment('lucissicare.com', '', storage);
    expect(initAnalytics(win, doc)).toBe(true);
    expect(calls(win)[1]).toEqual(['config', DEFAULT_GA4_MEASUREMENT_ID, { send_page_view: false, traffic_type: 'internal' }]);
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
