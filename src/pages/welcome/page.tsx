
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { mockAuthState } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
);

export default function WelcomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [useMockData, setUseMockData] = useState(localStorage.getItem('useMockAuth') === 'true');

  useEffect(() => {
    const getUser = async () => {
      if (useMockData) {
        // 使用假數據
        const mockUser = localStorage.getItem('mockCurrentUser');
        if (mockUser) {
          const userData = JSON.parse(mockUser);
          setUser(userData);
        } else {
          navigate('/login');
        }
      } else {
        // 使用真實 Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
        } else {
          navigate('/login');
        }
      }
      setLoading(false);
    };

    getUser();
  }, [navigate, useMockData]);

  const handleContinue = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate('/');
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50">
      <Header />
      
      <div className="py-12 px-4 sm:px-6 lg:px-8" style={{ paddingTop: '120px' }}>
        <div className="max-w-4xl mx-auto">
          {/* 歡迎標題 */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-6 bg-teal-100 rounded-full flex items-center justify-center">
              <i className="ri-user-smile-line text-3xl text-teal-600"></i>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              歡迎加入 VAGI！
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              嗨 {user?.name || user?.user_metadata?.full_name || user?.email}，很高興您選擇我們
            </p>
            <p className="text-gray-500">
              讓我們花幾分鐘時間了解我們的服務
              {useMockData && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">假數據模式</span>}
            </p>
          </div>

          {/* 進度指示器 */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep 
                      ? 'bg-teal-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step < currentStep ? (
                      <i className="ri-check-line"></i>
                    ) : (
                      step
                    )}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      step < currentStep ? 'bg-teal-600' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 步驟內容 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            {currentStep === 1 && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center">
                  <i className="ri-heart-3-line text-4xl text-pink-500"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  專為女性設計的私密護理
                </h2>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                  我們提供高品質的女性私密護理產品，包括日常清潔、深層修護、舒適穿著等全方位解決方案。每一款產品都經過嚴格測試，確保安全溫和。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                  <div className="text-center p-4">
                    <div className="w-16 h-16 mx-auto mb-3 bg-teal-100 rounded-full flex items-center justify-center">
                      <i className="ri-shield-check-line text-2xl text-teal-600"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">安全認證</h3>
                    <p className="text-sm text-gray-600">通過多項安全檢測</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="ri-leaf-line text-2xl text-blue-600"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">天然成分</h3>
                    <p className="text-sm text-gray-600">選用優質天然原料</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-16 h-16 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="ri-customer-service-2-line text-2xl text-purple-600"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">專業服務</h3>
                    <p className="text-sm text-gray-600">24小時客服支援</p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-100 to-teal-100 rounded-full flex items-center justify-center">
                  <i className="ri-shopping-bag-3-line text-4xl text-green-500"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  豐富的產品選擇
                </h2>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                  從日常護理到專業修護，我們提供完整的產品線。無論您需要什麼，都能在這裡找到最適合的解決方案。
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-pink-100 rounded-full flex items-center justify-center">
                      <i className="ri-drop-line text-xl text-pink-500"></i>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm">女性護理</h4>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="ri-bubble-chart-line text-xl text-blue-500"></i>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm">每日清潔</h4>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                      <i className="ri-heart-pulse-line text-xl text-green-500"></i>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm">深層修護</h4>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="ri-t-shirt-line text-xl text-purple-500"></i>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm">舒適穿著</h4>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center">
                  <i className="ri-gift-line text-4xl text-orange-500"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  專屬新會員優惠
                </h2>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                  感謝您加入我們！作為新會員，您可以享受以下專屬優惠和服務。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-6 text-center border border-teal-100">
                    <div className="w-16 h-16 mx-auto mb-4 bg-teal-100 rounded-full flex items-center justify-center">
                      <i className="ri-percent-line text-2xl text-teal-600"></i>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 text-lg">首購優惠</h3>
                    <p className="text-teal-600 font-semibold text-xl mb-2">85折優惠</p>
                    <p className="text-sm text-gray-600">首次購買享受特別折扣</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 text-center border border-purple-100">
                    <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="ri-truck-line text-2xl text-purple-600"></i>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 text-lg">免費配送</h3>
                    <p className="text-purple-600 font-semibold text-xl mb-2">滿額免運</p>
                    <p className="text-sm text-gray-600">購買滿一定金額即享免費配送</p>
                  </div>
                </div>
                <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <i className="ri-information-line mr-2"></i>
                    優惠碼將自動套用到您的帳戶，購買時會自動折扣
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 操作按鈕 */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleSkip}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              跳過介紹
            </button>
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              {currentStep === 3 ? '開始購物' : '繼續'}
            </button>
          </div>

          {/* 底部提示 */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500">
              您隨時可以在個人設定中查看這些資訊
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="mt-2 text-teal-600 hover:text-teal-800 text-sm cursor-pointer"
            >
              前往會員中心
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
