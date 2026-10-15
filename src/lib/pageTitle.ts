export const SITE_TITLE = 'LUCISSI CARE 質感生活選品';

// 固定頁面的分頁標題；動態頁（商品、搜尋、文章）在資料載入後另外覆寫
const ROUTE_TITLES: Array<[RegExp, string]> = [
  [/^\/$/, ''],
  [/^\/(products|search)$/, '全部商品'],
  [/^\/product(\/|$)/, '商品'],
  [/^\/(about|brand-story)$/, '關於我們'],
  [/^\/(blog|community)(\/|$)/, 'LUCISSI Talk 私密對話'],
  [/^\/promotion$/, '優惠活動'],
  [/^\/best-rated$/, '精選商品'],
  [/^\/faq$/, '常見問題'],
  [/^\/customer-service$/, '客服中心'],
  [/^\/order-status$/, '訂單查詢'],
  [/^\/return-policy$/, '退換貨說明'],
  [/^\/privacy$/, '隱私權政策'],
  [/^\/(terms|terms-of-service)$/, '條款和協議'],
  [/^\/adchoices$/, '廣告與追蹤偏好'],
  [/^\/sitemap$/, '網站地圖'],
  [/^\/login$/, '會員登入'],
  [/^\/register$/, '加入會員'],
  [/^\/(forgot-password|reset-password)$/, '重設密碼'],
  [/^\/profile$/, '會員中心'],
  [/^\/admin(\/|$)/, '管理後台'],
];

export function formatPageTitle(title?: string): string {
  return title ? `${title}｜LUCISSI CARE` : SITE_TITLE;
}

export function titleForPath(pathname: string): string {
  const match = ROUTE_TITLES.find(([pattern]) => pattern.test(pathname));
  return formatPageTitle(match ? match[1] : '找不到頁面');
}
