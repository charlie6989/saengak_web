
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { mockUsers, mockAuthState, simulateApiDelay } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import AuthCaptcha, {
  captchaTokenOptions,
  isAuthCaptchaReady,
} from '../../components/feature/AuthCaptcha';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [useMockData, setUseMockData] = useState(
    import.meta.env.DEV && localStorage.getItem('useMockAuth') === 'true'
  );

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
        // 登入成功，儲存用戶狀態到 localStorage
        localStorage.setItem('mockCurrentUser', JSON.stringify(user));
        mockAuthState.isLoggedIn = true;
        mockAuthState.currentUser = user;

        setMessage('登入成功！');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setMessage('登入失敗：電子郵件或密碼不正確');
      }
    } catch (error) {
      setMessage('登入過程中發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleRealLogin = async () => {
    if (!isSupabaseConfigured) {
      setMessage('會員系統正在接線，現階段暫不開放登入');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
        options: captchaTokenOptions(captchaToken),
      });

      if (error) {
        setMessage('登入失敗：電子郵件、密碼不正確，或帳號尚未完成驗證');
        setCaptchaToken('');
        setCaptchaResetKey((current) => current + 1);
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

  const fillDemoAccount = () => {
    setFormData({
      email: 'mock1@saengak.invalid',
      password: 'development-only-1'
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
            {!useMockData && !isSupabaseConfigured && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                會員資料庫尚未完成正式綁定；目前可瀏覽商品與內容，但暫不接受登入。
              </div>
            )}
            {/* 假數據模式提示 */}
            {useMockData && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">開發測試模式 (使用假數據)</p>
                    <p className="text-xs text-blue-600 mt-1">
                      可使用示範帳號進行登入測試
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fillDemoAccount}
                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 cursor-pointer"
                  >
                    填入示範帳號
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 rounded-md border border-teal-100 bg-teal-50 p-3 text-sm text-teal-800">
              目前只開放電子郵件登入；Google、Facebook 與 Apple 尚未啟用，因此不顯示無效按鈕。
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

              {!useMockData && (
                <AuthCaptcha
                  onTokenChange={setCaptchaToken}
                  resetKey={captchaResetKey}
                />
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading || (!useMockData && !isAuthCaptchaReady(captchaToken))}
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
