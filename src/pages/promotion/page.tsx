import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import AuthModal from '../../components/feature/AuthModal';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchActivePromotions,
  fetchUserCoupons,
  claimPromotionCoupon,
} from '../../lib/promotions';
import type { Promotion, UserCoupon, CouponCategory } from '../../types/promotions';

const categoryTabs: { key: CouponCategory; label: string; icon: string }[] = [
  { key: 'all', label: '全部優惠', icon: 'ri-apps-line' },
  { key: 'welcome', label: '新客專享', icon: 'ri-user-star-line' },
  { key: 'discount', label: '限時折扣', icon: 'ri-percent-line' },
  { key: 'shipping', label: '免運專區', icon: 'ri-truck-line' },
  { key: 'member', label: '會員專屬', icon: 'ri-vip-crown-line' },
];

const faqs = [
  {
    q: '每組優惠折扣碼可以使用幾次？',
    a: '每組折扣碼的使用次數完全依照 Shopify 官方後台之「使用量限制」即時判定：若活動有勾選「每位顧客限用一次（One use per customer）」，每位會員限用乙次；若後台未勾選該項限制，則不加以限制，會員在每次結帳時皆可再次重複享有折抵。若活動有設定「代碼總使用次數上限」，達到全店總限額後即停止兌換。',
  },
  {
    q: '單筆訂單可以同時使用多張優惠券嗎？',
    a: '依據 Shopify 官方後台「組合（Combinations）」規則設定即時判定：若折扣碼設定為獨立使用，則不可與其他優惠併用；若後台有開放與指定運費優惠或商品折扣組合，系統將於結帳時自動合併折抵。',
  },
  {
    q: '如何使用領取到的優惠券？',
    a: '登入會員領取優惠券後，優惠券將自動存入您的「會員中心 > 我的優惠券」。在購物車側邊欄結帳時，系統會自動列出符合門檻的可用優惠券供您直接點選，跳轉至 Shopify 結帳頁時將自動折抵。',
  },
  {
    q: '訂單取消或辦理退貨時，優惠券會退還嗎？',
    a: '若訂單未完成付款取消，或辦理整筆訂單退貨，已使用的折價券將在系統審核完成後返還至您的會員錢包；若為部分退貨且剩餘金額未達優惠門檻，折抵金額將依比例扣除。',
  },
  {
    q: '優惠券有使用期限嗎？',
    a: '每張優惠券均有明確的有效起訖日期與最低消費金額門檻，請於卡片標示期限內使用，逾期將自動失效且無法延長。',
  },
];

