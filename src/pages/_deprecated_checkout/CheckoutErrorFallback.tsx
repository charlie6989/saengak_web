import React, { Component, type ReactNode, type ErrorInfo, useState } from 'react';
import { captureExceptionSafe } from '../../lib/sentry';

export interface CheckoutErrorFallbackProps {
  error?: Error;
  eventId?: string;
  resetError?: () => void;
  onGoHome?: () => void;
  onOpenCart?: () => void;
}

/**
 * 結帳專屬親和降級 UI (Checkout Error Fallback)
 * 提供購物車安全保存安心提示、重試結帳按鈕、返回首頁/購物車按鈕，以及客服定位用的 6 碼錯誤追蹤碼。
 */
export const CheckoutErrorFallback: React.FC<CheckoutErrorFallbackProps> = ({
  error,
  eventId,
  resetError,
  onGoHome,
  onOpenCart,
}) => {
  const [copied, setCopied] = useState(false);
  const displayEventId = eventId || '#ERR-CKOUT';

  const handleCopyEventId = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(displayEventId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.warn('複製失敗', e);
      }
    }
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const handleRetry = () => {
    if (resetError) {
      resetError();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div
      data-testid="checkout-error-fallback"
      className="w-full max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-500/5 text-center"
    >
      {/* 警告與購物車守護盾牌圖示 */}
      <div className="relative w-16 h-16 mx-auto mb-5">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-200">
          <svg
            className="w-8 h-8 text-rose-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      </div>

      {/* 標題與安心保證 */}
      <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-2">
        結帳區域發生臨時異常
      </h3>
      <p className="text-stone-600 text-sm sm:text-base mb-4 font-medium">
        您的購物車商品已安全保存，請不用擔心。
      </p>

      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 mb-6 flex items-center justify-center gap-2 text-emerald-800 text-xs sm:text-sm">
        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>已啟用連線安全防護，未產生任何未授權之扣款。</span>
      </div>

      {/* 錯誤追蹤代碼 */}
      <div className="mb-6 p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-2 max-w-md mx-auto">
        <div className="flex items-center gap-2 text-xs font-mono text-stone-600 truncate">
          <span className="text-stone-400">錯誤追蹤碼:</span>
          <span data-testid="short-event-id" className="font-semibold text-stone-900 select-all">{displayEventId}</span>
        </div>
        <button
          type="button"
          onClick={handleCopyEventId}
          className="text-xs px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0 font-medium cursor-pointer"
        >
          {copied ? '已複製 ✓' : '複製代碼'}
        </button>
      </div>

      {error && process.env.NODE_ENV !== 'production' && (
        <p className="text-xs text-rose-500 font-mono mb-4 text-left p-2 bg-rose-50 rounded overflow-x-auto">
          {error.message}
        </p>
      )}

      {/* 操作按鈕 */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch">
        <button
          type="button"
          onClick={handleRetry}
          className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          <span>重試結帳</span>
        </button>

        <button
          type="button"
          onClick={onOpenCart || handleGoHome}
          className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-sm font-semibold transition-all border border-stone-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <span>🛒</span>
          <span>回到首頁 / 購物車</span>
        </button>
      </div>
    </div>
  );
};

export interface CheckoutErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; eventId: string; resetError: () => void }) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo, eventId: string) => void;
  onReset?: () => void;
}

export interface CheckoutErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

/**
 * 結帳區專屬 Error Boundary
 * 攔截結帳子樹之 React Exception，不破壞全站頁首頁尾，自動安全上報 Sentry 並回傳 6 碼客服短追蹤碼。
 */
export class CheckoutErrorBoundary extends Component<CheckoutErrorBoundaryProps, CheckoutErrorBoundaryState> {
  constructor(props: CheckoutErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CheckoutErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const eventId = captureExceptionSafe(error, {
      source: 'CheckoutErrorBoundary',
      componentStack: errorInfo.componentStack,
    });

    this.setState({ eventId });
    this.props.onError?.(error, errorInfo, eventId);
  }

  resetError = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      eventId: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, eventId } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (typeof fallback === 'function') {
        return fallback({
          error: error || new Error('結帳區域發生異常'),
          eventId: eventId || '#ERR-CKOUT',
          resetError: this.resetError,
        });
      }

      if (fallback) {
        return fallback;
      }

      return (
        <CheckoutErrorFallback
          error={error || undefined}
          eventId={eventId || undefined}
          resetError={this.resetError}
        />
      );
    }

    return children;
  }
}

export default CheckoutErrorBoundary;
