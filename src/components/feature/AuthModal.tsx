
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'login' | 'register';
  onSwitchMode?: (mode: 'login' | 'register') => void;
}

export default function AuthModal({ isOpen, onClose, mode = 'login', onSwitchMode }: AuthModalProps) {
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

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          setMessage(`登入失敗: ${error.message}`);
        } else {
          setMessage('登入成功！');
          setTimeout(() => {
            onClose();
            window.location.reload(); // 重新載入頁面以更新用戶狀態
          }, 1000);
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
            emailRedirectTo: `${window.location.origin.replace(':3000', ':5173')}/auth/confirm`
          }
        });

        if (error) {
          setMessage(`註冊失敗: ${error.message}`);
        } else {
          setMessage('註冊成功！請檢查您的電子郵件以驗證帳號');
          setTimeout(() => {
            onClose();
            // 註冊成功後跳轉到歡迎頁面
            navigate('/welcome');
          }, 2000);
        }
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/welcome`
        }
      });

      if (error) {
        console.error('Google OAuth error:', error);
        setMessage('Google 登入設定中，請稍後再試或使用電子郵件登入');
      }
    } catch (error) {
      console.error('Google login error:', error);
      setMessage('Google 登入功能暫時無法使用，請使用電子郵件登入');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setMessage('請先輸入您的電子郵件地址');
      return;
    }

    setLoading(true);
    try {
      // 使用正確的端口號 5173（Vite 預設端口）
      const redirectUrl = window.location.origin.replace(':3000', ':5173') + '/reset-password';
      console.log('Reset password redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setMessage(`重設密碼失敗: ${error.message}`);
      } else {
        setMessage('密碼重設連結已發送到您的電子郵件');
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isLogin ? '登入' : '註冊帳號'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer outline-none focus:outline-none"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 導航到獨立頁面的提示 */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
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
        </div>

        {/* Google Login Button - 暫時隱藏直到設定完成 */}
        <div style={{ display: 'none' }}>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mb-6 inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:outline-none"
          >
            <i className="ri-google-fill text-lg text-red-500 mr-3"></i>
            使用 Google {isLogin ? '登入' : '註冊'}
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或使用電子郵件</span>
            </div>
          </div>
        </div>

        {/* 設定完成提示 */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start">
            <i className="ri-information-line text-amber-600 mr-2 mt-0.5"></i>
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Google 登入設定中</p>
              <p>請先完成 Google Cloud Console 的 OAuth 設定，或使用電子郵件註冊登入</p>
            </div>
          </div>
        </div>

        {/* 提示訊息 */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <i className="ri-information-line text-blue-600 mr-2"></i>
            <span className="text-sm text-blue-800">
              目前僅支援電子郵件註冊和登入
            </span>
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
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="請輸入您的密碼"
              minLength={6}
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
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="請再次輸入密碼"
                minLength={6}
              />
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.includes('成功') || message.includes('已發送')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
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
              disabled={loading}
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
