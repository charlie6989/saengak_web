import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { getFunctionUrl } from '../../lib/supabase';

export default function Community() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [activeTab, setActiveTab] = useState('blog'); // 'blog' or 'instagram'

  const tags = ['全部', '私密護理', '健康知識', '產品介紹', '使用心得', '專家建議', '生理期', '懷孕', '運動', '夏季護理'];

  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await fetch(getFunctionUrl('get-articles'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ limit: 12 }),
      });
      const data = await response.json();
      if (data.articles) {
        // Map Shopify articles to your component's expected format
        const mappedArticles = data.articles.map((article: any, index: number) => ({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt || article.contentHtml?.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...',
          category: article.blog?.title || '精彩文章',
          author: article.authorV2?.name || 'LUCISSI 編輯',
          date: new Date(article.publishedAt).toLocaleDateString(),
          readTime: '3分鐘', // Estimate or default
          image: article.image?.url || `https://via.placeholder.com/800x500?text=No+Image`,
          tags: article.tags || [],
          likes: 0, // Mock or fetch if possible
          comments: 0, // Mock
          views: 0, // Mock
          handle: article.handle,
          blogHandle: article.blog?.handle
        }));
        setArticles(mappedArticles);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const instagramPosts = [
    {
      id: 1,
      image: 'https://readdy.ai/api/search-image?query=Instagram%20style%20feminine%20care%20product%20flat%20lay%20photography%2C%20aesthetic%20pink%20and%20white%20background%2C%20Korean%20beauty%20products%20arranged%20beautifully%2C%20social%20media%20content%20style&width=400&height=400&seq=ig1&orientation=squarish',
      caption: '每日護理小貼士 💕 選擇溫和的私密護理產品，讓妳每天都充滿自信！ #私密護理 #女性健康 #內心想法',
      likes: 245,
      comments: 18,
      date: '2天前'
    },
    {
      id: 2,
      image: 'https://readdy.ai/api/search-image?query=Healthy%20lifestyle%20flat%20lay%20with%20feminine%20care%20products%2C%20natural%20ingredients%2C%20wellness%20concept%2C%20Instagram%20aesthetic%20photography%2C%20clean%20minimalist%20style&width=400&height=400&seq=ig2&orientation=squarish',
      caption: '天然成分的力量 🌿 我們堅持使用最純淨的天然成分，為妳的健康把關 #天然護理 #健康生活',
      likes: 189,
      comments: 12,
      date: '3天前'
    },
    {
      id: 3,
      image: 'https://readdy.ai/api/search-image?query=Educational%20infographic%20about%20feminine%20health%20tips%2C%20modern%20design%2C%20pastel%20colors%2C%20Instagram%20post%20style%2C%20Korean%20healthcare%20education%20content&width=400&height=400&seq=ig3&orientation=squarish',
      caption: '健康小知識分享 📚 正確的私密護理方式，讓妳遠離不適困擾 #健康教育 #護理知識',
      likes: 312,
      comments: 25,
      date: '5天前'
    },
    {
      id: 4,
      image: 'https://readdy.ai/api/search-image?query=Customer%20testimonial%20and%20review%20concept%2C%20happy%20Asian%20woman%20with%20feminine%20care%20products%2C%20authentic%20user%20experience%2C%20Instagram%20story%20style&width=400&height=400&seq=ig4&orientation=squarish',
      caption: '用戶真實分享 ✨ 感謝每一位信任我們的女性朋友，妳們的回饋是我們前進的動力 #用戶分享 #真實體驗',
      likes: 156,
      comments: 8,
      date: '1週前'
    },
    {
      id: 5,
      image: 'https://readdy.ai/api/search-image?query=Menstrual%20care%20and%20period%20comfort%20products%2C%20soft%20feminine%20colors%2C%20caring%20atmosphere%2C%20Instagram%20wellness%20content%2C%20Korean%20feminine%20care%20brand&width=400&height=400&seq=ig5&orientation=squarish',
      caption: '生理期護理指南 🌸 溫柔呵護每個特殊的日子，讓妳舒適度過 #生理期護理 #女性關懷',
      likes: 278,
      comments: 19,
      date: '1週前'
    },
    {
      id: 6,
      image: 'https://readdy.ai/api/search-image?query=Professional%20healthcare%20consultation%2C%20female%20doctor%20and%20patient%20discussion%2C%20medical%20advice%20about%20womens%20health%2C%20Instagram%20educational%20content&width=400&height=400&seq=ig6&orientation=squarish',
      caption: '專家建議時間 👩‍⚕️ 定期諮詢專業醫師，是維護健康的重要步驟 #專家建議 #健康諮詢',
      likes: 201,
      comments: 14,
      date: '2週前'
    }
  ];

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTag = selectedTag === '' || selectedTag === '全部' ||
      article.tags.includes(selectedTag) ||
      article.category === selectedTag;

    return matchesSearch && matchesTag;
  });

  const handleRegister = () => {
    navigate('/register');
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
                    <div className="relative overflow-hidden rounded-lg cursor-pointer group" onClick={() => window.open(`https://${import.meta.env.VITE_SHOPIFY_DOMAIN || 'saengak.myshopify.com'}/blogs/${filteredArticles[0].blogHandle}/${filteredArticles[0].handle}`, '_blank')}>
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
                              <span className="hidden sm:inline">{filteredArticles[0].date}</span>
                              <span className="sm:hidden">1月15日</span>
                            </div>

                            <div className="flex items-center space-x-3 md:space-x-4 text-xs md:text-sm opacity-90">
                              <div className="flex items-center">
                                <i className="ri-heart-line mr-1"></i>
                                <span>{filteredArticles[0].likes}</span>
                              </div>
                              <div className="flex items-center">
                                <i className="ri-chat-3-line mr-1"></i>
                                <span>{filteredArticles[0].comments}</span>
                              </div>
                              <div className="flex items-center">
                                <i className="ri-eye-line mr-1"></i>
                                <span>{filteredArticles[0].views}</span>
                              </div>
                            </div>
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
                        onClick={() => window.open(`https://${import.meta.env.VITE_SHOPIFY_DOMAIN || 'saengak.myshopify.com'}/blogs/${article.blogHandle}/${article.handle}`, '_blank')}
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
                            {article.tags.slice(0, 2).map((tag, index) => (
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

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 md:space-x-4 text-xs text-gray-500">
                              <div className="flex items-center">
                                <i className="ri-heart-line mr-1"></i>
                                <span>{article.likes}</span>
                              </div>
                              <div className="flex items-center">
                                <i className="ri-chat-3-line mr-1"></i>
                                <span>{article.comments}</span>
                              </div>
                              <div className="flex items-center">
                                <i className="ri-eye-line mr-1"></i>
                                <span>{article.views}</span>
                              </div>
                            </div>

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

                {/* Pagination - 手機版優化 */}
                {filteredArticles.length > 0 && (
                  <div className="flex justify-center items-center gap-2 py-8">
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                      <i className="ri-arrow-left-s-line text-lg"></i>
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center text-sm text-gray-900 font-bold cursor-pointer hover:text-teal-600 transition-colors">1</button>
                    <button className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 font-medium hover:text-teal-600 transition-colors cursor-pointer">2</button>
                    <button className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 font-medium hover:text-teal-600 transition-colors cursor-pointer">3</button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                      <i className="ri-arrow-right-s-line text-lg"></i>
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
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">@innercare_official</h2>
                  </div>
                  <p className="text-sm md:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto px-4">
                    追蹤我們的 Instagram，獲得最新的健康護理小貼士、產品資訊和用戶分享
                  </p>
                  <div className="mt-6">
                    <button className="inline-flex items-center px-6 py-3 text-sm md:text-base text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer whitespace-nowrap" style={{ backgroundColor: '#225B4F' }}>
                      <i className="ri-instagram-line mr-2"></i>
                      追蹤我們
                    </button>
                  </div>
                </div>

                {/* Instagram Posts Grid - 手機版優化 */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                  {instagramPosts.map((post) => (
                    <div key={post.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group">
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

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-3 md:space-x-4">
                            <div className="flex items-center">
                              <i className="ri-heart-line mr-1"></i>
                              <span>{post.likes}</span>
                            </div>
                            <div className="flex items-center">
                              <i className="ri-chat-3-line mr-1"></i>
                              <span>{post.comments}</span>
                            </div>
                          </div>
                          <span className="text-xs">{post.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Instagram CTA - 手機版優化 */}
                <div className="text-center mt-8 md:mt-12 p-6 md:p-8 rounded-lg" style={{ backgroundColor: '#F7F7F5' }}>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">想看更多內容？</h3>
                  <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6 leading-relaxed">
                    在 Instagram 上追蹤我們，獲得每日健康小貼士、產品使用教學和社群互動
                  </p>
                  <button className="inline-flex items-center px-6 md:px-8 py-3 text-sm md:text-base text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer whitespace-nowrap" style={{ backgroundColor: '#225B4F' }}>
                    <i className="ri-instagram-line mr-2"></i>
                    前往 Instagram
                  </button>
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
              成為我們的會員，享受專屬健康資訊推送、專家諮詢服務，以及會員限定的護理指南
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
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">專屬健康資訊</h3>
                <p className="text-sm text-gray-600 leading-relaxed">定期接收最新的健康知識和護理建議，個人化推薦適合您的內容</p>
              </div>

              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#BED2C0' }}>
                  <i className="ri-user-heart-line text-xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">專家諮詢服務</h3>
                <p className="text-sm text-gray-600 leading-relaxed">享受專業醫師和護理師的線上諮詢服務，解答您的健康疑問</p>
              </div>

              <div className="bg-white p-5 md:p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg mb-4" style={{ backgroundColor: '#BED2C0' }}>
                  <i className="ri-vip-crown-line text-xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">會員專屬優惠</h3>
                <p className="text-sm text-gray-600 leading-relaxed">獲得產品優惠、會員限定活動邀請，以及專屬護理指南下載</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
