
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate, useSearchParams } from 'react-router-dom';

const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthConfirmPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthConfirm = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth confirmation error:', error);
          setMessage('驗證失敗，請重新嘗試');
          setLoading(false);
          return;
        }

        if (data.session) {
          setMessage('電子郵件驗證成功！正在跳轉...');
          setTimeout(() => {
            // 驗證成功後跳轉到歡迎頁面
            navigate('/welcome');
          }, 2000);
        } else {
          setMessage('驗證連結無效或已過期');
          setLoading(false);
        }
      } catch (error) {
        console.error('Confirmation error:', error);
        setMessage('發生錯誤，請稍後再試');
        setLoading(false);
      }
    };

    handleAuthConfirm();
  }, [navigate]);

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
