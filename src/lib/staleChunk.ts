/**
 * 每次部署後，前一版的 JS 分塊（/assets/*.js）會回 404。部署前就開著的分頁，
 * 換頁時載入不到新頁面的程式，原本會停在「頁面載入發生異常」。
 * 這類錯誤改為自動重新載入一次，拿到新版網站；短時間內重複發生就不再重載，避免無限循環。
 */

const RELOAD_KEY = 'lucissi:stale-chunk-reload-at';
const RELOAD_GUARD_MS = 30_000;

// Chrome／Edge、Firefox、Safari 的動態 import 失敗訊息，以及 Vite 預載 CSS 失敗
const STALE_CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Failed to load module script/i;

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return STALE_CHUNK_PATTERN.test(message);
}

interface ReloadOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  reload?: () => void;
  now?: number;
}

let reloadStarted = false;

/**
 * 是部署後的舊分塊錯誤且最近沒有重載過時，重新載入頁面並回傳 true。
 * 同一頁已經開始重載時也回傳 true（vite:preloadError 與 Error Boundary 可能各收到一次）。
 */
export function reloadForStaleChunk(error: unknown, options: ReloadOptions = {}): boolean {
  if (!isStaleChunkError(error)) return false;
  if (reloadStarted) return true;
  const now = options.now ?? Date.now();
  try {
    const storage = options.storage ?? window.sessionStorage;
    const last = Number(storage.getItem(RELOAD_KEY));
    if (last && now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    // 無法記錄就無法防止循環，改為顯示錯誤頁
    return false;
  }
  reloadStarted = true;
  (options.reload ?? (() => window.location.reload()))();
  return true;
}
