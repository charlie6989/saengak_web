import EditorialHero from '../../components/feature/EditorialHero';
import { editorialImage } from '../../content/editorialImages';
import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { buildShopifyArticleUrl } from '../../lib/shopifyNavigation';
import { getShopifyArticles } from '../../lib/shopify';
import { estimateReadingMinutes } from '../../domain/algorithms';

interface CommunityArticle {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  image: string;
  tags: string[];
  handle?: string;
  blogHandle?: string;
  url?: string | null;
}

const editorialFallbackImage = '/images/lucissi-v5/thumb-standards.webp';

const localArticles: CommunityArticle[] = [
  {
    id: 'fallback-article-1',
    handle: 'daily-feminine-care-guide',
    blogHandle: 'care-talk',
    title: '日常私密護理：先理解身體，再選擇產品',
    excerpt: '從溫和清潔、生活習慣到何時應尋求專業協助，建立可長期執行的溫和照護原則。',
    category: '健康知識',
    author: 'LUCISSI CARE 編輯團隊',
    date: '2026/9/1',
    readTime: '3 分鐘',
    image: '/images/lucissi-v5/thumb-care.webp',
    tags: ['健康知識', '私密護理', '日常保養'],
    url: '/blog/daily-feminine-care-guide'
  },
  {
    id: 'fallback-article-2',
    handle: 'how-to-choose-seamless-underwear',
    blogHandle: 'lifestyle',
    title: '貼身衣物材質怎麼選？透氣、摩擦與清潔頻率的日常指南',
    excerpt: '用透氣度、摩擦感與清潔頻率三個面向，整理日常挑選貼身衣物的實用重點。',
    category: '生活美學',
    author: 'LUCISSI CARE 編輯團隊',
    date: '2026/9/1',
    readTime: '3 分鐘',
    image: '/images/lucissi-v5/thumb-wear.webp',
    tags: ['生活美學', '選購指南', '親膚材質'],
    url: '/blog/how-to-choose-seamless-underwear'
  },
  {
    id: 'fallback-article-3',
    handle: 'how-we-review-products-and-content',
    blogHandle: 'brand',
    title: '我們如何整理產品與內容：LUCISSI CARE 編輯團隊的透明度承諾',
    excerpt: '所有產品資訊堅持來源透明與成分公開；沒有即時評價時，就以編輯精選清楚標示。',
    category: '品牌方法',
    author: 'LUCISSI CARE 編輯團隊',
    date: '2026/9/1',
    readTime: '3 分鐘',
    image: '/images/lucissi-v5/thumb-standards.webp',
    tags: ['品牌方法', '透明原則', '編輯守則'],
    url: '/blog/how-we-review-products-and-content'
  },
];

