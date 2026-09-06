import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface GoogleLoginButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  width?: number | string;
  onSuccess?: (result: { session: any; user: any }) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export default function GoogleLoginButton({
  text = 'continue_with',
  onError,
  disabled = false,
}: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const getButtonText = () => {
    switch (text) {
      case 'signup_with':
        return '使用 Google 帳號註冊';
      case 'signin_with':
      case 'signin':
        return '使用 Google 帳號登入';
      case 'continue_with':
      default:
        return '透過 Google 帳戶繼續操作';
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      onError?.(new Error('會員系統正在連線，現階段暫無法登入'));
      return;
    }

    try {
      setLoading(true);
      const redirectTo = `${window.location.origin}/auth/confirm`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Google OAuth 錯誤:', err);
      setLoading(false);
      let errorMsg = err?.message || 'Google 登入失敗';
      if (errorMsg.includes('provider is not enabled') || errorMsg.includes('Unsupported provider')) {
        errorMsg = 'Google 登入尚未啟用：Supabase 後台尚未配置 Google Client ID 與 Secret';
      }
      onError?.(err instanceof Error ? err : new Error(errorMsg));
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={disabled || loading}
      aria-label="使用 Google 登入"
      className="w-full h-11 flex items-center justify-center gap-3 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium text-sm rounded-lg shadow-xs transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      )}
      <span className="truncate">{getButtonText()}</span>
    </button>
  );
}
