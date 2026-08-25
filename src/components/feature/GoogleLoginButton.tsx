import React, { useEffect, useRef, useState } from 'react';
import { renderGoogleButton } from '../../lib/googleAuth';
import { isSupabaseConfigured } from '../../lib/supabase';

interface GoogleLoginButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  width?: number | string;
  onSuccess: (result: { session: any; user: any }) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export default function GoogleLoginButton({
  text = 'continue_with',
  theme = 'outline',
  size = 'large',
  width = 360,
  onSuccess,
  onError,
  disabled = false,
}: GoogleLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const setupButton = async () => {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        setLoadError(null);

        cleanup = await renderGoogleButton(containerRef.current, {
          theme,
          size,
          text,
          width,
          onSuccess: (result) => {
            if (isMounted) {
              onSuccess(result);
            }
          },
          onError: (err) => {
            console.error('Google 登入失敗:', err);
            if (isMounted) {
              setLoadError(err.message || 'Google 登入失敗');
              onError?.(err);
            }
          },
        });

        if (isMounted) {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Google SDK 載入或渲染失敗:', err);
        if (isMounted) {
          setLoading(false);
          setLoadError(err.message || '無法載入 Google 登入按鈕');
          onError?.(err);
        }
      }
    };

    setupButton();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [text, theme, size, width, onSuccess, onError]);

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Google 官方渲染容器 */}
      <div
        ref={containerRef}
        className={`w-full flex justify-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ minHeight: '44px' }}
      />

      {loading && (
        <div className="flex items-center justify-center py-2 text-xs text-gray-500 space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
          <span>載入 Google 登入服務...</span>
        </div>
      )}

      {loadError && (
        <p className="text-xs text-red-500 mt-1 text-center">
          {loadError}
        </p>
      )}
    </div>
  );
}
