import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface FacebookLoginButtonProps {
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function FacebookLoginButton({
  text = 'continue_with',
  disabled = false,
  onError,
}: FacebookLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const getButtonText = () => {
    switch (text) {
      case 'signup_with':
        return '使用 Facebook 帳號註冊';
      case 'signin_with':
        return '使用 Facebook 帳號登入';
      case 'continue_with':
      default:
        return '使用 Facebook 繼續';
    }
  };

  const handleFacebookLogin = async () => {
    if (!isSupabaseConfigured) {
      onError?.(new Error('會員系統正在連線，現階段暫無法登入'));
      return;
    }

    try {
      setLoading(true);
      const redirectTo = `${window.location.origin}/auth/confirm`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo,
          scopes: 'email,public_profile',
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Facebook OAuth 錯誤:', err);
      setLoading(false);
      onError?.(err instanceof Error ? err : new Error(err?.message || 'Facebook 登入失敗'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleFacebookLogin}
      disabled={disabled || loading}
      aria-label="使用 Facebook 登入"
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#1465D2] text-white font-medium text-sm rounded-lg shadow-xs transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      ) : (
        <i className="ri-facebook-circle-fill text-lg"></i>
      )}
      <span>{getButtonText()}</span>
    </button>
  );
}
