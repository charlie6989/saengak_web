import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200" style={{ backgroundColor: '#FFFEF2' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 主要內容區域 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* 客戶服務 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              客戶服務
            </h3>
            <ul className="space-y-4">
              <li>
                <Link 
                  to="/faq" 
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  常見問題
                </Link>
              </li>
              <li>
                <Link 
                  to="/order-status" 
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  訂單狀態
                </Link>
              </li>
              <li>
                <Link 
                  to="/return-policy" 
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  退換貨說明
                </Link>
              </li>
            </ul>
          </div>

          {/* 聯絡我們 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              聯絡我們
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  to="/customer-service" 
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  一對一諮詢
                </Link>
              </li>
              <li className="text-base text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                週一至週五 9:30~18:00
              </li>
              <li className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                (國定例假日除外)
              </li>
            </ul>
          </div>

          {/* 社群 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              社群
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  to="/community" 
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  <i className="ri-article-line text-xl"></i>
                  健康知識分享
                </Link>
              </li>
              <li>
                <a 
                  href="https://www.instagram.com" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  <i className="ri-instagram-line text-xl"></i>
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 分隔線 */}
        <div className="border-t border-gray-200 pt-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-6 lg:space-y-0">
            {/* 版權資訊 */}
            <div className="flex flex-col space-y-2">
              <p className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                © 2024 LUCISSI. All rights reserved.
              </p>
            </div>

            {/* 法律連結 */}
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <Link 
                to="/terms" 
                className="text-gray-500 hover:text-gray-700 transition-colors"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                條款和協議
              </Link>
              <span className="text-gray-300">|</span>
              <Link 
                to="/adchoices" 
                className="text-gray-500 hover:text-gray-700 transition-colors"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                AdChoices
              </Link>
              <span className="text-gray-300">|</span>
              <Link 
                to="/privacy" 
                className="text-gray-500 hover:text-gray-700 transition-colors"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                隱私權
              </Link>
              <span className="text-gray-300">|</span>
              <Link 
                to="/sitemap" 
                className="text-gray-500 hover:text-gray-700 transition-colors"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                網站地圖
              </Link>
            </div>

            {/* Readdy 連結 */}
            <div>
              <a 
                href="https://readdy.ai/?origin=logo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                Powered by Readdy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
