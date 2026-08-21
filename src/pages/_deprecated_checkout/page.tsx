import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { formatTwd } from '../../domain/algorithms';
import {
  defaultInvoicePreference,
  type InvoicePreference,
  validateInvoicePreference,
} from '../../domain/invoice';
import { PaymentForm, type PaymentFormHandle } from './PaymentForm';
import { IdentityFlow, type CheckoutIdentityMode } from './IdentityFlow';
import { CheckoutErrorBoundary } from './CheckoutErrorFallback';
import { captureExceptionSafe } from '../../lib/sentry';

// 產生 UUID v4 作為 Idempotency-Key
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function CheckoutMain() {
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCart();
  const paymentFormRef = useRef<PaymentFormHandle>(null);

  // 結帳身分
  const [identityMode, setIdentityMode] = useState<CheckoutIdentityMode>('guest');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // 物流方式與收件資訊
  const [deliveryMode, setDeliveryMode] = useState<'home' | 'convenience-store'>('home');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [orderNote, setOrderNote] = useState('');

  // 電子發票設定
  const [invoicePreference, setInvoicePreference] =
    useState<InvoicePreference>(defaultInvoicePreference);

  // 提交狀態與錯誤提示
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shortEventId, setShortEventId] = useState<string | null>(null);

  // 當 guestEmail/guestPhone 輸入時，若收件人為空可自動預填
  useEffect(() => {
    if (guestPhone && !recipientPhone) {
      setRecipientPhone(guestPhone);
    }
  }, [guestPhone, recipientPhone]);

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setShortEventId(null);

    // 1. 購物車檢查
    if (items.length === 0) {
      setSubmitError('購物車為空，無法進行結帳。');
      return;
    }

    // 檢查是否有遺失 Variant ID 的商品
    const missingVariantItems = items.filter((item) => !item.variantId);
    if (missingVariantItems.length > 0) {
      setSubmitError(
        `購物車中有 ${missingVariantItems.length} 項商品規格資料不完整，請重新選擇規格後再結帳。`,
      );
      return;
    }

    // 2. 身分與聯絡資料檢查
    if (identityMode === 'guest') {
      if (!guestEmail.trim() || !guestEmail.includes('@')) {
        setSubmitError('請填寫有效的聯絡 Email。');
        return;
      }
      if (!guestPhone.trim() || guestPhone.trim().length < 8) {
        setSubmitError('請填寫有效的聯絡手機。');
        return;
      }
    }

    // 3. 收件人資訊檢查
    if (!recipientName.trim()) {
      setSubmitError('請填寫收件人姓名。');
      return;
    }
    if (!recipientPhone.trim() || recipientPhone.trim().length < 8) {
      setSubmitError('請填寫有效的收件人電話。');
      return;
    }
    if (deliveryMode === 'home' && !shippingAddress.trim()) {
      setSubmitError('宅配請填寫完整配送地址。');
      return;
    }
    if (deliveryMode === 'convenience-store' && (!storeName.trim() || !storeCode.trim())) {
      setSubmitError('超商取貨請填寫門市名稱與門市店號。');
      return;
    }

    // 4. 發票偏好驗證
    const invoiceError = validateInvoicePreference(invoicePreference);
    if (invoiceError) {
      setSubmitError(invoiceError);
      return;
    }

    // 5. 取得 TapPay Prime (PCI-DSS SAQ A-EP，零卡號落地)
    let prime = '';
    try {
      if (!paymentFormRef.current) {
        throw new Error('付款表單尚未就緒');
      }
      prime = await paymentFormRef.current.getPrime();
    } catch (err: any) {
      const errMsg = err?.message || '信用卡授權失敗，請確認卡片各欄位填寫正確。';
      const eventId = captureExceptionSafe(err instanceof Error ? err : new Error(errMsg), {
        source: 'CheckoutGetPrime',
      });
      setSubmitError(errMsg);
      setShortEventId(eventId);
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = generateIdempotencyKey();

    try {
      // 鐵則：提交給後端僅包含 Variant ID 與數量，絕不包含前端金額 (Server-Side Price Authority)
      const payload = {
        items: items.map((item) => ({
          variantId: item.variantId!,
          quantity: item.quantity,
        })),
        identity: {
          mode: identityMode,
          email: identityMode === 'guest' ? guestEmail.trim() : undefined,
          phone: identityMode === 'guest' ? guestPhone.trim() : undefined,
        },
        shipping: {
          deliveryMode,
          recipient: {
            name: recipientName.trim(),
            phone: recipientPhone.trim(),
            address: deliveryMode === 'home' ? shippingAddress.trim() : undefined,
            storeName: deliveryMode === 'convenience-store' ? storeName.trim() : undefined,
            storeCode: deliveryMode === 'convenience-store' ? storeCode.trim() : undefined,
          },
          orderNote: orderNote.trim() || undefined,
        },
        invoice: invoicePreference,
        prime,
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && (result.status === 0 || result.success === true)) {
        // 若需要 3D Secure 驗證，跳轉至銀行 3DS 授權頁
        if (result.payment_url) {
          window.location.assign(result.payment_url);
          return;
        }

        // 直接扣款成功，清空購物車並導向訂單成功頁
        clearCart();
        const orderId = result.order_id || result.orderNumber || 'success';
        navigate(`/order-status?order_id=${encodeURIComponent(orderId)}`);
      } else {
        const errMsg =
          result.message ||
          result.msg ||
          '結帳授權未通過，請檢查信用卡額度或更換卡片再試。';
        const eventId = captureExceptionSafe(new Error(errMsg), {
          source: 'CheckoutSubmit',
          responseStatus: response.status,
          result,
        });
        setSubmitError(errMsg);
        setShortEventId(eventId);
      }
    } catch (err: any) {
      const eventId = captureExceptionSafe(err, {
        source: 'CheckoutNetworkException',
      });
      setSubmitError(err?.message || '網路連線異常，請稍候重試。');
      setShortEventId(eventId);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-stone-900">購物車是空的</h2>
        <p className="text-stone-500 text-sm">目前尚無待結帳之商品，歡迎前往選購 SAENGAK 嚴選系列。</p>
        <div>
          <Link
            to="/products"
            className="inline-block px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md"
          >
            探索熱銷商品
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12" data-testid="checkout-page">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2">安全結帳</h1>
        <p className="text-xs sm:text-sm text-stone-500">
          全程採用 256-bit SSL 加密，提供 TapPay Direct Pay PCI-DSS SAQ A-EP 安全授權。
        </p>
      </div>

      <form onSubmit={handleSubmitCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左側：身分、物流、發票、刷卡 */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. 身分流程 */}
          <IdentityFlow
            mode={identityMode}
            onModeChange={setIdentityMode}
            guestEmail={guestEmail}
            guestPhone={guestPhone}
            onGuestEmailChange={setGuestEmail}
            onGuestPhoneChange={setGuestPhone}
          />

          {/* 2. 收件與配送方式 */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-stone-900">2. 配送方式與收件資訊</h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full">
                ShipAny 履約門市
              </span>
            </div>

            {/* 配送模式切換 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="delivery-home-btn"
                onClick={() => setDeliveryMode('home')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  deliveryMode === 'home'
                    ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-stone-900 text-sm">宅配到府</span>
                  <input
                    type="radio"
                    name="delivery_mode"
                    checked={deliveryMode === 'home'}
                    onChange={() => setDeliveryMode('home')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                </div>
                <p className="text-xs text-stone-500">本島與離島低溫/常溫黑貓直送</p>
              </button>

              <button
                type="button"
                data-testid="delivery-store-btn"
                onClick={() => setDeliveryMode('convenience-store')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  deliveryMode === 'convenience-store'
                    ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-stone-900 text-sm">超商取貨</span>
                  <input
                    type="radio"
                    name="delivery_mode"
                    checked={deliveryMode === 'convenience-store'}
                    onChange={() => setDeliveryMode('convenience-store')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                </div>
                <p className="text-xs text-stone-500">7-ELEVEN / 全家便利商店</p>
              </button>
            </div>

            {/* 收件人欄位 */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recipient-name" className="block text-xs font-semibold text-stone-700 mb-1">
                    收件人姓名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="recipient-name"
                    data-testid="recipient-name-input"
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="請填寫完整真實姓名"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label htmlFor="recipient-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                    收件人手機 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="recipient-phone"
                    data-testid="recipient-phone-input"
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {deliveryMode === 'home' ? (
                <div>
                  <label htmlFor="shipping-address" className="block text-xs font-semibold text-stone-700 mb-1">
                    配送地址 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="shipping-address"
                    data-testid="shipping-address-input"
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="縣市、區域、路街名、樓層"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="store-name" className="block text-xs font-semibold text-stone-700 mb-1">
                      超商門市名稱 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="store-name"
                      data-testid="store-name-input"
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="例如 7-11 敦南門市"
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="store-code" className="block text-xs font-semibold text-stone-700 mb-1">
                      門市店號 (6 碼) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="store-code"
                      data-testid="store-code-input"
                      type="text"
                      required
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value)}
                      placeholder="例如 123456"
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="order-note" className="block text-xs font-semibold text-stone-700 mb-1">
                  訂單備註（選填）
                </label>
                <input
                  id="order-note"
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="如配送時間偏好或特殊需求"
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* 3. 電子發票偏好 */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-stone-900">3. 電子發票</h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full">
                光貿電子發票
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="checkout-invoice-kind" className="block text-xs font-semibold text-stone-700 mb-1">
                  發票類型
                </label>
                <select
                  id="checkout-invoice-kind"
                  data-testid="invoice-kind-select"
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
                          },
                    )
                  }
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="personal">個人電子發票</option>
                  <option value="company">公司統編發票 (三聯式)</option>
                </select>
              </div>

              {invoicePreference.kind === 'personal' ? (
                <>
                  <div>
                    <label htmlFor="checkout-invoice-carrier" className="block text-xs font-semibold text-stone-700 mb-1">
                      載具類別 / 捐贈
                    </label>
                    <select
                      id="checkout-invoice-carrier"
                      data-testid="invoice-carrier-select"
                      value={invoicePreference.carrier}
                      onChange={(e) =>
                        setInvoicePreference({
                          ...invoicePreference,
                          carrier: e.target.value as 'none' | 'mobile' | 'amego-email' | 'donation',
                          carrierId: '',
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="none">會員載具（開立後由系統自動對獎與通知）</option>
                      <option value="mobile">手機條碼載具 (如 /AB12+-.)</option>
                      <option value="amego-email">光貿 Email 載具</option>
                      <option value="donation">社福團體捐贈碼</option>
                    </select>
                  </div>

                  {invoicePreference.carrier !== 'none' && (
                    <div>
                      <label htmlFor="checkout-carrier-id" className="block text-xs font-semibold text-stone-700 mb-1">
                        {invoicePreference.carrier === 'mobile'
                          ? '手機條碼（請包含斜線 /，共 8 碼）'
                          : invoicePreference.carrier === 'donation'
                            ? '捐贈碼（3–7 碼數字）'
                            : '載具接收 Email'}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="checkout-carrier-id"
                        data-testid="carrier-id-input"
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
                            ? '/1234567'
                            : invoicePreference.carrier === 'donation'
                              ? '88888'
                              : 'carrier@example.com'
                        }
                        className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="company-tax-id" className="block text-xs font-semibold text-stone-700 mb-1">
                      統一編號 (8 碼) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="company-tax-id"
                      data-testid="tax-id-input"
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
                      placeholder="8 碼數字統編"
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="company-buyer-name" className="block text-xs font-semibold text-stone-700 mb-1">
                      公司抬頭 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="company-buyer-name"
                      data-testid="buyer-name-input"
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
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. 信用卡 Hosted Fields */}
          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-stone-900">4. 付款資訊</h3>
            <PaymentForm ref={paymentFormRef} disabled={isSubmitting} />
          </div>
        </div>

        {/* 右側：訂單商品確認與金額總覽 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5 sticky top-24">
            <h3 className="text-lg font-bold text-stone-900 border-b border-stone-200 pb-3">
              訂單商品清單 ({items.length})
            </h3>

            {/* 商品縮圖列表 */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={`${item.id}:${item.variantId ?? 'unresolved'}`}
                  className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-stone-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-900 truncate">{item.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">數量: {item.quantity}</p>
                  </div>
                  <div className="text-right font-semibold text-sm text-stone-900">
                    {formatTwd(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* 金額小計與運費 */}
            <div className="space-y-2 border-t border-stone-200 pt-4 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>商品小計 (預估)</span>
                <span className="font-semibold text-stone-800">{formatTwd(getTotalPrice())}</span>
              </div>
              <div className="flex justify-between">
                <span>物流運費</span>
                <span className="font-semibold text-emerald-700">滿額免運費</span>
              </div>
              <div className="flex justify-between text-base font-bold text-stone-900 pt-2 border-t border-stone-200">
                <span>結帳總額 (以伺服端重算為準)</span>
                <span className="text-teal-700 text-lg">{formatTwd(getTotalPrice())}</span>
              </div>
            </div>

            {/* 錯誤與提示訊息 */}
            {submitError && (
              <div
                role="alert"
                data-testid="checkout-submit-error"
                className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl space-y-1"
              >
                <p className="font-semibold">{submitError}</p>
                {shortEventId && (
                  <p className="font-mono text-[11px] text-rose-500">
                    客服追蹤碼: {shortEventId}
                  </p>
                )}
              </div>
            )}

            {/* 結帳提交按鈕 (防連點與載入狀態) */}
            <button
              type="submit"
              data-testid="submit-checkout-btn"
              disabled={isSubmitting}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-base transition-all shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>正在安全授權與扣款…</span>
                </>
              ) : (
                <span>確認付款・立即下單</span>
              )}
            </button>

            <p className="text-[11px] text-stone-400 text-center leading-relaxed">
              點擊即表示您同意 SAENGAK 服務條款與隱私權政策。訂單金額將於伺服端重新驗證計算。
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * 結帳頁面主入口，以專屬 CheckoutErrorBoundary 包裹，確保例外發生時購物車不丟失
 */
export function CheckoutPage() {
  return (
    <CheckoutErrorBoundary>
      <CheckoutMain />
    </CheckoutErrorBoundary>
  );
}

export default CheckoutPage;
