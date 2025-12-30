
import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function BlogArticle() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // 模擬文章數據
  const article = {
    id: 1,
    title: '女性私密護理完整指南：專家教你正確保養方式',
    content: `
      <p class="mb-8 text-lg leading-relaxed">女性私密護理是健康生活的重要組成部分，正確的護理方式不僅能維持健康的pH值平衡，還能預防各種感染和不適症狀。本文將為您詳細介紹專業的私密護理知識。</p>

      <h2 class="text-2xl font-bold mb-6 mt-12" style="color: #000000;">為什麼私密護理如此重要？</h2>
      <p class="mb-6 leading-relaxed">女性私密部位具有獨特的生理結構和微環境，需要特別的護理方式。正常情況下，陰道內的pH值應維持在3.8-4.5之間，這種弱酸性環境有助於抑制有害細菌的生長，維護健康的菌群平衡。</p>

      <p class="mb-4 leading-relaxed">然而，許多因素都可能影響這種平衡，包括：</p>
      <ul class="mb-8 ml-6 space-y-2">
        <li class="leading-relaxed">• 荷爾蒙變化（月經週期、懷孕、更年期）</li>
        <li class="leading-relaxed">• 不當的清潔習慣</li>
        <li class="leading-relaxed">• 緊身衣物的長期穿著</li>
        <li class="leading-relaxed">• 壓力和生活方式</li>
        <li class="leading-relaxed">• 某些藥物的使用</li>
      </ul>

      <h2 class="text-2xl font-bold mb-6 mt-12" style="color: #000000;">正確的私密護理步驟</h2>
      
      <h3 class="text-xl font-semibold mb-4 mt-10" style="color: #225B4F;">1. 選擇合適的清潔產品</h3>
      <p class="mb-4 leading-relaxed">選擇專為私密部位設計的溫和清潔產品，避免使用含有強烈香料、酒精或刺激性化學成分的產品。理想的私密護理產品應該：</p>
      <ul class="mb-8 ml-6 space-y-2">
        <li class="leading-relaxed">• pH值接近私密部位的自然酸性環境</li>
        <li class="leading-relaxed">• 含有溫和的天然成分</li>
        <li class="leading-relaxed">• 無香料或使用天然香料</li>
        <li class="leading-relaxed">• 經過皮膚科測試</li>
      </ul>

      <h3 class="text-xl font-semibold mb-4 mt-10" style="color: #225B4F;">2. 正確的清潔方式</h3>
      <p class="mb-4 leading-relaxed">每日清潔是必要的，但過度清潔可能會破壞自然的菌群平衡。建議的清潔方式包括：</p>
      <ul class="mb-8 ml-6 space-y-2">
        <li class="leading-relaxed">• 使用溫水輕柔清洗外陰部</li>
        <li class="leading-relaxed">• 從前往後的方向清潔，避免細菌感染</li>
        <li class="leading-relaxed">• 避免過度搓洗或使用粗糙的毛巾</li>
        <li class="leading-relaxed">• 清潔後用乾淨的毛巾輕拍乾燥</li>
      </ul>

      <h3 class="text-xl font-semibold mb-4 mt-10" style="color: #225B4F;">3. 內衣的選擇與護理</h3>
      <p class="mb-4 leading-relaxed">內衣的選擇對私密健康有重要影響：</p>
      <ul class="mb-8 ml-6 space-y-2">
        <li class="leading-relaxed">• 選擇透氣性好的棉質內衣</li>
        <li class="leading-relaxed">• 避免過緊的內衣，確保空氣流通</li>
        <li class="leading-relaxed">• 每日更換乾淨的內衣</li>
        <li class="leading-relaxed">• 使用溫和的洗衣劑清洗內衣</li>
      </ul>

      <h2 class="text-2xl font-bold mb-6 mt-12" style="color: #000000;">常見的護理誤區</h2>
      
      <h3 class="text-xl font-semibold mb-4 mt-10" style="color: #225B4F;">誤區一：頻繁使用陰道沖洗液</h3>
      <p class="mb-8 leading-relaxed">許多女性認為使用陰道沖洗液能保持清潔，但實際上這可能會破壞陰道內的自然菌群平衡，增加感染風險。</p>

      <h3 class="text-xl font-semibold mb-4 mt-10" style="color: #225B4F;">誤區二：使用普通肥皂清洗</h3>
      <p class="mb-8 leading-relaxed">普通肥皂的pH值通常偏鹼性，與私密部位的酸性環境不符，長期使用可能導致乾燥和刺激。</p>

      <h3 class="text-xl font-semibold mb-4 mt-10" style="color: #225B4F;">誤區三：忽視月經期間的特殊護理</h3>
      <p class="mb-8 leading-relaxed">月經期間需要更頻繁的清潔和衛生用品更換，同時要注意選擇透氣性好的衛生用品。</p>

      <h2 class="text-2xl font-bold mb-6 mt-12" style="color: #000000;">何時需要尋求專業幫助</h2>
      <p class="mb-4 leading-relaxed">如果出現以下症狀，建議及時諮詢醫療專業人員：</p>
      <ul class="mb-8 ml-6 space-y-2">
        <li class="leading-relaxed">• 異常分泌物（顏色、氣味、質地改變）</li>
        <li class="leading-relaxed">• 持續的瘙癢或灼熱感</li>
        <li class="leading-relaxed">• 排尿時疼痛或不適</li>
        <li class="leading-relaxed">• 異常出血</li>
        <li class="leading-relaxed">• 骨盆疼痛</li>
      </ul>

      <h2 class="text-2xl font-bold mb-6 mt-12" style="color: #000000;">結語</h2>
      <p class="mb-8 leading-relaxed">正確的私密護理是維護女性健康的重要環節。通過選擇合適的產品、採用正確的護理方式，並避免常見誤區，每位女性都能維護自己的私密健康。記住，每個人的身體狀況不同，如有疑問，請諮詢專業的醫療人員。</p>
    `,
    category: '私密護理',
    author: 'Dr. 林美華',
    authorBio: '婦產科專科醫師，擁有15年臨床經驗，專精於女性健康護理',
    date: '2024年1月15日',
    readTime: '8分鐘',
    image: 'https://readdy.ai/api/search-image?query=Professional%20female%20healthcare%20expert%20explaining%20feminine%20health%20care%20importance%2C%20clean%20medical%20consultation%20room%2C%20educational%20materials%20about%20womens%20health%2C%20professional%20healthcare%20setting%2C%20Korean%20medical%20expert&width=1200&height=600&seq=article-detail&orientation=landscape',
    tags: ['私密護理', '健康知識', '專家建議'],
    likes: 128,
    comments: 23,
    views: 1250,
    shares: 45
  };

  const relatedArticles = [
    {
      id: 2,
      title: '選擇私密護理產品的5個關鍵要素',
      excerpt: '市面上私密護理產品眾多，如何選擇最適合自己的產品？',
      image: 'https://readdy.ai/api/search-image?query=Various%20feminine%20care%20products%20arranged%20beautifully%2C%20natural%20ingredients%2C%20product%20selection%20guide%2C%20clean%20white%20background%2C%20professional%20product%20photography&width=400&height=250&seq=related1&orientation=landscape',
      readTime: '7分鐘',
      category: '產品介紹'
    },
    {
      id: 3,
      title: '常見的私密護理誤區：避免這些錯誤觀念',
      excerpt: '許多女性在私密護理上存在誤區，這些錯誤的觀念可能會影響健康',
      image: 'https://readdy.ai/api/search-image?query=Educational%20infographic%20about%20feminine%20care%20myths%20and%20facts%2C%20medical%20illustration%2C%20healthcare%20education%20materials%2C%20professional%20medical%20design&width=400&height=250&seq=related2&orientation=landscape',
      readTime: '6分鐘',
      category: '健康知識'
    },
    {
      id: 4,
      title: '月經期間的特殊護理：讓您更舒適度過生理期',
      excerpt: '月經期間需要特別的護理方式，了解正確的護理方法讓您更舒適',
      image: 'https://readdy.ai/api/search-image?query=Menstrual%20care%20products%20and%20comfort%20items%2C%20soft%20feminine%20colors%2C%20period%20care%20essentials%2C%20gentle%20and%20caring%20atmosphere&width=400&height=250&seq=related3&orientation=landscape',
      readTime: '8分鐘',
      category: '私密護理'
    }
  ];

  // 推薦相關產品
  const recommendedProducts = [
    {
      id: 1,
      name: '溫和私密護理潔淨露',
      price: 'NT$ 680',
      originalPrice: 'NT$ 850',
      image: 'https://readdy.ai/api/search-image?query=Gentle%20feminine%20intimate%20care%20cleanser%20bottle%2C%20natural%20ingredients%2C%20clean%20product%20photography%2C%20minimalist%20design%2C%20healthcare%20product&width=300&height=300&seq=product1&orientation=squarish',
      rating: 4.8,
      reviews: 156,
      isOnSale: true
    },
    {
      id: 2,
      name: '天然草本私密護理凝膠',
      price: 'NT$ 520',
      image: 'https://readdy.ai/api/search-image?query=Natural%20herbal%20intimate%20care%20gel%20tube%2C%20organic%20ingredients%2C%20professional%20healthcare%20product%20photography%2C%20clean%20white%20background&width=300&height=300&seq=product2&orientation=squarish',
      rating: 4.6,
      reviews: 89,
      isOnSale: false
    },
    {
      id: 3,
      name: '舒緩保濕私密護理霜',
      price: 'NT$ 750',
      originalPrice: 'NT$ 920',
      image: 'https://readdy.ai/api/search-image?query=Soothing%20moisturizing%20intimate%20care%20cream%20jar%2C%20premium%20skincare%20product%2C%20elegant%20packaging%2C%20professional%20product%20photography&width=300&height=300&seq=product3&orientation=squarish',
      rating: 4.9,
      reviews: 203,
      isOnSale: true
    },
    {
      id: 4,
      name: '益生菌私密護理膠囊',
      price: 'NT$ 1,280',
      image: 'https://readdy.ai/api/search-image?query=Probiotic%20intimate%20health%20supplement%20capsules%20bottle%2C%20healthcare%20supplement%2C%20clean%20medical%20product%20photography%2C%20professional%20packaging&width=300&height=300&seq=product4&orientation=squarish',
      rating: 4.7,
      reviews: 124,
      isOnSale: false
    }
  ];

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = article.title;
    
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

  const handleProductClick = (productId: number) => {
    navigate('/product');
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Article Hero Section */}
      <div className="relative w-full overflow-hidden">
        <div className="w-full h-96">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end">
          <div className="w-full max-w-6xl mx-auto px-6 pb-8">
            <div className="text-white">
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 text-sm font-medium bg-white/20 backdrop-blur-sm">
                  {article.category}
                </span>
                <span className="text-sm opacity-90">{article.readTime}</span>
                <span className="text-sm opacity-90">{article.date}</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                {article.title}
              </h1>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm opacity-90">
                  <span>作者：{article.author}</span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm opacity-90">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="page-content">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm mb-12" style={{ color: '#747775' }}>
            <button onClick={() => navigate('/')} className="cursor-pointer" style={{ color: '#747775' }}>
              首頁
            </button>
            <i className="ri-arrow-right-s-line"></i>
            <button onClick={() => navigate('/community')} className="cursor-pointer" style={{ color: '#747775' }}>
              健康知識
            </button>
            <i className="ri-arrow-right-s-line"></i>
            <span style={{ color: '#000000' }}>文章詳情</span>
          </nav>

          <div className="flex flex-col lg:flex-row gap-12">
            {/* Main Content */}
            <article className="flex-1">
              {/* Article Actions */}
              <div className="flex items-center justify-between mb-12 pb-8 border-b" style={{ borderColor: '#CDCDCD' }}>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className={`flex items-center space-x-2 px-6 py-3 border transition-colors cursor-pointer ${
                      isLiked 
                        ? 'border-red-300 bg-red-50 text-red-600' 
                        : 'border-gray-300 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    <i className={`${isLiked ? 'ri-heart-fill' : 'ri-heart-line'}`}></i>
                    <span className="text-sm font-medium">喜歡 ({article.likes + (isLiked ? 1 : 0)})</span>
                  </button>
                  
                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className={`flex items-center space-x-2 px-6 py-3 border transition-colors cursor-pointer ${
                      isBookmarked 
                        ? 'text-white' 
                        : 'hover:text-white'
                    }`}
                    style={{
                      backgroundColor: isBookmarked ? '#225B4F' : undefined,
                      borderColor: isBookmarked ? '#225B4F' : '#CDCDCD'
                    }}
                    onMouseEnter={(e) => {
                      if (!isBookmarked) {
                        e.currentTarget.style.backgroundColor = '#225B4F';
                        e.currentTarget.style.borderColor = '#225B4F';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isBookmarked) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#CDCDCD';
                        e.currentTarget.style.color = '#555555';
                      }
                    }}
                  >
                    <i className={`${isBookmarked ? 'ri-bookmark-fill' : 'ri-bookmark-line'}`}></i>
                    <span className="text-sm font-medium">收藏</span>
                  </button>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="flex items-center space-x-2 px-6 py-3 border transition-colors cursor-pointer"
                    style={{ borderColor: '#CDCDCD', color: '#555555' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#225B4F';
                      e.currentTarget.style.borderColor = '#225B4F';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = '#CDCDCD';
                      e.currentTarget.style.color = '#555555';
                    }}
                  >
                    <i className="ri-share-line"></i>
                    <span className="text-sm font-medium">分享</span>
                  </button>

                  {showShareMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-white border shadow-lg z-10 min-w-48" style={{ borderColor: '#CDCDCD' }}>
                      <button
                        onClick={() => handleShare('facebook')}
                        className="w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
                        style={{ color: '#555555' }}
                      >
                        <i className="ri-facebook-fill mr-3 text-blue-600"></i>
                        分享到 Facebook
                      </button>
                      <button
                        onClick={() => handleShare('line')}
                        className="w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
                        style={{ color: '#555555' }}
                      >
                        <i className="ri-line-fill mr-3 text-green-500"></i>
                        分享到 LINE
                      </button>
                      <button
                        onClick={() => handleShare('twitter')}
                        className="w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
                        style={{ color: '#555555' }}
                      >
                        <i className="ri-twitter-fill mr-3 text-blue-400"></i>
                        分享到 Twitter
                      </button>
                      <button
                        onClick={() => handleShare('copy')}
                        className="w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
                        style={{ color: '#555555' }}
                      >
                        <i className="ri-file-copy-line mr-3"></i>
                        複製連結
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Article Content */}
              <div 
                className="prose prose-lg max-w-none"
                style={{
                  '--tw-prose-body': '#555555',
                  '--tw-prose-headings': '#000000',
                  '--tw-prose-links': '#225B4F',
                  '--tw-prose-bold': '#000000',
                  '--tw-prose-counters': '#747775',
                  '--tw-prose-bullets': '#CDCDCD',
                  '--tw-prose-hr': '#CDCDCD',
                  '--tw-prose-quotes': '#000000',
                  '--tw-prose-quote-borders': '#CDCDCD',
                  '--tw-prose-captions': '#747775',
                  '--tw-prose-code': '#000000',
                  '--tw-prose-pre-code': '#CDCDCD',
                  '--tw-prose-pre-bg': '#1F1F1F',
                  '--tw-prose-th-borders': '#CDCDCD',
                  '--tw-prose-td-borders': '#CDCDCD'
                } as any}
                dangerouslySetInnerHTML={{ __html: article.content }}
              />

              {/* Tags */}
              <div className="mt-16 pt-8 border-t" style={{ borderColor: '#CDCDCD' }}>
                <h3 className="text-lg font-semibold mb-6" style={{ color: '#000000' }}>相關標籤</h3>
                <div className="flex flex-wrap gap-3">
                  {article.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-4 py-2 text-sm cursor-pointer hover:text-white transition-colors"
                      style={{ 
                        backgroundColor: '#F7F7F5',
                        color: '#555555'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#225B4F';
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F7F7F5';
                        e.currentTarget.style.color = '#555555';
                      }}
                      onClick={() => navigate('/community')}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Author Info */}
              <div className="mt-16 p-8 border" style={{ backgroundColor: '#F7F7F5', borderColor: '#CDCDCD' }}>
                <div className="flex items-start space-x-6">
                  <div className="w-20 h-20 flex items-center justify-center" style={{ backgroundColor: '#BBBBBB' }}>
                    <i className="ri-user-line text-3xl" style={{ color: '#555555' }}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-3" style={{ color: '#000000' }}>{article.author}</h3>
                    <p className="mb-6 leading-relaxed" style={{ color: '#555555' }}>{article.authorBio}</p>
                    <div className="flex items-center space-x-6">
                      <button className="text-sm font-medium cursor-pointer hover:opacity-80" style={{ color: '#225B4F' }}>
                        查看更多文章
                      </button>
                      <button className="text-sm font-medium cursor-pointer hover:opacity-80" style={{ color: '#225B4F' }}>
                        關注作者
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="lg:w-80">
              {/* Table of Contents */}
              <div className="bg-white border p-6 mb-8" style={{ borderColor: '#CDCDCD' }}>
                <h3 className="text-lg font-semibold mb-6" style={{ color: '#000000' }}>文章目錄</h3>
                <nav className="space-y-3">
                  <a href="#" className="block text-sm cursor-pointer transition-colors" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>為什麼私密護理如此重要？</a>
                  <a href="#" className="block text-sm cursor-pointer transition-colors" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>正確的私密護理步驟</a>
                  <a href="#" className="block text-sm cursor-pointer transition-colors pl-4" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>1. 選擇合適的清潔產品</a>
                  <a href="#" className="block text-sm cursor-pointer transition-colors pl-4" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>2. 正確的清潔方式</a>
                  <a href="#" className="block text-sm cursor-pointer transition-colors pl-4" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>3. 內衣的選擇與護理</a>
                  <a href="#" className="block text-sm cursor-pointer transition-colors" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>常見的護理誤區</a>
                  <a href="#" className="block text-sm cursor-pointer transition-colors" style={{ color: '#555555' }} onMouseEnter={(e) => e.currentTarget.style.color = '#225B4F'} onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}>何時需要尋求專業幫助</a>
                </nav>
              </div>

              {/* Recommended Products */}
              <div className="bg-white border p-6 mb-8" style={{ borderColor: '#CDCDCD' }}>
                <h3 className="text-lg font-semibold mb-6" style={{ color: '#000000' }}>推薦相關產品</h3>
                <div className="space-y-6">
                  {recommendedProducts.map((product) => (
                    <div 
                      key={product.id}
                      className="cursor-pointer group"
                      onClick={() => handleProductClick(product.id)}
                    >
                      <div className="aspect-square overflow-hidden mb-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm line-clamp-2 group-hover:text-teal-600 transition-colors" style={{ color: '#000000' }}>
                          {product.name}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm" style={{ color: '#225B4F' }}>{product.price}</span>
                          {product.originalPrice && (
                            <span className="text-xs line-through" style={{ color: '#BBBBBB' }}>{product.originalPrice}</span>
                          )}
                          {product.isOnSale && (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-600">特價</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <i 
                                key={i} 
                                className={`ri-star-${i < Math.floor(product.rating) ? 'fill' : 'line'} text-xs`}
                                style={{ color: '#007AFF' }}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs" style={{ color: '#747775' }}>({product.reviews})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Articles */}
              <div className="bg-white border p-6" style={{ borderColor: '#CDCDCD' }}>
                <h3 className="text-lg font-semibold mb-6" style={{ color: '#000000' }}>相關文章</h3>
                <div className="space-y-6">
                  {relatedArticles.map((relatedArticle) => (
                    <article 
                      key={relatedArticle.id}
                      className="cursor-pointer group"
                      onClick={() => navigate('/blog')}
                    >
                      <div className="aspect-[16/10] overflow-hidden mb-3">
                        <img
                          src={relatedArticle.image}
                          alt={relatedArticle.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-white px-2 py-1" style={{ backgroundColor: '#225B4F' }}>
                          {relatedArticle.category}
                        </span>
                        <span className="text-xs" style={{ color: '#747775' }}>{relatedArticle.readTime}</span>
                      </div>
                      <h4 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-teal-600 transition-colors" style={{ color: '#000000' }}>
                        {relatedArticle.title}
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: '#555555' }}>
                        {relatedArticle.excerpt}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-20 pt-8 border-t" style={{ borderColor: '#CDCDCD' }}>
            <button 
              onClick={() => navigate('/community')}
              className="flex items-center cursor-pointer transition-colors"
              style={{ color: '#555555' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}
            >
              <i className="ri-arrow-left-line mr-2"></i>
              返回文章列表
            </button>
            
            <div className="flex items-center space-x-4">
              <button 
                className="flex items-center cursor-pointer transition-colors"
                style={{ color: '#555555' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}
              >
                <i className="ri-arrow-left-line mr-1"></i>
                上一篇
              </button>
              <button 
                className="flex items-center cursor-pointer transition-colors"
                style={{ color: '#555555' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#555555'}
              >
                下一篇
                <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <section className="py-20 px-6" style={{ backgroundColor: '#F7F7F5' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-12" style={{ color: '#000000' }}>讀者留言 ({article.comments})</h2>
            
            {/* Comment Form */}
            <div className="bg-white border p-8 mb-12" style={{ borderColor: '#CDCDCD' }}>
              <h3 className="text-lg font-semibold mb-6" style={{ color: '#000000' }}>發表留言</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#555555' }}>姓名</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    style={{ borderColor: '#CDCDCD' }}
                    placeholder="請輸入您的姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#555555' }}>留言內容</label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                    style={{ borderColor: '#CDCDCD' }}
                    placeholder="分享您的想法..."
                  ></textarea>
                </div>
                <button className="px-8 py-3 text-white font-medium hover:opacity-90 transition-colors cursor-pointer whitespace-nowrap" style={{ backgroundColor: '#225B4F' }}>
                  發表留言
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-8">
              {[1, 2, 3].map((comment) => (
                <div key={comment} className="bg-white border p-8" style={{ borderColor: '#CDCDCD' }}>
                  <div className="flex items-start space-x-6">
                    <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: '#BBBBBB' }}>
                      <i className="ri-user-line" style={{ color: '#555555' }}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="font-semibold" style={{ color: '#000000' }}>讀者{comment}</span>
                        <span className="text-sm" style={{ color: '#747775' }}>2024年1月{15 - comment}日</span>
                      </div>
                      <p className="mb-4 leading-relaxed" style={{ color: '#555555' }}>
                        非常實用的文章！我一直在尋找正確的私密護理方式，這篇文章解答了我很多疑問。特別是關於產品選擇的部分，讓我知道該注意哪些成分。
                      </p>
                      <div className="flex items-center space-x-6">
                        <button className="flex items-center text-sm cursor-pointer transition-colors" style={{ color: '#747775' }} onMouseEnter={(e) => e.currentTarget.style.color = '#007AFF'} onMouseLeave={(e) => e.currentTarget.style.color = '#747775'}>
                          <i className="ri-heart-line mr-1"></i>
                          喜歡 (5)
                        </button>
                        <button className="text-sm cursor-pointer transition-colors" style={{ color: '#747775' }} onMouseEnter={(e) => e.currentTarget.style.color = '#000000'} onMouseLeave={(e) => e.currentTarget.style.color = '#747775'}>
                          回覆
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
