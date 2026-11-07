import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// 伺服器端渲染不會執行 effect；這裡讓 useEffect 立即執行，才能驗證 NotFound 寫入 noindex。
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useEffect: (effect: () => void) => effect() };
});
vi.mock('../src/components/feature/Header', () => ({ default: () => null }));
vi.mock('../src/components/feature/Footer', () => ({ default: () => null }));

import NotFound from '../src/pages/NotFound';
import { LUCISSI_PUBLIC_URL } from '../src/content/carePillars';

afterEach(() => vi.unstubAllGlobals());

describe('404 page', () => {
  function render() {
    const setAttribute = vi.fn();
    vi.stubGlobal('document', { querySelector: () => ({ setAttribute }) });
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <NotFound />
      </MemoryRouter>,
    );
    return { html, setAttribute };
  }

  it('is written in Traditional Chinese with no leftover builder text', () => {
    const { html } = render();
    expect(html).toContain('找不到這個頁面');
    expect(html).not.toContain('has not been generated');
    expect(html).not.toContain('Tell me what');
  });

  it('offers navigation back into the store', () => {
    const { html } = render();
    for (const href of ['href="/"', 'href="/products"', 'href="/promotion"', 'href="/faq"', 'href="/customer-service"']) {
      expect(html).toContain(href);
    }
  });

  it('marks the page noindex', () => {
    expect(render().setAttribute).toHaveBeenCalledWith('content', 'noindex, nofollow');
  });
});

const source = (path: string) => readFileSync(path, 'utf8');

describe('parent site link', () => {
  it('stays hidden while lucissi.com is not public', () => {
    expect(LUCISSI_PUBLIC_URL).toBeNull();
  });

  it('goes through the one constant everywhere it is rendered', () => {
    for (const path of [
      'src/components/feature/Footer.tsx',
      'src/components/feature/LucissiMemberPerkCard.tsx',
      'src/pages/home/components/FromLucissiSection.tsx',
    ]) {
      const code = source(path);
      expect(code).toContain('{LUCISSI_PUBLIC_URL && (');
      expect(code).not.toContain('https://lucissi.com');
    }
  });
});

describe('customer-facing copy', () => {
  it('does not read as a draft on the privacy, terms or FAQ pages', () => {
    const copy = ['src/pages/privacy/page.tsx', 'src/pages/terms/page.tsx', 'src/pages/faq/page.tsx'].map(source).join('\n');
    for (const draftPhrase of ['發布前審閱中', '正式客服管道公告後', '規劃使用', '啟用後，', '正式結帳已啟用', '客服狀態']) {
      expect(copy).not.toContain(draftPhrase);
    }
  });

  it('keeps the owner review marker until legal wording is approved', () => {
    expect(source('src/pages/privacy/page.tsx')).toContain('OWNER-REVIEW');
    expect(source('src/pages/terms/page.tsx')).toContain('OWNER-REVIEW');
  });

  it('does not contradict an open-ended promotion with a time-limited label', () => {
    const page = source('src/pages/promotion/page.tsx');
    expect(page).not.toContain('長期有效');
    expect(page).not.toContain('限時');
  });
});

describe('browser logging', () => {
  it('does not log the signed-in email', () => {
    const header = source('src/components/feature/Header.tsx');
    expect(header).not.toContain('console.log');
    expect(header).not.toContain('user?.email ||');
  });
});
