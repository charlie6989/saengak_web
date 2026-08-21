import {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react';

declare global {
  interface Window {
    TPDirect?: any;
  }
}

export interface PaymentFormHandle {
  getPrime: () => Promise<string>;
  isReady: () => boolean;
}

export interface PaymentFormProps {
  onStatusChange?: (status: {
    canGetPrime: boolean;
    hasError: boolean;
    errorMessage?: string;
  }) => void;
  disabled?: boolean;
}

const TAPPAY_SDK_URL = 'https://js.tappaysdk.com/sdk/tpdirect/v5.18.0';

/**
 * TapPay Hosted Fields 信用卡付款表單元件
 * 嚴格遵循 PCI-DSS SAQ A-EP（卡號零落地政策）：
 * - 卡號、有效期限、CCV 均由 TapPay 獨立加密 iframe 處理
 * - 前端 React 狀態不包含、不傳遞、不儲存任何卡號字串
 */
export const PaymentForm = forwardRef<PaymentFormHandle, PaymentFormProps>(
  ({ onStatusChange, disabled = false }, ref) => {
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [sdkError, setSdkError] = useState<string | null>(null);
    const [canGetPrime, setCanGetPrime] = useState(false);
    const [cardStatus, setCardStatus] = useState({
      numberStatus: 0, // 0: 正常/未填, 1: 錯誤, 2: 正確
      expiryStatus: 0,
      ccvStatus: 0,
    });
    const isSetupRef = useRef(false);

    // 載入 TapPay SDK
    useEffect(() => {
      let isMounted = true;

      const initTapPay = () => {
        try {
          if (!window.TPDirect) {
            throw new Error('TapPay SDK 未成功載入');
          }

          const appIdRaw = import.meta.env.VITE_PUBLIC_TAPPAY_APP_ID || import.meta.env.VITE_TAPPAY_APP_ID;
          const appKey = import.meta.env.VITE_PUBLIC_TAPPAY_APP_KEY || import.meta.env.VITE_TAPPAY_APP_KEY;
          const appId = Number(appIdRaw);
          const env =
            (import.meta.env.VITE_PUBLIC_TAPPAY_ENV || import.meta.env.VITE_TAPPAY_ENV) === 'production'
              ? 'production'
              : 'sandbox';

          if (!appIdRaw || !Number.isFinite(appId) || !appKey) {
            throw new Error(
              'TapPay App ID / App Key 尚未設定，請確認 VITE_PUBLIC_TAPPAY_APP_ID 與 VITE_PUBLIC_TAPPAY_APP_KEY 環境變數',
            );
          }

          window.TPDirect.setupSDK(appId, appKey, env);

          if (!isSetupRef.current) {
            window.TPDirect.card.setup({
              fields: {
                number: {
                  element: '#tappay-card-number',
                  placeholder: '4000221111111111 (直接輸入 16 位卡號)',
                },
                expirationDate: {
                  element: '#tappay-card-expiration-date',
                  placeholder: 'MM / YY',
                },
                ccv: {
                  element: '#tappay-card-ccv',
                  placeholder: 'CVV (3 碼)',
                },
              },
              styles: {
                input: {
                  color: '#1c1917',
                  'font-size': '15px',
                  'font-family': 'monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  'letter-spacing': '1px',
                },
                ':focus': {
                  color: '#0f766e',
                },
                '.valid': {
                  color: '#059669',
                },
                '.invalid': {
                  color: '#e11d48',
                },
                '@media screen and (max-width: 400px)': {
                  'font-size': '14px',
                },
              },
              // 停用強制遮罩以確保直接輸入 16 位數字時無中斷與空格阻礙
              isMaskCreditCardNumber: false,
            });

            window.TPDirect.card.onUpdate((update: any) => {
              if (!isMounted) return;

              const isReady = Boolean(update?.canGetPrime);
              setCanGetPrime(isReady);

              const newCardStatus = {
                numberStatus: update?.status?.number ?? 0,
                expiryStatus: update?.status?.expiry ?? 0,
                ccvStatus: update?.status?.ccv ?? 0,
              };
              setCardStatus(newCardStatus);

              let errorMessage: string | undefined;
              if (update?.status?.number === 2 && update?.status?.numberError) {
                errorMessage = '信用卡卡號有誤，請重新檢查';
              } else if (update?.status?.expiry === 2 && update?.status?.expiryError) {
                errorMessage = '卡片有效期限有誤，請確認 MM/YY 格式';
              } else if (update?.status?.ccv === 2 && update?.status?.ccvError) {
                errorMessage = '卡片背面末三碼 (CVV) 有誤';
              }

              onStatusChange?.({
                canGetPrime: isReady,
                hasError: Boolean(errorMessage),
                errorMessage,
              });
            });

            isSetupRef.current = true;
          }

          if (isMounted) {
            setSdkLoaded(true);
          }
        } catch (err: any) {
          if (isMounted) {
            const msg = err?.message || 'TapPay 初始化失敗';
            setSdkError(msg);
            onStatusChange?.({
              canGetPrime: false,
              hasError: true,
              errorMessage: msg,
            });
          }
        }
      };

      if (window.TPDirect) {
        initTapPay();
      } else {
        const existingScript = document.querySelector(`script[src="${TAPPAY_SDK_URL}"]`);
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = TAPPAY_SDK_URL;
          script.async = true;
          script.onload = () => {
            if (isMounted) initTapPay();
          };
          script.onerror = () => {
            if (isMounted) {
              const msg = '無法載入 TapPay 安全刷卡元件，請檢查網路連線';
              setSdkError(msg);
              onStatusChange?.({
                canGetPrime: false,
                hasError: true,
                errorMessage: msg,
              });
            }
          };
          document.body.appendChild(script);
        } else {
          existingScript.addEventListener('load', initTapPay);
        }
      }

      return () => {
        isMounted = false;
      };
    }, [onStatusChange]);

    // 對父層暴露 getPrime 與 isReady 方法
    useImperativeHandle(
      ref,
      () => ({
        getPrime: () => {
          return new Promise<string>((resolve, reject) => {
            if (!window.TPDirect) {
              reject(new Error('TapPay SDK 尚未就緒'));
              return;
            }

            const tappayStatus = window.TPDirect.card.getTappayFieldsStatus();
            if (!tappayStatus.canGetPrime) {
              reject(new Error('請確認信用卡各欄位均填寫完整無誤'));
              return;
            }

            window.TPDirect.card.getPrime((result: any) => {
              if (result.status !== 0) {
                reject(
                  new Error(
                    result.msg || '取得信用卡授權碼失敗，請確認卡片資料或更換卡片重試',
                  ),
                );
              } else {
                resolve(result.card.prime);
              }
            });
          });
        },
        isReady: () => canGetPrime && sdkLoaded,
      }),
      [canGetPrime, sdkLoaded],
    );

    return (
      <div className="space-y-4" data-testid="tappay-payment-form">
        {sdkError && (
          <div
            role="alert"
            className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl flex items-center gap-2"
          >
            <svg
              className="w-4 h-4 text-rose-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{sdkError}</span>
          </div>
        )}

        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-800 text-sm sm:text-base">
                信用卡付款 (TapPay Direct Pay)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">
                PCI-DSS SAQ A-EP
              </span>
            </div>
            {/* 支援卡別圖示 */}
            <div className="flex items-center gap-1.5 opacity-80">
              <span className="text-[11px] text-stone-500 font-medium hidden sm:inline">支援:</span>
              <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-bold text-blue-700 border border-stone-200">
                VISA
              </span>
              <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-bold text-rose-600 border border-stone-200">
                MasterCard
              </span>
              <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-bold text-emerald-700 border border-stone-200">
                JCB
              </span>
            </div>
          </div>

          {/* 卡號 Hosted Field */}
          <div>
            <label
              htmlFor="tappay-card-number"
              className="block text-xs font-semibold text-stone-700 mb-1.5"
            >
              信用卡卡號
            </label>
            <div
              id="tappay-card-number"
              data-testid="hosted-field-card-number"
              className={`h-11 px-3.5 bg-stone-50/60 rounded-xl border transition-all flex items-center ${
                cardStatus.numberStatus === 2
                  ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20'
                  : cardStatus.numberStatus === 0
                    ? 'border-stone-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100'
                    : 'border-emerald-500 bg-emerald-50/20'
              } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            />
          </div>

          {/* 有效期限與 CCV */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label
                htmlFor="tappay-card-expiration-date"
                className="block text-xs font-semibold text-stone-700 mb-1.5"
              >
                有效期限 (MM / YY)
              </label>
              <div
                id="tappay-card-expiration-date"
                data-testid="hosted-field-expiration-date"
                className={`h-11 px-3.5 bg-stone-50/60 rounded-xl border transition-all flex items-center ${
                  cardStatus.expiryStatus === 2
                    ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20'
                    : cardStatus.expiryStatus === 0
                      ? 'border-stone-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100'
                      : 'border-emerald-500 bg-emerald-50/20'
                } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              />
            </div>

            <div>
              <label
                htmlFor="tappay-card-ccv"
                className="block text-xs font-semibold text-stone-700 mb-1.5"
              >
                背面末三碼 (CVV)
              </label>
              <div
                id="tappay-card-ccv"
                data-testid="hosted-field-ccv"
                className={`h-11 px-3.5 bg-stone-50/60 rounded-xl border transition-all flex items-center ${
                  cardStatus.ccvStatus === 2
                    ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20'
                    : cardStatus.ccvStatus === 0
                      ? 'border-stone-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100'
                      : 'border-emerald-500 bg-emerald-50/20'
                } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-stone-500">
            <svg
              className="w-3.5 h-3.5 text-teal-600 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              採用 256-bit SSL 加密傳輸與 3D Secure 2.0 驗證，卡號資料由 TapPay 安全處理零落地。
            </span>
          </div>

          {/* 測試沙盒模式快捷卡號提示 */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-950 space-y-2">
            <div className="font-bold flex items-center justify-between">
              <span>🧪 測試沙盒專用卡號（直接輸入 16 位數字，無需空格）：</span>
              <span className="text-[10px] text-teal-700">到期日: 12/30 | CVV: 123</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText('4000221111111111')}
                className="px-2.5 py-1 rounded bg-white border border-teal-300 hover:bg-teal-100 font-mono text-[11px] transition-colors"
                title="點擊複製 16 位無空格卡號"
              >
                📋 一般測試: 4000221111111111
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText('4000221111111112')}
                className="px-2.5 py-1 rounded bg-white border border-teal-300 hover:bg-teal-100 font-mono text-[11px] transition-colors"
                title="點擊複製 3DS 測試卡號"
              >
                📋 3DS 驗證: 4000221111111112
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

PaymentForm.displayName = 'PaymentForm';
export default PaymentForm;
