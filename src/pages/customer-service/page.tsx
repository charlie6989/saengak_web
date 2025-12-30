import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function CustomerService() {

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />

      {/* Hero Section */}
      <div
        className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(20, 184, 166, 0.85), rgba(20, 184, 166, 0.85)), url('https://readdy.ai/api/search-image?query=Professional%20customer%20service%20team%20working%20in%20modern%20office%20environment%20with%20headsets%20and%20computers%20friendly%20customer%20support%20representatives%20clean%20business%20atmosphere%20professional%20lighting%20warm%20welcoming%20atmosphere&width=1920&height=600&seq=customer-service-hero-v2&orientation=landscape')`
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">客服中心</h1>
          <p className="text-base sm:text-lg lg:text-xl text-white/90 mb-4 sm:mb-8">我們隨時為您提供專業的諮詢服務</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm sm:text-base text-white/80">
            <div className="flex items-center gap-2">
              <i className="ri-time-line text-lg"></i>
              <span>週一至週五 9:30-18:00</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-customer-service-2-line text-lg"></i>
              <span>即時線上客服</span>
            </div>
          </div>
        </div>
      </div>

      <main className="pb-16">
        <div className="max-w-5xl mx-auto px-4">
          {/* Chat Guidance */}
          <div className="bg-white rounded-xl shadow-xl overflow-hidden -mt-8 sm:-mt-10 relative z-10 border border-gray-100 p-8 text-center max-w-3xl mx-auto">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-chat-smile-2-line text-3xl text-teal-600"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">需要即時協助嗎？</h2>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              點擊右下角的 <span className="font-semibold text-teal-600">對話圖示</span>，我們的線上客服團隊隨時為您服務。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
                <i className="ri-time-line text-teal-600"></i>
                <span>平均回覆時間：5 分鐘內</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
                <i className="ri-user-smile-line text-teal-600"></i>
                <span>真人客服線上服務</span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="mt-12 sm:mt-16">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">其他聯絡方式</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-time-line text-teal-600 text-2xl"></i>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2 text-center text-base sm:text-lg">服務時間</h4>
                <p className="text-gray-600 text-sm text-center">週一至週五</p>
                <p className="text-gray-600 text-sm text-center">9:30 - 18:00</p>
                <p className="text-gray-500 text-xs text-center mt-1">(國定例假日除外)</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-mail-line text-teal-600 text-2xl"></i>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2 text-center text-base sm:text-lg">電子郵件</h4>
                <a href="mailto:service@lucissi.com" className="text-teal-600 hover:text-teal-700 text-sm block text-center transition-colors duration-200">
                  service@lucissi.com
                </a>
                <p className="text-gray-500 text-xs text-center mt-1">24小時內回覆</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-100 sm:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-question-line text-teal-600 text-2xl"></i>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2 text-center text-base sm:text-lg">常見問題</h4>
                <p className="text-gray-600 text-sm text-center mb-2">查看常見問題解答</p>
                <a href="/faq" className="text-teal-600 hover:text-teal-700 text-sm font-medium block text-center transition-colors duration-200">
                  前往 FAQ →
                </a>
              </div>
            </div>
          </div>

          {/* Service Features */}
          <div className="mt-12 sm:mt-16 bg-gradient-to-br from-teal-50 to-white rounded-xl p-6 sm:p-8 border border-teal-100">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 text-center">我們的服務承諾</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="ri-check-line text-white text-lg"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">快速回應</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">工作時間內 5 分鐘內回覆</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="ri-check-line text-white text-lg"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">專業諮詢</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">專業團隊提供產品建議</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="ri-check-line text-white text-lg"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">隱私保護</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">對話內容加密保護</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="ri-check-line text-white text-lg"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">貼心服務</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">用心解決每個問題</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
