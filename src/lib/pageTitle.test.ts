import { describe, expect, it } from 'vitest';
import { NOINDEX_ROBOTS, SITE_TITLE, formatPageTitle, robotsForPath, titleForPath } from './pageTitle';

describe('page titles', () => {
  it('gives each route its own tab title', () => {
    expect(titleForPath('/')).toBe(SITE_TITLE);
    expect(titleForPath('/products')).toBe('全部商品｜私密處清潔保養、女生內褲與生理褲｜LUCISSI CARE');
    expect(titleForPath('/product/7812559405123')).toBe('商品｜LUCISSI CARE');
    expect(titleForPath('/customer-service')).toBe('客服中心｜訂單、配送與退換貨問題聯絡方式｜LUCISSI CARE');
    expect(titleForPath('/welcome')).toBe('歡迎｜LUCISSI CARE');
    expect(titleForPath('/auth/confirm')).toBe('登入驗證｜LUCISSI CARE');
    expect(titleForPath('/no-such-page')).toBe('找不到頁面｜LUCISSI CARE');
  });

  it('keeps login-flow pages out of search indexes', () => {
    expect(robotsForPath('/welcome')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/auth/confirm')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/admin')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/admin/orders')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/reset-password')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/forgot-password')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/profile')).toBe(NOINDEX_ROBOTS);
    expect(robotsForPath('/products')).toBe('index,follow');
  });

  it('formats dynamic titles with the brand suffix', () => {
    expect(formatPageTitle('涼感冰絲無痕內褲')).toBe('涼感冰絲無痕內褲｜LUCISSI CARE');
    expect(formatPageTitle()).toBe(SITE_TITLE);
  });

  it('drops brand suffixes that Shopify SEO titles already carry', () => {
    expect(formatPageTitle('私密處越洗越不舒服？外陰清潔原則｜LUCISSI CARE')).toBe('私密處越洗越不舒服？外陰清潔原則｜LUCISSI CARE');
    expect(formatPageTitle('白帶正常嗎？就醫時機｜LUCISSI Talk')).toBe('白帶正常嗎？就醫時機｜LUCISSI CARE');
    expect(formatPageTitle('白帶正常嗎 | LUCISSI Talk ｜ LUCISSI CARE ')).toBe('白帶正常嗎｜LUCISSI CARE');
    // 品牌名稱在標題中間或開頭時保留
    expect(formatPageTitle('LUCISSI Talk 私密對話')).toBe('LUCISSI Talk 私密對話｜LUCISSI CARE');
    expect(formatPageTitle('｜LUCISSI CARE')).toBe(SITE_TITLE);
  });
});
