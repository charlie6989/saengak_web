import { Link, useNavigate } from 'react-router-dom';

export default function StorySection() {
  const navigate = useNavigate();
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 標題區域 */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
            LUCISSI Talk｜私密對話
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
            談身體，也談心
          </p>
        </div>

        {/* 品牌故事內容 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* 左側圖片 */}
          <div className="order-2 lg:order-1">
            <img
              src="https://readdy.ai/api/search-image?query=Professional%20female%20entrepreneur%20in%20modern%20office%20environment%2C%20confident%20business%20woman%20representing%20feminine%20care%20brand%2C%20clean%20minimalist%20workspace%2C%20natural%20lighting%2C%20Korean%20business%20professional&width=600&height=400&seq=brand-story&orientation=landscape"
              alt="品牌創辦人"
              className="w-full h-96 object-cover object-top rounded-lg"
            />
          </div>

          {/* 右側內容 */}
          <div className="order-1 lg:order-2">
            <h3 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              我們的使命
            </h3>
            <div className="space-y-6 text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <p className="leading-relaxed">
                內心想法品牌創立於對女性健康的深切關懷。我們發現市場上缺乏真正了解女性需求的私密護理產品，因此決定創造一個專為亞洲女性設計的品牌。
              </p>
              <p className="leading-relaxed">
                我們與專業醫師和研發團隊合作，使用天然溫和的成分，確保每一款產品都能為女性帶來安全、有效的護理體驗。
              </p>
              <p className="leading-relaxed">
                從產品研發到包裝設計，我們都秉持著「以女性為中心」的理念，希望透過我們的產品，讓每位女性都能自信地擁抱自己的美麗。
              </p>
            </div>

            <div className="mt-8">
              <Link
                to="/community"
                className="inline-flex items-center justify-center px-8 py-3 font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap border"
                style={{ 
                  fontFamily: "Noto Sans TC, sans-serif",
                  backgroundColor: '#225B4F',
                  color: '#FFFFFF',
                  borderColor: '#225B4F',
                  fontSize: '16px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a4a3f';
                  e.currentTarget.style.borderColor = '#1a4a3f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#225B4F';
                  e.currentTarget.style.borderColor = '#225B4F';
                }}
              >
                了解更多健康知識
                <i className="ri-arrow-right-line ml-2 w-4 h-4 flex items-center justify-center"></i>
              </Link>
            </div>
          </div>
        </div>

        {/* 品牌價值 */}
        <div className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full" style={{ backgroundColor: '#EBF3EC' }}>
                <i className="ri-heart-line text-2xl" style={{ color: '#225B4F' }}></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                用心關懷
              </h4>
              <p className="text-gray-600 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                深度了解女性需求，提供最貼心的護理解決方案
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full" style={{ backgroundColor: '#EBF3EC' }}>
                <i className="ri-leaf-line text-2xl" style={{ color: '#225B4F' }}></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                天然安全
              </h4>
              <p className="text-gray-600 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                嚴選天然成分，確保產品的安全性和溫和性
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full" style={{ backgroundColor: '#EBF3EC' }}>
                <i className="ri-award-line text-2xl" style={{ color: '#225B4F' }}></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                專業品質
              </h4>
              <p className="text-gray-600 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                與醫療專家合作，確保每款產品都達到專業標準
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
