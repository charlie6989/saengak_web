
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { mockUsers, mockAuthState, simulateApiDelay } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import AuthCaptcha, {
  captchaTokenOptions,
  isAuthCaptchaReady,
} from '../../components/feature/AuthCaptcha';
import GoogleLoginButton from '../../components/feature/GoogleLoginButton';
import FacebookLoginButton from '../../components/feature/FacebookLoginButton';
import { captureExceptionSafe } from '../../lib/sentry';

const RESEND_COOLDOWN_SECONDS = 60;

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
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [useMockData, setUseMockData] = useState(
    import.meta.env.DEV && localStorage.getItem('useMockAuth') === 'true'
  );

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

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
      await simulateApiDelay(1500);

      // 建立新的假用戶
      const newUser = {
        id: `mock-${Date.now()}`,
        email: formData.email,
        name: formData.name,
        created_at: new Date().toISOString()
      };

      // 儲存到 localStorage
      localStorage.setItem('mockCurrentUser', JSON.stringify(newUser));
      mockAuthState.isLoggedIn = true;
      mockAuthState.currentUser = newUser;

      setMessage('註冊成功！歡迎加入 SAENGAK');
      setTimeout(() => {
        navigate('/welcome');
      }, 1000);
    } catch (error) {
      setMessage('註冊過程中發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleRealRegister = async () => {
    if (!isSupabaseConfigured) {
      setMessage('會員系統正在接線，現階段暫不開放註冊');
      return;
    }

    if (!isAuthCaptchaReady(captchaToken)) {
      setMessage('請先完成真人安全驗證');
      return;
    }

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
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          ...captchaTokenOptions(captchaToken),
        }
      });

      if (error) {
        captureExceptionSafe(error, { source: 'RegisterPage.signUp' });
        setMessage('目前無法完成註冊，請確認資料後稍後再試。');
        setCaptchaToken('');
        setCaptchaResetKey((current) => current + 1);
      } else if (data.session) {
        setMessage('註冊成功！正在前往會員歡迎頁面');
        window.setTimeout(() => navigate('/welcome'), 1200);
      } else {
        setPendingConfirmationEmail(formData.email);
        setResendCountdown(RESEND_COOLDOWN_SECONDS);
        setCaptchaToken('');
        setCaptchaResetKey((current) => current + 1);
        setMessage('註冊申請已送出，請先到電子郵件完成驗證，再回來登入');
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail || resendCountdown > 0 || !isAuthCaptchaReady(captchaToken)) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          ...captchaTokenOptions(captchaToken),
        },
      });
      if (error) captureExceptionSafe(error, { source: 'RegisterPage.resendConfirmation' });
      setMessage('若此電子郵件尚待驗證，系統會重新寄出驗證信，請稍後檢查信箱');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setCaptchaToken('');
      setCaptchaResetKey((current) => current + 1);
    } catch (error) {
      captureExceptionSafe(error, { source: 'RegisterPage.resendConfirmation.catch' });
      setMessage('若此電子郵件尚待驗證，系統會重新寄出驗證信，請稍後檢查信箱');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = () => {
    setMessage('Google 帳號註冊成功！正在前往會員歡迎頁...');
    setTimeout(() => {
      navigate('/welcome');
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage('密碼不一致');
      return;
    }

    if (formData.password.length < 12) {
      setMessage('密碼至少需要 12 個字元');
      return;
    }

    if (useMockData) {
      await handleMockRegister();
    } else {
      await handleRealRegister();
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
            {!useMockData && !isSupabaseConfigured && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                會員資料庫尚未完成正式綁定；現階段不會收集註冊資料。
              </div>
            )}
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

            {/* 第三方快速註冊 (Google & Facebook) */}
            <div className="mb-6 space-y-3">
              <GoogleLoginButton
                text="signup_with"
                theme="outline"
                size="large"
                onSuccess={handleGoogleSuccess}
                onError={(err) => setMessage(`Google 註冊失敗: ${err.message}`)}
                disabled={loading || (!useMockData && !isSupabaseConfigured)}
              />

              <FacebookLoginButton
                text="signup_with"
                onError={(err) => setMessage(`Facebook 註冊失敗: ${err.message}`)}
                disabled={loading || (!useMockData && !isSupabaseConfigured)}
              />

              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">或使用電子郵件註冊</span>
                </div>
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
                  placeholder="密碼（至少 12 個字元）"
                  minLength={12}
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
                  minLength={12}
                />
              </div>

              {message && (
                <div className={`rounded-md p-3 text-sm ${
                  message.includes('成功') || message.includes('已送出') || message.includes('重新寄出')
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

              {pendingConfirmationEmail && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={loading || resendCountdown > 0 || !isAuthCaptchaReady(captchaToken)}
                  className="w-full py-2 border border-teal-200 text-teal-700 rounded-md text-sm font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resendCountdown > 0 ? `${resendCountdown} 秒後可重新寄送` : '重新寄送驗證信'}
                </button>
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
