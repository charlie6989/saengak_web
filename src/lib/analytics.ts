/**
 * Google Analytics 4（2026-11-19 店主決定先加 GA4）。
 * - 評估 ID 是公開值；可用 VITE_PUBLIC_GA4_MEASUREMENT_ID 覆寫，設成 off 可整個關閉。
 * - 只在正式網域載入，預覽與本機不送資料；管理後台、登入回跳等頁面不送。
 * - 網站是單頁應用程式，所以關閉自動 page_view，改在換頁後自己送（等商品、文章頁更新標題）。
 * 隱私權政策已說明使用 Google Analytics 與 Cookie（src/pages/privacy）。
 */

export const DEFAULT_GA4_MEASUREMENT_ID = 'G-8HKZRE72SY';
export const ANALYTICS_HOSTS = new Set(['lucissicare.com', 'www.lucissicare.com']);
/** 換頁後等多久再送 page_view，讓商品與文章頁載入資料後更新的標題被記到。 */
export const PAGE_VIEW_DELAY_MS = 800;

const EXCLUDED_PREFIXES = ['/admin', '/auth/', '/reset-password'];

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

export function resolveMeasurementId(configured: string | undefined = import.meta.env.VITE_PUBLIC_GA4_MEASUREMENT_ID): string | null {
  const value = configured?.trim();
  if (value?.toLowerCase() === 'off') return null;
  const id = value || DEFAULT_GA4_MEASUREMENT_ID;
  return /^G-[A-Z0-9]{6,12}$/.test(id) ? id : null;
}

export function isAnalyticsHost(hostname: string): boolean {
  return ANALYTICS_HOSTS.has(hostname.toLowerCase());
}

export function isTrackedPath(pathname: string): boolean {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

let loadedId: string | null = null;

/** 載入 gtag.js 並設定評估 ID；同一頁只做一次。回傳是否啟用。 */
export function initAnalytics(win: AnalyticsWindow = window, doc: Document = document): boolean {
  if (loadedId) return true;
  const id = resolveMeasurementId();
  if (!id || !isAnalyticsHost(win.location.hostname)) return false;

  win.dataLayer = win.dataLayer || [];
  // gtag 必須推入 arguments 物件，不能改成陣列
  win.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    win.dataLayer!.push(arguments);
  };
  win.gtag('js', new Date());
  win.gtag('config', id, { send_page_view: false });

  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  doc.head.appendChild(script);
  loadedId = id;
  return true;
}

export function trackPageView(pathname: string, search: string, win: AnalyticsWindow = window, doc: Document = document): void {
  if (!loadedId || !win.gtag || !isTrackedPath(pathname)) return;
  win.gtag('event', 'page_view', {
    page_location: `${win.location.origin}${pathname}${search}`,
    page_path: `${pathname}${search}`,
    page_title: doc.title,
  });
}

/** 測試用：重設載入狀態。 */
export function resetAnalyticsForTest(): void {
  loadedId = null;
}
