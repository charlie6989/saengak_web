import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRouteSeo, replaceStructuredData, setCanonical, setPageMeta } from '../src/lib/documentMeta';
import { applyProductSeo } from '../src/lib/productMeta';

/** 最小的 head 模擬：只支援 documentMeta 用到的選擇器（tag 加上 [attr] 或 [attr="value"]）。 */
class FakeElement {
  attributes = new Map<string, string>();
  textContent = '';
  parent: FakeHead | null = null;
  constructor(readonly tagName: string) {}
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  get rel() { return this.getAttribute('rel') ?? ''; }
  set rel(value: string) { this.setAttribute('rel', value); }
  get href() { return this.getAttribute('href') ?? ''; }
  set href(value: string) { this.setAttribute('href', value); }
  get type() { return this.getAttribute('type') ?? ''; }
  set type(value: string) { this.setAttribute('type', value); }
  get isConnected() { return this.parent !== null; }
  remove() { this.parent?.removeChild(this); }
}

class FakeHead {
  children: FakeElement[] = [];
  appendChild(element: FakeElement) { element.parent = this; this.children.push(element); return element; }
  removeChild(element: FakeElement) { this.children = this.children.filter((child) => child !== element); element.parent = null; }
  querySelectorAll(selector: string) {
    const [, tag, rest] = selector.match(/^(\w+)(.*)$/) ?? [];
    const conditions = [...rest.matchAll(/\[([\w:-]+)(?:="([^"]*)")?\]/g)].map(([, name, value]) => ({ name, value }));
    return this.children.filter((element) => element.tagName === tag
      && conditions.every(({ name, value }) => (value === undefined ? element.attributes.has(name) : element.getAttribute(name) === value)));
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
}

let head: FakeHead;
const fakeDocument = { title: '', head: undefined as unknown as FakeHead, createElement: (tag: string) => new FakeElement(tag), querySelector: (s: string) => head.querySelector(s) };
const meta = (key: string) => (head.querySelector(`meta[name="${key}"]`) ?? head.querySelector(`meta[property="${key}"]`))?.getAttribute('content');
const jsonLd = () => head.querySelectorAll('script[data-seo-jsonld]').map((element) => JSON.parse(element.textContent));

beforeEach(() => {
  head = new FakeHead();
  fakeDocument.head = head;
  fakeDocument.title = '';
  vi.stubGlobal('document', fakeDocument);
});
afterEach(() => vi.unstubAllGlobals());

describe('browser head updates', () => {
  it('keeps exactly one canonical link and updates it in place', () => {
    const serverLink = head.appendChild(new FakeElement('link'));
    serverLink.rel = 'canonical';
    serverLink.href = 'https://lucissicare.com/product/1';
    const duplicate = head.appendChild(new FakeElement('link'));
    duplicate.rel = 'canonical';

    setCanonical('https://lucissicare.com/faq');
    setCanonical('https://lucissicare.com/about');

    const links = head.querySelectorAll('link[rel="canonical"]');
    expect(links).toHaveLength(1);
    expect(links[0]).toBe(serverLink);
    expect(links[0].href).toBe('https://lucissicare.com/about');
  });

  it('applies the shared route table on navigation, including description and robots', () => {
    applyRouteSeo('/products', '?q=凝膠');
    expect(fakeDocument.title).toBe('搜尋: 凝膠｜LUCISSI CARE');
    expect(meta('robots')).toBe('noindex,follow');
    expect(head.querySelector('link[rel="canonical"]')?.href).toBe('https://lucissicare.com/products');

    applyRouteSeo('/faq', '');
    expect(fakeDocument.title).toBe('常見問題｜LUCISSI CARE');
    expect(meta('description')).toContain('常見問題');
    expect(meta('og:description')).toBe(meta('description'));
    expect(meta('og:url')).toBe('https://lucissicare.com/faq');
    expect(meta('robots')).toBe('index,follow');
    expect(head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });

  it('adds the store identity on the home page and clears page data on later navigation', () => {
    applyRouteSeo('/', '');
    expect(jsonLd().map((item) => item['@type'])).toEqual(['Organization', 'WebSite']);
    applyRouteSeo('/faq', '');
    expect(jsonLd()).toEqual([]);
  });

  it('keeps the server structured data on the first render of a product page', () => {
    replaceStructuredData([{ '@type': 'Product', name: 'server' }]);
    applyRouteSeo('/product/1', '', { initial: true });
    expect(jsonLd()).toEqual([{ '@type': 'Product', name: 'server' }]);
  });

  it('replaces product data with the same shape the server renders and removes it on leave', () => {
    replaceStructuredData([{ '@type': 'Product', name: 'server' }]);
    const remove = applyProductSeo({
      id: 'gid://shopify/Product/7819900551235',
      name: '冰絲無痕中腰三角褲',
      description: '涼感冰絲布料。',
      price: 680,
      productType: '舒適內搭',
      variants: [{ sku: 'BRIEF-M', price: 680, availableForSale: true }],
    });
    expect(fakeDocument.title).toBe('冰絲無痕中腰三角褲｜LUCISSI CARE');
    expect(head.querySelector('link[rel="canonical"]')?.href).toBe('https://lucissicare.com/product/7819900551235');
    expect(jsonLd().map((item) => item['@type'])).toEqual(['Product', 'BreadcrumbList']);
    remove();
    expect(jsonLd()).toEqual([]);
  });

  it('leaves fields it was not given untouched', () => {
    setPageMeta({ title: 'A｜LUCISSI CARE', description: '說明' });
    setPageMeta({ robots: 'noindex,nofollow' });
    expect(fakeDocument.title).toBe('A｜LUCISSI CARE');
    expect(meta('description')).toBe('說明');
    expect(meta('robots')).toBe('noindex,nofollow');
  });
});
