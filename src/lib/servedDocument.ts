/**
 * 伺服器送出的第一份 HTML 已經由 middleware 判斷過網址（找不到的文章或商品回 404 與 noindex）。
 * 瀏覽器端之後讀到的 Shopify 資料可能較舊或讀取失敗，例如剛上架的文章還沒出現在回應裡；
 * 這時不能用瀏覽器端的結果推翻伺服器的判斷，否則搜尋引擎轉譯時會看到 noindex。
 */

export interface ServedDocument {
  /** 目前網址仍是伺服器送出的那一份文件（還沒有站內換頁） */
  served: boolean;
  /** 那份文件的 HTTP 狀態碼；瀏覽器不支援 responseStatus 時為 undefined */
  status?: number;
}

let servedPathname: string | undefined = typeof window === 'undefined' ? undefined : window.location.pathname;

/** 換頁時呼叫：離開第一份文件的網址後，之後的頁面都是瀏覽器端產生的。 */
export function noteRouteChange(pathname: string) {
  if (servedPathname !== undefined && pathname !== servedPathname) servedPathname = undefined;
}

function navigationStatus(): number | undefined {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return undefined;
  const [entry] = performance.getEntriesByType('navigation') as (PerformanceEntry & { responseStatus?: number })[];
  const status = entry?.responseStatus;
  return typeof status === 'number' && status > 0 ? status : undefined;
}

export function servedDocumentFor(pathname: string): ServedDocument {
  if (servedPathname === undefined || pathname !== servedPathname) return { served: false };
  return { served: true, status: navigationStatus() };
}

export type LookupStatus = 'found' | 'not-found' | 'unavailable';

export interface LookupPageState {
  /** 畫面要顯示的狀態 */
  view: LookupStatus;
  /** 是否由瀏覽器端把 robots 改成 noindex */
  noindex: boolean;
}

/**
 * 文章頁與商品頁依 Shopify 查詢結果與伺服器的判斷決定畫面與 robots：
 * - 第一份文件：robots 一律維持伺服器寫好的值；伺服器回 200 而瀏覽器找不到時，當成暫時讀不到。
 * - 站內換頁：確定找不到才設 noindex（與伺服器的 404 規則相同）。
 */
export function lookupPageState(lookup: LookupStatus, document: ServedDocument): LookupPageState {
  if (lookup !== 'not-found') return { view: lookup, noindex: false };
  if (!document.served) return { view: 'not-found', noindex: true };
  return { view: document.status === 200 ? 'unavailable' : 'not-found', noindex: false };
}
