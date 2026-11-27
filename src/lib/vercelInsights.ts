/**
 * Vercel Web Analytics 與 Speed Insights（2026-11-28 店主要求安裝）。
 * - 只在正式網域啟用（與 GA4 相同的 ANALYTICS_HOSTS）；預覽與本機不載入。
 * - 不送管理後台、登入回跳、重設密碼頁；標記為內部流量的瀏覽器（`?ga_internal=1`）也不送。
 * - 送出前去掉查詢字串，只保留商品分類（category、collection），避免訂單編號等資料進入報表。
 * 腳本與收集端點都是同網域的 /_vercel/…，CSP 不必另外放行；middleware 直接放行這些路徑。
 * Vercel 專案（saengak-web-d2ux）要在後台開啟 Web Analytics 與 Speed Insights 才會收資料。
 */
import { INTERNAL_TRAFFIC_STORAGE_KEY, isAnalyticsHost, isTrackedPath } from './analytics';

const KEPT_QUERY_PARAMS = ['category', 'collection'];

function isInternalBrowser(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(INTERNAL_TRAFFIC_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 報表分組用的路由樣式：同類頁面合併計算（例如所有商品頁算在 /product/[id]）。 */
export function insightsRoute(pathname: string): string {
  if (/^\/product\/[^/]+$/.test(pathname)) return '/product/[id]';
  if (/^\/blog\/[^/]+$/.test(pathname)) return '/blog/[handle]';
  return pathname;
}

export function insightsEnabled(hostname: string): boolean {
  return isAnalyticsHost(hostname);
}

/** 回傳要送出的網址；不該送出時回傳 null。 */
export function redactInsightsUrl(rawUrl: string, storage: Pick<Storage, 'getItem'> | undefined): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isTrackedPath(url.pathname) || isInternalBrowser(storage)) return null;
  const kept = new URLSearchParams();
  for (const key of KEPT_QUERY_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) kept.set(key, value);
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Web Analytics 與 Speed Insights 共用的 beforeSend。 */
export function beforeSendInsights<T extends { url: string }>(event: T): T | null {
  const url = redactInsightsUrl(event.url, browserStorage());
  return url ? { ...event, url } : null;
}
