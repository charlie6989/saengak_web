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

const editorialFallbackImage = 'https://readdy.ai/api/search-image?query=calm%20minimal%20women%20wellness%20editorial%20still%20life%20soft%20natural%20light%20green%20and%20white%20palette&width=800&height=600&seq=saengak-editorial-fallback&orientation=landscape';

const localArticles: CommunityArticle[] = [
  {
    id: 'fallback-article-1',
    handle: 'daily-feminine-care-guide',
    blogHandle: 'care-talk',
    title: '日常私密護理：先理解身體，再選擇產品',
    excerpt: '從溫和清潔、生活習慣到何時應尋求專業協助，建立可長期執行的溫和照護原則。',
    category: '健康知識',
    author: 'SAENGAK 編輯團隊',
    date: '2026/9/1',
    readTime: '3 分鐘',
    image: '/images/blog/daily-feminine-care-guide.jpg',
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
    author: 'SAENGAK 編輯團隊',
    date: '2026/9/1',
    readTime: '3 分鐘',
    image: '/images/blog/how-to-choose-seamless-underwear.jpg',
    tags: ['生活美學', '選購指南', '親膚材質'],
    url: '/blog/how-to-choose-seamless-underwear'
  },
  {
    id: 'fallback-article-3',
    handle: 'how-we-review-products-and-content',
    blogHandle: 'brand',
    title: '我們如何整理產品與內容：SAENGAK 編輯團隊的透明度承諾',
    excerpt: '所有產品資訊堅持來源透明與成分公開；沒有即時評價時，就以編輯精選清楚標示。',
    category: '品牌方法',
    author: 'SAENGAK 編輯團隊',
    date: '2026/9/1',
    readTime: '3 分鐘',
    image: '/images/blog/how-we-review-products-and-content.jpg',
    tags: ['品牌方法', '透明原則', '編輯守則'],
    url: '/blog/how-we-review-products-and-content'
  },
];

