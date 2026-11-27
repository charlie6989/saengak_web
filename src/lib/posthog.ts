/**
 * PostHog（2026-11-28 店主要求安裝，設定比照 LUCISSI 母站 `LUCISSI_website` 的 src/lib/marketing-tags.ts）。
 * - 美國區（us.i.posthog.com）；專案金鑰（phc_…）是公開的寫入用金鑰。沒有有效金鑰時整個不載入。
 *   金鑰可用 VITE_PUBLIC_POSTHOG_KEY 覆寫，設成 off 可關閉。
 * - 只在正式網域載入；不送後台、登入回跳、重設密碼頁；Do Not Track、自動化瀏覽器與標記為內部流量
 *   （`?ga_internal=1`，與 GA4、Vercel 共用）的瀏覽器不載入。
 * - 送出前把本站網址的查詢字串去掉，只留商品分類（category、collection）與 UTM 參數，避免訂單編號等資料進入 PostHog。
 * - 畫面錄影預設關閉，依頁面開關：輸入框一律遮蔽、`.ph-mask` 內的文字遮蔽；
 *   登入、註冊、會員、訂單查詢等顯示或填寫個人資料的頁面不錄。
 * 隱私權政策已說明（src/pages/privacy）；CSP 放行 us.i.posthog.com 與 us-assets.i.posthog.com（vercel.json）。
 */
import type { CaptureResult, PostHog } from 'posthog-js';
import { isAnalyticsHost, isTrackedPath, resolveInternalTraffic } from './analytics';

export const POSTHOG_HOST = 'https://us.i.posthog.com';
/** LUCISSI CARE 專用的 PostHog 專案金鑰；專案建立前為空字串（不載入）。 */
export const DEFAULT_POSTHOG_KEY = '';

/** 商品分類與行銷活動參數（UTM）不含個人資料，保留供報表分析；其他查詢參數一律去掉。 */
const KEPT_QUERY_PARAMS = ['category', 'collection', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const NO_REPLAY_PREFIXES = ['/admin', '/auth', '/login', '/register', '/forgot-password', '/reset-password', '/profile', '/order-status', '/welcome'];
const AUTOMATED_AGENT = /bot\b|crawler|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|facebot|googlebot|bingbot|google-inspectiontool/i;
/** 會帶本站網址的事件屬性（含 $set_once 的首次造訪網址）。 */
const URL_PROPERTIES = ['$current_url', '$initial_current_url', '$referrer', '$initial_referrer', '$session_entry_url'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type NavigatorLike = { userAgent?: string; webdriver?: boolean; doNotTrack?: string | null };

/** PostHog 專案金鑰一律以 phc_ 開頭。 */
export function validPosthogKey(key: unknown): key is string {
  return typeof key === 'string' && /^phc_[A-Za-z0-9]{20,64}$/.test(key);
}

export function resolvePosthogKey(configured: string | undefined = import.meta.env.VITE_PUBLIC_POSTHOG_KEY): string | null {
  const value = configured?.trim();
  if (value?.toLowerCase() === 'off') return null;
  const key = value || DEFAULT_POSTHOG_KEY;
  return validPosthogKey(key) ? key : null;
}

export function sessionReplayAllowed(pathname: string): boolean {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return !NO_REPLAY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isAutomatedBrowser(nav: NavigatorLike | undefined): boolean {
  if (!nav) return false;
  return nav.webdriver === true || AUTOMATED_AGENT.test(nav.userAgent ?? '');
}

function doNotTrack(nav: NavigatorLike | undefined): boolean {
  return nav?.doNotTrack === '1';
}

/** 本站網址去掉查詢字串（只留商品分類與 UTM）；其他網站的網址不改。 */
export function redactSiteUrl(value: unknown, siteHost: string): unknown {
  if (typeof value !== 'string') return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (url.hostname !== siteHost && !isAnalyticsHost(url.hostname)) return value;
  const kept = new URLSearchParams();
  for (const key of KEPT_QUERY_PARAMS) {
    const param = url.searchParams.get(key);
    if (param !== null) kept.set(key, param);
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

function redactProperties(properties: Record<string, unknown> | undefined, siteHost: string) {
  if (!properties) return properties;
  const next = { ...properties };
  for (const key of URL_PROPERTIES) {
    if (key in next) next[key] = redactSiteUrl(next[key], siteHost);
  }
  return next;
}

/** before_send：後台等頁面不送；網址去掉查詢字串。 */
export function redactPosthogEvent(event: CaptureResult | null, siteHost: string): CaptureResult | null {
  if (!event) return null;
  const pathname = typeof event.properties?.$pathname === 'string' ? event.properties.$pathname : undefined;
  if (pathname && !isTrackedPath(pathname)) return null;
  return {
    ...event,
    properties: redactProperties(event.properties, siteHost) ?? event.properties,
    $set: redactProperties(event.$set, siteHost),
    $set_once: redactProperties(event.$set_once, siteHost),
  };
}

function safeStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** 這個瀏覽器是否該載入 PostHog（正式網域、有金鑰、不是內部流量／DNT／自動化瀏覽器）。 */
export function posthogAllowed(
  hostname: string,
  search: string,
  storage: StorageLike | undefined,
  nav: NavigatorLike | undefined,
  key: string | null = resolvePosthogKey(),
): key is string {
  if (!key || !isAnalyticsHost(hostname)) return false;
  if (resolveInternalTraffic(search, storage)) return false;
  return !doNotTrack(nav) && !isAutomatedBrowser(nav);
}

const state: { client: PostHog | null; loading: boolean; recording: boolean; path: string | null } = {
  client: null,
  loading: false,
  recording: false,
  path: null,
};

function applySessionReplay() {
  const client = state.client;
  if (!client || state.path === null) return;
  const allowed = sessionReplayAllowed(state.path);
  if (allowed === state.recording) return;
  try {
    if (allowed) client.startSessionRecording();
    else client.stopSessionRecording();
    state.recording = allowed;
  } catch {
    // 分析工具不能影響購物
  }
}

/** 換頁時呼叫：第一次在允許的瀏覽器載入 PostHog，之後依頁面開關畫面錄影。 */
export function syncPosthog(pathname: string, search: string): void {
  if (typeof window === 'undefined') return;
  state.path = pathname;
  if (state.client) {
    // 載入後才標記為內部流量（開了 ?ga_internal=1）：停止收集
    if (resolveInternalTraffic(search, safeStorage())) {
      state.client.opt_out_capturing();
      state.client.stopSessionRecording();
      state.recording = false;
      return;
    }
    applySessionReplay();
    return;
  }
  if (state.loading) return;
  const key = resolvePosthogKey();
  if (!posthogAllowed(window.location.hostname, search, safeStorage(), navigator, key)) return;
  state.loading = true;
  const siteHost = window.location.hostname;
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: POSTHOG_HOST,
        capture_pageview: 'history_change',
        person_profiles: 'identified_only',
        // 錄影不自動開始：由 applySessionReplay 依頁面開關
        disable_session_recording: true,
        session_recording: { maskAllInputs: true, maskTextSelector: '.ph-mask' },
        respect_dnt: true,
        before_send: (event) => redactPosthogEvent(event, siteHost),
      });
      state.client = posthog;
      applySessionReplay();
    })
    .catch(() => {
      // 載入失敗不影響網站
    })
    .finally(() => {
      state.loading = false;
    });
}

/** 測試用：重設狀態。 */
export function resetPosthogForTest(): void {
  state.client = null;
  state.loading = false;
  state.recording = false;
  state.path = null;
}
