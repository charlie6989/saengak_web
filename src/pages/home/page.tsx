import { useState, useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import HeroSection from './components/HeroSection';
import ProductSection from './components/ProductSection';
import BrandSection from './components/BrandSection';
import SolutionSection from './components/SolutionSection';
import ReviewSection from './components/ReviewSection';
import { getFunctionUrl } from '../../lib/supabase';

export default function Home() {
  const featuredProductIds = [
    'gid://shopify/Product/9969008509232',
    'gid://shopify/Product/9969008542000',
    'gid://shopify/Product/9969008574768',
    'gid://shopify/Product/9969008607536',
    'gid://shopify/Product/9969008673072',
    'gid://shopify/Product/9975451189552'
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />

      <main>
        <HeroSection />

        <ProductSection
          title="精選產品"
          subtitle="探索我們最受歡迎的女性護理產品"
          shopifyProductIds={featuredProductIds}
        />

        <BrandSection />

        {/* 白色間隔區域 */}
        <section className="py-12 bg-white"></section>

        <SolutionSection />

        {/* 白色間隔區域 */}
        <section className="py-12 bg-white"></section>

        {/* LUCISSI Talk｜私密對話 區塊 */}
        <section className="py-20" style={{ backgroundColor: '#F7F7F5' }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                LUCISSI Talk｜私密對話
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-4xl mx-auto" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                談身體，也談心。<br />
                在這裡，我們分享最真實的女性話題，<br />
                讓每一位女性都能在溫柔與理解中，找到屬於自己的自信與平衡。
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-stretch">
              {/* 左側內容 */}
              <div className="flex flex-col justify-center">
                <div className="space-y-8">
                  {/* 專業文章 */}
                  <div className="bg-white p-8 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-start space-x-6">
                      <div className="w-16 h-16 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#BED2C0', borderRadius: '12px' }}>
                        <i className="ri-article-line text-2xl" style={{ color: '#225B4F' }}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          專業文章
                        </h4>
                        <p className="text-gray-600 leading-relaxed text-lg" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          由醫師與專家撰寫的女性健康與私密護理內容，<br />
                          以科學為基礎，提供妳最可靠的知識與建議。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Instagram 動態 */}
                  <div className="bg-white p-8 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-start space-x-6">
                      <div className="w-16 h-16 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#BED2C0', borderRadius: '12px' }}>
                        <i className="ri-instagram-line text-2xl" style={{ color: '#225B4F' }}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          Instagram 動態
                        </h4>
                        <p className="text-gray-600 leading-relaxed text-lg" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          每日更新保養小知識、產品使用教學與真實用戶心得，<br />
                          一起打造屬於妳的私密健康日常。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 按鈕組 */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <a
                      href="/community"
                      className="inline-flex items-center justify-center px-8 py-4 font-semibold text-lg transition-all duration-300 cursor-pointer whitespace-nowrap hover:transform hover:scale-105 shadow-sm"
                      style={{
                        fontFamily: "Noto Sans TC, sans-serif",
                        backgroundColor: '#225B4F',
                        color: '#FFFFFF',
                        borderRadius: '12px'
                      }}
                    >
                      探索更多內容
                      <i className="ri-arrow-right-line ml-2"></i>
                    </a>
                    <a
                      href="/community?tab=instagram"
                      className="inline-flex items-center justify-center px-8 py-4 font-semibold text-lg transition-all duration-300 cursor-pointer whitespace-nowrap border-2 hover:transform hover:scale-105 shadow-sm"
                      style={{
                        fontFamily: "Noto Sans TC, sans-serif",
                        backgroundColor: 'transparent',
                        color: '#225B4F',
                        borderColor: '#225B4F',
                        borderRadius: '12px'
                      }}
                    >
                      <i className="ri-instagram-line mr-2"></i>
                      追蹤 Instagram
                    </a>
                  </div>
                </div>
              </div>

              {/* 右側圖片 */}
              <div className="flex items-stretch">
                <div className="w-full h-full min-h-[500px] relative overflow-hidden shadow-lg" style={{ borderRadius: '16px' }}>
                  <img
                    src="https://readdy.ai/api/search-image?query=Intimate%20conversation%20between%20women%20about%20feminine%20health%2C%20warm%20and%20caring%20atmosphere%2C%20soft%20lighting%2C%20comfortable%20setting%20for%20sharing%20personal%20topics%2C%20Korean%20women%20having%20heart%20to%20heart%20talk%20about%20body%20and%20mind%20wellness%2C%20professional%20healthcare%20consultation%20environment&width=600&height=500&seq=lucissi-talk-redesign&orientation=landscape"
                    alt="LUCISSI Talk 私密對話"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                  <div className="absolute bottom-8 left-8 right-8">
                    <div className="bg-white/90 backdrop-blur-sm p-6" style={{ borderRadius: '12px' }}>
                      <h5 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                        真實分享，溫暖陪伴
                      </h5>
                      <p className="text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                        每一個故事都值得被聆聽
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 最新話題 */}
            <div className="mt-20">
              <h3 className="text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                最新話題
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {(() => {
                  const [articles, setArticles] = useState<any[]>([]);

                  useEffect(() => {
                    const fetchArticles = async () => {
                      try {
                        const response = await fetch(getFunctionUrl('get-articles'), {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
                          },
                        });
                        const data = await response.json();
                        if (data.articles) {
                          setArticles(data.articles);
                        }
                      } catch (error) {
                        console.error('Error fetching articles:', error);
                      }
                    };
                    fetchArticles();
                  }, []);

                  if (articles.length === 0) {
                    // Fallback loading state or empty
                    return (
                      <div className="col-span-3 text-center py-10">
                        <div className="inline-block animate-spin h-8 w-8 border-b-2 border-gray-900"></div>
                      </div>
                    );
                  }

                  return articles.map((article: any) => (
                    <div
                      key={article.id}
                      className="bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-lg hover:transform hover:scale-105 cursor-pointer flex flex-col h-full"
                      style={{ borderRadius: '16px' }}
                      onClick={() => window.open(`https://${import.meta.env.VITE_SHOPIFY_DOMAIN || 'saengak.myshopify.com'}/blogs/${article.blog.handle}/${article.handle}`, '_blank')}
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={article.image?.url || 'https://via.placeholder.com/400x300?text=No+Image'}
                          alt={article.image?.altText || article.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center mb-3">
                          <span className="px-3 py-1 text-sm font-medium text-white" style={{ backgroundColor: '#225B4F', borderRadius: '20px' }}>
                            {article.tags && article.tags.length > 0 ? article.tags[0] : '專欄文章'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {article.title}
                        </h4>
                        <p className="text-gray-600 text-sm line-clamp-2 flex-1" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {article.excerpt || article.contentHtml?.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...'}
                        </p>
                        <p className="text-xs text-gray-400 mt-4">
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </section>

        {/* 白色間隔區域 */}
        <section className="py-12 bg-white"></section>

        <ReviewSection />
      </main>

      <Footer />
    </div>
  );
}
