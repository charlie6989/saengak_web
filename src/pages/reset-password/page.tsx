
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let mounted = true;

    // Supabase JS 會從 recovery redirect 自動建立 session；以
    // PASSWORD_RECOVERY 事件為主，並兼容 PKCE code flow。
    const checkToken = async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session && mounted) {
            setIsValidToken(true);
            setMessage('');
            return;
          }
        }

        const hash = new URLSearchParams(window.location.hash.slice(1));
        const isRecoveryRedirect = hash.get('type') === 'recovery';
        const { data, error } = await supabase.auth.getSession();
        if (isRecoveryRedirect && !error && data.session && mounted) {
          setIsValidToken(true);
          setMessage('');
          return;
        }
      } catch (error) {
        console.error('Password recovery session error:', error);
      }

      if (mounted) {
        setMessage('重設密碼連結無效或已過期');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && mounted) {
        setIsValidToken(true);
        setMessage('');
      }
    });

    checkToken();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('密碼不一致');
      return;
    }

    if (password.length < 12) {
      setMessage('密碼長度至少需要 12 個字元');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setMessage(`密碼重設失敗: ${error.message}`);
      } else {
        setMessage('密碼重設成功！正在跳轉到首頁...');
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <img 
              src="https://public.readdy.ai/ai/img_res/7abd47af-dc1d-4a06-b368-a8eac6dfbf6a.jpg"
              alt="Inner Saengak Logo"
              className="h-12 w-auto mx-auto"
              style={{ 
                filter: 'brightness(0.8) contrast(1.2) saturate(1.1)'
              }}
            />
          </Link>
        </div>
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            重設密碼
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            請輸入您的新密碼
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {!isValidToken ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <i className="ri-error-warning-line text-2xl text-red-600"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                連結無效
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {message || '重設密碼連結無效或已過期，請重新申請'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                返回首頁
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  新密碼
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="請輸入新密碼（至少 12 個字元）"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  確認新密碼
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="請再次輸入新密碼"
                />
              </div>

              {message && (
                <div className={`p-3 rounded-md text-sm ${
                  message.includes('成功')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <div className="flex items-center">
                    <i className={`mr-2 ${
                      message.includes('成功') ? 'ri-check-line' : 'ri-error-warning-line'
                    }`}></i>
                    {message}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>重設中...</span>
                  </div>
                ) : (
                  '重設密碼'
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-teal-600 hover:text-teal-800 cursor-pointer"
          >
            返回首頁
          </button>
        </div>
      </div>
    </div>
  );
}
