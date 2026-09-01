import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { mockProducts } from '../../mocks/products';
import { formatTwd, estimateReadingMinutes } from '../../domain/algorithms';
import { getShopifyArticles, getShopifyArticleByHandle, type ShopifyArticle } from '../../lib/shopify';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function BlogArticle() {
  const { handle } = useParams<{ handle?: string }>();
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [article, setArticle] = useState<ShopifyArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<ShopifyArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTocId, setActiveTocId] = useState<string>('');
  const [readingProgress, setReadingProgress] = useState(0);

  const activeHandle = handle || 'daily-feminine-care-guide';

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    async function loadArticleData() {
      setLoading(true);
      try {
        const fetched = await getShopifyArticleByHandle(activeHandle);
        if (isMounted && fetched) {
          setArticle(fetched);
        }

        const allArticles = await getShopifyArticles(6);
        if (isMounted) {
          const others = allArticles.filter(
            (a) => a.handle !== activeHandle && a.id !== activeHandle
          );
          setRelatedArticles(others.slice(0, 3));
        }
      } catch (err) {
        console.error('Error fetching blog article:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadArticleData();

    return () => {
      isMounted = false;
    };
  }, [activeHandle]);

  // 監聽閱讀滾動進度與當前可見標題 (ScrollSpy)
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setReadingProgress(Math.min(100, Math.max(0, currentProgress)));
      }

      // 偵測當前標題位置
      const headings = document.querySelectorAll('.article-content h2, .article-content h3');
      let currentActive = '';
      headings.forEach((h) => {
        const rect = h.getBoundingClientRect();
        if (rect.top <= 160) {
          currentActive = h.id;
        }
      });
      if (currentActive) {
        setActiveTocId(currentActive);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [article]);

  // 解析文章 HTML 並自動注入 ID 以便目錄跳轉
  const { processedHtml, toc } = useMemo(() => {
    const rawHtml = article?.contentHtml || article?.excerpt || '';
    if (!rawHtml || typeof window === 'undefined') {
      return { processedHtml: rawHtml, toc: [] };
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      const headings = doc.querySelectorAll('h2, h3');
      const tocList: TocItem[] = [];

      headings.forEach((heading, idx) => {
        const text = heading.textContent?.trim() || '';
        const safeId = `section-${idx + 1}-${text.slice(0, 15).replace(/[\s\W]+/g, '-')}`;
        heading.setAttribute('id', safeId);
        tocList.push({
          id: safeId,
          text,
          level: heading.tagName === 'H2' ? 2 : 3,
        });
      });

      return {
        processedHtml: doc.body.innerHTML,
        toc: tocList,
      };
    } catch {
      return { processedHtml: rawHtml, toc: [] };
    }
  }, [article]);

  // 核心重點摘要清單（依不同文章自動適配）
  const keyHighlights = useMemo(() => {
    if (activeHandle.includes('care') || activeHandle.includes('daily')) {
      return [
        { icon: 'ri-drop-line', title: '微生態平衡', desc: '弱酸環境 (pH 3.5~4.5)，乳酸菌天然自淨。' },
        { icon: 'ri-shield-check-line', title: '分區清潔守則', desc: '內陰切勿灌洗，外陰以溫水或溫和潔膚露清洗。' },
        { icon: 'ri-temp-cold-line', title: '水溫與擦拭', desc: '37~40℃ 溫水拍乾，如廁由前往後擦拭。' },
        { icon: 'ri-hospital-line', title: '異常及早就醫', desc: '分泌物異狀或搔癢請諮詢合格婦產科專科醫師。' }
      ];
    } else if (activeHandle.includes('underwear') || activeHandle.includes('fabric')) {
      return [
        { icon: 'ri-t-shirt-line', title: '天然純棉親膚', desc: '吸濕柔軟，適合日常休閒與敏感肌膚。' },
        { icon: 'ri-windy-line', title: '莫代爾與天絲', desc: '透氣涼爽垂墜佳，久坐辦公不悶熱。' },
        { icon: 'ri-focus-3-line', title: '底襠雙層防護', desc: '接觸面優先選擇純棉或透氣抑菌纖維。' },
        { icon: 'ri-refresh-line', title: '定期汰換週期', desc: '專用洗劑單獨洗滌，建議 3~6 個月定期更換。' }
      ];
    } else {
      return [
        { icon: 'ri-search-eye-line', title: '成分來源透明', desc: '所有原料與檢測如實呈現，拒絕隱匿與誇大。' },
        { icon: 'ri-heart-pulse-line', title: '守法無醫療宣稱', desc: '回歸日常舒適潔淨，不以醫療療效作為宣傳。' },
        { icon: 'ri-star-smile-line', title: '真實評價原則', desc: '未獲真實授權訂單前，一律清楚標記編輯精選。' },
        { icon: 'ri-hand-heart-line', title: '溫柔陪伴日常', desc: '以科學與細膩質感，陪伴每一位女性的日常。' }
      ];
    }
  }, [activeHandle]);

  const recommendedProducts = mockProducts.slice(0, 3);

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = article?.title || 'SAENGAK 專欄文章';

    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
        break;
      case 'line':
        window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`);
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        alert('連結已複製到剪貼簿');
        break;
    }
    setShowShareMenu(false);
  };

  const handleTocClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveTocId(id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-[#225B4F] border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 font-medium">專欄文章載入中...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
        <Header />
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <i className="ri-file-warning-line text-6xl text-gray-300 mb-4 inline-block"></i>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">找不到該專欄文章</h2>
          <p className="text-gray-600 mb-8">此文章可能已被移動或尚未發布，請瀏覽其他精選文章。</p>
          <button
            onClick={() => navigate('/community')}
            className="px-8 py-3 bg-[#225B4F] text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer font-medium"
          >
            返回文章列表
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const readMinutes = estimateReadingMinutes(article.contentHtml || article.excerpt || '');
  const displayDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString()
    : '2026/9/1';
  const categoryName = article.blog?.title || (article.tags && article.tags.length > 0 ? article.tags[0] : '專欄文章');
  const coverImage = article.image?.url || '/images/blog/daily-feminine-care-guide.jpg';

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
      {/* 頂部閱讀進度條 */}
      <div
        className="fixed top-0 left-0 h-1 bg-[#225B4F] z-50 transition-all duration-150 ease-out"
        style={{ width: `${readingProgress}%` }}
      />

      <Header />

      {/* Hero Banner Section */}
      <div className="relative w-full overflow-hidden bg-[#182C27]">
        <div className="w-full h-80 sm:h-96 md:h-[440px] lg:h-[480px]">
          <img
            src={coverImage}
            alt={article.image?.altText || article.title}
            className="w-full h-full object-cover opacity-80"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#112420] via-[#112420]/50 to-transparent flex items-end">
          <div className="w-full max-w-7xl mx-auto px-6 sm:px-8 pb-10 md:pb-14">
            <div className="max-w-4xl text-white">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-3.5 py-1 text-xs font-semibold bg-[#225B4F] text-white rounded-full tracking-wide">
                  {categoryName}
                </span>
                <span className="text-sm opacity-90">{readMinutes} 分鐘閱讀</span>
                <span className="text-sm opacity-60">•</span>
                <span className="text-sm opacity-90">{displayDate}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold mb-5 leading-[1.3] tracking-tight">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center justify-between gap-4 text-sm opacity-90 pt-2 border-t border-white/15">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    <i className="ri-user-3-line"></i>
                  </div>
                  <span className="font-medium">{article.author || 'SAENGAK 編輯團隊'}</span>
                </div>
                <span className="text-xs bg-white/15 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-white/90">
                  SAENGAK 官方專欄
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="page-content bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm mb-10 text-gray-500">
            <button onClick={() => navigate('/')} className="cursor-pointer hover:text-[#225B4F] transition-colors">
              首頁
            </button>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <button onClick={() => navigate('/community')} className="cursor-pointer hover:text-[#225B4F] transition-colors">
              健康知識分享
            </button>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-md">{article.title}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-start">
            {/* 左側主文章內容 (8 欄) */}
            <article className="lg:col-span-8 bg-white p-6 sm:p-10 md:p-12 rounded-2xl shadow-sm border border-gray-100/80">
              {/* Article Top Actions */}
              <div className="flex items-center justify-between pb-6 mb-8 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-lg transition-all cursor-pointer font-medium ${
                      isBookmarked
                        ? 'bg-[#225B4F] text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-[#EBF3EC] hover:text-[#225B4F]'
                    }`}
                  >
                    <i className={isBookmarked ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                    <span>{isBookmarked ? '已收藏' : '收藏'}</span>
                  </button>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm rounded-lg bg-gray-50 text-gray-700 hover:bg-[#EBF3EC] hover:text-[#225B4F] transition-all cursor-pointer font-medium"
                  >
                    <i className="ri-share-forward-line"></i>
                    <span>分享</span>
                  </button>

                  {showShareMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-48 overflow-hidden py-1">
                      <button
                        onClick={() => handleShare('facebook')}
                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <i className="ri-facebook-circle-fill mr-3 text-blue-600 text-lg"></i>
                        分享到 Facebook
                      </button>
                      <button
                        onClick={() => handleShare('line')}
                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <i className="ri-line-fill mr-3 text-green-500 text-lg"></i>
                        分享到 LINE
                      </button>
                      <button
                        onClick={() => handleShare('twitter')}
                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <i className="ri-twitter-x-line mr-3 text-gray-900 text-lg"></i>
                        分享到 X (Twitter)
                      </button>
                      <button
                        onClick={() => handleShare('copy')}
                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer border-t border-gray-100"
                      >
                        <i className="ri-file-copy-line mr-3 text-gray-500 text-lg"></i>
                        複製文章連結
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 嚴格法規與非醫療宣稱免責警語 */}
              <div className="mb-10 p-5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 text-sm leading-relaxed text-emerald-950 flex items-start space-x-3.5">
                <i className="ri-information-line text-emerald-700 text-xl flex-shrink-0 mt-0.5"></i>
                <div>
                  <strong className="text-emerald-900 font-semibold block mb-0.5">日常衛教與生活保養說明</strong>
                  本專欄內容為日常衛生清潔習慣與一般生活保養分享，不具備任何醫療與診斷意圖。如有任何個人健康或身體不適疑慮，請儘速諮詢合格婦產科專科醫師。
                </div>
              </div>

              {/* 文章正文內容 (注入專屬排版系統) */}
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: processedHtml }}
              />

              {/* 專欄標籤 */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-14 pt-8 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-3.5">相關主題標籤</h4>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3.5 py-1.5 text-xs font-medium bg-[#F2F5F3] text-[#225B4F] rounded-full hover:bg-[#225B4F] hover:text-white transition-all cursor-pointer"
                        onClick={() => navigate('/community')}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 作者與編輯承諾區塊 */}
              <div className="mt-10 p-6 sm:p-8 rounded-2xl bg-[#F7F9F8] border border-emerald-900/10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-[#225B4F] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <i className="ri-leaf-line text-2xl"></i>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-base font-bold text-gray-900">{article.author || 'SAENGAK 編輯團隊'}</h4>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-medium">
                      內容審核
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    SAENGAK 編輯團隊致力於提供成分透明、不誇大療效的日常女性生活保養指引。以溫柔而科學的視角，陪伴妳探索更舒適的自己。
                  </p>
                </div>
              </div>
            </article>

            {/* 右側重點摘要與互動目錄側邊欄 (4 欄 - Sticky) */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
              {/* 卡片 1: 📌 本文核心摘要與速讀 (Key Highlights) */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/90">
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-flashlight-line text-[#225B4F] text-lg"></i>
                    本篇核心速讀
                  </h3>
                  <span className="text-xs text-[#225B4F] bg-[#EBF3EC] px-2.5 py-1 rounded-full font-medium">
                    重點整理
                  </span>
                </div>
                <div className="space-y-3.5">
                  {keyHighlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50/80 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#EBF3EC] text-[#225B4F] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className={`${item.icon} text-base`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 mb-0.5">{item.title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 卡片 2: 📑 文章目錄導覽 (Interactive Table of Contents) */}
              {toc.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/90">
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <i className="ri-list-check text-[#225B4F] text-lg"></i>
                      文章章節目錄
                    </h3>
                    <span className="text-xs text-gray-400 font-normal">
                      {Math.round(readingProgress)}% 進度
                    </span>
                  </div>
                  <nav className="space-y-1.5">
                    {toc.map((item) => {
                      const isActive = activeTocId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleTocClick(item.id)}
                          className={`w-full text-left transition-all cursor-pointer rounded-lg py-2 px-3 flex items-center gap-2.5 text-xs ${
                            item.level === 3 ? 'pl-6 text-gray-500' : 'font-medium text-gray-700'
                          } ${
                            isActive
                              ? 'bg-[#EBF3EC] text-[#225B4F] font-bold border-l-2 border-[#225B4F]'
                              : 'hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <i
                            className={`text-xs ${
                              isActive
                                ? 'ri-arrow-right-s-fill text-[#225B4F]'
                                : 'ri-checkbox-blank-circle-line text-gray-300'
                            }`}
                          ></i>
                          <span className="truncate">{item.text}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              )}

              {/* 卡片 3: 🌿 推薦日常護理品 (Recommended Products) */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/90">
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-heart-3-line text-[#225B4F] text-lg"></i>
                    推薦日常護理
                  </h3>
                  <span className="text-xs text-gray-400 font-normal">編輯推薦</span>
                </div>
                <div className="space-y-3.5">
                  {recommendedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="cursor-pointer group flex items-center gap-3.5 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-gray-900 line-clamp-1 group-hover:text-[#225B4F] transition-colors mb-1">
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#225B4F]">{formatTwd(product.price)}</span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[10px] line-through text-gray-400">{formatTwd(product.originalPrice)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 卡片 4: 📖 更多專欄 (Related Articles) */}
              {relatedArticles.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/90">
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <i className="ri-book-open-line text-[#225B4F] text-lg"></i>
                      更多精選專欄
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {relatedArticles.map((related) => (
                      <article
                        key={related.id}
                        className="cursor-pointer group flex gap-3.5 items-center p-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/blog/${related.handle}`)}
                      >
                        <div className="w-16 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={related.image?.url || '/images/blog/daily-feminine-care-guide.jpg'}
                            alt={related.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-[#225B4F] uppercase tracking-wider block mb-0.5">
                            {related.tags && related.tags.length > 0 ? related.tags[0] : '專欄'}
                          </span>
                          <h4 className="font-bold text-xs text-gray-900 line-clamp-1 group-hover:text-[#225B4F] transition-colors">
                            {related.title}
                          </h4>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>

          {/* 底部導覽與返回按鈕 */}
          <div className="flex items-center justify-between mt-14 pt-8 border-t border-gray-200">
            <button
              onClick={() => navigate('/community')}
              className="inline-flex items-center text-sm font-semibold text-gray-700 hover:text-[#225B4F] transition-colors cursor-pointer bg-white px-5 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:shadow"
            >
              <i className="ri-arrow-left-line mr-2 text-base"></i>
              返回健康知識社群
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center text-sm font-semibold text-gray-700 hover:text-[#225B4F] transition-colors cursor-pointer bg-white px-5 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:shadow"
            >
              回首頁探索目錄
              <i className="ri-arrow-right-line ml-2 text-base"></i>
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
