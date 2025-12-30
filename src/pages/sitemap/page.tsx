import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

const SitemapPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    document.title = '網站地圖 - LUCISSI CARE | 探索完整網站結構';
    
    // SEO meta tags
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', '瀏覽 LUCISSI 完整網站地圖，快速找到您需要的頁面和功能。包含產品分類、客戶服務、政策條款等所有重要連結，提供最佳的網站導航體驗。');
    }
    
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', '網站地圖, 導航, 頁面索引, 網站結構, 快速導航, LUCISSI, 女性護理');
    }
  }, []);

  const siteStructure = [
    {
      category: '主要頁面',
      icon: 'ri-home-line',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      links: [
        { name: '首頁', url: '/', description: '探索 LUCISSI 精選產品和最新優惠活動' },
        { name: '產品搜尋', url: '/search', description: '搜尋和瀏覽所有女性護理產品' },
        { name: '社群', url: '/community', description: '加入我們的健康知識社群' },
        { name: '促銷活動', url: '/promotion', description: '查看最新優惠和促銷活動' },
        { name: '品牌故事', url: '/brand-story', description: '了解 LUCISSI 的品牌理念' },
      ]
    },
    {
      category: '用戶服務',
      icon: 'ri-user-line',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      links: [
        { name: '會員登入', url: '/login', description: '登入您的 LUCISSI 會員帳戶' },
        { name: '會員註冊', url: '/register', description: '註冊成為 LUCISSI 會員享受專屬優惠' },
        { name: '個人資料', url: '/profile', description: '管理您的個人資料和偏好設定' },
        { name: '忘記密碼', url: '/forgot-password', description: '重設您的帳戶密碼' },
        { name: '歡迎頁面', url: '/welcome', description: '新會員歡迎頁面和使用指南' },
      ]
    },
    {
      category: '客戶服務',
      icon: 'ri-customer-service-line',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      links: [
        { name: '一對一諮詢', url: '/customer-service', description: '聯繫我們的專業客服團隊' },
        { name: '常見問題', url: '/faq', description: '查看常見問題和詳細解答' },
        { name: '訂單狀態', url: '/order-status', description: '查詢和追蹤您的訂單狀態' },
        { name: '退換貨說明', url: '/return-policy', description: '了解退換貨政策和詳細流程' },
      ]
    },
    {
      category: '政策條款',
      icon: 'ri-file-text-line',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      links: [
        { name: '隱私權政策', url: '/privacy', description: '了解我們如何保護您的個人隱私' },
        { name: '使用條款', url: '/terms', description: '網站使用條款和服務規範' },
        { name: '網路訂購商品條款', url: '/terms-of-service', description: '線上購物服務條款和保障' },
        { name: 'AdChoices', url: '/adchoices', description: '廣告選擇和個人化偏好設定' },
      ]
    },
  ];

  const categories = [
    { id: 'all', name: '全部分類' },
    { id: '主要頁面', name: '主要頁面' },
    { id: '用戶服務', name: '用戶服務' },
    { id: '客戶服務', name: '客戶服務' },
    { id: '政策條款', name: '政策條款' },
  ];

  const filteredStructure = siteStructure.filter(section => {
    if (selectedCategory === 'all') return true;
    return section.category === selectedCategory;
  }).map(section => ({
    ...section,
    links: section.links.filter(link => 
      link.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.links.length > 0);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-2xl mb-6">
              <i className="ri-map-2-line text-3xl sm:text-4xl"></i>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              網站地圖
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed px-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              快速找到您需要的頁面和功能
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-gray-50 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            {/* Search Box */}
            <div className="mb-6 sm:mb-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜尋頁面或功能..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 pl-12 sm:pl-14 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                />
                <i className="ri-search-line absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg sm:text-xl"></i>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base font-medium transition-all duration-200 whitespace-nowrap ${
                    selectedCategory === category.id
                      ? 'bg-teal-600 text-white shadow-lg'
                      : 'bg-white text-teal-600 border-2 border-teal-600 hover:bg-teal-600 hover:text-white'
                  }`}
                  style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {filteredStructure.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <i className="ri-search-line text-5xl sm:text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-600 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              找不到相關頁面
            </h3>
            <p className="text-sm sm:text-base text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              請嘗試其他關鍵字或選擇不同的分類
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {filteredStructure.map((section, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                {/* Section Header */}
                <div className={`${section.bgColor} px-6 sm:px-8 py-5 sm:py-6`}>
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-sm`}>
                      <i className={`${section.icon} ${section.color} text-xl sm:text-2xl`}></i>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                      {section.category}
                    </h2>
                  </div>
                </div>

                {/* Section Links */}
                <div className="p-4 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    {section.links.map((link, linkIndex) => (
                      <Link
                        key={linkIndex}
                        to={link.url}
                        className="block p-4 sm:p-5 rounded-xl border border-gray-200 hover:border-teal-500 hover:shadow-md transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-teal-600 mb-1 sm:mb-2 transition-colors" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                              {link.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                              {link.description}
                            </p>
                          </div>
                          <i className="ri-arrow-right-line text-gray-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all ml-3 sm:ml-4 mt-1 text-lg sm:text-xl flex-shrink-0"></i>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-12 sm:mt-16 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            網站統計資訊
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            <div className="text-center bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-3xl sm:text-4xl font-bold text-teal-600 mb-2 sm:mb-3" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {siteStructure.reduce((total, section) => total + section.links.length, 0)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>總頁面數</div>
            </div>
            <div className="text-center bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-3xl sm:text-4xl font-bold text-teal-600 mb-2 sm:mb-3" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {siteStructure.length}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>主要分類</div>
            </div>
            <div className="text-center bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-3xl sm:text-4xl font-bold text-teal-600 mb-2 sm:mb-3" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {siteStructure.find(s => s.category === '客戶服務')?.links.length || 0}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>客服頁面</div>
            </div>
            <div className="text-center bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-3xl sm:text-4xl font-bold text-teal-600 mb-2 sm:mb-3" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {siteStructure.find(s => s.category === '政策條款')?.links.length || 0}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>政策頁面</div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-12 sm:mt-16 bg-white rounded-2xl p-8 sm:p-12 text-center border-2 border-teal-100">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-teal-50 rounded-2xl mb-6">
              <i className="ri-customer-service-2-line text-3xl sm:text-4xl text-teal-600"></i>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              需要協助嗎？
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 leading-relaxed" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              如果您無法找到所需的頁面或功能，我們的專業客服團隊隨時為您提供協助
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                to="/customer-service"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-teal-600 text-white text-sm sm:text-base font-semibold rounded-xl hover:bg-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                <i className="ri-customer-service-line mr-2 sm:mr-3 text-lg sm:text-xl"></i>
                一對一諮詢
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-teal-600 text-sm sm:text-base font-semibold rounded-xl border-2 border-teal-600 hover:bg-teal-600 hover:text-white transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                <i className="ri-question-line mr-2 sm:mr-3 text-lg sm:text-xl"></i>
                常見問題
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SitemapPage;
