
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthConfirmPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let redirectTimer: number | undefined;

    const handleAuthConfirm = async () => {
      try {
        // 1. 檢查 URL Query 或 Hash 是否包含第三方 OAuth 錯誤訊息
        const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash);
        const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
        const errorMsg = searchParams.get('error') || hashParams.get('error');

        if (errorMsg || errorDesc) {
          console.error('Auth confirmation redirect error:', errorMsg, errorDesc);
          if (errorDesc?.includes('Unable to exchange external code') || errorDesc?.includes('invalid_client')) {
            setMessage('Google 登入驗證失敗：Supabase 後台尚未儲存有效的 Google Client Secret，請由專案擁有者 (Owner) 登入後台儲存金鑰。');
          } else {
            setMessage(`驗證失敗: ${errorDesc || errorMsg}`);
          }
          setLoading(false);
          return;
        }

        // 2. PKCE code 交換或取得 Session
        const code = searchParams.get('code');
        const result = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.getSession();
        const { data, error } = result;
        
        if (error) {
          console.error('Auth confirmation error:', error);
          setMessage(`驗證失敗: ${error.message || '請重新嘗試'}`);
          setLoading(false);
          return;
        }

        if (data.session) {
          setIsSuccess(true);
          setLoading(false);
          setMessage('會員登入驗證成功！正在跳轉...');
          const fromCheckout = searchParams.get('from') === 'checkout';
          redirectTimer = window.setTimeout(() => {
            // 驗證成功後跳轉
            navigate(fromCheckout ? '/' : '/welcome');
          }, 1500);
        } else {
          setMessage('驗證連結無效或已過期，請重新登入');
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Confirmation error:', error);
        setMessage(error?.message || '發生錯誤，請稍後再試');
        setLoading(false);
      }
    };

    handleAuthConfirm();

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            電子郵件認證
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            正在驗證您的電子郵件地址
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            {loading ? (
              <div>
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  正在驗證中...
                </h3>
                <p className="text-sm text-gray-600">
                  請稍候，我們正在確認您的電子郵件地址
                </p>
              </div>
            ) : (
              <div>
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isSuccess ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <i className={`text-2xl ${
                    isSuccess 
                      ? 'ri-check-line text-green-600' 
                      : 'ri-error-warning-line text-red-600'
                  }`}></i>
                </div>
                <h3 className={`text-lg font-medium mb-2 ${
                  isSuccess ? 'text-green-900' : 'text-red-900'
                }`}>
                  {isSuccess ? '認證成功！' : '認證失敗'}
                </h3>
                <p className={`text-sm mb-6 ${
                  isSuccess ? 'text-green-600' : 'text-red-600'
                }`}>
                  {message}
                </p>
                
                {isSuccess ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                      <span>3秒後自動跳轉到首頁...</span>
                    </div>
                    <button
                      onClick={() => navigate('/')}
                      className="w-full py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      立即前往首頁
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => navigate('/')}
                      className="w-full py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      返回首頁
                    </button>
                    <p className="text-xs text-gray-500">
                      如果問題持續發生，請聯繫客服支援
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
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