export default function Community() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  const tags = ['全部', '私密護理', '健康知識', '生活美學', '選購指南', '品牌方法', '日常保養'];

  const [articles, setArticles] = useState<CommunityArticle[]>([]);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const items = await getShopifyArticles(12);
      if (items && items.length > 0) {
        const mappedArticles = items.map((article) => ({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt || article.contentHtml?.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...',
          category: article.blog?.title || (article.tags && article.tags.length > 0 ? article.tags[0] : '精彩文章'),
          author: article.author || 'LUCISSI CARE 編輯團隊',
          date: new Date(article.publishedAt).toLocaleDateString(),
          readTime: `${estimateReadingMinutes(article.contentHtml || article.excerpt || '')} 分鐘`,
          image: editorialImage(article.handle, article.image?.url),
          tags: article.tags || [],
          handle: article.handle,
          blogHandle: article.blog?.handle,
          url: `/blog/${article.handle}`,
        }));
        setArticles(mappedArticles);
        return;
      }
      setArticles(localArticles);
    } catch {
      setArticles(localArticles);
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = searchTerm === '' ||
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTag = selectedTag === '' || selectedTag === '全部' ||
      article.tags.includes(selectedTag) ||
      article.category === selectedTag;

    return matchesSearch && matchesTag;
  });

  const handleRegister = () => {
    navigate('/register');
  };

  const handleArticleOpen = (article: any) => {
    const handle = article.handle || article.id;
    navigate(`/blog/${handle}`);
  };

  return (
    <div className="min-h-screen bg-[#F8F5F1]">
      <Header />

      {/* Hero Section - 手機版優化 */}
      <EditorialHero
        className="mt-24"
        image="/images/lucissi-v5/community-hero.webp"
        alt="三位成年女性在自在的小聚中交流彼此的日常心得"
        eyebrow="LUCISSI CARE · COMMUNITY"
        title="健康知識分享社群"
        description="專業的私密護理知識、使用心得與健康觀念分享，讓妳在社群中獲得支持與啟發"
      />

      <main className="page-content bg-[#F8F5F1]">
        <section className="py-4 px-4 bg-[#F8F5F1] -mt-px">
          <div className="max-w-7xl mx-auto">
            {/* Blog Content */}
              <>
                {/* Search and Filter Section - 手機版優化 */}
                <div className="flex flex-col gap-4 mb-6 md:mb-8">
                  {/* Search Bar */}
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="搜尋文章..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 pl-11 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                    <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-base"></i>
                  </div>

                  {/* Article Count */}
                  <div className="text-sm text-gray-600 text-center md:text-left">
                    找到 <span className="font-semibold" style={{ color: '#5B3D48' }}>{filteredArticles.length}</span> 篇文章
                  </div>
                </div>

                {/* Tags Filter - 手機版優化 */}
                <div className="mb-8 md:mb-12">
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag === '全部' ? '' : tag)}
                        className={`px-4 md:px-6 py-2 text-xs md:text-sm font-medium rounded-full transition-colors duration-200 cursor-pointer whitespace-nowrap ${(selectedTag === tag) || (selectedTag === '' && tag === '全部')
                          ? 'text-white'
                          : 'bg-white text-gray-600 hover:text-white border border-gray-200'
                          }`}
                        style={{
                          backgroundColor: (selectedTag === tag) || (selectedTag === '' && tag === '全部') ? '#5B3D48' : undefined,
                          borderColor: (selectedTag === tag) || (selectedTag === '' && tag === '全部') ? '#5B3D48' : undefined
                        }}
                        onMouseEnter={(e) => {
                          if (!((selectedTag === tag) || (selectedTag === '' && tag === '全部'))) {
                            e.currentTarget.style.backgroundColor = '#E7D6D4';
                            e.currentTarget.style.color = '#5B3D48';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!((selectedTag === tag) || (selectedTag === '' && tag === '全部'))) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.color = '#655859';
                          }
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Featured Article - 手機版優化 */}
                {filteredArticles.length > 0 && (
                  <div className="mb-8 md:mb-16">
                    <div className="relative overflow-hidden rounded-lg cursor-pointer group" onClick={() => handleArticleOpen(filteredArticles[0])}>
                      {/* 手機版使用 4:3 比例，平板以上使用 21:9 */}
                      <div className="aspect-4/3 md:aspect-video lg:aspect-21/9 overflow-hidden">
                        <img
                          src={filteredArticles[0].image}
                          alt={filteredArticles[0].title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>

                      <div className="absolute inset-0 bg-linear-to-t/srgb from-black/80 via-black/40 to-transparent flex items-end">
                        <div className="p-4 md:p-6 lg:p-8 text-white w-full">
                          <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                            <span className="px-2.5 md:px-3 py-1 text-xs font-medium bg-white/20 backdrop-blur-xs rounded-full">
                              {filteredArticles[0].category}
                            </span>
                            <span className="text-xs md:text-sm opacity-90">{filteredArticles[0].readTime}</span>
                          </div>

                          <h2 className="text-xl md:text-2xl md:leading-8 lg:text-3xl lg:leading-9 xl:text-4xl xl:leading-10 font-bold mb-2 md:mb-3 lg:mb-4 leading-tight line-clamp-2 md:line-clamp-none">
                            {filteredArticles[0].title}
                          </h2>

                          <p className="text-sm md:text-base lg:text-lg opacity-90 mb-4 md:mb-6 line-clamp-2 md:line-clamp-2">
                            {filteredArticles[0].excerpt}
                          </p>

                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center text-xs md:text-sm opacity-90">
                              <span className="truncate">作者：{filteredArticles[0].author}</span>
                              <span className="mx-2">•</span>
                              <span>{filteredArticles[0].date}</span>
                            </div>

                            <span className="text-xs md:text-sm opacity-90">站內編輯內容</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Articles Grid - 手機版優化 */}
                <motion.div
                  className="pb-12"
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 1 },
                    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                    {filteredArticles.slice(1).map((article) => (
                      <motion.article
                        key={article.id}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
                        variants={{
                          hidden: { opacity: 0, y: 16 },
                          show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
                        }}
                        onClick={() => handleArticleOpen(article)}
                      >
                        {/* 手機版使用 16:10 比例 */}
                        <div className="aspect-16/10 overflow-hidden">
                          <img
                            src={article.image}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        <div className="p-4 md:p-5 lg:p-6">
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-block px-2.5 md:px-3 py-1 text-xs font-medium text-white rounded-full" style={{ backgroundColor: '#5B3D48' }}>
                              {article.category}
                            </span>
                            <span className="text-xs text-gray-500">{article.readTime}</span>
                          </div>

                          <h3 className="text-base md:text-lg md:leading-7 font-semibold text-gray-900 mb-2 md:mb-3 line-clamp-2 group-hover:text-brand transition-colors leading-snug">
                            {article.title}
                          </h3>

                          <p className="text-gray-600 text-sm mb-3 md:mb-4 line-clamp-2 md:line-clamp-3 leading-relaxed">
                            {article.excerpt}
                          </p>

                          <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
                            {article.tags.slice(0, 2).map((tag: string, index: number) => (
                              <span
                                key={index}
                                className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full cursor-pointer hover:bg-blush hover:text-brand transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTag(tag);
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500 mb-3 md:mb-4">
                            <div className="flex items-center truncate">
                              <span className="truncate">作者：{article.author}</span>
                              <span className="mx-2">•</span>
                              <span className="hidden sm:inline">{article.date}</span>
                              <span className="sm:hidden whitespace-nowrap">{article.date.slice(5)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end">
                            <div className="font-medium text-xs md:text-sm transition-colors whitespace-nowrap" style={{ color: '#5B3D48' }}>
                              閱讀更多
                              <i className="ri-arrow-right-line ml-1"></i>
                            </div>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                </motion.div>

                {/* No Results */}
                {filteredArticles.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <i className="ri-file-search-line text-5xl md:text-6xl text-gray-300 mb-4"></i>
                    <h3 className="text-lg md:text-xl font-semibold text-gray-600 mb-2">找不到相關文章</h3>
                    <p className="text-sm md:text-base text-gray-500 mb-6">請嘗試調整搜尋條件或選擇其他標籤</p>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedTag('');
                      }}
                      className="inline-flex items-center justify-center px-6 py-2.5 text-white text-sm md:text-base font-medium rounded-lg hover:opacity-90 transition-colors duration-300 cursor-pointer whitespace-nowrap"
                      style={{ backgroundColor: '#5B3D48' }}
                    >
                      重置搜尋
                    </button>
                  </div>
                )}

              </>
          </div>
        </section>

        {/* Member Registration Section - 手機版優化 */}
        <section className="py-12 md:py-16 px-4" style={{ backgroundColor: '#E7D6D4' }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
              加入我們的健康社群
            </h2>
            <p className="text-sm md:text-base md:leading-6 lg:text-lg lg:leading-7 text-gray-600 mb-6 md:mb-8 leading-relaxed px-4">
              加入 LUCISSI CARE 會員，掌握最新護理專欄、專屬優惠與個人化貼心購物體驗。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <button
                onClick={handleRegister}
                className="w-full sm:w-auto px-8 py-3 text-sm md:text-base text-white font-medium rounded-lg hover:opacity-90 transition-colors duration-300 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: '#5B3D48' }}
              >
                立即註冊會員
              </button>
              <div className="text-sm text-gray-500">
                已經是會員？
                <button
                  onClick={() => navigate('/login')}
                  className="ml-1 cursor-pointer hover:opacity-80"
                  style={{ color: '#5B3D48' }}
                >
                  立即登入
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-left">
              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#E7D6D4' }}>
                  <i className="ri-mail-line text-xl" style={{ color: '#5B3D48' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">專屬會員禮遇</h3>
                <p className="text-sm text-gray-600 leading-relaxed">隨時掌握專屬優惠、新品首發資訊與品牌最新動態。</p>
              </div>

              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#E7D6D4' }}>
                  <i className="ri-user-heart-line text-xl" style={{ color: '#5B3D48' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">安全隱私保障</h3>
                <p className="text-sm text-gray-600 leading-relaxed">以最嚴格的加密標準保護您的個人資料與收藏清單。</p>
              </div>

              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#E7D6D4' }}>
                  <i className="ri-vip-crown-line text-xl" style={{ color: '#5B3D48' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">即時訂單查詢</h3>
                <p className="text-sm text-gray-600 leading-relaxed">登入會員中心即可隨時輕鬆查詢物流配送與購買紀錄。</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
