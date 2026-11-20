import { findCarePillarByName, resolveCategoryName } from '../content/carePillars.js';

/**
 * 全站路由的 SEO 表：標題、說明、robots 與 canonical。
 * 伺服器（middleware.ts 產生第一份 HTML 的 head）與瀏覽器（ScrollToTop 換頁時更新）共用這一份，
 * 所以兩邊的結果必須一致；新增路由時要在這裡登記，否則伺服器會以 404 回應。
 * middleware 直接載入本檔，import 一律寫 .js 副檔名，且只能引用同樣規則的模組。
 */

export const SITE_URL = 'https://lucissicare.com';
export const SITE_NAME = 'LUCISSI CARE';
/** 首頁標題：依 docs/seo/2026-11-keyword-research.md 改用搜尋者的說法（2026-11-20 店主核可）。 */
export const SITE_TITLE = 'LUCISSI CARE｜私密處清潔保養・無痕內褲・生理褲';
export const SITE_DESCRIPTION = 'LUCISSI CARE 是 LUCISSI 的日常照護系列：私密保養、舒適內搭與生理期照護，照顧貼近身體的每一天。';
export const DEFAULT_SHARE_IMAGE = { url: `${SITE_URL}/images/brand/og-image.png`, width: 1200, height: 630, alt: SITE_NAME };
/** Organization 的標誌：搜尋引擎要求點陣圖（至少 112×112）。 */
export const SITE_LOGO_URL = `${SITE_URL}/apple-touch-icon.png`;

export const INDEX_ROBOTS = 'index,follow';
export const NOINDEX_FOLLOW_ROBOTS = 'noindex,follow';
export const NOINDEX_ROBOTS = 'noindex,nofollow';
export type RobotsDirective = typeof INDEX_ROBOTS | typeof NOINDEX_FOLLOW_ROBOTS | typeof NOINDEX_ROBOTS;

const DESCRIPTION_MAX = 120;

export type RoutePage =
  | 'home'
  | 'products'
  | 'product'
  | 'articles'
  | 'article'
  | 'static'
  | 'private'
  | 'redirect'
  | 'not-found';

export interface RouteSeo {
  page: RoutePage;
  /** 完整的分頁標題（已加上品牌後綴）。 */
  title: string;
  /** 頁面主標題（不含品牌後綴），供伺服器的爬蟲備援內容使用。 */
  heading: string;
  description: string;
  canonicalPath: string;
  robots: RobotsDirective;
  type: 'website' | 'product' | 'article';
  /** 路由會顯示找不到頁面；伺服器以 HTTP 404 回應。 */
  notFound?: boolean;
  /** 只會轉址的舊網址（vercel.json 與 middleware 都以 308 轉到這裡，保留原查詢字串）。 */
  redirectTo?: string;
  /** /product/<數字 ID> */
  productId?: string;
  /** /product/<handle>：伺服器查到商品後轉到數字 ID 網址。 */
  productHandle?: string;
  /** /blog/<handle> */
  articleHandle?: string;
  /** /products?category= 的照護入口名稱（已把舊分類名稱轉成目前名稱）。 */
  category?: string;
}

/** Shopify 的 SEO 標題有時已自帶品牌後綴（｜LUCISSI CARE、｜LUCISSI Talk），網站會再加站名，所以先去掉。 */
const BRAND_TITLE_SUFFIX = /(?:\s*[｜|]\s*LUCISSI\s+(?:CARE|Talk))+\s*$/i;

export function formatPageTitle(title?: string): string {
  const base = title?.replace(BRAND_TITLE_SUFFIX, '').trim();
  return base ? `${base}｜${SITE_NAME}` : SITE_TITLE;
}

