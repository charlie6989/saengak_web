import { afterEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

async function load() {
  vi.resetModules();
  return import('../src/lib/staleChunk');
}

afterEach(() => vi.resetModules());

describe('stale chunk reload', () => {
  it('recognises dynamic import failures from Chrome, Firefox and Safari', async () => {
    const { isStaleChunkError } = await load();
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://lucissicare.com/assets/page-abc.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/index-abc.css'))).toBe(true);
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });

  it('reloads once for a stale chunk and reports later errors in the same page as already reloading', async () => {
    const { reloadForStaleChunk } = await load();
    const storage = new MemoryStorage();
    const reload = vi.fn();
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/a.js');
    expect(reloadForStaleChunk(error, { storage, reload, now: 1_000 })).toBe(true);
    expect(reloadForStaleChunk(error, { storage, reload, now: 1_100 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again right after a reload, to avoid a loop', async () => {
    const storage = new MemoryStorage();
    const reload = vi.fn();
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/a.js');
    expect((await load()).reloadForStaleChunk(error, { storage, reload, now: 1_000 })).toBe(true);
    // 重新載入後的新頁面（模組重新初始化）仍載入失敗
    expect((await load()).reloadForStaleChunk(error, { storage, reload, now: 5_000 })).toBe(false);
    expect((await load()).reloadForStaleChunk(error, { storage, reload, now: 40_000 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('ignores other errors and shows the error page when storage is unavailable', async () => {
    const { reloadForStaleChunk } = await load();
    const reload = vi.fn();
    expect(reloadForStaleChunk(new Error('boom'), { storage: new MemoryStorage(), reload })).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => undefined };
    expect(reloadForStaleChunk(new TypeError('Importing a module script failed.'), { storage: broken, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
