import { Link } from 'react-router-dom';
import { siteContent } from '../../content/site';
import { ENDORSEMENT, LUCISSI_URL } from '../../content/carePillars';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200" style={{ backgroundColor: '#F8F5F1' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 母品牌背書 */}
        <div className="mb-12 flex flex-col gap-4 border-b border-gray-200 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-medium tracking-[0.18em] text-brand">BY LUCISSI</p>
            <p className="text-base leading-relaxed text-gray-600">
              {siteContent.brandName} 是 {ENDORSEMENT}，為妳挑選私密與身體保養、舒適內搭與輕盈運動用品。
            </p>
          </div>
          <a
            href={LUCISSI_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex shrink-0 self-start border-b border-brand pb-1 text-sm font-medium text-brand md:self-auto"
          >
            前往 LUCISSI<span aria-hidden="true" className="ml-3">↗</span>
          </a>
        </div>

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
                  訂單查詢
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
                  客服中心
                </Link>
              </li>
              <li>
                <a 
                  href={`mailto:${siteContent.companyEmail}`}
                  className="text-base text-gray-600 hover:text-brand transition-colors flex items-center gap-1.5"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  <i className="ri-mail-line text-lg"></i>
                  {siteContent.companyEmail}
                </a>
              </li>
              <li className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {siteContent.supportSafetyNotice}
              </li>
            </ul>
          </div>

          {/* 品牌 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              品牌
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/about" className="text-base text-gray-600 hover:text-gray-900 transition-colors">
                  關於我們
                </Link>
              </li>
              <li>
                <Link to="/community" className="text-base text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2">
                  <i className="ri-article-line text-xl"></i>
                  LUCISSI Talk
                </Link>
              </li>
              <li>
                <Link to="/promotion" className="text-base text-gray-600 hover:text-gray-900 transition-colors">
                  優惠活動
                </Link>
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
                © 2026 {siteContent.brandName}. All rights reserved.
              </p>
              <p className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                公司名稱：{siteContent.legalName}
              </p>
              <p className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                統一編號：{siteContent.taxId}
              </p>
              <p className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                電子郵件：<a href={`mailto:${siteContent.companyEmail}`} className="hover:text-gray-700 transition-colors">{siteContent.companyEmail}</a>
              </p>
              <p className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                登記地址：{siteContent.registeredAddress}
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
          </div>
        </div>
      </div>
    </footer>
  );
}
