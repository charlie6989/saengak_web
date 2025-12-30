
import { useEffect, useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function AdChoicesPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: 'overview', title: '概述', icon: 'ri-information-line' },
    { id: 'how-it-works', title: '運作方式', icon: 'ri-settings-3-line' },
    { id: 'data-collection', title: '資料收集', icon: 'ri-database-2-line' },
    { id: 'your-choices', title: '您的選擇', icon: 'ri-user-settings-line' },
    { id: 'opt-out', title: '退出設定', icon: 'ri-shield-user-line' },
    { id: 'faq', title: '常見問題', icon: 'ri-question-answer-line' }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-green-50 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">什麼是 AdChoices？</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                AdChoices 是一個透明度計畫，讓您了解我們如何使用您的資料來提供個人化廣告體驗。我們致力於為您提供相關且有價值的廣告內容，同時尊重您的隱私選擇。
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                    <i className="ri-eye-line text-2xl text-teal-600"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">透明度</h3>
                  <p className="text-gray-600 text-sm">清楚說明我們如何收集和使用您的資料</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <i className="ri-user-settings-line text-2xl text-green-600"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">控制權</h3>
                  <p className="text-gray-600 text-sm">讓您完全控制廣告偏好和隱私設定</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                    <i className="ri-shield-check-line text-2xl text-teal-600"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">安全性</h3>
                  <p className="text-gray-600 text-sm">採用最高標準保護您的個人資料</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'how-it-works':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">廣告如何運作</h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">資料收集</h3>
                  <p className="text-gray-700">我們收集您在網站上的瀏覽行為、購買記錄和互動資料，以了解您的興趣和偏好。</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">興趣分析</h3>
                  <p className="text-gray-700">透過機器學習演算法分析您的行為模式，建立個人化的興趣檔案。</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">廣告投放</h3>
                  <p className="text-gray-700">根據您的興趣檔案，在您瀏覽其他網站時顯示相關的廣告內容。</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">效果優化</h3>
                  <p className="text-gray-700">持續監測廣告效果，調整投放策略以提供更相關的廣告體驗。</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'data-collection':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">我們收集的資料類型</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-teal-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="ri-computer-line text-teal-600 mr-3"></i>
                  網站活動資料
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>瀏覽的頁面和產品</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>點擊行為和互動</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>停留時間和瀏覽深度</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>搜尋關鍵字</li>
                </ul>
              </div>
              <div className="bg-green-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="ri-shopping-cart-line text-green-600 mr-3"></i>
                  購買行為資料
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>購買歷史記錄</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>產品偏好分析</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>購物車行為</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>價格敏感度</li>
                </ul>
              </div>
              <div className="bg-teal-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="ri-smartphone-line text-teal-600 mr-3"></i>
                  裝置資訊
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>裝置類型和作業系統</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>瀏覽器資訊</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>IP 位址和位置</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>螢幕解析度</li>
                </ul>
              </div>
              <div className="bg-green-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="ri-share-line text-green-600 mr-3"></i>
                  社交媒體資料
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>社交平台互動</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>分享和按讚行為</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>興趣標籤</li>
                  <li className="flex items-center"><i className="ri-check-line text-green-500 mr-2"></i>人口統計資料</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'your-choices':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">您的廣告選擇權利</h2>
            <div className="bg-gradient-to-r from-teal-50 to-green-50 rounded-2xl p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">您可以控制的項目</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="ri-settings-4-line text-teal-600 mr-3"></i>
                    廣告偏好設定
                  </h4>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <i className="ri-arrow-right-s-line text-teal-500 mt-1 mr-2"></i>
                      <span>選擇您感興趣的產品類別</span>
                    </li>
                    <li className="flex items-start">
                      <i className="ri-arrow-right-s-line text-teal-500 mt-1 mr-2"></i>
                      <span>調整廣告頻率和時間</span>
                    </li>
                    <li className="flex items-start">
                      <i className="ri-arrow-right-s-line text-teal-500 mt-1 mr-2"></i>
                      <span>設定廣告內容過濾器</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="ri-shield-user-line text-teal-600 mr-3"></i>
                    隱私控制
                  </h4>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <i className="ri-arrow-right-s-line text-teal-500 mt-1 mr-2"></i>
                      <span>完全退出個人化廣告</span>
                    </li>
                    <li className="flex items-start">
                      <i className="ri-arrow-right-s-line text-teal-500 mt-1 mr-2"></i>
                      <span>限制資料收集範圍</span>
                    </li>
                    <li className="flex items-start">
                      <i className="ri-arrow-right-s-line text-teal-500 mt-1 mr-2"></i>
                      <span>刪除已收集的資料</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">快速設定</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">個人化廣告</h4>
                    <p className="text-sm text-gray-600">根據您的興趣顯示相關廣告</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">跨網站追蹤</h4>
                    <p className="text-sm text-gray-600">在其他網站上顯示我們的廣告</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">分析和測量</h4>
                    <p className="text-sm text-gray-600">幫助我們改善廣告效果</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 'opt-out':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">退出個人化廣告</h2>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
              <div className="flex items-start">
                <i className="ri-information-line text-red-500 text-xl mr-3 mt-1"></i>
                <div>
                  <h3 className="font-semibold text-red-800 mb-2">重要提醒</h3>
                  <p className="text-red-700">退出個人化廣告後，您仍會看到廣告，但這些廣告將不會根據您的興趣定制。您可能會看到較不相關的廣告內容。</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="ri-global-line text-teal-600 mr-3"></i>
                  網頁瀏覽器設定
                </h3>
                <div className="space-y-4">
                  <a href="http://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" 
                     className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">數位廣告聯盟 (DAA)</h4>
                        <p className="text-sm text-gray-600">美國廣告退出工具</p>
                      </div>
                      <i className="ri-external-link-line text-gray-400"></i>
                    </div>
                  </a>
                  <a href="http://www.networkadvertising.org/choices/" target="_blank" rel="noopener noreferrer"
                     className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">網路廣告促進會 (NAI)</h4>
                        <p className="text-sm text-gray-600">網路廣告選擇工具</p>
                      </div>
                      <i className="ri-external-link-line text-gray-400"></i>
                    </div>
                  </a>
                  <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer"
                     className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">歐洲廣告選擇</h4>
                        <p className="text-sm text-gray-600">歐盟用戶專用</p>
                      </div>
                      <i className="ri-external-link-line text-gray-400"></i>
                    </div>
                  </a>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="ri-smartphone-line text-green-600 mr-3"></i>
                  行動裝置設定
                </h3>
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <i className="ri-apple-line mr-2"></i>iOS 裝置
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">設定 → 隱私權與安全性 → Apple 廣告 → 個人化廣告</p>
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">關閉個人化廣告</span>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <i className="ri-android-line mr-2"></i>Android 裝置
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">設定 → Google → 廣告 → 廣告個人化</p>
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">關閉廣告個人化</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3 flex items-center">
                <i className="ri-lightbulb-line mr-2"></i>
                Cookie 管理提示
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-yellow-700">
                <div>
                  <h4 className="font-medium mb-2">瀏覽器設定</h4>
                  <ul className="text-sm space-y-1">
                    <li>• 設定瀏覽器拒絕第三方 Cookie</li>
                    <li>• 啟用「不要追蹤」功能</li>
                    <li>• 定期清除瀏覽資料</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">隱私模式</h4>
                  <ul className="text-sm space-y-1">
                    <li>• 使用無痕瀏覽模式</li>
                    <li>• 安裝廣告攔截器</li>
                    <li>• 使用隱私保護瀏覽器</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">常見問題</h2>
            <div className="space-y-6">
              {[
                {
                  question: "選擇退出後還會看到廣告嗎？",
                  answer: "是的，您仍會看到廣告，但這些廣告將不會基於您的個人興趣和瀏覽行為來定制。您會看到更通用的廣告內容。"
                },
                {
                  question: "選擇退出設定會在所有裝置上生效嗎？",
                  answer: "不會，您需要在每個裝置和瀏覽器上分別設定選擇退出偏好。這是因為設定是儲存在本地裝置上的。"
                },
                {
                  question: "清除 Cookie 會影響我的選擇退出設定嗎？",
                  answer: "是的，清除 Cookie 會移除您的選擇退出設定，您需要重新進行設定。建議您記住這些設定並定期檢查。"
                },
                {
                  question: "我可以選擇性地退出某些類型的廣告嗎？",
                  answer: "是的，您可以在廣告偏好設定中選擇特定的產品類別或廣告類型。這讓您可以保留感興趣的廣告，同時過濾不相關的內容。"
                },
                {
                  question: "退出設定會影響網站功能嗎？",
                  answer: "基本的網站功能不會受到影響，但某些個人化功能（如產品推薦）可能會變得較不精確。"
                },
                {
                  question: "我的資料會被分享給第三方嗎？",
                  answer: "我們不會出售您的個人資料給第三方。我們可能會與可信賴的合作夥伴分享匿名化的統計資料，以改善服務品質。"
                }
              ].map((faq, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-start">
                    <span className="bg-teal-100 text-teal-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                      Q
                    </span>
                    {faq.question}
                  </h3>
                  <div className="ml-9">
                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      <main className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center bg-teal-100 text-teal-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <i className="ri-shield-check-line mr-2"></i>
              廣告透明度計畫
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">AdChoices</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              了解我們如何使用您的資料來提供個人化廣告體驗，並完全控制您的廣告偏好設定
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:w-1/4">
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-32">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">導覽選單</h3>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center whitespace-nowrap ${
                        activeSection === section.id
                          ? 'bg-teal-100 text-teal-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <i className={`${section.icon} mr-3`}></i>
                      {section.title}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:w-3/4">
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
                {renderContent()}
              </div>

              {/* Contact Section */}
              <div className="mt-8 bg-gradient-to-r from-teal-600 to-green-600 rounded-2xl p-8 text-white">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-4">還有疑問嗎？</h3>
                  <p className="text-teal-100 mb-6">我們的客服團隊隨時為您提供協助</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button className="bg-white text-teal-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-customer-service-2-line mr-2"></i>
                      聯絡客服
                    </button>
                    <button className="border-2 border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-mail-line mr-2"></i>
                      發送郵件
                    </button>
                  </div>
                  <div className="mt-6 text-sm text-teal-100">
                    <p>客服時間：週一至週五 09:00-18:00</p>
                    <p>客服信箱：privacy@innercare.com</p>
                  </div>
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
