
import { useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function AboutPage() {
  useEffect(() => {
    document.title = '品牌故事 - LUCISSI CARE 私密護理專家';
    
    // SEO meta tags
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', '了解 LUCISSI CARE 的品牌故事，從性感到健康，自信始於內在的美好平衡。結合韓國專業技術與溫柔科學，為現代女性打造日常私密護理新標準。');
    }
    
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', '品牌故事, LUCISSI CARE, 私密護理, 女性健康, 韓國技術, 溫柔科學');
    }
  }, []);

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5', paddingTop: '122px' }}>
        {/* Hero Section with Background Image */}
        <section 
          className="relative py-32 lg:py-40 overflow-hidden"
          style={{
            backgroundImage: `url('https://readdy.ai/api/search-image?query=Elegant%20modern%20woman%20in%20comfortable%20intimate%20wear%2C%20natural%20confident%20pose%2C%20soft%20natural%20lighting%2C%20minimalist%20bedroom%20setting%2C%20Korean%20beauty%20aesthetic%2C%20self-care%20moment%2C%20peaceful%20and%20serene%20atmosphere%2C%20clean%20white%20background%2C%20high-end%20luxury%20feel%2C%20sophisticated%20beauty%20portrait&width=1920&height=800&seq=hero-background-elegant&orientation=landscape')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent"></div>
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-3xl">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight">
                LUCISSI CARE
              </h1>
              <p className="text-2xl md:text-3xl text-white/95 mb-6 leading-relaxed font-light">
                品牌故事
              </p>
              <p className="text-xl md:text-2xl text-white/90 leading-relaxed font-light">
                從性感到健康，自信始於「內在的美好平衡」
              </p>
            </div>
          </div>
        </section>

        {/* Brand Philosophy */}
        <section className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-12 leading-tight" style={{ color: '#225B4F' }}>
                我們的信念
              </h2>
              <p className="text-xl md:text-2xl text-gray-700 max-w-5xl mx-auto leading-relaxed font-light">
                我們相信，性感不是外在的姿態，而是內在的平衡與自信。<br />
                LUCISSI CARE 誕生於這個信念——讓每一位女性在日常中，<br />
                都能以最自然、最舒適的狀態，照顧自己最親密的部分。
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
              <div className="relative">
                <div className="overflow-hidden rounded-3xl shadow-2xl">
                  <img
                    src="https://readdy.ai/api/search-image?query=Modern%20confident%20woman%20in%20elegant%20intimate%20wear%2C%20natural%20beauty%20portrait%2C%20soft%20morning%20light%20streaming%20through%20window%2C%20minimalist%20bedroom%20setting%2C%20Korean%20skincare%20aesthetic%2C%20self-care%20routine%2C%20peaceful%20atmosphere%2C%20luxury%20lifestyle%2C%20sophisticated%20beauty&width=700&height=600&seq=brand-philosophy-modern&orientation=portrait"
                    alt="品牌理念"
                    className="w-full h-96 lg:h-[500px] object-cover object-center"
                  />
                </div>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-20" style={{ backgroundColor: '#225B4F' }}></div>
              </div>
              
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                    自然與科學的平衡
                  </h3>
                  <p className="text-gray-700 text-lg leading-relaxed font-light">
                    結合天然成分與科學技術，為女性打造最溫和有效的護理體驗。
                  </p>
                </div>
                
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                    內在美的體現
                  </h3>
                  <p className="text-gray-700 text-lg leading-relaxed font-light">
                    真正的美麗源於內在的自信與健康，我們致力於喚醒每位女性的內在光芒。
                  </p>
                </div>
                
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                    日常的儀式感
                  </h3>
                  <p className="text-gray-700 text-lg leading-relaxed font-light">
                    將護理轉化為日常的自我關愛儀式，讓每一刻都充滿愛自己的溫柔。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gentle Science Section */}
        <section className="py-24 lg:py-32" style={{ backgroundColor: '#EBF3EC' }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-8 leading-tight" style={{ color: '#225B4F' }}>
                溫柔科學
              </h2>
              <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light">
                專為女性而生的護理哲學
              </p>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-12 mb-20">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-flask-line text-3xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                  韓國專業技術
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  結合韓國專業私密護理品牌 Saengak 的先進技術與研發成果
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-leaf-line text-3xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                  天然成分
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  精選天然植物萃取，溫和呵護女性最敏感的肌膚部位
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-heart-line text-3xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                  溫柔呵護
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  以女性身體的自然節奏為出發點，追求安全、平衡與相容性
                </p>
              </div>
            </div>

            <div className="bg-white p-12 lg:p-16 rounded-3xl shadow-xl">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h3 className="text-3xl font-bold mb-8 leading-tight" style={{ color: '#225B4F' }}>
                    科學與溫柔的完美結合
                  </h3>
                  <div className="space-y-6 text-gray-700 text-lg leading-relaxed font-light">
                    <p>
                      LUCISSI CARE 結合 <strong className="font-semibold">韓國專業私密護理品牌 Saengak 的技術</strong> 與
                      LUCISSI 長期在女性時尚與身體美學的洞察。
                    </p>
                    <p>
                      我們希望用「<span style={{ color: '#225B4F' }} className="font-semibold">溫柔 × 科學</span>」的方式，
                      讓護理不再只是功能，而是日常自我關懷的一部分。
                    </p>
                    <p>
                      從清潔、修護、保濕到舒緩，每一項產品都以女性身體的自然節奏為出發點，
                      追求安全、平衡、與肌膚真正的相容性。
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div className="overflow-hidden rounded-2xl shadow-xl">
                    <img
                      src="https://readdy.ai/api/search-image?query=Korean%20skincare%20laboratory%20with%20natural%20ingredients%2C%20scientific%20research%20equipment%2C%20botanical%20extracts%20and%20essential%20oils%2C%20clean%20modern%20laboratory%20setting%2C%20professional%20female%20scientists%2C%20gentle%20science%20concept%2C%20minimalist%20aesthetic%2C%20luxury%20beauty%20industry%2C%20sophisticated%20research%20environment&width=600&height=500&seq=gentle-science-modern&orientation=landscape"
                      alt="溫柔科學"
                      className="w-full h-80 lg:h-96 object-cover object-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Confidence Design Section */}
        <section className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-8 leading-tight" style={{ color: '#225B4F' }}>
                為自信而設計
              </h2>
              <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light">
                每一種「自信的樣子」都值得被呵護
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center mb-20">
              <div>
                <h3 className="text-3xl lg:text-4xl font-bold mb-10 leading-tight" style={{ color: '#225B4F' }}>
                  重新定義女性美學
                </h3>
                <div className="space-y-8 text-gray-700 text-lg leading-relaxed font-light">
                  <p>
                    我們懂得，女性的自信不只存在於鏡子前。<br />
                    它藏在肌膚的舒適、氣味的自在、<br />
                    以及那份「我在照顧自己」的心安裡。
                  </p>
                  <p>
                    LUCISSI CARE 不只是護理品牌，<br />
                    更是一種「<span style={{ color: '#225B4F' }} className="font-semibold">從內而外愛自己</span>」的生活方式。
                  </p>
                  <p>
                    從日常清潔到內著選擇，我們陪伴妳探索身體與感受的連結，
                    讓每一刻的親密，都不再需要妥協。
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="overflow-hidden rounded-3xl shadow-2xl">
                  <img
                    src="https://readdy.ai/api/search-image?query=Confident%20modern%20woman%20in%20elegant%20intimate%20wear%2C%20ballet-inspired%20pose%2C%20natural%20beauty%2C%20self-care%20routine%2C%20comfortable%20home%20environment%2C%20soft%20morning%20light%2C%20minimalist%20aesthetic%2C%20Korean%20beauty%20style%2C%20luxury%20lifestyle%2C%20sophisticated%20atmosphere%2C%20empowering%20portrait&width=600&height=500&seq=confidence-design-empowering&orientation=landscape"
                    alt="自信設計"
                    className="w-full h-80 lg:h-96 object-cover object-center"
                  />
                </div>
                <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-20" style={{ backgroundColor: '#225B4F' }}></div>
              </div>
            </div>

            {/* Values Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-user-heart-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  個人化護理
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  針對不同需求提供客製化解決方案
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-shield-check-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  安全保證
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  嚴格品質控管，確保產品安全性
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-earth-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  環保理念
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  可持續發展的環保包裝設計
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-community-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  社群支持
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  建立女性互助支持的溫暖社群
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-24 lg:py-32" style={{ backgroundColor: '#EBF3EC' }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-8" style={{ color: '#225B4F' }}>
                我們的願景
              </h2>
              <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light">
                打造屬於現代女性的日常私密護理新標準
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mb-20">
              <div className="bg-white p-10 rounded-3xl shadow-lg text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-star-line text-3xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold mb-6 leading-tight" style={{ color: '#225B4F' }}>
                  讓女性的自信，<br />不再被定義
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  每個女性都有屬於自己的美麗方式，我們尊重並支持每一種選擇
                </p>
              </div>
              
              <div className="bg-white p-10 rounded-3xl shadow-lg text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-heart-pulse-line text-3xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold mb-6 leading-tight" style={{ color: '#225B4F' }}>
                  讓「性感」與「健康」<br />並存
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  真正的性感來自於健康的身體和內在的自信平衡
                </p>
              </div>
              
              <div className="bg-white p-10 rounded-3xl shadow-lg text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-hand-heart-line text-3xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold mb-6 leading-tight" style={{ color: '#225B4F' }}>
                  讓每個身體，<br />都被溫柔對待
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  用最溫和的方式呵護最私密的部分，這是我們的承諾
                </p>
              </div>
            </div>

            <div className="bg-white p-12 lg:p-16 rounded-3xl shadow-xl">
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-8" style={{ color: '#225B4F' }}>
                  持續創新的承諾
                </h3>
                <p className="text-gray-700 text-lg lg:text-xl leading-relaxed font-light max-w-5xl mx-auto">
                  LUCISSI CARE 將持續與全球優質品牌、醫學實驗室合作，<br />
                  引入安全有效的護理技術，<br />
                  同時堅持以簡約、自然、美感為設計語言，<br />
                  打造屬於現代女性的「<span style={{ color: '#225B4F' }} className="font-semibold">日常私密護理新標準</span>」。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Message Section */}
        <section className="py-24 lg:py-32">
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-gradient-to-br from-white to-gray-50 p-12 lg:p-20 rounded-3xl shadow-2xl text-center">
              <h2 className="text-4xl lg:text-5xl font-bold mb-12" style={{ color: '#225B4F' }}>
                我們想說的話
              </h2>
              <div className="mb-12">
                <p className="text-3xl lg:text-4xl text-gray-700 leading-relaxed mb-8 font-light">
                  妳的每一個選擇，<br />
                  都是愛自己的方式。
                </p>
                <div className="w-24 h-1 mx-auto mb-8" style={{ backgroundColor: '#225B4F' }}></div>
                <p className="text-lg lg:text-xl text-gray-600 leading-relaxed font-light max-w-3xl mx-auto">
                  在這個快節奏的世界裡，我們希望提醒每一位女性，<br />
                  停下來關愛自己，傾聽身體的聲音，<br />
                  因為妳值得最好的呵護。
                </p>
              </div>
              <div className="border-t pt-12" style={{ borderColor: '#EBF3EC' }}>
                <h3 className="text-3xl lg:text-4xl font-bold mb-6" style={{ color: '#225B4F' }}>
                  LUCISSI CARE
                </h3>
                <p className="text-xl lg:text-2xl text-gray-600 italic font-light">
                  from confidence to comfort, from sensuality to self-love.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24" style={{ backgroundColor: '#225B4F' }}>
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8">
              開始妳的自信之旅
            </h2>
            <p className="text-xl lg:text-2xl text-white/90 mb-12 leading-relaxed font-light">
              讓 LUCISSI CARE 陪伴妳探索身體與感受的連結，從內而外愛自己
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a
                href="/search"
                className="bg-white text-black px-12 py-5 rounded-full font-semibold hover:bg-gray-100 transition-all duration-200 whitespace-nowrap text-lg hover:scale-105 transform"
              >
                探索產品
              </a>
              <a
                href="/community"
                className="border-2 border-white text-white px-12 py-5 rounded-full font-semibold hover:bg-white hover:text-black transition-all duration-200 whitespace-nowrap text-lg hover:scale-105 transform"
              >
                加入社群
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
