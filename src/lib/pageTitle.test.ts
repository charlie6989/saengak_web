import { describe, expect, it } from 'vitest';
import { SITE_TITLE, formatPageTitle, titleForPath } from './pageTitle';

describe('page titles', () => {
  it('gives each route its own tab title', () => {
    expect(titleForPath('/')).toBe(SITE_TITLE);
    expect(titleForPath('/products')).toBe('全部商品｜LUCISSI CARE');
    expect(titleForPath('/product/7812559405123')).toBe('商品｜LUCISSI CARE');
    expect(titleForPath('/customer-service')).toBe('客服中心｜LUCISSI CARE');
    expect(titleForPath('/no-such-page')).toBe('找不到頁面｜LUCISSI CARE');
  });

  it('formats dynamic titles with the brand suffix', () => {
    expect(formatPageTitle('涼感冰絲無痕內褲')).toBe('涼感冰絲無痕內褲｜LUCISSI CARE');
    expect(formatPageTitle()).toBe(SITE_TITLE);
  });
});
