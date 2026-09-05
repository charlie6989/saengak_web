import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ShopifyPromotion } from '../api/shopify/discounts.js';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  fetchShopifyPromotionByCode: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../api/_lib/supabase-admin.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/supabase-admin.js')>();
  return {
    ...actual,
    getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  };
});

vi.mock('../api/shopify/discounts.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/shopify/discounts.js')>();
  return {
    ...actual,
    fetchShopifyPromotionByCode: mocks.fetchShopifyPromotionByCode,
  };
});

import { POST, OPTIONS } from '../api/promotions/claim.js';

const mockPromotion: ShopifyPromotion = {
  id: 'gid://shopify/DiscountCodeNode/999',
  code: 'SAVE15',
  title: 'VIP 專屬回饋',
  subtitle: '質感選品全品項 85 折',
  description: 'Shopify 官方活動，結帳時直接折抵。',
  category: 'discount',
  discount_type: 'percentage',
  discount_value: 15,
  min_spend: 3000,
  min_quantity: null,
  starts_at: '2026-01-01T00:00:00Z',
  ends_at: undefined,
  badge_text: '15% OFF',
  image_url: 'https://example.test/save15.jpg',
  is_active: true,
  applies_once_per_customer: true,
  usage_limit: null,
  async_usage_count: 0,
  combines_with: { order_discounts: false, product_discounts: false, shipping_discounts: false },
};

/**
 * 組出符合 claim.ts 呼叫鏈的 adminClient mock：
 * .from('promotions').upsert(...).select('id').single()
 * .from('user_coupons').insert(...).select(...).single()
 * .from('user_coupons').select(...).eq(...).eq(...).maybeSingle()（僅重複領取時查回既有那筆用）
 */
