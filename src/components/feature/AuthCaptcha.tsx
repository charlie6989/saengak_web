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

/** 等這麼久還沒拿到 token，就顯示說明與重新驗證按鈕（Safari 無痕模式常停在「Verifying…」，不會觸發錯誤）。 */
export const CAPTCHA_STALL_MS = 15000;

/** 驗證失敗或停住時的說明。Cloudflare 可能把 Safari 無痕模式等隱私設定判定為機器人，網站無法改變判定結果。 */
export const CAPTCHA_STUCK_MESSAGE = '安全驗證沒有完成。Safari 無痕模式或部分隱私設定可能無法通過驗證，請按「重新驗證」，或改用一般瀏覽模式再試一次。';

interface AuthCaptchaProps {
  onTokenChange: (token: string) => void;
  resetKey: number;
  /** Turnstile action，伺服器端可比對 siteverify 回傳的 action（例如 'guest_checkout'）。 */
  action?: string;
  siteKey?: string;
  /** 驗證失敗或停住時，接在預設說明後面的替代做法（例如訪客結帳提示改用會員登入）。 */
  fallbackHint?: string;
}

export default function AuthCaptcha({ onTokenChange, resetKey, action, siteKey = configuredSiteKey, fallbackHint }: AuthCaptchaProps) {
  const [hasToken, setHasToken] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const onTokenChangeRef = useRef(onTokenChange);
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  });

  // 重新驗證時清除提示狀態；元件卸載時清除 token，避免送出已離開畫面的舊 token
  useEffect(() => {
    setHasToken(false);
    setStuck(false);
  }, [resetKey, retryCount]);
  useEffect(() => () => onTokenChangeRef.current(''), []);

  // 一段時間內沒拿到 token 視為停住
  useEffect(() => {
    if (!siteKey || hasToken || stuck) return undefined;
    const timer = setTimeout(() => setStuck(true), CAPTCHA_STALL_MS);
    return () => clearTimeout(timer);
  }, [siteKey, hasToken, stuck, resetKey, retryCount]);

  if (!siteKey) return null;

  const updateToken = (token: string) => {
    setHasToken(Boolean(token));
    if (token) setStuck(false);
    onTokenChange(token);
  };
  const fail = () => {
    updateToken('');
    setStuck(true);
  };

  return (
    <div className="space-y-2">
      <Turnstile
        key={`${resetKey}-${retryCount}`}
        siteKey={siteKey}
        options={action ? { action, language: 'zh-tw' } : { language: 'zh-tw' }}
        onSuccess={updateToken}
        onExpire={() => updateToken('')}
        onError={fail}
        onTimeout={fail}
        onUnsupported={fail}
      />
      {!hasToken && !stuck && <p className="text-xs text-gray-500">請完成安全驗證後繼續。</p>}
      {!hasToken && stuck && (
        <div role="alert" className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          <p>{CAPTCHA_STUCK_MESSAGE}{fallbackHint ? ` ${fallbackHint}` : ''}</p>
          <button
            type="button"
            onClick={() => {
              onTokenChange('');
              setRetryCount((count) => count + 1);
            }}
            className="font-semibold underline underline-offset-2"
          >
            重新驗證
          </button>
        </div>
      )}
    </div>
  );
}
