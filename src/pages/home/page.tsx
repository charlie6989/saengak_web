import { editorialImage } from '../../content/editorialImages';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import HeroSection from './components/HeroSection';
import ProductSection from './components/ProductSection';
import BrandSection from './components/BrandSection';
import SolutionSection from './components/SolutionSection';
import PillarSection from './components/PillarSection';
import FromLucissiSection from './components/FromLucissiSection';
import { TALK_FALLBACK_ARTICLES } from '../../content/talkFallbackArticles';
import { getShopifyArticles } from '../../lib/shopify';

const fallbackArticles = TALK_FALLBACK_ARTICLES;

export default function Home() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const items = await getShopifyArticles(3);
        if (items && items.length > 0) {
          setArticles(items.map((a) => ({
            id: a.id,
            handle: a.handle,
            title: a.title,
            excerpt: a.excerpt || '',
            contentHtml: a.contentHtml || '',
            tags: a.tags || [],
            publishedAt: a.publishedAt,
            image: { url: editorialImage(a.handle, a.image?.url), altText: a.title },
          })));
        } else {
          setArticles(fallbackArticles);
        }
      } catch {
        setArticles(fallbackArticles);
      }
    };

    fetchArticles();
  }, []);

  return (
    <div className="min-h-screen bg-ivory" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />

      <main className="pt-24">
        <HeroSection />

        <PillarSection />

        <ProductSection
          title="本季精選"
          subtitle="從私密保養到舒適內搭，先從這些開始。"
        />

        <BrandSection />

        <SolutionSection />

        {/* LUCISSI Talk｜私密對話 區塊：白底與上方象牙色主視覺區隔 */}
        <section className="py-20 bg-white">
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
                  <div className="bg-white p-8 shadow-xs border border-gray-100 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-start space-x-6">
                      <div className="w-16 h-16 flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-sage)', borderRadius: '12px' }}>
                        <i className="ri-article-line text-2xl" style={{ color: '#5B3D48' }}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          專業文章
                        </h4>
                        <p className="text-gray-600 leading-relaxed text-lg" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          整理女性健康與私密護理主題，<br />
                          從日常習慣到選購重點，一次讀懂。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 按鈕組 */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <a
                      href="/community"
                      className="inline-flex items-center justify-center px-8 py-4 font-semibold text-lg transition-all duration-300 cursor-pointer whitespace-nowrap hover:transform hover:scale-105 shadow-xs"
                      style={{
                        fontFamily: "Noto Sans TC, sans-serif",
                        backgroundColor: '#5B3D48',
                        color: '#FFFDFC',
                        borderRadius: '12px'
                      }}
                    >
                      探索更多內容
                      <i className="ri-arrow-right-line ml-2"></i>
                    </a>
                  </div>
                </div>
              </div>

              {/* 右側圖片 */}
              <div className="flex items-stretch">
                <div className="w-full h-full min-h-[500px] relative overflow-hidden shadow-lg" style={{ borderRadius: '16px' }}>
                  <img
                    src="/images/lucissi-v5/home-talk-portrait.webp"
                    alt="LUCISSI Talk 私密對話"
                    className="w-full h-full origin-top scale-[1.15] object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t/srgb from-black/20 via-transparent to-transparent"></div>
                  <div className="absolute bottom-8 left-8 right-8">
                    <div className="bg-white/90 backdrop-blur-xs p-6" style={{ borderRadius: '12px' }}>
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
                {articles.length === 0 ? (
                  <div className="col-span-3 text-center py-10">
                    <div className="inline-block animate-spin h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : articles.map((article: any) => (
                    <div
                      key={article.id}
                      className="bg-white shadow-xs border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-lg hover:transform hover:scale-105 cursor-pointer flex flex-col h-full"
                      style={{ borderRadius: '16px' }}
                      onClick={() => {
                        const target = article.handle || article.id;
                        navigate(`/blog/${target}`);
                      }}
                    >
                      <div className="aspect-4/3 overflow-hidden">
                        <img
                          src={article.image?.url || '/images/lucissi-v5/thumb-standards.webp'}
                          alt={article.image?.altText || article.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center mb-3">
                          <span className="px-3 py-1 text-sm font-medium text-white" style={{ backgroundColor: '#5B3D48', borderRadius: '20px' }}>
                            {article.tags && article.tags.length > 0 ? article.tags[0] : '專欄文章'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {article.title}
                        </h4>
                        <p className="text-gray-600 text-sm line-clamp-2 flex-1" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {article.excerpt || article.contentHtml?.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...'}
                        </p>
                        <p className="text-xs text-gray-500 mt-4">
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        <FromLucissiSection />
      </main>

      <Footer />
    </div>
  );
}
