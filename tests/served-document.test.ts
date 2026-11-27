import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupPageState } from '../src/lib/servedDocument';

async function loadAt(pathname: string, responseStatus?: number) {
  vi.resetModules();
  vi.stubGlobal('window', { location: { pathname } });
  vi.stubGlobal('performance', {
    getEntriesByType: (type: string) => (type === 'navigation' ? [{ responseStatus }] : []),
  });
  return import('../src/lib/servedDocument');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('served document', () => {
  it('reports the first document and its HTTP status until the route changes', async () => {
    const mod = await loadAt('/blog/period-cleansing-pad-change', 200);
    expect(mod.servedDocumentFor('/blog/period-cleansing-pad-change')).toEqual({ served: true, status: 200 });
    expect(mod.servedDocumentFor('/blog/other')).toEqual({ served: false });

    mod.noteRouteChange('/blog/period-cleansing-pad-change');
    expect(mod.servedDocumentFor('/blog/period-cleansing-pad-change').served).toBe(true);

    mod.noteRouteChange('/community');
    mod.noteRouteChange('/blog/period-cleansing-pad-change');
    expect(mod.servedDocumentFor('/blog/period-cleansing-pad-change')).toEqual({ served: false });
  });

  it('leaves the status undefined when the browser does not expose it', async () => {
    const mod = await loadAt('/blog/a', 0);
    expect(mod.servedDocumentFor('/blog/a')).toEqual({ served: true, status: undefined });
  });
});

describe('article page state', () => {
  it('never sets noindex on the server-rendered document', () => {
    // 剛上架：伺服器找到文章回 200，瀏覽器讀到的資料還沒有它
    expect(lookupPageState('not-found', { served: true, status: 200 })).toEqual({ view: 'unavailable', noindex: false });
    // 伺服器也找不到：已回 404 與 noindex，瀏覽器只顯示找不到
    expect(lookupPageState('not-found', { served: true, status: 404 })).toEqual({ view: 'not-found', noindex: false });
    expect(lookupPageState('not-found', { served: true })).toEqual({ view: 'not-found', noindex: false });
  });

  it('sets noindex only for a missing article reached by in-app navigation', () => {
    expect(lookupPageState('not-found', { served: false })).toEqual({ view: 'not-found', noindex: true });
    expect(lookupPageState('unavailable', { served: false })).toEqual({ view: 'unavailable', noindex: false });
    expect(lookupPageState('found', { served: false })).toEqual({ view: 'found', noindex: false });
    expect(lookupPageState('found', { served: true, status: 200 })).toEqual({ view: 'found', noindex: false });
  });
});
