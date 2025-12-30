
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { mockUsers, mockAuthState, simulateApiDelay } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [useMockData, setUseMockData] = useState(localStorage.getItem('useMockAuth') === 'true');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleMockRegister = async () => {
    setLoading(true);
    setMessage('');

    try {
      await simulateApiDelay(2000);

      // 檢查是否已存在相同電子郵件
      const existingUser = mockUsers.find(u => u.email === formData.email);
      if (existingUser) {
        setMessage('此電子郵件已被註冊');
        setLoading(false);
        return;
      }

      // 創建新的假用戶
      const newUser = {
        id: `user-${Date.now()}`,
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: '',
        address: '',
        birth_date: '',
        gender: '',
        created_at: new Date().toISOString(),
        avatar: 'https://readdy.ai/api/search-image?query=friendly%20asian%20woman%20smiling%20professional%20portrait%20modern%20clean%20background&width=200&height=200&seq=newuser&orientation=squarish'
      };

      // 模擬註冊成功並自動登入
      localStorage.setItem('mockCurrentUser', JSON.stringify(newUser));
      mockAuthState.isLoggedIn = true;
      mockAuthState.currentUser = newUser;
      
      setMessage('註冊成功！正在為您準備歡迎頁面...');
      
      setTimeout(() => {
        navigate('/welcome');
      }, 1500);
    } catch (error) {
      setMessage('註冊失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleRealRegister = async () => {
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      });

      if (error) {
        setMessage(`註冊失敗: ${error.message}`);
      } else {
        setMessage('註冊成功！請檢查您的電子郵件以驗證帳號');
        setTimeout(() => {
          navigate('/welcome');
        }, 2000);
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage('密碼不一致');
      return;
    }

    if (formData.password.length < 6) {
      setMessage('密碼至少需要 6 個字元');
      return;
    }

    if (useMockData) {
      await handleMockRegister();
    } else {
      await handleRealRegister();
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    if (useMockData) {
      setMessage('假數據模式下暫不支援社交註冊，請使用電子郵件註冊');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/welcome`
        }
      });

      if (error) {
        console.error(`${provider} OAuth error:`, error);
        setMessage(`${provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'Apple'} 註冊設定中，請稍後再試或使用電子郵件註冊`);
      }
    } catch (error) {
      console.error(`${provider} register error:`, error);
      setMessage(`${provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'Apple'} 註冊功能暫時無法使用，請使用電子郵件註冊`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex flex-col justify-center py-12 sm:px-6 lg:px-8" style={{ paddingTop: '120px' }}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              會員註冊
            </h2>
            <p className="text-gray-600">
              建立您的新帳號，享受更多服務
            </p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-lg rounded-lg border">
            {/* 假數據模式提示 */}
            {useMockData && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-start">
                  <i className="ri-information-line text-green-600 mr-2 mt-0.5"></i>
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">假數據模式</p>
                    <p>您可以使用任何電子郵件地址註冊測試帳號，註冊後將自動登入並跳轉到歡迎頁面。</p>
                  </div>
                </div>
              </div>
            )}

            {/* 社交註冊按鈕 */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-google-fill text-red-500 mr-3 text-lg"></i>
                使用 Google 註冊
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('facebook')}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-facebook-fill text-blue-600 mr-3 text-lg"></i>
                使用 Facebook 註冊
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('apple')}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-apple-fill text-black mr-3 text-lg"></i>
                使用 Apple 註冊
              </button>
            </div>

            {/* 分隔線 */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或使用電子郵件註冊</span>
              </div>
            </div>

            {/* 註冊表單 */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="姓名"
                />
              </div>

              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="電子郵件地址"
                />
              </div>

              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="密碼（至少 6 個字元）"
                  minLength={6}
                />
              </div>

              <div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="確認密碼"
                  minLength={6}
                />
              </div>

              {message && (
                <div className={`rounded-md p-3 text-sm ${
                  message.includes('成功') 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {message}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-teal-600 text-white rounded-md font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>註冊中...</span>
                    </div>
                  ) : (
                    '建立帳號'
                  )}
                </button>
              </div>
            </form>

            {/* 底部連結 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                已經有帳號了？{' '}
                <Link
                  to="/login"
                  className="text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
                >
                  立即登入
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                註冊即表示您同意我們的{' '}
                <Link to="/terms" className="text-teal-600 hover:text-teal-500 cursor-pointer">
                  服務條款
                </Link>
                {' '}和{' '}
                <Link to="/privacy" className="text-teal-600 hover:text-teal-500 cursor-pointer">
                  隱私政策
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
