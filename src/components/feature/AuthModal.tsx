
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { captureExceptionSafe } from '../../lib/sentry';
import AuthCaptcha, {
  captchaTokenOptions,
  isAuthCaptchaReady,
} from './AuthCaptcha';

const RESEND_COOLDOWN_SECONDS = 60;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'login' | 'register';
  onSwitchMode?: (mode: 'login' | 'register') => void;
  onAuthenticated?: () => void;
  purpose?: 'default' | 'checkout';
}

export default function AuthModal({
  isOpen,
  onClose,
  mode = 'login',
  onSwitchMode,
  onAuthenticated,
  purpose = 'default',
}: AuthModalProps) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setIsLogin(mode === 'login');
      setMessage('');
      setPendingConfirmationEmail('');
      setResendCountdown(0);
      setCaptchaToken('');
      setCaptchaResetKey((current) => current + 1);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage('會員系統正在接線，現階段暫不接受登入或註冊');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        setMessage('密碼不一致');
        setLoading(false);
        return;
      }

      if (isLogin) {
        // 登入
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
          options: captchaTokenOptions(captchaToken),
        });

        if (error) {
          setMessage('登入失敗，請確認電子郵件與密碼後再試。');
          setCaptchaToken('');
          setCaptchaResetKey((current) => current + 1);
        } else {
          setMessage('登入成功！');
          onAuthenticated?.();
          onClose();
        }
      } else {
        // 註冊 - 使用正確的端口號
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
          captureExceptionSafe(error, { source: 'AuthModal.signUp' });
          setMessage('目前無法完成註冊，請確認資料後稍後再試。');
          setCaptchaToken('');
          setCaptchaResetKey((current) => current + 1);
        } else if (data.session) {
          setMessage('註冊並登入成功！');
          onAuthenticated?.();
          onClose();
        } else {
          setPendingConfirmationEmail(formData.email);
          setResendCountdown(RESEND_COOLDOWN_SECONDS);
          setCaptchaToken('');
          setCaptchaResetKey((current) => current + 1);
          setMessage('註冊資料已送出。請先完成電子郵件驗證，再回來登入後結帳。');
        }
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      setMessage('會員系統正在接線，Google 登入尚未開放');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: purpose === 'checkout'
            ? `${window.location.origin}/auth/confirm?from=checkout`
            : `${window.location.origin}/auth/confirm`,
        }
      });

      if (error) {
        console.error('Google OAuth error:', error);
        setMessage(`Google 登入失敗: ${error.message}`);
      }
    } catch (error) {
      console.error('Google login error:', error);
      setMessage('Google 登入發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isSupabaseConfigured) {
      setMessage('會員系統正在接線，重設密碼尚未開放');
      return;
    }

    if (!formData.email) {
      setMessage('請先輸入您的電子郵件地址');
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: redirectUrl,
        ...captchaTokenOptions(captchaToken),
      });
      if (error) captureExceptionSafe(error, { source: 'AuthModal.resetPassword' });
      setMessage('若此電子郵件可重設密碼，系統將寄出操作連結。');
    } catch (error) {
      captureExceptionSafe(error, { source: 'AuthModal.resetPassword.catch' });
      setMessage('若此電子郵件可重設密碼，系統將寄出操作連結。');
    } finally {
      setCaptchaToken('');
      setCaptchaResetKey((current) => current + 1);
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
      if (error) captureExceptionSafe(error, { source: 'AuthModal.resendConfirmation' });
      setMessage('若此電子郵件尚待驗證，系統會重新寄出驗證信，請稍後檢查信箱。');
    } catch (error) {
      captureExceptionSafe(error, { source: 'AuthModal.resendConfirmation.catch' });
      setMessage('若此電子郵件尚待驗證，系統會重新寄出驗證信，請稍後檢查信箱。');
    } finally {
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setCaptchaToken('');
      setCaptchaResetKey((current) => current + 1);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    });
    setMessage('');
    setPendingConfirmationEmail('');
    setResendCountdown(0);
    setCaptchaToken('');
    setCaptchaResetKey((current) => current + 1);
  };

  const switchMode = () => {
    const newMode = !isLogin;
    setIsLogin(newMode);
    if (onSwitchMode) {
      onSwitchMode(newMode ? 'login' : 'register');
    }
    resetForm();
  };

  // 導航到獨立頁面的函數
  const navigateToLogin = () => {
    onClose();
    navigate('/login');
  };

  const navigateToRegister = () => {
    onClose();
    navigate('/register');
  };

  const navigateToForgotPassword = () => {
    onClose();
    navigate('/forgot-password');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 max-h-[calc(100vh-2rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isLogin ? '登入' : '註冊帳號'}
          </h2>
          <button
            onClick={onClose}
            aria-label="關閉會員登入視窗"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer outline-none focus:outline-none"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {purpose === 'checkout' && (
          <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-md">
            <p className="text-sm font-medium text-teal-900">結帳前請先登入會員</p>
            <p className="mt-1 text-sm text-teal-800">訂單會綁定到您的會員 ID；登入或註冊過程不會清除購物車。</p>
          </div>
        )}

        {/* 導航到獨立頁面的提示 */}
        {purpose === 'default' && <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <i className="ri-information-line text-blue-600 mr-2 mt-0.5"></i>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">使用獨立頁面獲得更好的體驗</p>
              <div className="space-y-2">
                <button
                  onClick={navigateToLogin}
                  className="block w-full text-left px-3 py-2 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-login-box-line mr-2"></i>
                  前往登入頁面
                </button>
                <button
                  onClick={navigateToRegister}
                  className="block w-full text-left px-3 py-2 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-user-add-line mr-2"></i>
                  前往註冊頁面
                </button>
                <button
                  onClick={navigateToForgotPassword}
                  className="block w-full text-left px-3 py-2 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-lock-unlock-line mr-2"></i>
                  忘記密碼
                </button>
              </div>
            </div>
          </div>
        </div>}

        {/* Google 快速登入/註冊按鈕 */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:outline-none"
          >
            <i className="ri-google-fill text-lg text-red-500 mr-3"></i>
            使用 Google {isLogin ? '登入' : '註冊'}
          </button>

          {/* Divider */}
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或使用電子郵件</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                姓名
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="請輸入您的姓名"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              電子郵件
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="請輸入您的電子郵件"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密碼
            </label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="請輸入您的密碼"
              minLength={isLogin ? undefined : 12}
            />
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                確認密碼
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="請再次輸入密碼"
                minLength={12}
              />
            </div>
          )}

          <AuthCaptcha
            onTokenChange={setCaptchaToken}
            resetKey={captchaResetKey}
          />

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.includes('成功') || message.includes('已發送') || message.includes('已送出') || message.includes('重新寄出')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {!isLogin && pendingConfirmationEmail && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={loading || resendCountdown > 0 || !isAuthCaptchaReady(captchaToken)}
              className="w-full py-2 border border-teal-200 text-teal-700 rounded-md text-sm font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {resendCountdown > 0 ? `${resendCountdown} 秒後可重新寄送` : '重新寄送驗證信'}
            </button>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isAuthCaptchaReady(captchaToken)}
            className="w-full py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:outline-none"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{isLogin ? '登入中...' : '註冊中...'}</span>
              </div>
            ) : (
              isLogin ? '登入' : '註冊'
            )}
          </button>
        </form>

        {/* Forgot Password (Login only) */}
        {isLogin && (
          <div className="mt-4 text-center">
            <button 
              onClick={handleForgotPassword}
              disabled={loading || !isAuthCaptchaReady(captchaToken)}
              className="text-sm text-teal-600 hover:text-teal-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:outline-none"
            >
              忘記密碼？
            </button>
          </div>
        )}

        {/* Switch Mode */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? "還沒有帳號？" : "已經有帳號了？"}
            <button
              onClick={switchMode}
              className="ml-1 text-teal-600 hover:text-teal-800 font-medium cursor-pointer outline-none focus:outline-none"
            >
              {isLogin ? '註冊' : '登入'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
