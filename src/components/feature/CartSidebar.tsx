import { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatTwd, getCartLineKey } from '../../domain/algorithms';
import { 
  defaultInvoicePreference, 
  type InvoicePreference, 
  validateInvoicePreference 
} from '../../domain/invoice';
import { createShopifyCheckout } from '../../lib/shopifyCheckout';
import { captureExceptionSafe } from '../../lib/sentry';
import {
  fetchUserCoupons,
  calculateDiscountAmount,
  fetchShippingSettings,
  computePostDiscountShippingWarning,
} from '../../lib/promotions';
import type { UserCoupon } from '../../types/promotions';
import AuthModal from './AuthModal';

export default function CartSidebar() {
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [invoicePreference, setInvoicePreference] = useState<InvoicePreference>(defaultInvoicePreference);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [isCouponSectionOpen, setIsCouponSectionOpen] = useState(false);
  const [selectedCouponCode, setSelectedCouponCode] = useState<string>('');
  const [manualCouponInput, setManualCouponInput] = useState<string>('');
  const [shippingSettings, setShippingSettings] = useState({ freeShippingThreshold: 1500, defaultShippingFee: 80 });
  const { user, isLoading: isAuthLoading } = useAuth();

  const { 
    items, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getTotalPrice, 
    isCartOpen, 
    setIsCartOpen,
    validateAndPruneCart,
    prunedNotice,
    setPrunedNotice
  } = useCart();

  // 當購物車開啟時，自動審查商品庫存是否依然有效
  useEffect(() => {
    if (isCartOpen && items.length > 0) {
      void validateAndPruneCart();
    }
  }, [isCartOpen, validateAndPruneCart]);

  // 當購物車開啟時，自動載入會員專屬優惠券
  useEffect(() => {
    if (isCartOpen && user?.id) {
      void fetchUserCoupons(user.id).then((coupons) => {
        setUserCoupons(coupons.filter((c) => c.status === 'available'));
      });
    }
  }, [isCartOpen, user?.id]);

  // 當購物車開啟時，自動同步後台免運門檻設定，避免與 site_settings 脫鉤
  useEffect(() => {
    if (isCartOpen) {
      void fetchShippingSettings().then(setShippingSettings);
    }
  }, [isCartOpen]);

  const totalPrice = getTotalPrice();
  const amountToFreeShipping = Math.max(0, shippingSettings.freeShippingThreshold - totalPrice);
  const freeShippingProgress = Math.min(100, Math.round((totalPrice / shippingSettings.freeShippingThreshold) * 100));

  const activeCoupon = userCoupons.find((c) => c.coupon_code === selectedCouponCode);
  const discountCalculation = activeCoupon?.promotion
    ? calculateDiscountAmount(activeCoupon.promotion, totalPrice)
    : { amount: 0, isEligible: true, shortfall: 0 };

  const shippingWarning = computePostDiscountShippingWarning(
    totalPrice,
    discountCalculation.amount,
    shippingSettings.freeShippingThreshold,
  );

  const submitCheckout = async () => {
    setIsSubmitting(true);
    try {
      const shopifyLines = items.map(item => {
        const id = item.variantId || item.id;
        const merchandiseId = id.includes('gid://') ? id : `gid://shopify/ProductVariant/${id}`;
        return { merchandiseId, quantity: item.quantity };
      });
      
      const discountCodes = selectedCouponCode.trim() ? [selectedCouponCode.trim()] : undefined;
      const result = await createShopifyCheckout(shopifyLines, invoicePreference, discountCodes);
      if (result.invalidDiscountCodes.length > 0) {
        setSelectedCouponCode('');
        setCheckoutMessage(
          `折扣碼 ${result.invalidDiscountCodes.join('、')} 目前無法套用（可能未達門檻、已達使用上限或已失效），已為您移除，請確認金額後再次點擊結帳。`
        );
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      const msg = err?.message || '建立結帳失敗，請稍後再試。';
      setCheckoutMessage(msg);
      if (/登入|會員登入狀態/.test(msg)) {
        setIsAuthModalOpen(true);
      } else {
        captureExceptionSafe(err, { source: 'CartSidebarCheckout' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

    if (isAuthLoading) {
      setCheckoutMessage('正在確認會員登入狀態，請稍候。');
      return;
    }

    if (!user) {
      setCheckoutMessage('結帳前請先登入或註冊會員；購物車內容會保留。');
      setIsAuthModalOpen(true);
      return;
    }

    await submitCheckout();
  };

  const handleAuthenticated = () => {
    setIsAuthModalOpen(false);
    setCheckoutMessage('登入成功，正在建立會員專屬結帳。');
    void submitCheckout();
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
                  <span className="text-teal-700 font-bold">🎉 已達成免運門檻（滿 {formatTwd(shippingSettings.freeShippingThreshold)}）</span>
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

        {/* 缺貨自動移除提醒橫幅 */}
        {prunedNotice && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3.5 flex items-start gap-3 animate-fade-in" role="alert" data-testid="cart-pruned-notice">
            <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 text-amber-800 text-xs font-bold mt-0.5">
              !
            </div>
            <div className="flex-1 text-xs text-amber-900 leading-relaxed font-medium">
              {prunedNotice}
            </div>
            <button
              type="button"
              onClick={() => setPrunedNotice(null)}
              className="text-amber-600 hover:text-amber-900 text-sm leading-none p-1 cursor-pointer"
              aria-label="關閉提醒"
            >
              ×
            </button>
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

                      {item.variantTitle && item.variantTitle !== 'Default Title' && (
                        <div className="inline-block bg-teal-50 text-teal-800 border border-teal-100 text-[10px] px-1.5 py-0.5 rounded font-medium mb-1.5">
                          {item.variantTitle}
                        </div>
                      )}
                      
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
            <div className="py-2 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>商品小計</span>
                <span>{formatTwd(totalPrice)}</span>
              </div>
              {selectedCouponCode && discountCalculation.amount > 0 && (
                <div className="flex items-center justify-between text-xs text-teal-700 font-semibold">
                  <span>優惠折抵 ({selectedCouponCode})</span>
                  <span>-{formatTwd(discountCalculation.amount)}</span>
                </div>
              )}
              {selectedCouponCode && discountCalculation.amount > 0 && shippingWarning.willLoseFreeShipping && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
                  <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                  <span>套用此折扣後金額將低於免運門檻，還差 {formatTwd(shippingWarning.amountStillNeeded)} 才能維持免運，實際運費以 Shopify 結帳頁計算結果為準。</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <div>
                  <span className="text-sm text-gray-900 font-bold" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    總結帳金額
                  </span>
                  {selectedCouponCode && (
                    <p className="text-[10px] text-gray-400">實際金額於 Shopify Checkout 結算</p>
                  )}
                </div>
                <span className="text-xl font-bold text-teal-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  {formatTwd(Math.max(0, totalPrice - discountCalculation.amount))}
                </span>
              </div>
            </div>

            {/* 優惠券折抵區塊 */}
            <div className="border-t border-gray-100 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setIsCouponSectionOpen(!isCouponSectionOpen)}
                className="w-full flex items-center justify-between text-xs font-bold text-gray-800 hover:text-teal-700 py-1 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <i className="ri-ticket-2-line text-teal-600 text-sm"></i>
                  <span>選擇優惠券 / 輸入折扣碼</span>
                  {selectedCouponCode && (
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono font-bold text-[11px]">
                      {selectedCouponCode}
                    </span>
                  )}
                </span>
                <i className={`ri-arrow-down-s-line text-base transition-transform ${isCouponSectionOpen ? 'rotate-180 text-teal-600' : 'text-gray-400'}`}></i>
              </button>

              {isCouponSectionOpen && (
                <div className="mt-3 space-y-3 p-3 bg-gray-50/80 rounded-xl border border-gray-200/70 text-xs">
                  {/* 手動輸入優惠碼 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="輸入折扣代碼"
                      value={manualCouponInput}
                      onChange={(e) => setManualCouponInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-mono uppercase bg-white focus:outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!manualCouponInput.trim()) return;
                        setSelectedCouponCode(manualCouponInput.trim());
                        setManualCouponInput('');
                      }}
                      className="px-3 py-1.5 bg-teal-700 text-white rounded-lg font-semibold hover:bg-teal-800 cursor-pointer"
                    >
                      套用
                    </button>
                  </div>

                  {/* 已套用之折扣碼指示 */}
                  {selectedCouponCode && (
                    <div className="flex items-center justify-between bg-teal-50 p-2.5 rounded-lg border border-teal-200 text-teal-900">
                      <div className="flex items-center gap-2">
                        <i className="ri-checkbox-circle-fill text-teal-600"></i>
                        <span>已套用：<strong className="font-mono">{selectedCouponCode}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCouponCode('')}
                        className="text-gray-400 hover:text-red-500 font-bold px-1 cursor-pointer"
                        title="取消套用"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* 會員已歸戶優惠券列表 */}
                  {user ? (
                    userCoupons.length > 0 ? (
                      <div className="space-y-2 pt-1 border-t border-gray-200/60">
                        <p className="text-[11px] font-semibold text-gray-600">您的可用優惠券：</p>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                          {userCoupons.map((c) => {
                            const isSelected = selectedCouponCode === c.coupon_code;
                            const isEligible = !c.promotion || totalPrice >= c.promotion.min_spend;

                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  if (!isEligible) return;
                                  setSelectedCouponCode(isSelected ? '' : c.coupon_code);
                                }}
                                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-teal-50/70 border-teal-500 text-teal-950 font-medium'
                                    : isEligible
                                    ? 'bg-white border-gray-200 hover:border-teal-300 text-gray-800'
                                    : 'bg-gray-100 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold">{c.promotion?.title || c.coupon_code}</span>
                                    <span className="font-mono text-[10px] text-gray-500">({c.coupon_code})</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {c.promotion?.min_spend
                                      ? `滿 NT$ ${c.promotion.min_spend.toLocaleString()} 可用`
                                      : '無門檻'}
                                    {!isEligible && c.promotion && (
                                      <span className="text-red-500 ml-1 font-semibold">
                                        (差 NT$ {(c.promotion.min_spend - totalPrice).toLocaleString()})
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={!isEligible}
                                  className={`text-[11px] px-2 py-1 rounded font-semibold ${
                                    isSelected
                                      ? 'bg-teal-700 text-white'
                                      : isEligible
                                      ? 'bg-gray-100 text-gray-700 hover:bg-teal-100 hover:text-teal-900'
                                      : 'bg-gray-200 text-gray-400'
                                  }`}
                                >
                                  {isSelected ? '已選用' : '選用'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-gray-200/60 text-center py-2">
                        <p className="text-gray-500 text-[11px]">目前尚無可用的優惠券</p>
                        <a
                          href="/promotion"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 text-teal-700 font-bold hover:underline text-[11px]"
                        >
                          前往優惠專區領取 →
                        </a>
                      </div>
                    )
                  ) : (
                    <div className="pt-2 border-t border-gray-200/60 text-center py-2">
                      <p className="text-gray-500 text-[11px]">登入會員可自動載入已領取的專屬折價券</p>
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        className="inline-block mt-1 text-teal-700 font-bold hover:underline text-[11px] cursor-pointer"
                      >
                        立即登入 →
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              disabled={isSubmitting || isAuthLoading}
              data-testid="checkout-button"
              className="w-full bg-teal-700 text-white py-3 rounded font-semibold hover:bg-teal-800 active:bg-teal-900 transition-all cursor-pointer shadow-md shadow-teal-700/20 text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
              style={{ fontFamily: "Noto Sans TC, sans-serif" }}
            >
              {isSubmitting || isAuthLoading ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   <span>{isAuthLoading ? '確認會員狀態...' : '處理中...'}</span>
                 </>
              ) : (
                 <span>{user ? '前往 TapPay 安全結帳' : '登入會員後結帳'}</span>
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
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
        purpose="checkout"
      />
    </>
  );
}
