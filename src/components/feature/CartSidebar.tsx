import { useState } from 'react';
import { useCart } from '../../contexts/CartContext';
import { formatTwd, getCartLineKey } from '../../domain/algorithms';
import { 
  defaultInvoicePreference, 
  type InvoicePreference, 
  validateInvoicePreference 
} from '../../domain/invoice';
import { createShopifyCheckout } from '../../lib/shopifyCheckout';
import { captureExceptionSafe } from '../../lib/sentry';

const FREE_SHIPPING_THRESHOLD = 1500;

export default function CartSidebar() {
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoicePreference, setInvoicePreference] = useState<InvoicePreference>(defaultInvoicePreference);

  const { 
    items, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getTotalPrice, 
    isCartOpen, 
    setIsCartOpen 
  } = useCart();

  const totalPrice = getTotalPrice();
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totalPrice);
  const freeShippingProgress = Math.min(100, Math.round((totalPrice / FREE_SHIPPING_THRESHOLD) * 100));

  const handleCheckout = async () => {
    setCheckoutMessage('');
    if (items.length === 0) {
      setCheckoutMessage('購物車是空的，尚無法進行結帳。');
      return;
    }

    const invoiceError = validateInvoicePreference(invoicePreference);
    if (invoiceError) {
      setCheckoutMessage(invoiceError);
      return;
    }

    setIsSubmitting(true);
    try {
      const shopifyLines = items.map(item => {
        const id = item.variantId || item.id;
        const merchandiseId = id.includes('gid://') ? id : `gid://shopify/ProductVariant/${id}`;
        return { merchandiseId, quantity: item.quantity };
      });
      
      const checkoutUrl = await createShopifyCheckout(shopifyLines, invoicePreference);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      const msg = err?.message || '建立結帳失敗，請稍後再試。';
      setCheckoutMessage(msg);
      captureExceptionSafe(err, { source: 'CartSidebarCheckout' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProductClick = (item: any) => {
    const productId = String(item.id);
    const numericId = productId.includes('gid://shopify/Product/')
      ? productId.split('/').pop()
      : productId;
    window.location.href = `/product/${numericId}`;
  };

  if (!isCartOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      
      {/* Cart Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            購物車 <span className="text-teal-600 font-semibold text-base">({items.length} 件商品)</span>
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-900"
            aria-label="關閉購物車"
          >
            <span className="text-2xl leading-none" aria-hidden="true">×</span>
          </button>
        </div>

        {/* 免運門檻提示條 */}
        {items.length > 0 && (
          <div className="bg-teal-50/70 border-b border-teal-100 px-6 py-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-teal-900">
                {amountToFreeShipping === 0 ? (
                  <span className="text-teal-700 font-bold">🎉 已達成免運門檻（滿 NT$ 1,500）</span>
                ) : (
                  <span>再消費 <strong className="text-teal-700 font-bold">{formatTwd(amountToFreeShipping)}</strong> 即可享<strong>免運優惠</strong></span>
                )}
              </span>
              <span className="font-semibold text-teal-700">{freeShippingProgress}%</span>
            </div>
            <div className="w-full bg-teal-200/50 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-teal-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-base text-gray-700 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                購物車是空的
              </p>
              <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                快去挑選喜歡的商品吧！
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const lineKey = getCartLineKey(item);
                return (
                  <div 
                    key={lineKey} 
                    className="flex items-start gap-3 p-3.5 bg-gray-50/80 hover:bg-gray-50 border border-gray-100 rounded-xl transition-all"
                  >
                    {/* Product Image */}
                    <div 
                      className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border border-gray-200/60"
                      onClick={() => handleProductClick(item)}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="text-xs font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-teal-600 transition-colors leading-snug mb-1"
                        style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                        onClick={() => handleProductClick(item)}
                      >
                        {item.name}
                      </h3>
                      
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-sm font-bold text-teal-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {formatTwd(item.price)}
                        </span>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <span className="text-[11px] text-gray-400 line-through" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                            {formatTwd(item.originalPrice)}
                          </span>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-2xs">
                          <button
                            onClick={() => updateQuantity(lineKey, item.quantity - 1)}
                            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                            aria-label="減少數量"
                          >
                            <span className="text-sm leading-none font-medium" aria-hidden="true">−</span>
                          </button>
                          <span className="text-xs font-bold text-gray-900 min-w-[20px] text-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(lineKey, item.quantity + 1)}
                            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                            aria-label="增加數量"
                          >
                            <span className="text-sm leading-none font-medium" aria-hidden="true">＋</span>
                          </button>
                        </div>
                        
                        <button
                          onClick={() => removeFromCart(lineKey)}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 transition-colors cursor-pointer"
                          aria-label="移除商品"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-white space-y-3 shrink-0">
            {/* Total */}
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm text-gray-600 font-bold" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  總金額
                </span>
              </div>
              <span className="text-xl font-bold text-teal-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {formatTwd(totalPrice)}
              </span>
            </div>

            {/* Invoice Form */}
            <div className="space-y-4 pt-4 pb-2 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>電子發票</h3>
              
              <div className="space-y-3">
                <div>
                  <label htmlFor="drawer-invoice-kind" className="block text-xs font-semibold text-gray-700 mb-1">發票類型</label>
                  <select
                    id="drawer-invoice-kind"
                    value={invoicePreference.kind}
                    onChange={(e) =>
                      setInvoicePreference(
                        e.target.value === 'company'
                          ? {
                              kind: 'company',
                              notificationEmail: invoicePreference.notificationEmail,
                              buyerName: '',
                              taxId: '',
                            }
                          : {
                              ...defaultInvoicePreference,
                              notificationEmail: invoicePreference.notificationEmail,
                            }
                      )
                    }
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:border-teal-500 transition-colors"
                  >
                    <option value="personal">個人電子發票</option>
                    <option value="company">公司統編發票 (三聯)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="drawer-invoice-email" className="block text-xs font-semibold text-gray-700 mb-1">通知 Email (選填)</label>
                  <input
                    id="drawer-invoice-email"
                    type="email"
                    autoComplete="email"
                    value={invoicePreference.notificationEmail}
                    onChange={(e) =>
                      setInvoicePreference({
                        ...invoicePreference,
                        notificationEmail: e.target.value,
                      })
                    }
                    placeholder="name@example.com"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>

                {invoicePreference.kind === 'personal' ? (
                  <>
                    <div>
                      <label htmlFor="drawer-invoice-carrier" className="block text-xs font-semibold text-gray-700 mb-1">載具 / 捐贈</label>
                      <select
                        id="drawer-invoice-carrier"
                        value={invoicePreference.carrier}
                        onChange={(e) =>
                          setInvoicePreference({
                            ...invoicePreference,
                            carrier: e.target.value as 'none' | 'mobile' | 'amego-email' | 'donation',
                            carrierId: '',
                          })
                        }
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:border-teal-500 transition-colors"
                      >
                        <option value="none">一般電子發票 (系統自動對獎)</option>
                        <option value="mobile">手機條碼載具</option>
                        <option value="amego-email">光貿 Email 載具</option>
                        <option value="donation">社福團體捐贈碼</option>
                      </select>
                    </div>
                    {invoicePreference.carrier !== 'none' && (
                      <div>
                        <label htmlFor="drawer-invoice-carrier-id" className="block text-xs font-semibold text-gray-700 mb-1">
                          {invoicePreference.carrier === 'mobile' ? '手機條碼' : invoicePreference.carrier === 'donation' ? '捐贈碼' : '載具 Email'}
                        </label>
                        <input
                          id="drawer-invoice-carrier-id"
                          type="text"
                          required
                          value={invoicePreference.carrierId}
                          onChange={(e) =>
                            setInvoicePreference({
                              ...invoicePreference,
                              carrierId: e.target.value,
                            })
                          }
                          placeholder={
                            invoicePreference.carrier === 'mobile'
                              ? '/1234567 (手機條碼)'
                              : invoicePreference.carrier === 'donation'
                                ? '捐贈碼'
                                : '載具接收 Email'
                          }
                          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-teal-500 font-mono transition-colors"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="drawer-invoice-tax-id" className="block text-xs font-semibold text-gray-700 mb-1">統一編號</label>
                      <input
                        id="drawer-invoice-tax-id"
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        required
                        value={invoicePreference.taxId}
                        onChange={(e) =>
                          setInvoicePreference({
                            ...invoicePreference,
                            taxId: e.target.value,
                          })
                        }
                        placeholder="8 碼數字"
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-teal-500 font-mono transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="drawer-invoice-buyer-name" className="block text-xs font-semibold text-gray-700 mb-1">公司抬頭</label>
                      <input
                        id="drawer-invoice-buyer-name"
                        type="text"
                        maxLength={60}
                        required
                        value={invoicePreference.buyerName}
                        onChange={(e) =>
                          setInvoicePreference({
                            ...invoicePreference,
                            buyerName: e.target.value,
                          })
                        }
                        placeholder="完整公司名稱"
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">
                發票資料只送往光貿並暫存於受限後端；不會放入公開原始碼或瀏覽器可寫的資料表。
              </p>
            </div>

            {/* Action Buttons */}
            {checkoutMessage && (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status" data-testid="checkout-message">
                {checkoutMessage}
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              data-testid="checkout-button"
              className="w-full bg-teal-700 text-white py-3 rounded font-semibold hover:bg-teal-800 active:bg-teal-900 transition-all cursor-pointer shadow-md shadow-teal-700/20 text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
              style={{ fontFamily: "Noto Sans TC, sans-serif" }}
            >
              {isSubmitting ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   <span>處理中...</span>
                 </>
              ) : (
                 <span>前往 TapPay 安全結帳</span>
              )}
            </button>
            
            <p className="text-[10px] text-gray-500 text-center mt-2">
              將前往 Shopify Checkout, 付款方式與最終金額以結帳頁顯示為準。
            </p>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={clearCart}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer py-1 border border-gray-200 rounded px-3"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                清空購物車
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
