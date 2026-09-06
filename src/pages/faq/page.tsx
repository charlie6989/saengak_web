
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { id: 'all', name: '全部問題', icon: 'ri-question-line' },
    { id: 'order', name: '訂單相關', icon: 'ri-shopping-cart-line' },
    { id: 'product', name: '產品問題', icon: 'ri-product-hunt-line' },
    { id: 'shipping', name: '配送服務', icon: 'ri-truck-line' },
    { id: 'payment', name: '付款方式', icon: 'ri-bank-card-line' },
    { id: 'account', name: '帳戶管理', icon: 'ri-user-settings-line' },
    { id: 'return', name: '退換貨', icon: 'ri-arrow-go-back-line' }
  ];

  const faqItems: FAQItem[] = [
    {
      id: '1',
      category: 'order',
      question: '如何查詢我的訂單狀態？',
      answer: '完成正式結帳後，已登入會員可在個人頁查看與該帳號連結的 Shopify 訂單與物流追蹤。網站不會顯示示範訂單；若需要人工核對，請只透過本站公告的官方客服管道提供訂單編號。'
    },
    {
      id: '2',
      category: 'order',
      question: '可以修改或取消已下的訂單嗎？',
      answer: '是否能修改或取消，取決於 Shopify 訂單當下的付款與出貨狀態，不保證固定 30 分鐘期限。正式客服管道公告後，請儘早提供訂單編號申請；已交寄訂單需依正式退換貨流程辦理。'
    },
    {
      id: '3',
      category: 'product',
      question: '產品的保存期限是多久？',
      answer: '保存期限、製造日期、開封後使用期限與保存方式均以個別商品正式包裝標示為準。網站不以產品類型推測固定年限；若包裝破損、標示不清或已逾期，請勿使用。'
    },
    {
      id: '4',
      category: 'product',
      question: '如何選擇適合我的產品？',
      answer: '請依正式商品頁的用途、成分、使用方式與注意事項選擇。本站目前沒有線上肌膚檢測或醫療診斷功能；若有持續不適、懷孕、過敏史或正在接受治療，請先詢問合格醫療專業人員。'
    },
    {
      id: '5',
      category: 'shipping',
      question: '配送需要多長時間？',
      answer: '一般出貨後約 2 至 4 個工作天送達指定地址或超商門市（不含例假日與國定假日）。若遇特殊節日或偏遠離島地區，配送時間可能依物流狀況略有調整。'
    },
    {
      id: '6',
      category: 'shipping',
      question: '配送費用如何計算？',
      answer: '運費將於結帳時依您所選的配送方式（宅配或超商取貨）及促銷優惠門檻自動計算，以結帳頁面顯示之最終金額為準。'
    },
    {
      id: '7',
      category: 'payment',
      question: '支援哪些付款方式？',
      answer: '我們提供安全便捷的線上刷卡與行動支付服務，結帳時將透過 SSL 最高規格加密機制保護您的支付安全。'
    },
    {
      id: '8',
      category: 'payment',
      question: '付款後多久會收到確認通知？',
      answer: '訂單完成付款後，系統將即時發送訂單確認電子郵件至您的信箱，您亦可登入會員中心隨時查詢最新訂單狀態。'
    },
    {
      id: '9',
      category: 'account',
      question: '忘記密碼怎麼辦？',
      answer: '請至登入頁點選「忘記密碼」並輸入您的註冊信箱，系統將自動發送重設密碼信函。若未收到信件，請檢查垃圾郵件匣。'
    },
    {
      id: '10',
      category: 'account',
      question: '如何修改個人資料？',
      answer: '登入會員中心後，點選「個人資料」即可輕鬆修改收件姓名、聯絡電話及常用收件地址。'
    },
    {
      id: '11',
      category: 'return',
      question: '退換貨政策是什麼？',
      answer: '正式退換貨條件以退換貨說明、商品性質及適用消費者保護規定為準。鑑賞期不是試用期；涉及個人衛生、已拆封或依法得排除解除權的商品，必須在販售頁與結帳前明確告知後才依規定處理。'
    },
    {
      id: '12',
      category: 'return',
      question: '如何申請退換貨？',
      answer: '正式客服管道公告後，請在退貨前提供訂單編號、商品狀況與申請原因，並保留商品、包裝與交易證明。本站目前沒有已驗證的線上退貨單或固定 3 至 5 天退款承諾，請勿寄送到未經本站公告的地址。'
    }
  ];

  const toggleItem = (itemId: string) => {
    setOpenItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const filteredItems = faqItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      {/* Hero Section */}
      <div 
        className="relative pt-32 pb-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 91, 79, 0.8), rgba(36, 91, 79, 0.8)), url('https://readdy.ai/api/search-image?query=Professional%20customer%20service%20representative%20helping%20customers%20with%20questions%20in%20modern%20office%20environment%2C%20clean%20minimalist%20design%2C%20soft%20natural%20lighting%2C%20business%20consultation%20atmosphere%2C%20professional%20photography%20style&width=1920&height=600&seq=faq-hero-bg&orientation=landscape')`
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white mb-6">常見問題</h1>
          <p className="text-xl text-white/90 mb-8">快速找到您需要的答案，我們整理了最常見的問題與解答</p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋問題關鍵字..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 text-lg border-0 bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <i className="ri-search-line absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <main className="pb-16">
        <div className="max-w-6xl mx-auto px-4">
          {/* Category Filter */}
          <div className="bg-white shadow-lg -mt-10 relative z-10 mb-12 overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">問題分類</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`p-4 text-center transition-all duration-200 ${
                      activeCategory === category.id
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <i className={`${category.icon} text-2xl mb-2 block`}></i>
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ Items */}
          <div className="space-y-4">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full px-6 py-5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-teal-100 text-teal-600 flex items-center justify-center mr-4 font-bold text-sm">
                        Q
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{item.question}</h3>
                    </div>
                    <i className={`ri-arrow-down-s-line text-xl text-gray-500 transition-transform ${
                      openItems[item.id] ? 'rotate-180' : ''
                    }`}></i>
                  </button>
                  
                  {openItems[item.id] && (
                    <div className="px-6 py-6 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-start">
                        <div className="w-8 h-8 bg-green-100 text-green-600 flex items-center justify-center mr-4 font-bold text-sm flex-shrink-0">
                          A
                        </div>
                        <div className="text-gray-700 leading-relaxed">{item.answer}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <i className="ri-search-line text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-500 mb-2">找不到相關問題</h3>
                <p className="text-gray-400">請嘗試其他關鍵字或聯絡客服獲得協助</p>
              </div>
            )}
          </div>

          {/* Contact Section */}
          <div className="mt-16 bg-gray-50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">找不到答案？</h2>
              <p className="text-gray-600">我們的客服團隊隨時為您提供專業協助</p>
            </div>
            
            <div className="mx-auto max-w-2xl bg-white p-6 text-center">
              <i className="ri-information-line text-3xl text-amber-600 mb-4"></i>
              <h3 className="font-semibold text-gray-900 mb-2">正式客服管道確認中</h3>
              <p className="text-gray-600 text-sm mb-5">本站不顯示示範電話、跨品牌信箱或未啟用的即時聊天。</p>
              <Link to="/customer-service" className="inline-block bg-teal-700 text-white px-5 py-3 hover:bg-teal-800 transition-colors text-sm">
                查看客服狀態
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
