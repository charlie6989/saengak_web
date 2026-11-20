import { INDEX_ROBOTS, NOINDEX_ROBOTS, SITE_TITLE, formatPageTitle, productListingTitle, seoForLocation } from './seo';

/**
 * 分頁標題與 robots 的舊入口；規則集中在 src/lib/seo.ts 的路由表（伺服器與瀏覽器共用）。
 * 動態頁（商品、搜尋、文章）在資料載入後另外覆寫標題。
 */
export { SITE_TITLE, NOINDEX_ROBOTS, formatPageTitle, productListingTitle };
export const DEFAULT_ROBOTS = INDEX_ROBOTS;

export function robotsForPath(pathname: string, search = ''): string {
  return seoForLocation(pathname, search).robots;
}

export function titleForPath(pathname: string, search = ''): string {
  return seoForLocation(pathname, search).title;
}
