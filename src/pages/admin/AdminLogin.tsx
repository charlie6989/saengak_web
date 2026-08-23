import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { captureExceptionSafe } from '../../lib/sentry';

interface AdminLoginProps {
  onSuccess?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupabaseConfigured) {
      setErrorMessage('後端 Supabase 認證服務尚未設定完成，請檢查環境變數。');
      return;
    }

    if (!email || !password) {
      setErrorMessage('請輸入管理員電子郵件與密碼。');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        captureExceptionSafe(error, { source: 'AdminLogin.signInWithPassword' });
        setErrorMessage(
          error.message === 'Invalid login credentials'
            ? '登入失敗：電子郵件或密碼不正確。'
            : `登入失敗：${error.message}`
        );
        return;
      }

      if (data.user) {
        const role = data.user.app_metadata?.role;
        if (role !== 'admin') {
          setErrorMessage(
            `帳號 ${data.user.email} 已通過驗證，但尚未指派 admin 管理員角色（目前角色：${role || '一般用戶'}）。`
          );
          return;
        }

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminLogin.handleSubmit.catch' });
      setErrorMessage('登入過程中發生未預期錯誤，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="admin-login-page"
      className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-4 py-12"
    >
      <div className="w-full max-w-md">
        {/* 標頭與 Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto inline-flex items-center space-x-2 rounded-xl bg-[#225B4F] px-4 py-2 text-white shadow-md">
            <span className="text-base font-black tracking-widest">SAENGAK</span>
            <span className="text-xs font-semibold opacity-90">| 管理後台</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">管理員安全登入</h1>
          <p className="mt-1 text-sm text-gray-500">
            請輸入具備管理員權限之帳號憑證以進入營運主控台
          </p>
        </div>

        {/* 登入卡片 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* 安全政策提示 */}
          <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50/70 p-3.5 text-xs text-teal-800">
            <div className="flex items-start space-x-2">
              <span className="text-sm">🛡️</span>
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-semibold">安全權限不變量：</span>
                <p className="text-teal-700">
                  系統嚴格限制僅有 <code>app_metadata.role = 'admin'</code> 之授權人員方可存取後台。
                </p>
              </div>
            </div>
          </div>

          {/* 錯誤訊息提示 */}
          {errorMessage && (
            <div
              data-testid="admin-login-error"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 leading-relaxed"
            >
              <div className="flex items-start space-x-2">
                <span className="text-base">⚠️</span>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                管理員電子郵件 (Admin Email)
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@saengak.com.tw"
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#225B4F] focus:outline-none focus:ring-2 focus:ring-[#225B4F]/20 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                管理密碼 (Password)
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#225B4F] focus:outline-none focus:ring-2 focus:ring-[#225B4F]/20 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#225B4F] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1b483f] focus:outline-none focus:ring-2 focus:ring-[#225B4F] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>驗證管理權限中...</span>
                </div>
              ) : (
                '登入管理後台系統'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <Link
              to="/"
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              ← 返回前台商城首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
