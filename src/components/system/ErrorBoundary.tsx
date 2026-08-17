import { Component, type ReactNode, type ErrorInfo } from 'react';
import { captureExceptionSafe } from '../../lib/sentry';

export interface ErrorBoundaryFallbackProps {
  error: Error;
  eventId: string;
  resetError: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo, eventId: string) => void;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

/**
 * 全域與區塊級 React Error Boundary 組件
 * 自動捕獲例外並經由 captureExceptionSafe 進行 Sentry 脫敏上報，提供友善降級介面與重試機制。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 經由 Sentry 安全通道捕獲例外與 Component Stack
    const eventId = captureExceptionSafe(error, {
      componentStack: errorInfo.componentStack,
    });

    this.setState({ eventId });
    this.props.onError?.(error, errorInfo, eventId);
  }

  /**
   * 清除錯誤狀態並重設 Boundary
   */
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
          error: error || new Error('未知錯誤'),
          eventId: eventId || '#UNKNOWN',
          resetError: this.resetError,
        });
      }

      if (fallback) {
        return fallback;
      }

      // 預設全域 Fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-stone-50">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm border border-stone-200 text-center">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-stone-900 mb-2">頁面載入發生異常</h2>
            <p className="text-stone-600 text-sm mb-6 leading-relaxed">
              很抱歉，系統遇到非預期的狀況。我們已將錯誤紀錄傳送給工程團隊進行分析。
            </p>

            {eventId && (
              <div className="mb-6 p-3 bg-stone-100 rounded-lg text-xs font-mono text-stone-600 flex items-center justify-center gap-2 border border-stone-200">
                <span>錯誤追蹤碼:</span>
                <span className="font-semibold text-stone-800 select-all">{eventId}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.resetError}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                🔄 重新嘗試
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/';
                  }
                }}
                className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                🏠 回到首頁
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
