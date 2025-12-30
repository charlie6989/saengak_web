
import React, { useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function ReturnPolicyPage() {
  const [activeTab, setActiveTab] = useState('policy');
  const [openFAQ, setOpenFAQ] = useState<{ [key: string]: boolean }>({});

  const toggleFAQ = (id: string) => {
    setOpenFAQ(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const tabs = [
    { id: 'policy', name: '退換貨政策', icon: 'ri-arrow-go-back-line' },
    { id: 'process', name: '申請流程', icon: 'ri-list-check-line' },
    { id: 'conditions', name: '退換條件', icon: 'ri-shield-check-line' },
    { id: 'faq', name: '常見問題', icon: 'ri-question-answer-line' }
  ];

  const returnConditions = [
    {
      icon: 'ri-time-line',
      title: '7天鑑賞期',
      description: '自收到商品次日起算7天內（不含配送時間）',
      color: 'text-blue-600 bg-blue-50'
    },
    {
      icon: 'ri-package-line',
      title: '原包裝完整',
      description: '商品需保持原包裝、標籤、配件完整',
      color: 'text-green-600 bg-green-50'
    },
    {
      icon: 'ri-shield-line',
      title: '未使用狀態',
      description: '商品未使用、未拆封（衛生用品）',
      color: 'text-purple-600 bg-purple-50'
    },
    {
      icon: 'ri-file-text-line',
      title: '購買憑證',
      description: '需提供原購買發票或收據',
      color: 'text-orange-600 bg-orange-50'
    }
  ];

  const processSteps = [
    {
      step: 1,
      title: '線上申請',
      description: '登入會員帳戶，在訂單詳情中點擊「申請退換貨」',
      icon: 'ri-computer-line'
    },
    {
      step: 2,
      title: '填寫資料',
      description: '填寫退換貨原因、商品狀況等相關資訊',
      icon: 'ri-edit-line'
    },
    {
      step: 3,
      title: '列印單據',
      description: '列印退貨單並妥善包裝商品',
      icon: 'ri-printer-line'
    },
    {
      step: 4,
      title: '寄回商品',
      description: '將商品寄回指定地址（運費由顧客負擔）',
      icon: 'ri-truck-line'
    },
    {
      step: 5,
      title: '審核處理',
      description: '收到商品後3-5個工作天內完成審核',
      icon: 'ri-search-eye-line'
    },
    {
      step: 6,
      title: '退款完成',
      description: '審核通過後7-14個工作天內退款',
      icon: 'ri-money-dollar-circle-line'
    }
  ];

  const faqItems = [
    {
      id: '1',
      question: '哪些商品不能退換？',
      answer: '以下商品不適用退換貨：1. 個人衛生用品（化妝品、保養品）一旦拆封 2. 客製化商品 3. 食品類商品 4. 特價或促銷商品（除商品瑕疵外）5. 已使用的商品'
    },
    {
      id: '2',
      question: '退貨運費誰負擔？',
      answer: '一般情況下退貨運費由顧客負擔。但如果是因為商品瑕疵、錯誤配送等非顧客因素，運費將由我們負擔。建議使用有追蹤號碼的配送方式。'
    },
    {
      id: '3',
      question: '退款多久會到帳？',
      answer: '退款時間依付款方式而定：信用卡退款約7-14個工作天，ATM轉帳約3-5個工作天。實際到帳時間可能因銀行作業而有所差異。'
    },
    {
      id: '4',
      question: '可以換貨嗎？',
      answer: '可以申請換貨，但需符合退換貨條件。換貨商品需有庫存，如有價差需補足或退還。換貨運費由顧客負擔（商品瑕疵除外）。'
    },
    {
      id: '5',
      question: '國外訂單如何退換貨？',
      answer: '國外訂單退換貨需先聯絡客服確認流程。國際運費較高，建議先評估是否確實需要退換。退貨運費由顧客負擔，且可能產生關稅等額外費用。'
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'policy':
        return (
          <div className="space-y-8">
            <div className="bg-teal-50 border border-teal-200 p-6">
              <h3 className="text-xl font-bold text-teal-900 mb-4">退換貨政策概述</h3>
              <p className="text-teal-800 leading-relaxed">
                我們提供7天鑑賞期服務，讓您有充分時間檢視商品。為確保所有顧客的權益，
                請務必詳閱以下退換貨條件。我們致力於提供優質的購物體驗，
                如有任何問題歡迎隨時聯絡客服團隊。
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">退換貨條件</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {returnConditions.map((condition, index) => (
                  <div key={index} className="bg-white border border-gray-200 p-6">
                    <div className={`w-12 h-12 ${condition.color} flex items-center justify-center mb-4`}>
                      <i className={`${condition.icon} text-2xl`}></i>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{condition.title}</h4>
                    <p className="text-gray-600">{condition.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center">
                <i className="ri-error-warning-line mr-2"></i>
                不適用退換貨的商品
              </h3>
              <ul className="text-red-800 space-y-2">
                <li className="flex items-start">
                  <i className="ri-close-circle-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>個人衛生用品（化妝品、保養品）一旦拆封使用</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>客製化或個人化商品</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>食品、保健食品類商品</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>特價或促銷商品（除商品瑕疵外）</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>超過鑑賞期限的商品</span>
                </li>
              </ul>
            </div>
          </div>
        );

      case 'process':
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">退換貨申請流程</h3>
              <p className="text-gray-600">簡單6步驟，輕鬆完成退換貨申請</p>
            </div>

            <div className="space-y-6">
              {processSteps.map((step, index) => (
                <div key={step.step} className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-teal-600 text-white flex items-center justify-center font-bold text-lg">
                      {step.step}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <i className={`${step.icon} text-xl text-teal-600 mr-3`}></i>
                      <h4 className="text-lg font-semibold text-gray-900">{step.title}</h4>
                    </div>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                  {index < processSteps.length - 1 && (
                    <div className="absolute left-6 mt-12 w-0.5 h-8 bg-gray-200"></div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                <i className="ri-information-line mr-2"></i>
                重要提醒
              </h3>
              <ul className="text-blue-800 space-y-2">
                <li className="flex items-start">
                  <i className="ri-arrow-right-s-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>請妥善包裝商品，避免運送過程中損壞</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-arrow-right-s-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>建議使用有追蹤號碼的配送方式</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-arrow-right-s-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>保留寄件收據直到退款完成</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-arrow-right-s-line mr-2 mt-1 flex-shrink-0"></i>
                  <span>如有疑問請先聯絡客服確認</span>
                </li>
              </ul>
            </div>
          </div>
        );

      case 'conditions':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">詳細退換貨條件</h3>
              
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="ri-calendar-check-line text-green-600 mr-3"></i>
                    鑑賞期限
                  </h4>
                  <div className="space-y-3 text-gray-700">
                    <p>• 自收到商品次日起算7天內（不含配送時間）</p>
                    <p>• 例：12月1日收到商品，鑑賞期至12月8日止</p>
                    <p>• 國定假日不計入工作天數</p>
                    <p>• 超過期限恕不受理退換貨申請</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="ri-box-3-line text-blue-600 mr-3"></i>
                    商品狀態要求
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-green-900 mb-2">✅ 可接受狀態</h5>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• 原包裝完整未拆封</li>
                        <li>• 商品標籤完整</li>
                        <li>• 配件齊全</li>
                        <li>• 無使用痕跡</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-red-900 mb-2">❌ 不可接受狀態</h5>
                      <ul className="text-sm text-red-800 space-y-1">
                        <li>• 包裝破損或遺失</li>
                        <li>• 商品已使用</li>
                        <li>• 標籤撕毀</li>
                        <li>• 配件不全</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="ri-money-dollar-circle-line text-purple-600 mr-3"></i>
                    退款方式與時間
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left p-3 font-medium">付款方式</th>
                          <th className="text-left p-3 font-medium">退款方式</th>
                          <th className="text-left p-3 font-medium">處理時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-3">信用卡</td>
                          <td className="p-3">原卡退款</td>
                          <td className="p-3">7-14個工作天</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3">ATM轉帳</td>
                          <td className="p-3">銀行轉帳</td>
                          <td className="p-3">3-5個工作天</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3">超商代碼</td>
                          <td className="p-3">銀行轉帳</td>
                          <td className="p-3">3-5個工作天</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3">貨到付款</td>
                          <td className="p-3">銀行轉帳</td>
                          <td className="p-3">3-5個工作天</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">退換貨常見問題</h3>
            {faqItems.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleFAQ(item.id)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <h4 className="text-lg font-semibold text-gray-900">{item.question}</h4>
                  <i className={`ri-arrow-down-s-line text-xl text-gray-500 transition-transform ${
                    openFAQ[item.id] ? 'rotate-180' : ''
                  }`}></i>
                </button>
                
                {openFAQ[item.id] && (
                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      {/* Hero Section */}
      <div 
        className="relative pt-32 pb-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 91, 79, 0.8), rgba(36, 91, 79, 0.8)), url('https://readdy.ai/api/search-image?query=Professional%20customer%20service%20representative%20handling%20return%20and%20exchange%20process%20with%20packages%20and%20documents%2C%20modern%20office%20environment%2C%20customer%20satisfaction%20concept%2C%20clean%20business%20atmosphere&width=1920&height=600&seq=return-policy-hero&orientation=landscape')`
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white mb-6">退換貨說明</h1>
          <p className="text-xl text-white/90 mb-8">我們提供完善的退換貨服務，保障您的購物權益</p>
        </div>
      </div>

      <main className="pb-16">
        <div className="max-w-6xl mx-auto px-4">
          {/* Tab Navigation */}
          <div className="bg-white shadow-lg -mt-10 relative z-10 mb-12">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-0 px-6 py-4 text-center transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className={`${tab.icon} text-xl mb-2 block`}></i>
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white border border-gray-200 p-8">
            {renderContent()}
          </div>

          {/* Contact Section */}
          <div className="mt-12 bg-gray-50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">需要協助？</h2>
              <p className="text-gray-600">如有退換貨相關問題，歡迎聯絡我們的客服團隊</p>
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
