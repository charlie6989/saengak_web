
import React, { useState } from 'react';
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
      answer: '您可以透過以下方式查詢訂單狀態：1. 登入會員帳戶，在「我的訂單」中查看詳細資訊 2. 使用訂單編號在「訂單查詢」頁面查詢 3. 聯絡客服提供訂單編號進行查詢。我們會即時更新訂單狀態，包括訂單確認、備貨中、已出貨、配送中、已送達等階段。'
    },
    {
      id: '2',
      category: 'order',
      question: '可以修改或取消已下的訂單嗎？',
      answer: '訂單確認後30分鐘內可以修改或取消。超過時間後，如訂單尚未出貨，請立即聯絡客服協助處理。已出貨的訂單無法取消，但您可以在收到商品後申請退貨。'
    },
    {
      id: '3',
      category: 'product',
      question: '產品的保存期限是多久？',
      answer: '我們的產品保存期限因產品類型而異：護膚品通常為3年，彩妝品為2-3年，保健食品為2年。具體保存期限請參考產品包裝上的標示。建議開封後盡快使用，並避免陽光直射和高溫環境。'
    },
    {
      id: '4',
      category: 'product',
      question: '如何選擇適合我的產品？',
      answer: '我們提供多種方式幫助您選擇：1. 線上肌膚檢測工具 2. 產品詳細說明和成分介紹 3. 客戶評價和使用心得 4. 專業客服諮詢服務。建議您先了解自己的肌膚類型和需求，再選擇相應的產品系列。'
    },
    {
      id: '5',
      category: 'shipping',
      question: '配送需要多長時間？',
      answer: '一般配送時間為3-7個工作天，實際時間依配送地區而定：台北市、新北市通常2-3天，其他縣市3-5天，離島地區5-7天。急件可選擇隔日配送服務（需額外收費）。'
    },
    {
      id: '6',
      category: 'shipping',
      question: '配送費用如何計算？',
      answer: '配送費用標準：訂單金額滿1000元免運費，未滿1000元收取80元運費。離島地區統一收取150元運費。特殊商品（如大型商品）可能有額外運費，結帳時會顯示詳細費用。'
    },
    {
      id: '7',
      category: 'payment',
      question: '支援哪些付款方式？',
      answer: '我們支援多種付款方式：1. 信用卡（Visa、MasterCard、JCB） 2. 金融卡 3. ATM轉帳 4. 超商代碼繳費 5. 貨到付款（限台灣本島）。所有付款方式都採用SSL加密保護，確保交易安全。'
    },
    {
      id: '8',
      category: 'payment',
      question: '付款後多久會收到確認通知？',
      answer: '信用卡和金融卡付款會立即收到確認通知。ATM轉帳和超商繳費通常在1-2個工作天內確認。貨到付款則在訂單確認後開始備貨流程。'
    },
    {
      id: '9',
      category: 'account',
      question: '忘記密碼怎麼辦？',
      answer: '請點擊登入頁面的「忘記密碼」連結，輸入註冊時的電子郵件地址，系統會發送重設密碼的連結到您的信箱。如果沒有收到郵件，請檢查垃圾郵件匣或聯絡客服協助。'
    },
    {
      id: '10',
      category: 'account',
      question: '如何修改個人資料？',
      answer: '登入會員帳戶後，點擊「個人資料」即可修改姓名、電話、地址等資訊。電子郵件地址修改需要驗證新信箱，修改後請重新登入。'
    },
    {
      id: '11',
      category: 'return',
      question: '退換貨政策是什麼？',
      answer: '我們提供7天鑑賞期（不包含配送時間）。退換貨條件：商品保持原包裝完整、未使用、未拆封。個人衛生用品（如化妝品、保養品）一旦拆封恕不接受退換。客製化商品不適用退換貨。'
    },
    {
      id: '12',
      category: 'return',
      question: '如何申請退換貨？',
      answer: '退換貨申請步驟：1. 登入會員帳戶，在訂單詳情中點擊「申請退換貨」2. 填寫退換貨原因和說明 3. 列印退貨單並包裝商品 4. 寄回商品（運費由顧客負擔，商品瑕疵除外）5. 收到商品後3-5個工作天內處理退款。'
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
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 text-center">
                <i className="ri-phone-line text-3xl text-teal-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">電話客服</h3>
                <p className="text-gray-600 text-sm mb-4">週一至週五 09:00-18:00</p>
                <p className="font-semibold text-teal-600">0800-123-456</p>
              </div>
              
              <div className="bg-white p-6 text-center">
                <i className="ri-mail-line text-3xl text-blue-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">電子郵件</h3>
                <p className="text-gray-600 text-sm mb-4">24小時內回覆</p>
                <p className="font-semibold text-blue-600">service@lucissi.com</p>
              </div>
              
              <div className="bg-white p-6 text-center">
                <i className="ri-customer-service-2-line text-3xl text-green-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">線上客服</h3>
                <p className="text-gray-600 text-sm mb-4">即時線上協助</p>
                <button className="bg-green-600 text-white px-4 py-2 hover:bg-green-700 transition-colors text-sm whitespace-nowrap">
                  開始對話
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
