/**
 * SAENGAK 優惠券與促銷活動型別定義
 * 對齊 Shopify Discounts 與 Supabase 資料結構
 */

export type CouponCategory = 'all' | 'welcome' | 'discount' | 'shipping' | 'member';

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

export type UserCouponStatus = 'available' | 'used' | 'expired';

export interface Promotion {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: CouponCategory;
  discount_type: DiscountType;
  discount_value: number;
  min_spend: number;
  min_quantity?: number | null;
  starts_at: string;
  ends_at?: string;
  badge_text?: string;
  image_url?: string;
  is_active: boolean;
  applies_once_per_customer?: boolean;
  usage_limit?: number | null;
  async_usage_count?: number;
  combines_with?: {
    order_discounts?: boolean;
    product_discounts?: boolean;
    shipping_discounts?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export interface UserCoupon {
  id: string;
  user_id: string;
  promotion_id: string;
  coupon_code: string;
  status: UserCouponStatus;
  claimed_at: string;
  used_at?: string;
  order_id?: string;
  promotion?: Promotion;
}

export interface ClaimCouponResult {
  success: boolean;
  message: string;
  coupon?: UserCoupon;
  alreadyClaimed?: boolean;
}
