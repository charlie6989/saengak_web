import { supabase } from './supabase';
import type { Promotion, UserCoupon, ClaimCouponResult } from '../types/promotions';

// 預設促銷活動（對齊 Shopify 後台 Discounts 與本地容錯）
export const DEFAULT_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-welcome-100',
    code: 'WELCOME100',
    title: '新會員見面禮',
    subtitle: '首次加入會員專享折抵',
    description: '全館消費滿 NT$ 1,000 現折 NT$ 100。每位會員限領乙次。',
    category: 'welcome',
    discount_type: 'fixed_amount',
    discount_value: 100,
    min_spend: 1000,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    badge_text: '新客專享',
    image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
    is_active: true,
  },
  {
    id: 'promo-save-15',
    code: 'SAVE15',
    title: 'VIP 專屬回饋',
    subtitle: '質感選品全品項 85 折',
    description: '全館消費滿 NT$ 2,000 享結帳 85 折優惠（最高折抵 NT$ 600）。',
    category: 'discount',
    discount_type: 'percentage',
    discount_value: 15,
    min_spend: 2000,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    badge_text: '15% OFF',
    image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
    is_active: true,
  },
  {
    id: 'promo-free-ship',
    code: 'FREESHIP',
    title: '初夏免運專案',
    subtitle: '超商與宅配滿額免運費',
    description: '消費滿 NT$ 999 即可享免運費優惠，結帳時直接折抵運費。',
    category: 'shipping',
    discount_type: 'free_shipping',
    discount_value: 0,
    min_spend: 999,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    badge_text: '全館免運',
    image_url: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&q=80&w=800',
    is_active: true,
  },
  {
    id: 'promo-special-30',
    code: 'SPECIAL30',
    title: '限時會員日狂歡',
    subtitle: '指定熱銷組合 7 折特惠',
    description: '單筆訂單滿 NT$ 3,500 即享 7 折專屬特惠，數量有限送完為止。',
    category: 'member',
    discount_type: 'percentage',
    discount_value: 30,
    min_spend: 3500,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    badge_text: '30% OFF',
    image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
    is_active: true,
  },
];

const LOCAL_STORAGE_COUPONS_KEY = 'saengak_mock_user_coupons';

/**
 * 查詢所有有效進行中的促銷活動（優先自 Shopify Admin API 即時抓取最新折扣）
 */
export async function fetchActivePromotions(): Promise<Promotion[]> {
  // 1. 優先從 Shopify 折扣端點直讀官方後台折扣
  try {
    const res = await fetch('/api/shopify/discounts', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.promotions) && data.promotions.length > 0) {
        return data.promotions as Promotion[];
      }
    }
  } catch (apiErr) {
    console.warn('呼叫 /api/shopify/discounts 失敗，嘗試讀取 Supabase:', apiErr);
  }

  // 2. 次選從 Supabase promotions 表讀取
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as Promotion[];
    }
  } catch (dbErr) {
    console.warn('載入 Supabase 促銷活動失敗:', dbErr);
  }

  // 3. 退回預設促銷活動
  return DEFAULT_PROMOTIONS;
}

/**
 * 查詢特定會員名下所有優惠券（含關聯促銷細節）
 */
export async function fetchUserCoupons(userId: string): Promise<UserCoupon[]> {
  if (!userId) return [];

  // Mock 模式支援
  const isMockAuth = typeof window !== 'undefined' && localStorage.getItem('useMockAuth') === 'true';
  if (isMockAuth) {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_COUPONS_KEY}_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_coupons')
      .select(`
        *,
        promotion:promotions (*)
      `)
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });

    if (error) {
      // 若資料表尚未建立或查詢異常，退回本地快取
      const saved = localStorage.getItem(`${LOCAL_STORAGE_COUPONS_KEY}_${userId}`);
      return saved ? JSON.parse(saved) : [];
    }

    return (data || []) as UserCoupon[];
  } catch (err) {
    console.warn('載入會員優惠券失敗:', err);
    return [];
  }
}