export function summarizeText(text: string | undefined | null, max = DESCRIPTION_MAX): string {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

type StaticCopy = { heading: string; description: string; /** 分頁標題與 heading 不同時使用（不含品牌後綴）。 */ seoTitle?: string };

/** 可被收錄的固定頁面。說明文字是顧客會在搜尋結果看到的內容，不提內部服務。 */
const STATIC_PAGES: Record<string, StaticCopy> = {
  '/best-rated': {
    heading: '精選商品',
    description: 'LUCISSI CARE 編輯精選：從私密保養、舒適內搭到生理期照護，整理值得先認識的日常照護用品。',
  },
  '/promotion': {
    heading: '優惠活動',
    description: '查看 LUCISSI CARE 目前進行中的優惠活動與使用方式，實際折扣以結帳頁顯示為準。',
  },
  '/about': {
    heading: '關於我們',
    description: '認識 LUCISSI CARE：LUCISSI 的日常照護系列，以私密保養、舒適內搭與生理期照護，陪伴貼近身體的每一天。',
  },
  '/faq': {
    heading: '常見問題',
    description: '整理 LUCISSI CARE 訂購、付款、配送、退換貨與會員的常見問題與解答。',
  },
  '/customer-service': {
    heading: '客服中心',
    description: '聯絡 LUCISSI CARE 客服：訂單、配送、退換貨與商品使用問題的協助方式。',
  },
  '/return-policy': {
    heading: '退換貨說明',
    description: '查看 LUCISSI CARE 的退換貨條件與申請方式，以及密封個人衛生用品的例外說明。',
  },
  '/privacy': {
    heading: '隱私權政策',
    description: '說明 LUCISSI CARE 如何蒐集、使用與保護您的個人資料，以及您可以行使的權利。',
  },
  '/terms': {
    heading: '條款和協議',
    description: '查看 LUCISSI CARE 網站使用與線上購物的條款和協議。',
  },
  '/adchoices': {
    heading: '廣告與追蹤偏好',
    description: '說明 LUCISSI CARE 使用的 Cookie 與類似技術，以及如何調整廣告與追蹤偏好。',
  },
  '/sitemap': {
    heading: '網站地圖',
    description: '瀏覽 LUCISSI CARE 網站地圖，快速找到商品分類、文章、客戶服務與政策頁面。',
  },
};

const PRODUCTS_COPY: StaticCopy = {
  heading: '全部商品',
  seoTitle: '全部商品｜私密處清潔保養、女生內褲與生理褲',
  description: '瀏覽 LUCISSI CARE 全部商品：私密保養、舒適內搭與生理期照護，依分類挑選適合自己的日常用品。',
};

const ARTICLES_COPY: StaticCopy = {
  heading: 'LUCISSI Talk 私密對話',
  // 「｜LUCISSI Talk」放在結尾會被 formatPageTitle 當成品牌後綴去掉，所以放在開頭
  seoTitle: 'LUCISSI Talk｜私密處保養與女性健康知識',
  description: '閱讀 LUCISSI Talk：私密保養、貼身衣物與生理期日常的照護文章，由 LUCISSI CARE 編輯團隊整理。',
};

const PRODUCT_COPY: StaticCopy = {
  heading: '商品',
  description: '查看 LUCISSI CARE 商品的圖片、規格、價格與購買資訊。',
};

/** 會員、登入流程、訂單查詢與管理後台：真實頁面，但不收錄也不追蹤連結。 */
const PRIVATE_PAGES: Record<string, string> = {
  '/login': '會員登入',
  '/register': '加入會員',
  '/profile': '會員中心',
  '/welcome': '歡迎',
  '/forgot-password': '重設密碼',
  '/reset-password': '重設密碼',
  '/auth/confirm': '登入驗證',
  '/auth/callback': '登入驗證',
  '/auth/v1/callback': '登入驗證',
  '/order-status': '訂單查詢',
};

/** 只會轉址的舊網址，與 vercel.json 的 redirects 一致。 */
export const REDIRECT_PATHS: Record<string, string> = {
  '/search': '/products',
  '/product': '/products',
  '/blog': '/community',
  '/brand-story': '/about',
  '/terms-of-service': '/terms',
};

/** 帶這些查詢參數的商品列表是站內搜尋結果：不收錄，但追蹤其中的商品連結。值為 all 代表全部商品。 */
const SEARCH_PARAMS = ['q', 'query', 'keyword', 'search'];

export const PRODUCT_ID_PATTERN = /^\d{1,20}$/;
export const ARTICLE_HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const PRODUCT_GID_PATH = /^gid:\/*shopify\/Product\/(\d{1,20})$/i;
const PRODUCT_HANDLE = /^[^/\s]{1,255}$/;

/** 與 React Router 相同不分大小寫；合併多餘斜線並去掉結尾斜線。商品路徑後段保留原樣。 */
function normalizePath(pathname: string): { path: string; productRest?: string } {
  const segments = (pathname || '/').split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() === 'product' && segments.length > 1) {
    return { path: `/product/${segments.slice(1).join('/')}`, productRest: segments.slice(1).join('/') };
  }
  return { path: `/${segments.join('/')}`.toLowerCase() };
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const page = (
  pageKind: RoutePage,
  heading: string,
  description: string,
  canonicalPath: string,
  robots: RobotsDirective,
  extra: Partial<RouteSeo> = {},
): RouteSeo => ({
  page: pageKind,
  title: formatPageTitle(heading),
  heading,
  description,
  canonicalPath,
  robots,
  type: 'website',
  ...extra,
});

function notFoundRoute(path: string, heading = '找不到頁面'): RouteSeo {
  return page('not-found', heading, '此頁面不存在或已移動，請回到 LUCISSI CARE 首頁或全部商品繼續瀏覽。', path, NOINDEX_ROBOTS, {
    notFound: true,
  });
}

/**
 * 商品列表的分頁標題，伺服器路由表與瀏覽器的商品列表頁共用。
 * 照護入口用 seoTitle，全部商品用 PRODUCTS_COPY.seoTitle；標籤、其他分類與搜尋沿用頁面標題。
 */
export function productListingTitle({ category = '', tag = '', query = '' }: { category?: string; tag?: string; query?: string }): string {
  if (tag) return formatPageTitle(`標籤: ${tag}`);
  const pillar = findCarePillarByName(category);
  if (pillar) return formatPageTitle(pillar.seoTitle);
  const categoryName = resolveCategoryName(category);
  if (categoryName) return formatPageTitle(categoryName);
  if (query) return formatPageTitle(`搜尋: ${query}`);
  return formatPageTitle(PRODUCTS_COPY.seoTitle);
}

function productsRoute(search: string): RouteSeo {
  const params = new URLSearchParams(search);
  const rawCategory = (params.get('category') || '').trim();
  const category = rawCategory.toLowerCase() === 'all' ? '' : rawCategory;
  const collection = (params.get('collection') || '').trim();
  const query = SEARCH_PARAMS.map((name) => (params.get(name) || '').trim()).find(Boolean) || '';
  const searchTerm = query.toLowerCase() === 'all' ? '' : query;
  const tag = (params.get('tag') || '').trim();

  const canonicalParams = new URLSearchParams();
  if (category) canonicalParams.set('category', category);
  if (collection) canonicalParams.set('collection', collection);
  const canonicalQuery = canonicalParams.toString();
  const canonicalPath = `/products${canonicalQuery ? `?${canonicalQuery}` : ''}`;

  // 標題與搜尋頁一致：標籤 → 分類 → 搜尋字詞 → 全部商品（collection 的名稱由瀏覽器載入後覆寫）
  const categoryName = resolveCategoryName(category);
  const pillar = findCarePillarByName(category);
  const heading = tag ? `標籤: ${tag}` : categoryName || (searchTerm ? `搜尋: ${searchTerm}` : PRODUCTS_COPY.heading);
  const description = pillar ? pillar.description : PRODUCTS_COPY.description;
  return page('products', heading, description, canonicalPath, searchTerm || tag ? NOINDEX_FOLLOW_ROBOTS : INDEX_ROBOTS, {
    title: productListingTitle({ category, tag, query: searchTerm }),
    ...(pillar ? { category: pillar.name } : {}),
  });
}

/** 依網址決定這一頁的 head。search 是 location.search（可含或不含開頭的 ?）。 */
export function seoForLocation(pathname: string, search = ''): RouteSeo {
  const { path, productRest } = normalizePath(pathname);

  if (path === '/') {
    return { ...page('home', SITE_NAME, SITE_DESCRIPTION, '/', INDEX_ROBOTS), title: SITE_TITLE };
  }
  if (path === '/products') return productsRoute(search);

  const redirectTo = REDIRECT_PATHS[path];
  if (redirectTo) {
    const target = redirectTo === '/products' ? productsRoute(search) : seoForLocation(redirectTo);
    return { ...target, page: 'redirect', robots: NOINDEX_FOLLOW_ROBOTS, redirectTo };
  }

  if (productRest !== undefined) {
    const gid = productRest.match(PRODUCT_GID_PATH)?.[1];
    if (PRODUCT_ID_PATTERN.test(productRest) || gid) {
      const productId = gid || productRest;
      return {
        ...page('product', PRODUCT_COPY.heading, PRODUCT_COPY.description, `/product/${productId}`, INDEX_ROBOTS),
        type: 'product',
        productId,
      };
    }
    const handle = decodeSegment(productRest);
    if (PRODUCT_HANDLE.test(handle)) {
      // 商品頁也接受 handle；伺服器查到後轉到數字 ID 網址，所以這個網址本身不收錄
      return {
        ...page('product', PRODUCT_COPY.heading, PRODUCT_COPY.description, `/product/${productRest}`, NOINDEX_FOLLOW_ROBOTS),
        type: 'product',
        productHandle: handle,
      };
    }
    return notFoundRoute(path, '找不到商品');
  }

  if (path === '/community') {
    return page('articles', ARTICLES_COPY.heading, ARTICLES_COPY.description, '/community', INDEX_ROBOTS, {
      title: formatPageTitle(ARTICLES_COPY.seoTitle),
    });
  }
  const blogHandle = path.match(/^\/blog\/([^/]+)$/)?.[1];
  if (blogHandle !== undefined) {
    if (!ARTICLE_HANDLE_PATTERN.test(blogHandle)) return notFoundRoute(path, '找不到文章');
    return {
      ...page('article', ARTICLES_COPY.heading, ARTICLES_COPY.description, `/blog/${blogHandle}`, INDEX_ROBOTS),
      type: 'article',
      articleHandle: blogHandle,
    };
  }

  const staticCopy = STATIC_PAGES[path];
  if (staticCopy) return page('static', staticCopy.heading, staticCopy.description, path, INDEX_ROBOTS);

  const privateTitle = PRIVATE_PAGES[path] ?? (path === '/admin' || path.startsWith('/admin/') ? '管理後台' : undefined);
  if (privateTitle) return page('private', privateTitle, SITE_DESCRIPTION, path, NOINDEX_ROBOTS);

  return notFoundRoute(path);
}

export function canonicalUrlFor(route: Pick<RouteSeo, 'canonicalPath'>): string {
  return absoluteUrl(route.canonicalPath);
}