export default function PromotionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CouponCategory>('all');
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingPromoToClaim, setPendingPromoToClaim] = useState<Promotion | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // 讀取促銷活動
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const promos = await fetchActivePromotions();
      setPromotions(promos);

      if (user?.id) {
        const coupons = await fetchUserCoupons(user.id);
        setUserCoupons(coupons);
      } else {
        setUserCoupons([]);
      }
      setLoading(false);
    }
    loadData();
  }, [user?.id]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const isCouponClaimed = (promotionId: string, code: string) => {
    return userCoupons.some(
      (c) => c.promotion_id === promotionId || c.coupon_code === code
    );
  };

  const handleClaim = async (promo: Promotion) => {
    if (!user) {
      setPendingPromoToClaim(promo);
      setIsAuthModalOpen(true);
      return;
    }

    setClaimingId(promo.id);
    try {
      const result = await claimPromotionCoupon(user.id, promo);
      if (result.success && result.coupon) {
        setUserCoupons((prev) => [result.coupon!, ...prev]);
        showToast(result.message, 'success');
      } else {
        showToast(result.message, result.alreadyClaimed ? 'info' : 'error');
      }
    } catch (err: any) {
      showToast('領取失敗，請稍後再試', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  // 登入完成回呼
  const handleAuthenticated = async () => {
    setIsAuthModalOpen(false);
    if (pendingPromoToClaim && user?.id) {
      await handleClaim(pendingPromoToClaim);
      setPendingPromoToClaim(null);
    } else if (user?.id) {
      const coupons = await fetchUserCoupons(user.id);
      setUserCoupons(coupons);
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      showToast(`已複製折扣碼：${code}`, 'success');
    } else {
      showToast(`折扣碼：${code}`, 'info');
    }
  };

  const filteredPromotions = selectedCategory === 'all'
    ? promotions
    : promotions.filter((p) => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#F7F7F5]" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
      <Header />

      {/* Toast 提示 */}
      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border-red-200'
                : 'bg-teal-50 text-teal-900 border-teal-200'
            }`}
          >
            <i
              className={`text-lg ${
                toastMessage.type === 'success'
                  ? 'ri-checkbox-circle-fill text-emerald-600'
                  : toastMessage.type === 'error'
                  ? 'ri-error-warning-fill text-red-600'
                  : 'ri-information-fill text-teal-600'
              }`}
            ></i>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      <main className="pb-24 pt-32">
        {/* Hero 頂部橫幅 */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#225B4F]/10 via-[#225B4F]/5 to-transparent py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#225B4F]/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-[#225B4F] uppercase mb-4">
              <i className="ri-coupon-3-line text-sm"></i>
              SAENGAK Promotions
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              專屬優惠禮遇
            </h1>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-gray-600 leading-relaxed">
              探索專屬折扣與限時特惠，登入會員一鍵歸戶，為您的日常生活增添優雅與美好提案。
            </p>

            {user ? (
              <div className="mt-6 inline-flex items-center gap-3 bg-white/80 backdrop-blur-xs border border-teal-200/80 px-4 py-2 rounded-full text-xs sm:text-sm text-teal-800">
                <i className="ri-vip-crown-fill text-amber-500 text-base"></i>
                <span>您已歸戶 <strong>{userCoupons.length}</strong> 張優惠券</span>
                <Link
                  to="/profile?tab=coupons"
                  className="font-bold underline underline-offset-2 hover:text-teal-950 ml-1"
                >
                  查看我的券匣 →
                </Link>
              </div>
            ) : (
              <div className="mt-6 inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                <i className="ri-information-line"></i>
                <span>折扣券需登入會員後歸戶使用</span>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="font-semibold text-[#225B4F] underline underline-offset-2 hover:text-[#19453c] cursor-pointer"
                >
                  立即登入 / 註冊
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 分類過濾頁籤 */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-10">
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categoryTabs.map((tab) => {
              const isActive = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#225B4F] text-white shadow-md shadow-[#225B4F]/20'
                      : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80'
                  }`}
                >
                  <i className={tab.icon}></i>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 優惠券票卡網格 (Ticket Cards Grid) */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-20">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-3 border-[#225B4F] border-t-transparent"></div>
              <p className="mt-4 text-sm text-gray-500">載入優惠活動中...</p>
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <i className="ri-coupon-line text-2xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900">目前尚無此分類活動</h3>
              <p className="mt-1 text-sm text-gray-500">請切換其他分類或稍後再來查看最新提案。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredPromotions.map((promo) => {
                const claimed = isCouponClaimed(promo.id, promo.code);
                const isClaimingThis = claimingId === promo.id;

                return (
                  <div
                    key={promo.id}
                    className="relative flex flex-col bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
                  >
                    {/* 上方視覺圖與徽章 */}
                    <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                      {promo.image_url ? (
                        <img
                          src={promo.image_url}
                          alt={promo.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-teal-900/10 text-[#225B4F]">
                          <i className="ri-gift-line text-4xl"></i>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

                      {/* 類別徽章 */}
                      {promo.badge_text && (
                        <span className="absolute top-3 left-3 rounded-full bg-[#225B4F] px-3 py-1 text-xs font-bold text-white shadow-xs">
                          {promo.badge_text}
                        </span>
                      )}

                      {/* 面額大標 */}
                      <div className="absolute bottom-3 left-4 right-4 flex items-baseline justify-between text-white">
                        <div>
                          <p className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
                            {promo.discount_type === 'percentage'
                              ? `${promo.discount_value}% OFF`
                              : promo.discount_type === 'fixed_amount'
                              ? `NT$ ${promo.discount_value.toLocaleString()} 折抵`
                              : '全館免運費'}
                          </p>
                          <p className="text-xs text-gray-200 mt-0.5">
                            {promo.min_spend > 0
                              ? `滿 NT$ ${promo.min_spend.toLocaleString()} 即可折抵`
                              : promo.min_quantity && promo.min_quantity > 0
                              ? `滿 ${promo.min_quantity} 件即可折抵`
                              : '全館無門檻'}
                          </p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded bg-white/20 backdrop-blur-xs font-mono">
                          {promo.code}
                        </span>
                      </div>
                    </div>

                    {/* 票券切口裝飾條 (Ticket Notches & Dashed Divider) */}
                    <div className="relative flex items-center justify-between px-2 bg-white">
                      <div className="h-5 w-5 -ml-4 rounded-full bg-[#F7F7F5] border-r border-gray-200/90"></div>
                      <div className="w-full border-t border-dashed border-gray-300 mx-2"></div>
                      <div className="h-5 w-5 -mr-4 rounded-full bg-[#F7F7F5] border-l border-gray-200/90"></div>
                    </div>

                    {/* 下方內容與互動區塊 */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#225B4F] transition-colors">
                            {promo.title}
                          </h3>
                        </div>
                        {promo.subtitle && (
                          <p className="text-xs font-semibold text-[#225B4F] mt-1">
                            {promo.subtitle}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                          {promo.description || '結帳時自動套用折扣，限量優惠送完為止。'}
                        </p>

                        {/* 後台規則動態標籤 */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] mt-3">
                          {/* 1. 每位顧客限用一次 (勾選為 true；若未勾選則為 false，不加以限制) */}
                          {promo.applies_once_per_customer ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded-md font-medium">
                              <i className="ri-user-follow-line text-xs text-amber-700"></i>
                              每位顧客限用一次
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-900 border border-teal-200/80 px-2 py-0.5 rounded-md font-medium">
                              <i className="ri-loop-right-line text-xs text-teal-700"></i>
                              不限每人使用次數
                            </span>
                          )}

                          {/* 2. 限制每個代碼的總使用次數上限 (若未勾選則為 null，不加以限制) */}
                          {typeof promo.usage_limit === 'number' && (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-900 border border-rose-200/80 px-2 py-0.5 rounded-md font-medium">
                              <i className="ri-fire-line text-xs text-rose-600"></i>
                              全店限量 {promo.usage_limit.toLocaleString()} 組
                            </span>
                          )}

                          {/* 3. 折扣組合規則 (依 combines_with 動態判斷，不寫死) */}
                          {(() => {
                            const combines = promo.combines_with;
                            const canCombine = combines && (combines.order_discounts || combines.product_discounts || combines.shipping_discounts);
                            if (canCombine) {
                              const allowed: string[] = [];
                              if (combines.shipping_discounts) allowed.push('免運');
                              if (combines.product_discounts) allowed.push('商品折抵');
                              if (combines.order_discounts) allowed.push('訂單折抵');
                              return (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2 py-0.5 rounded-md font-medium">
                                  <i className="ri-links-line text-xs text-emerald-600"></i>
                                  可與{allowed.join('/')}併用
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                                <i className="ri-prohibited-line text-xs text-gray-500"></i>
                                單獨折抵不可併用
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 折扣碼複製與有效期限 */}
                      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200/80">
                          <div className="flex items-center gap-2">
                            <i className="ri-ticket-line text-gray-400 text-sm"></i>
                            <span className="font-mono text-sm font-bold text-gray-800 tracking-wider">
                              {promo.code}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(promo.code)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#225B4F] hover:text-[#173e35] cursor-pointer"
                          >
                            <i className="ri-file-copy-line"></i>
                            <span>複製代碼</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="text-[11px] text-gray-400">
                            {promo.ends_at ? `有效期限至 ${new Date(promo.ends_at).toLocaleDateString('zh-TW')}` : '長期有效'}
                          </span>

                          {claimed ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                <i className="ri-check-line font-bold"></i>
                                已歸戶
                              </span>
                              <button
                                type="button"
                                onClick={() => navigate('/search?query=all')}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#225B4F] hover:bg-[#1a473e] rounded-lg shadow-2xs transition-colors cursor-pointer"
                              >
                                前往逛逛
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleClaim(promo)}
                              disabled={isClaimingThis}
                              className="px-4 py-2 text-xs font-bold text-white bg-[#225B4F] hover:bg-[#1a473e] rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isClaimingThis ? (
                                <>
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                  <span>歸戶中...</span>
                                </>
                              ) : (
                                <>
                                  <i className="ri-download-cloud-line text-sm"></i>
                                  <span>立即領券歸戶</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 優惠使用折抵三步驟指南 (3-Step Guide) */}
        <section className="bg-white py-16 border-y border-gray-200/80 mb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                輕鬆享受折扣 3 步驟
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                簡單三步，將質感好物以最優價格帶入您的日常。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="h-14 w-14 rounded-2xl bg-[#225B4F]/10 text-[#225B4F] flex items-center justify-center text-2xl mb-4 font-bold">
                  1
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">登入領券歸戶</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  註冊或登入 SAENGAK 會員，在本頁面點擊「立即領券歸戶」，票券立即綁定至您的個人中心。
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="h-14 w-14 rounded-2xl bg-[#225B4F]/10 text-[#225B4F] flex items-center justify-center text-2xl mb-4 font-bold">
                  2
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">挑選商品加入購物車</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  瀏覽各項專屬嚴選商品，系統將即時提示滿額門檻與免運進度。
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="h-14 w-14 rounded-2xl bg-[#225B4F]/10 text-[#225B4F] flex items-center justify-center text-2xl mb-4 font-bold">
                  3
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">結帳自動套用折抵</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  於購物車展開選取已歸戶的優惠券，或輸入代碼，跳轉至 Shopify Checkout 即刻折抵！
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 優惠使用須知 FAQ Accordion */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              優惠使用須知與常見問題
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              關於折抵規則、退換貨原則與代碼使用細則。
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left font-semibold text-gray-900 hover:text-[#225B4F] transition-colors cursor-pointer"
                  >
                    <span className="text-sm sm:text-base">{faq.q}</span>
                    <i
                      className={`ri-arrow-down-s-line text-xl transition-transform ${
                        isOpen ? 'rotate-180 text-[#225B4F]' : 'text-gray-400'
                      }`}
                    ></i>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 官方客服導流橫幅 */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-[#225B4F] to-[#2e7465] p-8 sm:p-12 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wider text-emerald-100 uppercase mb-3">
                Customer Support
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                對優惠活動有任何疑問？
              </h3>
              <p className="mt-2 text-sm text-emerald-100 max-w-xl leading-relaxed">
                歡迎透過 SAENGAK LINE 官方客服即時諮詢，客服專員將於營業時間為您迅速解答。
              </p>
            </div>
            <a
              href="https://line.me/R/ti/p/@saengak"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#06C755] text-white font-bold hover:bg-[#05b34c] shadow-md hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
            >
              <i className="ri-line-fill text-xl"></i>
              <span>加入 LINE 官方客服</span>
            </a>
          </div>
        </section>
      </main>

      {/* 登入彈窗 */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingPromoToClaim(null);
        }}
        onAuthenticated={handleAuthenticated}
      />

      <Footer />
    </div>
  );
}
