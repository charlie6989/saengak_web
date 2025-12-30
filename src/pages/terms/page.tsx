
import React, { useEffect, useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function TermsPage() {
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const termsSections = [
    {
      id: 'acceptance',
      title: '1. 服務條款接受',
      content: (
        <div className="space-y-4">
          <p>歡迎使用本公司提供的網站服務。當您使用本網站時，即表示您已閱讀、瞭解並同意接受本服務條款的所有內容。</p>
          <p>本公司保留隨時修改這些條款的權利。任何修改將在網站上公布，並於公布後立即生效。繼續使用本服務即表示您接受修改後的條款。</p>
          <div className="bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-yellow-800 text-sm">
              <strong>重要提醒：</strong>請定期查看本條款的更新，以確保您了解最新的服務規範。
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'services',
      title: '2. 服務說明',
      content: (
        <div className="space-y-4">
          <p>本網站提供美妝保養品的線上購物服務，包括但不限於：</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-teal-50 p-4 border border-teal-200">
              <h4 className="font-semibold text-teal-900 mb-2">產品服務</h4>
              <ul className="text-teal-800 text-sm space-y-1">
                <li>• 護膚保養品銷售</li>
                <li>• 彩妝用品銷售</li>
                <li>• 美容器具銷售</li>
                <li>• 健康補充品銷售</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">附加服務</h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• 專業諮詢服務</li>
                <li>• 會員積分服務</li>
                <li>• 產品推薦服務</li>
                <li>• 客戶服務支援</li>
              </ul>
            </div>
          </div>
          <p>本公司致力於提供高品質的產品和服務，但不保證服務不會中斷或完全無錯誤。</p>
        </div>
      )
    },
    {
      id: 'user-responsibilities',
      title: '3. 用戶責任',
      content: (
        <div className="space-y-4">
          <p>使用本服務時，您同意遵守以下規範：</p>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4">
              <h4 className="font-semibold text-green-900 mb-2">✅ 您應該做的事</h4>
              <ul className="text-green-800 space-y-1">
                <li>• 提供真實、準確、完整的個人資訊</li>
                <li>• 維護帳戶安全，不與他人共享登入資訊</li>
                <li>• 遵守所有適用的法律法規</li>
                <li>• 尊重其他用戶的權利</li>
                <li>• 及時更新個人資料</li>
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 p-4">
              <h4 className="font-semibold text-red-900 mb-2">❌ 禁止的行為</h4>
              <ul className="text-red-800 space-y-1">
                <li>• 進行任何違法或有害的活動</li>
                <li>• 干擾或破壞網站的正常運作</li>
                <li>• 上傳惡意軟體或病毒</li>
                <li>• 侵犯他人的智慧財產權</li>
                <li>• 發布不當或冒犯性內容</li>
              </ul>
            </div>
          </div>
          <p className="text-amber-600 font-medium">如發現任何違反上述規定的行為，本公司有權立即終止您的帳戶。</p>
        </div>
      )
    },
    {
      id: 'shopping-terms',
      title: '4. 購物條款',
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">4.1 訂單處理</h4>
            <p className="mb-3">所有訂單均需經過本公司確認後方可生效。我們保留拒絕任何訂單的權利，特別是在以下情況：</p>
            <div className="bg-gray-50 p-4 border border-gray-200">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <i className="ri-close-circle-line text-red-500 mr-2 mt-1 flex-shrink-0"></i>
                  <span>產品缺貨或停產</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line text-red-500 mr-2 mt-1 flex-shrink-0"></i>
                  <span>價格或產品資訊錯誤</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line text-red-500 mr-2 mt-1 flex-shrink-0"></i>
                  <span>付款資訊無效</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-close-circle-line text-red-500 mr-2 mt-1 flex-shrink-0"></i>
                  <span>配送地址不在服務範圍內</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">4.2 付款方式</h4>
            <p className="mb-3">我們接受以下付款方式：</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-2">線上付款</h5>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• 信用卡（Visa、MasterCard、JCB）</li>
                  <li>• 金融卡</li>
                  <li>• 電子錢包</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 border border-green-200">
                <h5 className="font-medium text-green-900 mb-2">其他方式</h5>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>• 銀行轉帳</li>
                  <li>• 超商代碼繳費</li>
                  <li>• 貨到付款（限台灣本島）</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">4.3 配送服務</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 p-3 text-left">配送地區</th>
                    <th className="border border-gray-300 p-3 text-left">配送時間</th>
                    <th className="border border-gray-300 p-3 text-left">運費</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-3">台北市、新北市</td>
                    <td className="border border-gray-300 p-3">1-2個工作天</td>
                    <td className="border border-gray-300 p-3">滿1000元免運</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3">其他縣市</td>
                    <td className="border border-gray-300 p-3">2-3個工作天</td>
                    <td className="border border-gray-300 p-3">滿1000元免運</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3">離島地區</td>
                    <td className="border border-gray-300 p-3">3-5個工作天</td>
                    <td className="border border-gray-300 p-3">150元運費</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'return-policy',
      title: '5. 退換貨政策',
      content: (
        <div className="space-y-4">
          <p>我們提供7天鑑賞期，自收到商品次日起計算。退換貨需符合以下條件：</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">✅ 可退換條件</h4>
              <ul className="text-green-800 text-sm space-y-1">
                <li>• 商品保持原包裝完整</li>
                <li>• 未使用、未拆封</li>
                <li>• 附上原購買憑證</li>
                <li>• 非客製化商品</li>
                <li>• 在鑑賞期內申請</li>
              </ul>
            </div>
            <div className="bg-red-50 p-4 border border-red-200">
              <h4 className="font-semibold text-red-900 mb-2">❌ 不可退換</h4>
              <ul className="text-red-800 text-sm space-y-1">
                <li>• 個人衛生用品（已拆封）</li>
                <li>• 客製化商品</li>
                <li>• 食品類商品</li>
                <li>• 特價促銷商品</li>
                <li>• 超過鑑賞期</li>
              </ul>
            </div>
          </div>
          <p className="text-blue-600">退貨運費由顧客負擔，除非商品有瑕疵或錯誤。退款將在收到退貨商品後7-14個工作天內處理。</p>
        </div>
      )
    },
    {
      id: 'intellectual-property',
      title: '6. 智慧財產權',
      content: (
        <div className="space-y-4">
          <p>本網站的所有內容，包括但不限於文字、圖片、標誌、設計、程式碼等，均受著作權法保護，屬於本公司或其授權方所有。</p>
          <div className="bg-purple-50 border border-purple-200 p-4">
            <h4 className="font-semibold text-purple-900 mb-2">受保護的內容包括：</h4>
            <ul className="text-purple-800 space-y-1">
              <li>• 網站設計和版面配置</li>
              <li>• 產品圖片和描述</li>
              <li>• 商標和標誌</li>
              <li>• 軟體程式碼</li>
              <li>• 文字內容和文章</li>
            </ul>
          </div>
          <p className="text-red-600 font-medium">未經書面許可，您不得複製、修改、分發或以其他方式使用本網站的任何內容。</p>
        </div>
      )
    },
    {
      id: 'privacy',
      title: '7. 隱私保護',
      content: (
        <div className="space-y-4">
          <p>我們重視您的隱私權，個人資料的收集、處理和使用將遵循我們的隱私權政策。</p>
          <div className="bg-blue-50 border border-blue-200 p-4">
            <h4 className="font-semibold text-blue-900 mb-2">我們的承諾：</h4>
            <ul className="text-blue-800 space-y-1">
              <li>• 不會將您的個人資料出售給第三方</li>
              <li>• 僅在必要時收集個人資料</li>
              <li>• 採用適當的安全措施保護資料</li>
              <li>• 尊重您的隱私選擇權</li>
            </ul>
          </div>
          <p>詳細的隱私權政策請參閱我們的<a href="/privacy" className="text-teal-600 hover:text-teal-700 underline">隱私權政策頁面</a>。</p>
        </div>
      )
    },
    {
      id: 'disclaimer',
      title: '8. 免責聲明',
      content: (
        <div className="space-y-4">
          <p>本公司對以下情況不承擔責任：</p>
          <div className="space-y-3">
            <div className="flex items-start">
              <i className="ri-alert-line text-amber-500 mr-3 mt-1 flex-shrink-0"></i>
              <span>因不可抗力因素（如天災、戰爭、政府行為等）導致的服務中斷</span>
            </div>
            <div className="flex items-start">
              <i className="ri-alert-line text-amber-500 mr-3 mt-1 flex-shrink-0"></i>
              <span>第三方支付系統或物流系統的技術問題</span>
            </div>
            <div className="flex items-start">
              <i className="ri-alert-line text-amber-500 mr-3 mt-1 flex-shrink-0"></i>
              <span>用戶設備故障或網路連線問題</span>
            </div>
            <div className="flex items-start">
              <i className="ri-alert-line text-amber-500 mr-3 mt-1 flex-shrink-0"></i>
              <span>因用戶違反使用條款而產生的損失</span>
            </div>
            <div className="flex items-start">
              <i className="ri-alert-line text-amber-500 mr-3 mt-1 flex-shrink-0"></i>
              <span>產品使用不當造成的後果</span>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-yellow-800 text-sm">
              <strong>重要聲明：</strong>本服務按「現狀」提供，我們不提供任何明示或暗示的保證。
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'dispute-resolution',
      title: '9. 爭議解決',
      content: (
        <div className="space-y-4">
          <p>本使用條款受中華民國法律管轄。如發生爭議，雙方應首先通過友好協商解決。</p>
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">爭議解決流程：</h4>
            <ol className="text-gray-700 space-y-1">
              <li>1. 友好協商（建議期限：30天）</li>
              <li>2. 第三方調解（如消費者保護機構）</li>
              <li>3. 法院訴訟（台北地方法院管轄）</li>
            </ol>
          </div>
          <p>如協商不成，任何爭議應提交台北地方法院管轄。</p>
        </div>
      )
    },
    {
      id: 'contact',
      title: '10. 聯絡資訊',
      content: (
        <div className="space-y-4">
          <p>如對本使用條款有任何疑問，請聯絡我們：</p>
          <div className="bg-teal-50 border border-teal-200 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-teal-900 mb-3">公司資訊</h4>
                <div className="text-teal-800 space-y-2">
                  <p><strong>公司名稱：</strong>LUCISSI 股份有限公司</p>
                  <p><strong>統一編號：</strong>12345678</p>
                  <p><strong>地址：</strong>台北市信義區信義路五段123號456樓</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-teal-900 mb-3">聯絡方式</h4>
                <div className="text-teal-800 space-y-2">
                  <p><strong>客服電話：</strong>0800-123-456</p>
                  <p><strong>電子郵件：</strong>service@lucissi.com</p>
                  <p><strong>營業時間：</strong>平日 09:00~18:00</p>
                  <p className="text-sm">（午休時間 12:00~13:00）</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      {/* Hero Section */}
      <div 
        className="relative pt-32 pb-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 91, 79, 0.8), rgba(36, 91, 79, 0.8)), url('https://readdy.ai/api/search-image?query=Professional%20legal%20documents%20and%20contracts%20on%20modern%20office%20desk%20with%20gavel%20and%20scales%20of%20justice%2C%20business%20law%20concept%2C%20clean%20corporate%20environment%2C%20professional%20lighting&width=1920&height=600&seq=terms-hero-bg&orientation=landscape')`
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white mb-6">使用條款</h1>
          <p className="text-xl text-white/90 mb-4">詳細的服務條款與使用規範</p>
          <div className="text-white/80">
            最後更新日期：2024年12月
          </div>
        </div>
      </div>

      <main className="pb-16">
        <div className="max-w-6xl mx-auto px-4">
          {/* Introduction */}
          <div className="bg-white shadow-lg -mt-10 relative z-10 mb-12 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 mb-4">
                <i className="ri-file-text-line text-2xl text-teal-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">服務條款概述</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                歡迎使用我們的服務！本條款規範您與我們之間的權利義務關係，
                請仔細閱讀以下條款內容。使用我們的服務即表示您同意遵守這些條款。
              </p>
            </div>
          </div>

          {/* Terms Sections */}
          <div className="space-y-4">
            {termsSections.map((section) => (
              <div key={section.id} className="bg-white border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  <i className={`ri-arrow-down-s-line text-xl text-gray-500 transition-transform ${
                    openSections[section.id] ? 'rotate-180' : ''
                  }`}></i>
                </button>
                
                {openSections[section.id] && (
                  <div className="px-6 py-6 border-t border-gray-200">
                    <div className="prose prose-lg max-w-none text-gray-700">
                      {section.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-16 bg-gray-50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">還有其他問題嗎？</h2>
              <p className="text-gray-600">我們的客服團隊隨時為您服務</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-teal-600 text-white px-8 py-3 hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer">
                聯絡客服
              </button>
              <button className="border border-teal-600 text-teal-600 px-8 py-3 hover:bg-teal-50 transition-colors whitespace-nowrap cursor-pointer">
                常見問題
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
