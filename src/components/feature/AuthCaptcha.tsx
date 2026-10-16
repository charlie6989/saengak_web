import { useEffect, useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

const configuredSiteKey = import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY?.trim();
export const guestCheckoutSiteKey = import.meta.env.VITE_PUBLIC_GUEST_CHECKOUT_TURNSTILE_SITE_KEY?.trim();
export const isGuestCheckoutCaptchaEnabled = Boolean(guestCheckoutSiteKey);

export const isAuthCaptchaEnabled = Boolean(configuredSiteKey);

export function isAuthCaptchaReady(
  token: string,
  enabled = isAuthCaptchaEnabled,
): boolean {
  return !enabled || Boolean(token);
}

export function captchaTokenOptions(token: string): { captchaToken?: string } {
  return token ? { captchaToken: token } : {};
}

interface AuthCaptchaProps {
  onTokenChange: (token: string) => void;
  resetKey: number;
  /** Turnstile action，伺服器端可比對 siteverify 回傳的 action（例如 'guest_checkout'）。 */
  action?: string;
  siteKey?: string;
}

export default function AuthCaptcha({ onTokenChange, resetKey, action, siteKey = configuredSiteKey }: AuthCaptchaProps) {
  const [hasToken, setHasToken] = useState(false);
  const onTokenChangeRef = useRef(onTokenChange);
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  });

  // 重新驗證時清除提示狀態；元件卸載時清除 token，避免送出已離開畫面的舊 token
  useEffect(() => {
    setHasToken(false);
  }, [resetKey]);
  useEffect(() => () => onTokenChangeRef.current(''), []);

  if (!siteKey) return null;

  const updateToken = (token: string) => {
    setHasToken(Boolean(token));
    onTokenChange(token);
  };

  return (
    <div className="space-y-2">
      <Turnstile
        key={resetKey}
        siteKey={siteKey}
        options={action ? { action } : undefined}
        onSuccess={updateToken}
        onExpire={() => updateToken('')}
        onError={() => updateToken('')}
      />
      {!hasToken && <p className="text-xs text-gray-500">請完成安全驗證後繼續。</p>}
    </div>
  );
}
