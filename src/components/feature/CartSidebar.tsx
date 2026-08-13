import { useState } from 'react';
import { useCart } from '../../contexts/CartContext';
import { buildShopifyCheckoutLines, formatTwd, getCartLineKey } from '../../domain/algorithms';
import {
  defaultInvoicePreference,
  type InvoicePreference,
  validateInvoicePreference,
} from '../../domain/invoice';
import { createShopifyCheckout, isShopifyCheckoutConfigured } from '../../lib/shopifyCheckout';

export default function CartSidebar() {
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
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

  const handleCheckout = async () => {
    setCheckoutMessage('');

    const checkoutLines = buildShopifyCheckoutLines(items);
    if (!checkoutLines.ready) {
      if (checkoutLines.reason === 'missing_variant') {
        setCheckoutMessage(
          `購物車有 ${checkoutLines.missingItemIds.length} 項展示商品缺少 Shopify 規格 ID，尚不能送往結帳。`,
        );
      } else {
        setCheckoutMessage('購物車是空的，尚無法建立結帳。');
      }
      return;
    }

    if (!isShopifyCheckoutConfigured) {
      setCheckoutMessage('TapPay／Shopify 測試結帳尚未完成後端設定，目前不會送出付款。');
      return;
    }

    const invoiceError = validateInvoicePreference(invoicePreference);
    if (invoiceError) {
      setCheckoutMessage(invoiceError);
      return;
    }

    setIsCheckingOut(true);
    try {
      const checkoutUrl = await createShopifyCheckout(checkoutLines.lines, invoicePreference);
      window.location.assign(checkoutUrl);
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : '建立結帳時發生未知錯誤。');
    } finally {
      setIsCheckingOut(false);
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
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            購物車 <span className="text-teal-600">({items.length})</span>
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="關閉購物車"
          >
            <span className="text-2xl leading-none text-gray-700" aria-hidden="true">×</span>
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <i className="ri-shopping-cart-line text-5xl text-gray-400"></i>
              </div>
              <p className="text-lg text-gray-600 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                購物車是空的
              </p>
              <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                快去挑選喜歡的商品吧！
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const lineKey = getCartLineKey(item);
                return (
                <div key={lineKey} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  {/* Product Image */}
                  <div 
                    className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 cursor-pointer shadow-sm"
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
                      className="text-sm font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-teal-600 transition-colors mb-2"
                      style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                      onClick={() => handleProductClick(item)}
                    >
                      {item.name}
                    </h3>
                    
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-base font-bold text-teal-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                        {formatTwd(item.price)}
                      </span>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <span className="text-xs text-gray-400 line-through" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {formatTwd(item.originalPrice)}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm">
                        <button
                          onClick={() => updateQuantity(lineKey, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                          aria-label="減少數量"
                        >
                          <span className="text-lg leading-none" aria-hidden="true">−</span>
                        </button>
                        <span className="text-sm font-semibold text-gray-900 min-w-[24px] text-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(lineKey, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                          aria-label="增加數量"
                        >
                          <span className="text-lg leading-none" aria-hidden="true">＋</span>
                        </button>
                      </div>
                      
                      <button
                        onClick={() => removeFromCart(lineKey)}
                        className="h-9 px-2 flex items-center justify-center text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        aria-label="移除商品"
                      >
                        移除
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
          <div className="border-t border-gray-200 px-6 py-5 bg-gray-50 space-y-4">
            {/* Total */}
            <div className="flex items-center justify-between py-3 px-4 bg-white rounded-xl shadow-sm">
              <span className="text-base font-semibold text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                總金額
              </span>
              <span className="text-2xl font-bold text-teal-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {formatTwd(getTotalPrice())}
              </span>
            </div>

            <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
              <div>
                <label htmlFor="invoice-kind" className="text-sm font-semibold text-gray-800">電子發票</label>
                <select
                  id="invoice-kind"
                  value={invoicePreference.kind}
                  onChange={(event) => setInvoicePreference(event.target.value === 'company'
                    ? { kind: 'company', notificationEmail: invoicePreference.notificationEmail, buyerName: '', taxId: '' }
                    : { ...defaultInvoicePreference, notificationEmail: invoicePreference.notificationEmail })}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="personal">個人電子發票</option>
                  <option value="company">公司統編發票</option>
                </select>
              </div>

              <div>
                <label htmlFor="invoice-email" className="text-xs font-medium text-gray-700">通知 Email（選填）</label>
                <input
                  id="invoice-email"
                  type="email"
                  autoComplete="email"
                  value={invoicePreference.notificationEmail}
                  onChange={(event) => setInvoicePreference({ ...invoicePreference, notificationEmail: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="name@example.com"
                />
              </div>

              {invoicePreference.kind === 'personal' ? (
                <>
                  <div>
                    <label htmlFor="invoice-carrier" className="text-xs font-medium text-gray-700">載具／捐贈</label>
                    <select
                      id="invoice-carrier"
                      value={invoicePreference.carrier}
                      onChange={(event) => setInvoicePreference({
                        ...invoicePreference,
                        carrier: event.target.value as 'none' | 'mobile' | 'amego-email' | 'donation',
                        carrierId: '',
                      })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="none">一般電子發票</option>
                      <option value="mobile">手機條碼載具</option>
                      <option value="amego-email">光貿 Email 載具</option>
                      <option value="donation">捐贈碼</option>
                    </select>
                  </div>
                  {invoicePreference.carrier !== 'none' && (
                    <div>
                      <label htmlFor="invoice-carrier-id" className="text-xs font-medium text-gray-700">
                        {invoicePreference.carrier === 'mobile' ? '手機條碼' : invoicePreference.carrier === 'donation' ? '捐贈碼' : '載具 Email'}
                      </label>
                      <input
                        id="invoice-carrier-id"
                        value={invoicePreference.carrierId}
                        onChange={(event) => setInvoicePreference({ ...invoicePreference, carrierId: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="invoice-tax-id" className="text-xs font-medium text-gray-700">統一編號</label>
                    <input
                      id="invoice-tax-id"
                      inputMode="numeric"
                      maxLength={8}
                      value={invoicePreference.taxId}
                      onChange={(event) => setInvoicePreference({ ...invoicePreference, taxId: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="invoice-buyer-name" className="text-xs font-medium text-gray-700">公司抬頭</label>
                    <input
                      id="invoice-buyer-name"
                      maxLength={60}
                      value={invoicePreference.buyerName}
                      onChange={(event) => setInvoicePreference({ ...invoicePreference, buyerName: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
              <p className="text-xs leading-5 text-gray-500">
                發票資料只送往光貿並暫存於受限後端；不會放入公開原始碼或瀏覽器可寫的資料表。
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {checkoutMessage && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status" data-testid="checkout-message">
                  {checkoutMessage}
                </p>
              )}
              <button
                onClick={handleCheckout}
                data-testid="checkout-button"
                disabled={isCheckingOut}
                aria-busy={isCheckingOut}
                className="w-full bg-teal-600 text-white py-4 rounded-xl font-semibold hover:bg-teal-700 active:bg-teal-800 transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-teal-600/30 disabled:cursor-wait disabled:opacity-60"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                {isCheckingOut ? '正在建立安全結帳…' : '前往 TapPay 安全結帳'}
              </button>
              <p className="px-2 text-center text-xs leading-5 text-gray-500">
                將前往 Shopify Checkout，付款方式與最終金額以結帳頁顯示為準。
              </p>
              <button
                onClick={clearCart}
                className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
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
