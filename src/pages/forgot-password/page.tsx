
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setMessage(`重設密碼失敗: ${error.message}`);
        setIsSuccess(false);
      } else {
        setMessage('密碼重設連結已發送到您的電子郵件，請檢查您的信箱');
        setIsSuccess(true);
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              忘記密碼
            </h2>
            <p className="text-gray-600">
              請輸入您的電子郵件地址，我們將發送重設密碼連結給您
            </p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-lg rounded-lg border">
            {!isSuccess ? (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    電子郵件地址
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="請輸入您的電子郵件地址"
                  />
                </div>

                {message && !isSuccess && (
                  <div className="rounded-md p-3 text-sm bg-red-50 border border-red-200 text-red-800">
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
                        <span>發送中...</span>
                      </div>
                    ) : (
                      '發送重設連結'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <i className="ri-check-line text-2xl text-green-600"></i>
                </div>
                <div className="rounded-md p-4 bg-green-50 border border-green-200">
                  <p className="text-sm text-green-800">{message}</p>
                </div>
                <p className="text-sm text-gray-600">
                  沒有收到郵件？請檢查垃圾郵件資料夾，或{' '}
                  <button
                    onClick={() => {
                      setIsSuccess(false);
                      setMessage('');
                      setEmail('');
                    }}
                    className="text-teal-600 hover:text-teal-800 cursor-pointer"
                  >
                    重新發送
                  </button>
                </p>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-teal-600 hover:text-teal-800 cursor-pointer"
              >
                <i className="ri-arrow-left-line mr-1"></i>
                返回登入頁面
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
