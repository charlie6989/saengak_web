import { useState } from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { triggerFacebookLogin, isFacebookAuthConfigured } from '../../lib/facebookAuth';

interface FacebookLoginButtonProps {
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function FacebookLoginButton({
  text = 'continue_with',
  disabled = false,
  onSuccess,
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
        return '使用 Facebook 繼續操作';
    }
  };

  const handleFacebookLogin = async () => {
    if (!isSupabaseConfigured) {
      onError?.(new Error('會員系統正在連線，現階段暫無法登入'));
      return;
    }

    if (!isFacebookAuthConfigured) {
      onError?.(
        new Error(
          '此登入方式暫時無法使用，請稍後再試或改用 Email 登入。'
        )
      );
      return;
    }

    try {
      setLoading(true);
      const result = await triggerFacebookLogin();
      if (result.error) {
        throw result.error;
      }
      if (result.user || result.session) {
        onSuccess?.();
      }
    } catch (err: any) {
      console.error('Facebook 登入錯誤:', err);
      setLoading(false);
      let errorMsg = err?.message || 'Facebook 登入失敗';
      if (
        errorMsg.includes('provider is not enabled') ||
        errorMsg.includes('Unsupported provider')
      ) {
        errorMsg =
          '此登入方式暫時無法使用，請稍後再試或改用 Email 登入。';
      }
      onError?.(new Error(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleFacebookLogin}
      disabled={disabled || loading}
      aria-label="使用 Facebook 登入"
      className="w-full h-11 flex items-center justify-center gap-3 px-4 bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#1465D2] text-white font-medium text-sm rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <i className="ri-facebook-circle-fill text-xl leading-none" />
      )}
      <span className="truncate">{getButtonText()}</span>
    </button>
  );
}
