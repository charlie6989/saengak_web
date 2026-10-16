import { useEffect, useRef } from 'react';
import AuthCaptcha, { guestCheckoutSiteKey, isGuestCheckoutCaptchaEnabled } from './AuthCaptcha';

export type SignedOutCheckoutMode = 'member' | 'guest';

const guestEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 是否提供訪客結帳：未登入、後台開啟 guest_checkout_enabled，且前端已設定 Turnstile。
 * 沒有 Turnstile site key 時伺服器一定會回 TURNSTILE_TOKEN_REQUIRED，因此不顯示。
 */
export function isGuestCheckoutAvailable(
  isSignedIn: boolean,
  guestCheckoutEnabled: boolean,
  captchaEnabled = isGuestCheckoutCaptchaEnabled,
): boolean {
  return !isSignedIn && guestCheckoutEnabled && captchaEnabled;
}

export const GUEST_EMAIL_ERROR_MESSAGE = '請輸入有效的 Email，訂單確認信會寄到這個信箱。';

export interface GuestCheckoutValidationError {
  field: 'email' | 'captcha';
  message: string;
}

/** 送出訪客結帳前的檢查；通過則回傳 null。 */
export function getGuestCheckoutValidationError(
  email: string,
  turnstileToken: string,
): GuestCheckoutValidationError | null {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254 || !guestEmailPattern.test(trimmed)) {
    return { field: 'email', message: GUEST_EMAIL_ERROR_MESSAGE };
  }
  if (!turnstileToken) {
    return { field: 'captcha', message: '請先完成安全驗證，再進行訪客結帳。' };
  }
  return null;
}

interface SignedOutCheckoutActionsProps {
  mode: SignedOutCheckoutMode;
  guestEmail: string;
  /** Email 欄位旁顯示的錯誤；空字串代表沒有錯誤。 */
  guestEmailError: string;
  /** 每次遞增都會把焦點移到 Email 欄位（例如驗證失敗時）。 */
  emailFocusKey: number;
  /** 訪客結帳的提示或錯誤（例如伺服器拒絕），顯示在送出按鈕正上方。 */
  message: string;
  isBusy: boolean;
  captchaResetKey: number;
  onGuestEmailChange: (email: string) => void;
  onCaptchaTokenChange: (token: string) => void;
  onMemberCheckout: () => void;
  onChooseGuestCheckout: () => void;
  onSubmitGuestCheckout: () => void;
}

const fontStyle = { fontFamily: 'Noto Sans TC, sans-serif' };

/**
 * 未登入且開放訪客結帳時的結帳按鈕區：
 * 「登入結帳（使用會員優惠）」與「訪客結帳」；選擇訪客後展開 Email 與 Turnstile。
 */
export default function SignedOutCheckoutActions({
  mode,
  guestEmail,
  guestEmailError,
  emailFocusKey,
  message,
  isBusy,
  captchaResetKey,
  onGuestEmailChange,
  onCaptchaTokenChange,
  onMemberCheckout,
  onChooseGuestCheckout,
  onSubmitGuestCheckout,
}: SignedOutCheckoutActionsProps) {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  // 展開訪客結帳或驗證失敗時，把焦點移到 Email 欄位
  useEffect(() => {
    if (mode === 'guest') {
      emailInputRef.current?.focus();
    }
  }, [mode, emailFocusKey]);

  // 頁尾可捲動，訊息出現時捲到可視範圍，避免手機上被免運條遮住而看不到
  useEffect(() => {
    if (mode === 'guest' && message) {
      messageRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [mode, message]);

  const memberButton = (primary: boolean) => (
    <button
      type="button"
      onClick={onMemberCheckout}
      disabled={isBusy}
      data-testid="member-checkout-button"
      className={primary
        ? 'w-full bg-brand text-white py-3 rounded-sm font-semibold hover:bg-brand transition-all cursor-pointer shadow-md text-sm disabled:opacity-70 disabled:cursor-wait'
        : 'w-full border border-brand text-brand bg-white py-3 rounded-sm font-semibold hover:bg-blush transition-all cursor-pointer text-sm disabled:opacity-70 disabled:cursor-wait'}
      style={fontStyle}
    >
      登入結帳（使用會員優惠）
    </button>
  );

  if (mode !== 'guest') {
    return (
      <div className="space-y-2" data-testid="signed-out-checkout-actions">
        {memberButton(true)}
        <button
          type="button"
          onClick={onChooseGuestCheckout}
          disabled={isBusy}
          data-testid="guest-checkout-choice"
          className="w-full border border-gray-300 text-gray-800 bg-white py-3 rounded-sm font-semibold hover:border-brand hover:text-brand transition-all cursor-pointer text-sm disabled:opacity-70"
          style={fontStyle}
        >
          訪客結帳
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="guest-checkout-panel">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900" style={fontStyle}>訪客結帳</h3>
          <span className="text-[11px] text-gray-500">不需註冊</span>
        </div>
        <p className="rounded-lg bg-blush px-2.5 py-1.5 text-[11px] text-brand" data-testid="guest-member-benefits-notice">
          登入後可使用會員優惠（優惠券與折扣碼）。訪客結帳不套用會員優惠。
        </p>
        <div>
          <label htmlFor="guest-checkout-email" className="block text-xs font-semibold text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          {/* 手機上用 16px 字級，避免 iOS 聚焦時自動放大 */}
          <input
            ref={emailInputRef}
            id="guest-checkout-email"
            name="guestEmail"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={guestEmail}
            onChange={(e) => onGuestEmailChange(e.target.value)}
            placeholder="name@example.com"
            aria-invalid={guestEmailError ? true : undefined}
            aria-describedby={guestEmailError
              ? 'guest-checkout-email-error guest-checkout-email-help'
              : 'guest-checkout-email-help'}
            className={`w-full h-11 px-3 rounded-lg border text-base sm:text-sm bg-white focus:outline-hidden transition-colors ${
              guestEmailError ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-brand'
            }`}
          />
          {guestEmailError && (
            <p id="guest-checkout-email-error" className="mt-1 text-xs text-red-600" role="alert">
              {guestEmailError}
            </p>
          )}
          <p id="guest-checkout-email-help" className="mt-1 text-[11px] text-gray-500 leading-relaxed">
            訂單確認信會寄到這個信箱；之後以同一 Email 註冊會員，即可在會員中心看到這筆訂單。
          </p>
        </div>
        <AuthCaptcha siteKey={guestCheckoutSiteKey} onTokenChange={onCaptchaTokenChange} resetKey={captchaResetKey} action="guest_checkout" />
      </div>
      {message && (
        <p
          ref={messageRef}
          className="rounded-sm bg-amber-50 px-3 py-2 text-xs text-amber-800"
          role="status"
          data-testid="guest-checkout-message"
        >
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmitGuestCheckout}
        disabled={isBusy}
        data-testid="guest-checkout-submit"
        className="w-full bg-brand text-white py-3 rounded-sm font-semibold hover:bg-brand transition-all cursor-pointer shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
        style={fontStyle}
      >
        {isBusy ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>處理中...</span>
          </>
        ) : (
          <span>以訪客身分前往結帳</span>
        )}
      </button>
      {memberButton(false)}
    </div>
  );
}
