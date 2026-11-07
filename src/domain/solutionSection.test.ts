import { describe, expect, it } from 'vitest';
import { isBundleProduct, selectSolutionView } from './solutionSection';

const item = (name: string, availableForSale: boolean) => ({ name, availableForSale, variants: [{ availableForSale }] });
const names = (products: { name: string }[]) => products.map((product) => product.name);

describe('selectSolutionView', () => {
  it('drops sold-out products and the bundle heading when every bundle is sold out', () => {
    const view = selectSolutionView([item('舒緩組', false), item('修護組', false), item('濕巾', true), item('噴霧', false)], 'bundles');
    expect(names(view.displayed)).toEqual(['濕巾']);
    expect(view.heading).toBe('日常私密護理');
    expect(view.label).toBe('🌿 日常基礎護理單品');
    expect(view.showTabs).toBe(false);
  });

  it('returns to the bundle view once a bundle is back in stock', () => {
    const items = [item('舒緩組', true), item('修護組', false), item('濕巾', true)];
    const view = selectSolutionView(items, 'bundles');
    expect(view.heading).toBe('超值組合');
    expect(view.showTabs).toBe(true);
    expect(names(view.displayed)).toEqual(['舒緩組']);
    expect(names(selectSolutionView(items, 'singles').displayed)).toEqual(['濕巾']);
    expect(names(selectSolutionView(items, 'all').displayed)).toEqual(['舒緩組', '濕巾']);
  });

  it('keeps the bundle heading without tabs when only bundles are in stock', () => {
    const view = selectSolutionView([item('舒緩組', true), item('濕巾', false)], 'singles');
    expect(view.heading).toBe('超值組合');
    expect(view.showTabs).toBe(false);
    expect(names(view.displayed)).toEqual(['舒緩組']);
    expect(view.label).toBe('✨ 官方推薦特惠組合');
  });

  it('is empty when nothing is in stock', () => {
    expect(selectSolutionView([item('舒緩組', false), item('濕巾', false)], 'bundles').products).toEqual([]);
  });

  it('treats a sold-out variant set as sold out', () => {
    const view = selectSolutionView([{ name: '濕巾', variants: [{ availableForSale: false }] }], 'all');
    expect(view.products).toEqual([]);
  });

  it('recognises bundles by title or tag', () => {
    expect(isBundleProduct({ name: '舒緩組' })).toBe(true);
    expect(isBundleProduct({ name: '濕巾', tags: ['超值組合'] })).toBe(true);
    expect(isBundleProduct({ name: '濕巾' })).toBe(false);
  });
});