function createAdminClientMock(options: {
  promotionUpsertResult: { data: any; error: any };
  couponInsertResult: { data: any; error: any };
  existingCouponResult?: { data: any; error: any };
}) {
  const promotionsSingle = vi.fn().mockResolvedValue(options.promotionUpsertResult);
  const promotionsSelect = vi.fn().mockReturnValue({ single: promotionsSingle });
  const promotionsUpsert = vi.fn().mockReturnValue({ select: promotionsSelect });

  const couponsSingle = vi.fn().mockResolvedValue(options.couponInsertResult);
  const couponsSelectAfterInsert = vi.fn().mockReturnValue({ single: couponsSingle });
  const couponsInsert = vi.fn().mockReturnValue({ select: couponsSelectAfterInsert });

  const existingMaybeSingle = vi.fn().mockResolvedValue(
    options.existingCouponResult ?? { data: null, error: null },
  );
  const eqSecond = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle });
  const eqFirst = vi.fn().mockReturnValue({ eq: eqSecond });
  const couponsSelectForLookup = vi.fn().mockReturnValue({ eq: eqFirst });

  const from = vi.fn((table: string) => {
    if (table === 'promotions') {
      return { upsert: promotionsUpsert };
    }
    if (table === 'user_coupons') {
      return { insert: couponsInsert, select: couponsSelectForLookup };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return { from, __mocks: { promotionsUpsert, couponsInsert } };
}

describe('SAENGAK 會員領券歸戶 API 測試 (api/promotions/claim.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'member-123' } },
          error: null,
        }),
      },
    });
    mocks.getSupabaseAdminClient.mockReset();
    mocks.fetchShopifyPromotionByCode.mockReset();
  });

  describe('1. OPTIONS 與 CORS 權限檢查', () => {
    it('允許合規 Origin 之 OPTIONS 預檢請求 (204)', async () => {
      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'OPTIONS',
        headers: { Origin: 'https://saengak.com.tw' },
      });
      const response = await OPTIONS(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://saengak.com.tw');
    });

    it('拒絕非法 Origin 跨域請求 (403)', async () => {
      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'POST',
        headers: { Origin: 'https://malicious-phishing.com' },
      });
      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('2. 會員身分驗證', () => {
    it('缺少 Authorization header 時回傳 401 且 success: false', async () => {
      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'SAVE15' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.code).toBe('MEMBER_LOGIN_REQUIRED');
    });
  });

  describe('3. Shopify 折扣代碼查證', () => {
    it('fetchShopifyPromotionByCode 回傳 undefined（查無代碼或驗證不到）時回傳 503 且 success: false', async () => {
      mocks.fetchShopifyPromotionByCode.mockResolvedValue(undefined);

      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({ code: 'NOTFOUND' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
    });
  });

  describe('4. 成功領取流程', () => {
    it('查證成功、promotions upsert 成功、user_coupons insert 成功時回傳 200 success: true，且正確傳遞代碼與 upsert payload', async () => {
      mocks.fetchShopifyPromotionByCode.mockResolvedValue(mockPromotion);

      const adminMock = createAdminClientMock({
        promotionUpsertResult: { data: { id: 'promo-uuid-1' }, error: null },
        couponInsertResult: {
          data: {
            id: 'coupon-uuid-1',
            user_id: 'member-123',
            promotion_id: 'promo-uuid-1',
            coupon_code: 'SAVE15',
            status: 'available',
            claimed_at: '2026-09-04T00:00:00Z',
            promotion: mockPromotion,
          },
          error: null,
        },
      });
      mocks.getSupabaseAdminClient.mockReturnValue(adminMock);

      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({ code: '  save15  ' }), // 故意帶入小寫與空白，驗證正規化
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.coupon.id).toBe('coupon-uuid-1');

      // 呼叫 Shopify 查詢函式時應已 trim + toUpperCase
      expect(mocks.fetchShopifyPromotionByCode).toHaveBeenCalledWith('SAVE15');

      // promotions upsert payload 內容應完全來自 Shopify 權威資料，且用 onConflict: 'code'
      expect(adminMock.__mocks.promotionsUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SAVE15',
          title: 'VIP 專屬回饋',
          category: 'discount',
          discount_type: 'percentage',
          discount_value: 15,
          min_spend: 3000,
          is_active: true,
        }),
        { onConflict: 'code' },
      );

      // user_coupons insert 應使用驗證過的會員 id 與 promotions upsert 回傳的 uuid
      expect(adminMock.__mocks.couponsInsert).toHaveBeenCalledWith({
        user_id: 'member-123',
        promotion_id: 'promo-uuid-1',
        coupon_code: 'SAVE15',
        status: 'available',
      });
    });
  });

  describe('5. 重複領取', () => {
    it('user_coupons insert 回傳 error.code === 23505（unique violation）時回傳 success: false 與 alreadyClaimed: true', async () => {
      mocks.fetchShopifyPromotionByCode.mockResolvedValue(mockPromotion);

      const adminMock = createAdminClientMock({
        promotionUpsertResult: { data: { id: 'promo-uuid-1' }, error: null },
        couponInsertResult: { data: null, error: { code: '23505', message: 'duplicate key value' } },
        existingCouponResult: {
          data: {
            id: 'coupon-uuid-existing',
            user_id: 'member-123',
            promotion_id: 'promo-uuid-1',
            coupon_code: 'SAVE15',
            status: 'available',
          },
          error: null,
        },
      });
      mocks.getSupabaseAdminClient.mockReturnValue(adminMock);

      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({ code: 'SAVE15' }),
      });

      const response = await POST(request);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.alreadyClaimed).toBe(true);
    });
  });

  describe('6. 無 Service Role Key（本地開發降級 userClient 支援）', () => {
    it('當 adminClient 為 null 時，降級使用 userClient 查詢 promotions 並寫入 user_coupons', async () => {
      mocks.fetchShopifyPromotionByCode.mockResolvedValue(mockPromotion);
      mocks.getSupabaseAdminClient.mockReturnValue(null);

      const promotionsMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'promo-uuid-fallback' }, error: null });
      const promotionsEq = vi.fn().mockReturnValue({ maybeSingle: promotionsMaybeSingle });
      const promotionsSelect = vi.fn().mockReturnValue({ eq: promotionsEq });

      const couponSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'coupon-uuid-userclient',
          user_id: 'member-123',
          promotion_id: 'promo-uuid-fallback',
          coupon_code: 'SAVE15',
          status: 'available',
        },
        error: null,
      });
      const couponSelect = vi.fn().mockReturnValue({ single: couponSingle });
      const couponInsert = vi.fn().mockReturnValue({ select: couponSelect });

      mocks.createClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'member-123' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'promotions') return { select: promotionsSelect };
          if (table === 'user_coupons') return { insert: couponInsert };
          throw new Error(`Unexpected table: ${table}`);
        }),
      });

      const request = new Request('http://localhost/api/promotions/claim', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({ code: 'SAVE15' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.coupon.id).toBe('coupon-uuid-userclient');
    });
  });
});
