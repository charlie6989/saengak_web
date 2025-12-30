import { useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function Promotion() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const promotions = [
    {
      id: 1,
      title: '新會員專享優惠',
      subtitle: '首次購買享 30% 折扣',
      description: '註冊成為會員即可享受首次購買 30% 折扣優惠，適用於全館商品',
      image: 'https://readdy.ai/api/search-image?query=New%20member%20discount%20promotion%20banner%2C%20elegant%20Korean%20woman%20shopping%20online%2C%20modern%20e-commerce%20interface%2C%2030%25%20discount%20badge%2C%20feminine%20wellness%20products%2C%20clean%20minimalist%20design%2C%20promotional%20marketing%20material%2C%20simple%20white%20background&width=600&height=400&seq=new-member&orientation=landscape',
      discount: '30%',
      validUntil: '2024-12-31',
      code: 'NEWMEMBER30',
      category: 'membership'
    },
    {
      id: 2,
      title: '滿額免運優惠',
      subtitle: '訂單滿 ₩50,000 免運費',
      description: '單筆訂單滿 ₩50,000 即可享受免運費服務，讓您購物更划算',
      image: 'https://readdy.ai/api/search-image?query=Free%20shipping%20promotion%20banner%2C%20delivery%20truck%20icon%2C%20Korean%20won%20currency%20symbol%2C%20e-commerce%20shopping%20cart%2C%20feminine%20care%20products%20packaging%2C%20modern%20promotional%20design%2C%20clean%20aesthetic%2C%20simple%20white%20background&width=600&height=400&seq=free-shipping&orientation=landscape',
      discount: '免運',
      validUntil: '長期有效',
      code: 'FREESHIP50',
      category: 'shipping'
    },
    {
      id: 3,
      title: '組合套裝特惠',
      subtitle: '購買套裝享 25% 折扣',
      description: '選購任意組合套裝商品，立即享受 25% 折扣優惠',
      image: 'https://readdy.ai/api/search-image?query=Product%20bundle%20promotion%2C%20feminine%20care%20product%20set%2C%20Korean%20beauty%20products%20arrangement%2C%2025%25%20discount%20label%2C%20elegant%20packaging%20design%2C%20promotional%20marketing%20banner%2C%20clean%20modern%20aesthetic%2C%20simple%20white%20background&width=600&height=400&seq=bundle-deal&orientation=landscape',
      discount: '25%',
      validUntil: '2024-11-30',
      code: 'BUNDLE25',
      category: 'bundle'
    },
    {
      id: 4,
      title: '會員生日優惠',
      subtitle: '生日月享 40% 折扣',
      description: '會員生日當月可享受全館商品 40% 折扣，讓您的生日更特別',
      image: 'https://readdy.ai/api/search-image?query=Birthday%20promotion%20banner%2C%20celebration%20theme%2C%20Korean%20woman%20celebrating%20birthday%2C%20gift%20boxes%2C%2040%25%20discount%20badge%2C%20feminine%20wellness%20products%2C%20festive%20promotional%20design%2C%20elegant%20aesthetic%2C%20simple%20white%20background&width=600&height=400&seq=birthday-promo&orientation=landscape',
      discount: '40%',
      validUntil: '會員生日月',
      code: 'BIRTHDAY40',
      category: 'special'
    },
    {
      id: 5,
      title: '推薦好友優惠',
      subtitle: '推薦成功雙方各享 20% 折扣',
      description: '成功推薦好友註冊並購買，推薦人和被推薦人都可享受 20% 折扣',
      image: 'https://readdy.ai/api/search-image?query=Referral%20program%20promotion%2C%20two%20Korean%20women%20friends%20shopping%20together%2C%20sharing%20and%20recommendation%20concept%2C%2020%25%20discount%20for%20both%2C%20social%20commerce%2C%20modern%20promotional%20banner%20design%2C%20simple%20white%20background&width=600&height=400&seq=referral-promo&orientation=landscape',
      discount: '20%',
      validUntil: '長期有效',
      code: 'REFER20',
      category: 'referral'
    },
    {
      id: 6,
      title: '季節限定優惠',
      subtitle: '春季護理套裝 35% 折扣',
      description: '春季限定護理套裝，專為春季肌膚護理設計，享受 35% 特別折扣',
      image: 'https://readdy.ai/api/search-image?query=Spring%20season%20promotion%20banner%2C%20cherry%20blossoms%2C%20Korean%20spring%20aesthetic%2C%20feminine%20care%20products%20for%20spring%2C%2035%25%20discount%20label%2C%20seasonal%20promotional%20design%2C%20fresh%20and%20clean%20atmosphere%2C%20simple%20white%20background&width=600&height=400&seq=spring-promo&orientation=landscape',
      discount: '35%',
      validUntil: '2024-05-31',
      code: 'SPRING35',
      category: 'seasonal'
    }
  ];

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      // 模擬提交
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitMessage('訂閱成功！您將收到最新優惠資訊');
      setEmail('');
    } catch (error) {
      setSubmitMessage('訂閱失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    // 可以添加提示訊息
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      <main className="page-content">
        {/* Hero Section - 使用與頁面一致的背景色 */}
        <section className="pt-32 pb-20 bg-[#F7F7F5]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center">
              <h1 className="text-5xl md:text-6xl font-bold text-[#000000] mb-6 leading-tight">
                優惠專區
              </h1>
              <p className="text-xl md:text-2xl text-[#555555] max-w-3xl mx-auto leading-relaxed">
                精心為您準備的多種優惠方案，讓購物體驗更加超值
              </p>
            </div>
          </div>
        </section>

        {/* Promotions Grid - 簡化標題 */}
        <section className="py-8 px-4 bg-[#F7F7F5]">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {promotions.map((promo) => (
                <div key={promo.id} className="bg-white overflow-hidden hover:shadow-lg transition-shadow duration-300 group flex flex-col h-full">
                  <div className="relative">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-[#225B4F] text-white px-3 py-1 font-bold text-sm">
                      {promo.discount} OFF
                    </div>
                    {/* 分類標籤 */}
                    <div className="absolute top-4 left-4">
                      <span className="bg-white/90 text-[#225B4F] px-2 py-1 text-xs font-medium">
                        {promo.category === 'membership' && '會員專享'}
                        {promo.category === 'shipping' && '免運優惠'}
                        {promo.category === 'bundle' && '套裝優惠'}
                        {promo.category === 'special' && '特殊優惠'}
                        {promo.category === 'referral' && '推薦優惠'}
                        {promo.category === 'seasonal' && '季節限定'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-bold text-[#000000] mb-2">
                      {promo.title}
                    </h3>
                    <p className="text-lg font-semibold text-[#225B4F] mb-3">
                      {promo.subtitle}
                    </p>
                    <p className="text-[#555555] mb-6 leading-relaxed flex-1">
                      {promo.description}
                    </p>
                    
                    <div className="space-y-4 mt-auto">
                      {/* 優惠代碼區塊 */}
                      <div className="bg-[#F7F7F5] p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-[#747775]">優惠代碼</span>
                          <button
                            onClick={() => copyToClipboard(promo.code)}
                            className="text-[#225B4F] hover:text-[#245B4F] text-sm font-medium"
                          >
                            <i className="ri-file-copy-line mr-1"></i>
                            複製
                          </button>
                        </div>
                        <div className="font-mono font-bold text-[#000000] text-lg">
                          {promo.code}
                        </div>
                      </div>
                      
                      {/* 有效期限 */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#747775]">有效期限</span>
                        <span className="font-semibold text-[#000000]">
                          {promo.validUntil}
                        </span>
                      </div>
                      
                      <button className="w-full bg-[#225B4F] text-white py-3 px-4 font-semibold hover:bg-[#245B4F] transition-colors duration-300 whitespace-nowrap">
                        立即使用
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How to Use Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#000000] mb-4">
                如何使用優惠代碼
              </h2>
              <p className="text-lg text-[#555555]">
                簡單三步驟，輕鬆享受優惠
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center group">
                <div className="w-20 h-20 bg-[#EBF3EC] flex items-center justify-center mx-auto mb-6 group-hover:bg-[#225B4F] transition-colors duration-300">
                  <i className="ri-shopping-cart-line text-2xl text-[#225B4F] group-hover:text-white"></i>
                </div>
                <div className="w-8 h-8 bg-[#225B4F] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold text-[#000000] mb-3">
                  選擇商品
                </h3>
                <p className="text-[#555555] leading-relaxed">
                  瀏覽並選擇您喜歡的商品加入購物車，確認商品符合優惠條件
                </p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 bg-[#EBF3EC] flex items-center justify-center mx-auto mb-6 group-hover:bg-[#225B4F] transition-colors duration-300">
                  <i className="ri-coupon-line text-2xl text-[#225B4F] group-hover:text-white"></i>
                </div>
                <div className="w-8 h-8 bg-[#225B4F] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold text-[#000000] mb-3">
                  輸入代碼
                </h3>
                <p className="text-[#555555] leading-relaxed">
                  在結帳頁面的優惠代碼欄位輸入相應的優惠代碼，系統會自動計算折扣
                </p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 bg-[#EBF3EC] flex items-center justify-center mx-auto mb-6 group-hover:bg-[#225B4F] transition-colors duration-300">
                  <i className="ri-check-line text-2xl text-[#225B4F] group-hover:text-white"></i>
                </div>
                <div className="w-8 h-8 bg-[#225B4F] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold text-[#000000] mb-3">
                  享受優惠
                </h3>
                <p className="text-[#555555] leading-relaxed">
                  確認折扣金額正確後完成付款，立即享受優惠價格購買心儀商品
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 優惠提醒區塊 */}
        <section className="py-16 px-4 bg-[#EBF3EC]">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white p-8">
              <i className="ri-information-line text-4xl text-[#225B4F] mb-4"></i>
              <h3 className="text-2xl font-bold text-[#000000] mb-4">
                優惠使用須知
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div>
                  <h4 className="font-semibold text-[#000000] mb-2">使用限制</h4>
                  <ul className="text-[#555555] space-y-1 text-sm">
                    <li>• 每個帳戶限用一次</li>
                    <li>• 不可與其他優惠併用</li>
                    <li>• 特定商品可能不適用</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#000000] mb-2">注意事項</h4>
                  <ul className="text-[#555555] space-y-1 text-sm">
                    <li>• 請確認優惠代碼有效期限</li>
                    <li>• 折扣金額以結帳頁面為準</li>
                    <li>• 如有問題請聯繫客服</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Signup */}
        <section className="py-16 px-4 bg-[#225B4F]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              訂閱優惠通知
            </h2>
            <p className="text-lg text-[#BED2C0] mb-8">
              第一時間獲得最新優惠資訊和獨家折扣代碼，不錯過任何省錢機會
            </p>
            
            <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto">
              <div className="flex gap-4 mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="請輸入您的電子郵件"
                  className="flex-1 px-4 py-3 border-0 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#225B4F] text-[#000000]"
                  required
                />
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-white text-[#225B4F] font-semibold hover:bg-[#F7F7F5] transition-colors duration-300 whitespace-nowrap disabled:opacity-50"
                >
                  {isSubmitting ? '訂閱中...' : '訂閱'}
                </button>
              </div>
              {submitMessage && (
                <p className={`text-sm ${submitMessage.includes('成功') ? 'text-[#BED2C0]' : 'text-red-300'}`}>
                  {submitMessage}
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