export default function Community() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [activeTab, setActiveTab] = useState('blog'); // 'blog' or 'instagram'

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
          author: article.author || 'SAENGAK 編輯團隊',
          date: new Date(article.publishedAt).toLocaleDateString(),
          readTime: `${estimateReadingMinutes(article.contentHtml || article.excerpt || '')} 分鐘`,
          image: article.image?.url || '/images/blog/daily-feminine-care-guide.jpg',
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

  const instagramPosts = [
    {
      id: 1,
      image: 'https://readdy.ai/api/search-image?query=Instagram%20style%20feminine%20care%20product%20flat%20lay%20photography%2C%20aesthetic%20pink%20and%20white%20background%2C%20Korean%20beauty%20products%20arranged%20beautifully%2C%20social%20media%20content%20style&width=400&height=400&seq=ig1&orientation=squarish',
      caption: '每日護理小貼士 💕 選擇溫和的私密護理產品，讓妳每天都充滿自信！ #私密護理 #女性健康 #內心想法',
    },
    {
      id: 2,
      image: 'https://readdy.ai/api/search-image?query=Healthy%20lifestyle%20flat%20lay%20with%20feminine%20care%20products%2C%20natural%20ingredients%2C%20wellness%20concept%2C%20Instagram%20aesthetic%20photography%2C%20clean%20minimalist%20style&width=400&height=400&seq=ig2&orientation=squarish',
      caption: '成分資訊要能追溯 🌿 未取得原廠文件或包裝標示前，不把展示內容當作商品宣稱。 #成分透明 #資料來源',
    },
    {
      id: 3,
      image: 'https://readdy.ai/api/search-image?query=Educational%20infographic%20about%20feminine%20health%20tips%2C%20modern%20design%2C%20pastel%20colors%2C%20Instagram%20post%20style%2C%20Korean%20healthcare%20education%20content&width=400&height=400&seq=ig3&orientation=squarish',
      caption: '健康小知識分享 📚 正確的私密護理方式，讓妳遠離不適困擾 #健康教育 #護理知識',
    },
    {
      id: 4,
      image: 'https://readdy.ai/api/search-image?query=Customer%20testimonial%20and%20review%20concept%2C%20happy%20Asian%20woman%20with%20feminine%20care%20products%2C%20authentic%20user%20experience%2C%20Instagram%20story%20style&width=400&height=400&seq=ig4&orientation=squarish',
      caption: '內容規劃：公開回饋前先確認本人授權、商品與訂單來源，不以示範文字冒充使用心得。 #內容規劃 #來源查核',
    },
    {
      id: 5,
      image: 'https://readdy.ai/api/search-image?query=Menstrual%20care%20and%20period%20comfort%20products%2C%20soft%20feminine%20colors%2C%20caring%20atmosphere%2C%20Instagram%20wellness%20content%2C%20Korean%20feminine%20care%20brand&width=400&height=400&seq=ig5&orientation=squarish',
      caption: '生理期護理指南 🌸 溫柔呵護每個特殊的日子，讓妳舒適度過 #生理期護理 #女性關懷',
    },
    {
      id: 6,
      image: 'https://readdy.ai/api/search-image?query=Professional%20healthcare%20consultation%2C%20female%20doctor%20and%20patient%20discussion%2C%20medical%20advice%20about%20womens%20health%2C%20Instagram%20educational%20content&width=400&height=400&seq=ig6&orientation=squarish',
      caption: '專家建議時間 👩‍⚕️ 定期諮詢專業醫師，是維護健康的重要步驟 #專家建議 #健康諮詢',
    }
  ];

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
    <div className="min-h-screen bg-[#F7F7F5]">
      <Header />

      {/* Hero Section - 手機版優化 */}
      <section className="pt-28 md:pt-36 lg:pt-48 pb-8 md:pb-12 bg-[#F7F7F5]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-[#000000] mb-4 md:mb-6 leading-tight">
              健康知識分享社群
            </h1>
            <p className="text-base md:text-xl lg:text-2xl text-[#555555] max-w-3xl mx-auto leading-relaxed">
              專業的私密護理知識、使用心得與健康觀念分享，讓妳在社群中獲得支持與啟發
            </p>
          </div>
        </div>
      </section>

      <main className="page-content bg-[#F7F7F5]">
        <section className="py-4 px-4 bg-[#F7F7F5] mt-[-1px]">
          <div className="max-w-7xl mx-auto">
            {/* Tab Navigation - 手機版優化 */}
            <div className="flex items-center justify-center mb-6 md:mb-8">
              <div className="flex bg-gray-100 rounded-full p-1 w-full max-w-md">
                <button
                  onClick={() => setActiveTab('blog')}
                  className={`flex-1 px-4 md:px-6 py-2.5 md:py-2 rounded-full text-sm md:text-base font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'blog'
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                  style={{
                    backgroundColor: activeTab === 'blog' ? '#225B4F' : 'transparent'
                  }}
                >
                  <i className="ri-article-line mr-1 md:mr-2"></i>
                  健康文章
                </button>
                <button
                  onClick={() => setActiveTab('instagram')}
                  className={`flex-1 px-4 md:px-6 py-2.5 md:py-2 rounded-full text-sm md:text-base font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'instagram'
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                  style={{
                    backgroundColor: activeTab === 'instagram' ? '#225B4F' : 'transparent'
                  }}
                >
                  <i className="ri-instagram-line mr-1 md:mr-2"></i>
                  Instagram 動態
                </button>
              </div>
            </div>

            {/* Blog Content */}
            {activeTab === 'blog' && (
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
                      className="w-full px-4 py-3 pl-11 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-base"></i>
                  </div>

                  {/* Article Count */}
                  <div className="text-sm text-gray-600 text-center md:text-left">
                    找到 <span className="font-semibold" style={{ color: '#225B4F' }}>{filteredArticles.length}</span> 篇文章
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
                          backgroundColor: (selectedTag === tag) || (selectedTag === '' && tag === '全部') ? '#225B4F' : undefined,
                          borderColor: (selectedTag === tag) || (selectedTag === '' && tag === '全部') ? '#225B4F' : undefined
                        }}
                        onMouseEnter={(e) => {
                          if (!((selectedTag === tag) || (selectedTag === '' && tag === '全部'))) {
                            e.currentTarget.style.backgroundColor = '#EBF3EC';
                            e.currentTarget.style.color = '#225B4F';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!((selectedTag === tag) || (selectedTag === '' && tag === '全部'))) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.color = '#555555';
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
                      <div className="aspect-[4/3] md:aspect-[16/9] lg:aspect-[21/9] overflow-hidden">
                        <img
                          src={filteredArticles[0].image}
                          alt={filteredArticles[0].title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end">
                        <div className="p-4 md:p-6 lg:p-8 text-white w-full">
                          <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                            <span className="px-2.5 md:px-3 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm rounded-full">
                              {filteredArticles[0].category}
                            </span>
                            <span className="text-xs md:text-sm opacity-90">{filteredArticles[0].readTime}</span>
                          </div>

                          <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-2 md:mb-3 lg:mb-4 leading-tight line-clamp-2 md:line-clamp-none">
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
                        <div className="aspect-[16/10] overflow-hidden">
                          <img
                            src={article.image}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        <div className="p-4 md:p-5 lg:p-6">
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-block px-2.5 md:px-3 py-1 text-xs font-medium text-white rounded-full" style={{ backgroundColor: '#225B4F' }}>
                              {article.category}
                            </span>
                            <span className="text-xs text-gray-500">{article.readTime}</span>
                          </div>

                          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3 line-clamp-2 group-hover:text-teal-600 transition-colors leading-snug">
                            {article.title}
                          </h3>

                          <p className="text-gray-600 text-sm mb-3 md:mb-4 line-clamp-2 md:line-clamp-3 leading-relaxed">
                            {article.excerpt}
                          </p>

                          <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
                            {article.tags.slice(0, 2).map((tag: string, index: number) => (
                              <span
                                key={index}
                                className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full cursor-pointer hover:bg-teal-100 hover:text-teal-600 transition-colors"
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
                            <div className="font-medium text-xs md:text-sm transition-colors whitespace-nowrap" style={{ color: '#225B4F' }}>
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
                      style={{ backgroundColor: '#225B4F' }}
                    >
                      重置搜尋
                    </button>
                  </div>
                )}

              </>
            )}

            {/* Instagram Content - 手機版優化 */}
            {activeTab === 'instagram' && (
              <div className="pb-12">
                {/* Instagram Header */}
                <div className="text-center mb-8 md:mb-12">
                  <div className="flex items-center justify-center mb-4">
                    <i className="ri-instagram-line text-3xl md:text-4xl mr-2 md:mr-3" style={{ color: '#225B4F' }}></i>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">社群內容主題</h2>
                  </div>
                  <p className="text-sm md:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto px-4">
                    以下為預計發布的內容方向；正式 Instagram 帳號與貼文串接後，才會顯示貼文日期與互動數據。
                  </p>
                </div>

                {/* Instagram Posts Grid - 手機版優化 */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                  {instagramPosts.map((post) => (
                    <div key={post.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden group">
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={post.image}
                          alt="Instagram post"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-700 mb-2 md:mb-3 line-clamp-2 md:line-clamp-3 leading-relaxed">
                          {post.caption}
                        </p>

                        <span className="text-xs font-medium text-[#225B4F]">內容主題</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </section>

        {/* Member Registration Section - 手機版優化 */}
        <section className="py-12 md:py-16 px-4" style={{ backgroundColor: '#EBF3EC' }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
              加入我們的健康社群
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-gray-600 mb-6 md:mb-8 leading-relaxed px-4">
              電子郵件會員已完成技術接線；目前提供個人資料、收藏與已連結訂單的權限基線，不宣稱尚未啟用的諮詢或推播服務。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <button
                onClick={handleRegister}
                className="w-full sm:w-auto px-8 py-3 text-sm md:text-base text-white font-medium rounded-lg hover:opacity-90 transition-colors duration-300 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: '#225B4F' }}
              >
                立即註冊會員
              </button>
              <div className="text-sm text-gray-500">
                已經是會員？
                <button
                  onClick={() => navigate('/login')}
                  className="ml-1 cursor-pointer hover:opacity-80"
                  style={{ color: '#225B4F' }}
                >
                  立即登入
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-left">
              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#BED2C0' }}>
                  <i className="ri-mail-line text-xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">電子郵件帳號</h3>
                <p className="text-sm text-gray-600 leading-relaxed">完成信箱驗證後登入；不會自動訂閱未啟用的行銷郵件。</p>
              </div>

              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#BED2C0' }}>
                  <i className="ri-user-heart-line text-xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">個人資料權限</h3>
                <p className="text-sm text-gray-600 leading-relaxed">會員資料與收藏採本人權限隔離；本站目前不提供醫療或護理師諮詢。</p>
              </div>

              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#BED2C0' }}>
                  <i className="ri-vip-crown-line text-xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">訂單連結基線</h3>
                <p className="text-sm text-gray-600 leading-relaxed">完成正式結帳後，只顯示與已驗證會員 Cart 連結的 Shopify 訂單。</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
