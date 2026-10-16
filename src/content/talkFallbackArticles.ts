/** Shopify 文章讀取失敗或尚無文章時，首頁與面向頁共用的 LUCISSI Talk 備援文章。 */
export interface TalkArticlePreview {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  tags: string[];
  publishedAt: string;
  image: { url: string; altText: string };
}

export const TALK_FALLBACK_ARTICLES: TalkArticlePreview[] = [
  {
    id: 'fallback-article-1',
    handle: 'daily-feminine-care-guide',
    title: '日常私密護理：先理解身體，再選擇產品',
    excerpt: '從溫和清潔、生活習慣到何時應尋求專業協助，建立可長期執行的溫和照護原則。',
    contentHtml: '',
    tags: ['健康知識', '私密護理'],
    publishedAt: '2026-09-01T10:37:30Z',
    image: { url: '/images/lucissi-v5/thumb-care.webp', altText: '日常私密護理指南' }
  },
  {
    id: 'fallback-article-2',
    handle: 'how-to-choose-seamless-underwear',
    title: '貼身衣物材質怎麼選？透氣、摩擦與清潔頻率的日常指南',
    excerpt: '用透氣度、摩擦感與清潔頻率三個面向，整理日常挑選貼身衣物的實用重點。',
    contentHtml: '',
    tags: ['生活美學', '選購指南'],
    publishedAt: '2026-09-01T10:37:33Z',
    image: { url: '/images/lucissi-v5/thumb-wear.webp', altText: '貼身衣物材質指南' }
  },
  {
    id: 'fallback-article-3',
    handle: 'how-we-review-products-and-content',
    title: '我們如何整理產品與內容：LUCISSI CARE 編輯團隊的透明度承諾',
    excerpt: '所有產品資訊堅持來源透明與成分公開；沒有即時評價時，就以編輯精選清楚標示。',
    contentHtml: '',
    tags: ['品牌方法', '透明原則'],
    publishedAt: '2026-09-01T10:37:36Z',
    image: { url: '/images/lucissi-v5/thumb-standards.webp', altText: 'LUCISSI CARE 品牌編輯標準' }
  },
];
