import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { captureExceptionSafe } from '../../lib/sentry';

interface ConfirmResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  message?: string;
  shortEventId?: string;
}

/**
 * 3D Secure 驗證回呼承接頁 (ThreeDSCallback)
 * 當顧客完成銀行 3DS 驗證後，銀行 redirect 至 /checkout/3ds-callback
 * 本頁接取 rec_trade_id 呼叫後端 api/checkout/confirm 進行最終對帳與扣款確認
 */
export function ThreeDSCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();

  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<ConfirmResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    const confirmPayment = async () => {
      // 取得回呼參數
      const recTradeId = searchParams.get('rec_trade_id') || searchParams.get('recTradeId') || '';
      const orderId = searchParams.get('order_id') || searchParams.get('orderId') || '';
      const bankResultCode = searchParams.get('bank_result_code') || '';

      if (!recTradeId) {
        if (isMounted) {
          setIsLoading(false);
          setResult({
            success: false,
            message: '缺少必要之交易驗證識別碼 (rec_trade_id)，無法確認 3DS 付款結果。',
          });
        }
        return;
      }

      try {
        const response = await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rec_trade_id: recTradeId,
            order_id: orderId || undefined,
            bank_result_code: bankResultCode || undefined,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!isMounted) return;

        if (response.ok && (data.status === 0 || data.success === true)) {
          // 扣款成功，清空購物車
          clearCart();
          const targetOrderId = data.order_id || data.orderNumber || orderId || 'confirmed';

          setResult({
            success: true,
            orderId: targetOrderId,
            orderNumber: data.orderNumber || targetOrderId,
          });

          // 2 秒後自動導向訂單狀態頁
          setTimeout(() => {
            if (isMounted) {
              navigate(`/order-status?order_id=${encodeURIComponent(targetOrderId)}`, {
                replace: true,
              });
            }
          }, 2000);
        } else {
          const failMsg =
            data.message || data.msg || '3D Secure 驗證未通過或發卡銀行拒絕授權扣款。';
          const shortEventId = captureExceptionSafe(new Error(failMsg), {
            source: 'ThreeDSCallback',
            recTradeId,
            responseData: data,
          });

          setResult({
            success: false,
            message: failMsg,
            shortEventId,
          });
        }
      } catch (err: any) {
        if (!isMounted) return;
        const errMsg = err?.message || '連線確認超時，請檢查網路狀態或洽詢客服。';
        const shortEventId = captureExceptionSafe(err, {
          source: 'ThreeDSCallback_NetworkError',
          recTradeId,
        });

        setResult({
          success: false,
          message: errMsg,
          shortEventId,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    confirmPayment();

    return () => {
      isMounted = false;
    };
  }, [searchParams, clearCart, navigate]);

  return (
    <div
      data-testid="3ds-callback-container"
      className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-stone-50"
    >
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200 shadow-xl shadow-stone-200/50 text-center space-y-6">
        {isLoading ? (
          <div className="space-y-4 py-8">
            <div className="w-16 h-16 mx-auto relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-teal-100 border-t-teal-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-teal-600 font-bold text-xs">
                3DS
              </div>
            </div>
            <h3 className="text-xl font-bold text-stone-900">正在確認 3D Secure 交易結果</h3>
            <p className="text-sm text-stone-500 leading-relaxed">
              系統正在安全連線向發卡銀行確認授權狀態，請勿關閉視窗或重新整理頁面…
            </p>
          </div>
        ) : result?.success ? (
          <div className="space-y-4 py-4" data-testid="3ds-success-block">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900">信用卡 3DS 驗證付款成功！</h3>
            <p className="text-sm text-stone-600">
              訂單已成立，訂單編號：<span className="font-mono font-bold text-teal-700">{result.orderNumber}</span>
            </p>
            <p className="text-xs text-stone-400">正在為您跳轉至訂單明細頁面…</p>
            <div className="pt-2">
              <Link
                to={`/order-status?order_id=${encodeURIComponent(result.orderId || '')}`}
                className="inline-block px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                前往查看訂單
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4" data-testid="3ds-failure-block">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900">付款未完成</h3>
            <p className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {result?.message}
            </p>
            {result?.shortEventId && (
              <p className="text-xs font-mono text-stone-400">
                錯誤追蹤碼: {result.shortEventId}
              </p>
            )}
            <div className="pt-2 space-y-2">
              <Link
                to="/checkout"
                className="block w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                返回結帳頁重新嘗試
              </Link>
              <Link
                to="/"
                className="block w-full py-2.5 text-stone-500 hover:text-stone-800 text-xs font-medium"
              >
                回到首頁
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ThreeDSCallback;
