import { useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function BrandStoryPage() {
  useEffect(() => {
    try {
      document.title = '品牌故事 - Saengak 韓國女性私密護理品牌';
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', '了解 Saengak 品牌故事，來自韓國的女性私密日常照護品牌，以溫和、安心、可長期使用為核心，與 INNERSÉN 心身平衡理念相互呼應，由內而外守護女性健康。');
      }
      
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', '品牌故事, Saengak, 韓國私密護理, 女性健康, INNERSÉN, 心身平衡, 溫和護理');
      }
    } catch (error) {
      console.error('Error setting meta tags:', error);
    }
  }, []);

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5', paddingTop: '122px' }}>
        {/* Hero Section */}
        <section 
          className="relative py-32 lg:py-40 overflow-hidden"
          style={{
            backgroundImage: `url('https://readdy.ai/api/search-image?query=Elegant%20Korean%20beauty%20product%20photography%2C%20minimalist%20white%20background%20with%20soft%20natural%20lighting%2C%20feminine%20intimate%20care%20products%20arranged%20artistically%2C%20clean%20modern%20aesthetic%2C%20professional%20product%20shot%2C%20gentle%20pastel%20tones%2C%20sophisticated%20luxury%20feel%2C%20botanical%20elements%20subtly%20placed%2C%20serene%20and%20calming%20atmosphere&width=1920&height=800&seq=saengak-hero-elegant&orientation=landscape')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent"></div>
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-3xl">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight">
                Saengak
              </h1>
              <p className="text-2xl md:text-3xl text-white/95 mb-6 leading-relaxed font-light">
                來自韓國的女性私密日常照護品牌
              </p>
              <p className="text-xl md:text-2xl text-white/90 leading-relaxed font-light">
                溫和、安心、可長期使用
              </p>
            </div>
          </div>
        </section>

        {/* Brand Introduction */}
        <section className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-12 leading-tight" style={{ color: '#225B4F' }}>
                關於 Saengak
              </h2>
              <p className="text-xl md:text-2xl text-gray-700 max-w-5xl mx-auto leading-relaxed font-light">
                Saengak 是來自韓國的女性私密護理品牌，長期深耕女性私密健康與日常舒緩照護，深受韓國市場信賴。<br />
                我們相信，私密不適不只是身體表面的問題，而是與壓力、情緒與生活節奏息息相關。
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
              <div className="relative">
                <div className="overflow-hidden rounded-3xl shadow-2xl">
                  <img
                    src="https://readdy.ai/api/search-image?query=Korean%20skincare%20laboratory%20with%20natural%20botanical%20ingredients%2C%20professional%20female%20scientist%20examining%20intimate%20care%20products%2C%20clean%20modern%20research%20facility%2C%20soft%20natural%20lighting%2C%20minimalist%20aesthetic%2C%20gentle%20science%20concept%2C%20luxury%20beauty%20industry%2C%20sophisticated%20research%20environment%2C%20calming%20atmosphere&width=700&height=600&seq=saengak-research-lab&orientation=portrait"
                    alt="Saengak 品牌理念"
                    className="w-full h-96 lg:h-[500px] object-cover object-center"
                  />
                </div>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-20" style={{ backgroundColor: '#225B4F' }}></div>
              </div>
              
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="w-16 h-16 mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                    <i className="ri-heart-pulse-line text-2xl" style={{ color: '#225B4F' }}></i>
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                    深耕女性私密健康
                  </h3>
                  <p className="text-gray-700 text-lg leading-relaxed font-light">
                    長期專注於女性私密健康與日常舒緩照護，深受韓國市場信賴與喜愛。
                  </p>
                </div>
                
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="w-16 h-16 mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                    <i className="ri-emotion-line text-2xl" style={{ color: '#225B4F' }}></i>
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                    身心連結的理解
                  </h3>
                  <p className="text-gray-700 text-lg leading-relaxed font-light">
                    私密不適不只是身體表面的問題，而是與壓力、情緒與生活節奏息息相關。
                  </p>
                </div>
                
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="w-16 h-16 mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                    <i className="ri-time-line text-2xl" style={{ color: '#225B4F' }}></i>
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                    日常照護陪伴
                  </h3>
                  <p className="text-gray-700 text-lg leading-relaxed font-light">
                    陪伴女性在每個生活節奏中，維持私密肌膚的舒適與穩定。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values Section */}
        <section className="py-24 lg:py-32" style={{ backgroundColor: '#EBF3EC' }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-8 leading-tight" style={{ color: '#225B4F' }}>
                溫和、安心、可長期使用
              </h2>
              <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light">
                Saengak 的產品核心理念
              </p>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-12 mb-20">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-leaf-line text-3xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                  溫和配方
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  不追求刺激性的即時效果，以溫和成分呵護私密肌膚
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-shield-check-line text-3xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                  安全保證
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  嚴格品質控管，確保每一款產品都安全可靠
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#225B4F' }}>
                  <i className="ri-calendar-check-line text-3xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#225B4F' }}>
                  日常可用
                </h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  適合長期使用，讓照護回歸自然與安心
                </p>
              </div>
            </div>

            <div className="bg-white p-12 lg:p-16 rounded-3xl shadow-xl">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h3 className="text-3xl font-bold mb-8 leading-tight" style={{ color: '#225B4F' }}>
                    陪伴每個生活節奏
                  </h3>
                  <div className="space-y-6 text-gray-700 text-lg leading-relaxed font-light">
                    <p>
                      Saengak 以<strong className="font-semibold">溫和、安全與日常可用</strong>為產品核心，
                      不追求刺激性的即時效果，而是陪伴女性在每個生活節奏中，
                      維持私密肌膚的舒適與穩定。
                    </p>
                    <p>
                      我們相信，真正的照護不是短暫的解決方案，
                      而是能夠<span style={{ color: '#225B4F' }} className="font-semibold">長期信賴、安心使用</span>的日常陪伴。
                    </p>
                    <p>
                      讓照護回歸自然與安心，這是 Saengak 對每一位女性的承諾。
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div className="overflow-hidden rounded-2xl shadow-xl">
                    <img
                      src="https://readdy.ai/api/search-image?query=Serene%20Korean%20woman%20in%20comfortable%20home%20setting%2C%20morning%20self-care%20routine%2C%20natural%20beauty%2C%20soft%20window%20light%2C%20minimalist%20bedroom%20interior%2C%20intimate%20care%20products%20on%20vanity%2C%20peaceful%20atmosphere%2C%20gentle%20lifestyle%20photography%2C%20sophisticated%20aesthetic%2C%20calming%20pastel%20tones&width=600&height=500&seq=saengak-daily-care&orientation=landscape"
                      alt="日常照護"
                      className="w-full h-80 lg:h-96 object-cover object-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INNERSÉN Connection Section */}
        <section className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-8 leading-tight" style={{ color: '#225B4F' }}>
                由內而外的照護理念
              </h2>
              <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light">
                Saengak × INNERSÉN 的完美結合
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center mb-20">
              <div className="relative">
                <div className="overflow-hidden rounded-3xl shadow-2xl">
                  <img
                    src="https://readdy.ai/api/search-image?query=Zen%20meditation%20and%20wellness%20concept%2C%20Korean%20woman%20in%20peaceful%20yoga%20pose%2C%20minimalist%20interior%20with%20natural%20elements%2C%20soft%20diffused%20lighting%2C%20intimate%20care%20products%20arranged%20artistically%2C%20holistic%20health%20aesthetic%2C%20mind-body%20balance%20theme%2C%20serene%20atmosphere%2C%20sophisticated%20lifestyle%20photography&width=600&height=500&seq=innersen-balance&orientation=landscape"
                    alt="心身平衡"
                    className="w-full h-80 lg:h-96 object-cover object-center"
                  />
                </div>
                <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-20" style={{ backgroundColor: '#225B4F' }}></div>
              </div>
              
              <div>
                <h3 className="text-3xl lg:text-4xl font-bold mb-10 leading-tight" style={{ color: '#225B4F' }}>
                  INNERSÉN 心身平衡理念
                </h3>
                <div className="space-y-8 text-gray-700 text-lg leading-relaxed font-light">
                  <p>
                    作為 <strong className="font-semibold">INNERSÉN 心身平衡理念</strong> 所引入的女性私密護理品牌，
                    Saengak 從身體感受層級出發，與 INNERSÉN 專注的內在調節理念相互呼應。
                  </p>
                  <p>
                    我們相信，真正的健康與美麗來自於<span style={{ color: '#225B4F' }} className="font-semibold">身心的和諧平衡</span>。
                    外在的照護需要內在的支持，內在的調節也需要外在的呵護。
                  </p>
                  <p>
                    這種由內而外的女性照護觀點，讓 Saengak 不僅僅是一個護理品牌，
                    更是女性追求整體健康與幸福的重要夥伴。
                  </p>
                </div>
              </div>
            </div>

            {/* Values Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-body-scan-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  身體感受
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  從身體感受層級出發的照護方式
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-mental-health-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  內在調節
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  專注於內在平衡的調節理念
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-heart-add-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  外在呵護
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  溫和有效的外在護理支持
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg text-center hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EBF3EC' }}>
                  <i className="ri-balance-line text-2xl" style={{ color: '#225B4F' }}></i>
                </div>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#225B4F' }}>
                  整體平衡
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-light">
                  追求身心和諧的整體健康
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Promise Section */}
        <section className="py-24 lg:py-32" style={{ backgroundColor: '#EBF3EC' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-white p-12 lg:p-20 rounded-3xl shadow-2xl text-center">
              <h2 className="text-4xl lg:text-5xl font-bold mb-12" style={{ color: '#225B4F' }}>
                Saengak × INNERSÉN
              </h2>
              <div className="mb-12">
                <p className="text-3xl lg:text-4xl text-gray-700 leading-relaxed mb-8 font-light">
                  由內而外，<br />
                  守護女性的心身平衡。
                </p>
                <div className="w-24 h-1 mx-auto mb-8" style={{ backgroundColor: '#225B4F' }}></div>
                <p className="text-lg lg:text-xl text-gray-600 leading-relaxed font-light max-w-3xl mx-auto">
                  我們相信，真正的美麗與健康來自於身心的和諧。<br />
                  Saengak 與 INNERSÉN 攜手，為每一位女性提供全方位的照護，<br />
                  讓妳在每個生活節奏中，都能感受到身心的平衡與舒適。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24" style={{ backgroundColor: '#225B4F' }}>
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8">
              體驗 Saengak 的溫柔照護
            </h2>
            <p className="text-xl lg:text-2xl text-white/90 mb-12 leading-relaxed font-light">
              讓我們陪伴妳，在每個生活節奏中維持私密肌膚的舒適與穩定
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a
                href="/search"
                className="bg-white text-black px-12 py-5 rounded-full font-semibold hover:bg-gray-100 transition-all duration-200 whitespace-nowrap text-lg hover:scale-105 transform cursor-pointer"
              >
                探索產品
              </a>
              <a
                href="/community"
                className="border-2 border-white text-white px-12 py-5 rounded-full font-semibold hover:bg-white hover:text-black transition-all duration-200 whitespace-nowrap text-lg hover:scale-105 transform cursor-pointer"
              >
                了解更多
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
