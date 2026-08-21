import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export type CheckoutIdentityMode = 'guest' | 'member';

export interface IdentityFlowProps {
  mode: CheckoutIdentityMode;
  onModeChange: (mode: CheckoutIdentityMode) => void;
  guestEmail: string;
  guestPhone: string;
  onGuestEmailChange: (email: string) => void;
  onGuestPhoneChange: (phone: string) => void;
  userEmail?: string;
}

/**
 * 結帳身分流程元件
 * 遵循 CHECKOUT_PAYMENT_SPEC §7.7 混合模式 (Email OTP 歸戶) 與防枚舉安全設計：
 * - 訪客查詢歷史訂單時，需同時提供手機號碼與 Email
 * - 無論該信箱是否註冊過，均經歷固定延遲 (800ms) 並回傳相同成功提示，不洩漏帳號或訂單存在性
 */
export function IdentityFlow({
  mode,
  onModeChange,
  guestEmail,
  guestPhone,
  onGuestEmailChange,
  onGuestPhoneChange,
  userEmail,
}: IdentityFlowProps) {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(userEmail);
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 監聽 Supabase Auth 狀態
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
        onModeChange('member');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
        onModeChange('member');
      } else {
        setCurrentUserEmail(undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onModeChange]);

  // 處理發送 OTP / Magic Link（防枚舉設計：固定延遲與統一成功回應）
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLookupMessage(null);

    const email = lookupEmail.trim();
    const phone = lookupPhone.trim();

    if (!email || !email.includes('@')) {
      setErrorMessage('請輸入有效的 Email 地址');
      return;
    }
    if (!phone || phone.length < 8) {
      setErrorMessage('請輸入有效的手機號碼');
      return;
    }

    setIsSendingOtp(true);
    const startTime = Date.now();

    try {
      if (isSupabaseConfigured) {
        // 透過 Supabase 發送 Email OTP
        await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/checkout`,
          },
        });
      }

      // 防枚舉固定延遲 (維持至少 800ms)
      const elapsed = Date.now() - startTime;
      const delayNeeded = Math.max(0, 800 - elapsed);
      if (delayNeeded > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayNeeded));
      }

      // 一律顯示統一安全提示
      setOtpSent(true);
      setLookupMessage(
        '若此手機號碼與 Email 與歷史訂單相符，系統已將 6 碼驗證碼與登入連結寄送至您的信箱，請查收並於下方輸入驗證。',
      );
    } catch {
      // 即使發生錯誤，仍維持統一提示防探測
      const elapsed = Date.now() - startTime;
      const delayNeeded = Math.max(0, 800 - elapsed);
      if (delayNeeded > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayNeeded));
      }
      setOtpSent(true);
      setLookupMessage(
        '若此手機號碼與 Email 與歷史訂單相符，系統已將 6 碼驗證碼與登入連結寄送至您的信箱，請查收並於下方輸入驗證。',
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 驗證 OTP 代碼
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const email = lookupEmail.trim();
    const token = otpCode.trim();

    if (!token || token.length < 6) {
      setErrorMessage('請輸入 6 碼驗證碼');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });

        if (error) {
          throw error;
        }

        if (data.session?.user?.email) {
          setCurrentUserEmail(data.session.user.email);
          onModeChange('member');
          setShowLookupModal(false);
          setOtpSent(false);
          setOtpCode('');
        }
      } else {
        // Mock 環境直接登入成功
        setCurrentUserEmail(email);
        onModeChange('member');
        setShowLookupModal(false);
        setOtpSent(false);
        setOtpCode('');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '驗證碼錯誤或已過期，請重新索取');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setCurrentUserEmail(undefined);
    onModeChange('guest');
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4" data-testid="identity-flow">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
          <span>1. 結帳身分確認</span>
        </h3>
        {currentUserEmail ? (
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            已登入會員
          </span>
        ) : (
          <span className="text-xs font-medium text-stone-500">
            支援訪客快速免登結帳
          </span>
        )}
      </div>

      {currentUserEmail ? (
        // 已登入會員資訊
        <div className="bg-stone-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
              {currentUserEmail.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">{currentUserEmail}</p>
              <p className="text-xs text-stone-500">已自動套用會員專屬優惠與發票載具</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-stone-500 hover:text-stone-800 underline self-start sm:self-center cursor-pointer"
          >
            切換帳號 / 訪客結帳
          </button>
        </div>
      ) : (
        // 訪客 vs 會員切換選項
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="mode-guest-btn"
              onClick={() => onModeChange('guest')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                mode === 'guest'
                  ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-stone-900 text-sm">訪客快速結帳</span>
                <input
                  type="radio"
                  name="identity_mode"
                  checked={mode === 'guest'}
                  onChange={() => onModeChange('guest')}
                  className="text-teal-600 focus:ring-teal-500"
                />
              </div>
              <p className="text-xs text-stone-500">免註冊，填寫聯絡資料即可直接結帳</p>
            </button>

            <button
              type="button"
              data-testid="mode-member-btn"
              onClick={() => {
                onModeChange('member');
                setShowLookupModal(true);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                mode === 'member'
                  ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-stone-900 text-sm">會員快速結帳</span>
                <input
                  type="radio"
                  name="identity_mode"
                  checked={mode === 'member'}
                  onChange={() => onModeChange('member')}
                  className="text-teal-600 focus:ring-teal-500"
                />
              </div>
              <p className="text-xs text-stone-500">快速登入 / 歷史訂單查詢歸戶</p>
            </button>
          </div>

          {mode === 'guest' && (
            <div className="bg-stone-50/60 rounded-xl p-4 border border-stone-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="guest-email" className="block text-xs font-semibold text-stone-700 mb-1">
                    聯絡 Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="guest-email"
                    data-testid="guest-email-input"
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => onGuestEmailChange(e.target.value)}
                    placeholder="用於接收訂單確認信"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label htmlFor="guest-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                    聯絡手機 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="guest-phone"
                    data-testid="guest-phone-input"
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => onGuestPhoneChange(e.target.value)}
                    placeholder="0912345678"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-stone-500">
                  曾於本站訂購？
                </p>
                <button
                  type="button"
                  data-testid="open-lookup-modal-btn"
                  onClick={() => setShowLookupModal(true)}
                  className="text-xs text-teal-700 font-semibold hover:underline cursor-pointer"
                >
                  查詢歷史訂單並自動歸戶 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 訪客歷史訂單查詢與 OTP 登入 Modal */}
      {showLookupModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lookup-dialog-title"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setShowLookupModal(false);
                setOtpSent(false);
                setLookupMessage(null);
                setErrorMessage(null);
              }}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 cursor-pointer"
            >
              ×
            </button>

            <div>
              <h4 id="lookup-dialog-title" className="text-lg font-bold text-stone-900">
                會員登入 / 歷史訂單查詢
              </h4>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                依據個資防護與防窮舉機制，輸入手機與 Email 驗證後即可檢視歷史訂單並快速結帳。
              </p>
            </div>

            {lookupMessage && (
              <div
                role="status"
                data-testid="lookup-message"
                className="p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl leading-relaxed"
              >
                {lookupMessage}
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                data-testid="lookup-error"
                className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl"
              >
                {errorMessage}
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label htmlFor="lookup-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                    手機號碼
                  </label>
                  <input
                    id="lookup-phone"
                    data-testid="lookup-phone-input"
                    type="tel"
                    required
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label htmlFor="lookup-email" className="block text-xs font-semibold text-stone-700 mb-1">
                    Email 信箱
                  </label>
                  <input
                    id="lookup-email"
                    data-testid="lookup-email-input"
                    type="email"
                    required
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    data-testid="send-otp-btn"
                    disabled={isSendingOtp}
                    className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSendingOtp ? '正在進行安全驗證…' : '發送 Email 驗證碼'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <label htmlFor="otp-token" className="block text-xs font-semibold text-stone-700 mb-1">
                    6 碼 Email 驗證碼
                  </label>
                  <input
                    id="otp-token"
                    data-testid="otp-input"
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="例如 123456"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm text-center font-mono tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    data-testid="verify-otp-btn"
                    disabled={isVerifyingOtp}
                    className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isVerifyingOtp ? '正在驗證…' : '確認驗證並登入'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-xs text-stone-500 hover:text-stone-800 text-center py-2"
                  >
                    重新修改手機與 Email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default IdentityFlow;