/**
 * 會員領取優惠券並歸戶
 */
export async function claimPromotionCoupon(
  userId: string,
  promotion: Promotion,
): Promise<ClaimCouponResult> {
  if (!userId) {
    return { success: false, message: '請先登入會員以領取優惠券' };
  }

  const isMockAuth = typeof window !== 'undefined' && localStorage.getItem('useMockAuth') === 'true';

  if (isMockAuth) {
    const key = `${LOCAL_STORAGE_COUPONS_KEY}_${userId}`;
    const raw = localStorage.getItem(key);
    const list: UserCoupon[] = raw ? JSON.parse(raw) : [];

    const existing = list.find((c) => c.promotion_id === promotion.id || c.coupon_code === promotion.code);
    if (existing) {
      return { success: false, message: '您已領取過此張優惠券', alreadyClaimed: true, coupon: existing };
    }

    const newCoupon: UserCoupon = {
      id: `mock-coupon-${Date.now()}`,
      user_id: userId,
      promotion_id: promotion.id,
      coupon_code: promotion.code,
      status: 'available',
      claimed_at: new Date().toISOString(),
      promotion,
    };

    list.unshift(newCoupon);
    localStorage.setItem(key, JSON.stringify(list));
    return { success: true, message: '優惠券已成功歸戶！', coupon: newCoupon };
  }

  try {
    const { data, error } = await supabase
      .from('user_coupons')
      .insert({
        user_id: userId,
        promotion_id: promotion.id,
        coupon_code: promotion.code,
        status: 'available',
      })
      .select(`
        *,
        promotion:promotions (*)
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return { success: false, message: '您已領取過此張優惠券', alreadyClaimed: true };
      }
      throw error;
    }

    return {
      success: true,
      message: '優惠券已成功歸戶至會員中心！',
      coupon: data as UserCoupon,
    };
  } catch (err: any) {
    console.warn('歸戶寫入失敗，切換至本地快取容錯:', err);
    // 容錯機制
    const key = `${LOCAL_STORAGE_COUPONS_KEY}_${userId}`;
    const raw = localStorage.getItem(key);
    const list: UserCoupon[] = raw ? JSON.parse(raw) : [];

    if (list.some((c) => c.coupon_code === promotion.code)) {
      return { success: false, message: '您已領取過此張優惠券', alreadyClaimed: true };
    }

    const newCoupon: UserCoupon = {
      id: `fallback-${Date.now()}`,
      user_id: userId,
      promotion_id: promotion.id,
      coupon_code: promotion.code,
      status: 'available',
      claimed_at: new Date().toISOString(),
      promotion,
    };

    list.unshift(newCoupon);
    localStorage.setItem(key, JSON.stringify(list));
    return { success: true, message: '優惠券已成功歸戶！', coupon: newCoupon };
  }
}

/**
 * 計算特定折價券在當前購物車總金額下的折抵金額
 */
export function calculateDiscountAmount(
  promotion: Promotion,
  cartTotal: number,
): { amount: number; isEligible: boolean; shortfall: number } {
  if (cartTotal < promotion.min_spend) {
    return {
      amount: 0,
      isEligible: false,
      shortfall: promotion.min_spend - cartTotal,
    };
  }

  if (promotion.discount_type === 'fixed_amount') {
    return {
      amount: Math.min(promotion.discount_value, cartTotal),
      isEligible: true,
      shortfall: 0,
    };
  }

  if (promotion.discount_type === 'percentage') {
    const discounted = Math.round(cartTotal * (promotion.discount_value / 100));
    return {
      amount: discounted,
      isEligible: true,
      shortfall: 0,
    };
  }

  // free_shipping 不直接扣減商品小計，由運費計算處折抵
  return {
    amount: 0,
    isEligible: true,
    shortfall: 0,
  };
}
