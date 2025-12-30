
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mockUsers, mockAuthState, simulateApiDelay } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
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

  const handleMockLogin = async () => {
    setLoading(true);
    setMessage('');

    try {
      await simulateApiDelay(1500);

      // 查找匹配的假用戶
      const user = mockUsers.find(u =>
        u.email === formData.email && u.password === formData.password
      );

      if (user) {
        // 模擬登入成功
        localStorage.setItem('mockCurrentUser', JSON.stringify(user));
        mockAuthState.isLoggedIn = true;
        mockAuthState.currentUser = user;
        setMessage('登入成功！');

        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setMessage('電子郵件或密碼錯誤');
      }
    } catch (error) {
      setMessage('登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleRealLogin = async () => {
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setMessage(`登入失敗: ${error.message}`);
      } else {
        setMessage('登入成功！');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useMockData) {
      await handleMockLogin();
    } else {
      await handleRealLogin();
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    if (useMockData) {
      setMessage('假數據模式下暫不支援社交登入，請使用測試帳號');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        console.error(`${provider} OAuth error:`, error);
        setMessage(`${provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'Apple'} 登入設定中，請稍後再試或使用電子郵件登入`);
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      setMessage(`${provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'Apple'} 登入功能暫時無法使用，請使用電子郵件登入`);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setFormData({
      email: 'demo@example.com',
      password: '123456'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="flex flex-col justify-center py-12 sm:px-6 lg:px-8" style={{ paddingTop: '120px' }}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              現有會員登入
            </h2>
            <p className="text-gray-600">
              歡迎回來！請登入您的帳號
            </p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-lg rounded-lg border">
            {/* 假數據模式提示 */}
            {useMockData && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start">
                  <i className="ri-information-line text-blue-600 mr-2 mt-0.5"></i>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">假數據模式 - 測試帳號</p>
                    <div className="space-y-1 text-xs">
                      <p>• demo@example.com / 123456</p>
                      <p>• test@gmail.com / 123456</p>
                      <p>• user@test.com / 123456</p>
                    </div>
                    <button
                      onClick={fillDemoAccount}
                      className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer whitespace-nowrap"
                    >
                      填入示範帳號
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 社交登入按鈕 */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-google-fill text-red-500 mr-3 text-lg"></i>
                使用 Google 登入
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('facebook')}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-facebook-fill text-blue-600 mr-3 text-lg"></i>
                使用 Facebook 登入
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('apple')}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-apple-fill text-black mr-3 text-lg"></i>
                使用 Apple 登入
              </button>
            </div>

            {/* 分隔線 */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或使用電子郵件登入</span>
              </div>
            </div>

            {/* 登入表單 */}
            <form className="space-y-4" onSubmit={handleSubmit}>
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
                  placeholder="電子郵件"
                />
              </div>

              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="密碼"
                />
              </div>

              {message && (
                <div className={`rounded-md p-3 text-sm ${message.includes('成功')
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
                      <span>登入中...</span>
                    </div>
                  ) : (
                    '登入'
                  )}
                </button>
              </div>
            </form>

            {/* 底部連結 */}
            <div className="mt-6 flex justify-between text-sm">
              <Link
                to="/forgot-password"
                className="text-teal-600 hover:text-teal-800 cursor-pointer"
              >
                忘記密碼
              </Link>
              <Link
                to="/register"
                className="text-teal-600 hover:text-teal-800 cursor-pointer"
              >
                加入會員
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
