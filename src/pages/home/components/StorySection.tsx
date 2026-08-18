import { Link, useNavigate } from 'react-router-dom';

export default function StorySection() {
  const navigate = useNavigate();
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 標題區域 */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
            SAENGAK Talk｜私密對話
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
                SAENGAK 希望以清楚、容易理解的方式整理女性日常護理商品資訊，讓每個人都能依自己的需求做選擇。
              </p>
              <p className="leading-relaxed">
                商品成分、測試、認證與使用方式，以原廠文件、正式商品欄位及包裝標示為準；尚未取得來源的資訊不自行推定。
              </p>
              <p className="leading-relaxed">
                從選品到內容呈現，我們重視資料可追溯、說明不誇大，也提醒使用者有疑問時諮詢合格專業人員。
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
                成分透明
              </h4>
              <p className="text-gray-600 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                只顯示有正式來源的成分、測試與認證資料
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full" style={{ backgroundColor: '#EBF3EC' }}>
                <i className="ri-award-line text-2xl" style={{ color: '#225B4F' }}></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                資料審核
              </h4>
              <p className="text-gray-600 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                商品宣稱須能回到原廠文件、商品欄位或包裝標示
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
