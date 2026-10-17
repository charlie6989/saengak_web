import { describe, expect, it } from 'vitest';
import { NOINDEX_ROBOTS, SITE_TITLE, formatPageTitle, robotsForPath, titleForPath } from './pageTitle';

describe('page titles', () => {
  it('gives each route its own tab title', () => {
    expect(titleForPath('/')).toBe(SITE_TITLE);
    expect(titleForPath('/products')).toBe('全部商品｜LUCISSI CARE');
    expect(titleForPath('/product/7812559405123')).toBe('商品｜LUCISSI CARE');
    expect(titleForPath('/customer-service')).toBe('客服中心｜LUCISSI CARE');
    expect(titleForPath('/welcome')).toBe('歡迎加入｜LUCISSI CARE');
    expect(titleForPath('/auth/confirm')).toBe('登入驗證｜LUCISSI CARE');
    expect(titleForPath('/no-such-page')).toBe('找不到頁面｜LUCISSI CARE');
  });

  it('keeps login-flow pages out of search indexes', () => {
    expect(robotsForPath('/welcome')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/auth/confirm')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/products')).toBe('index, follow');
  });

  it('formats dynamic titles with the brand suffix', () => {
    expect(formatPageTitle('涼感冰絲無痕內褲')).toBe('涼感冰絲無痕內褲｜LUCISSI CARE');
    expect(formatPageTitle()).toBe(SITE_TITLE);
  });
});
