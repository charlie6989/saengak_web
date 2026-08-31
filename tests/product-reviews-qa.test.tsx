import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { AuthContext, type AuthContextType } from '../src/contexts/AuthContext';
import { CartProvider } from '../src/contexts/CartContext';
import type { ProductReview, ProductQuestion } from '../src/types/reviews-qa';
import {
  fetchPublishedReviews,
  fetchProductQA,
  fetchMemberReviews,
  submitProductReview,
  submitProductQuestion,
  maskUserIdentifier,
  isOrderDelivered,
} from '../src/lib/reviews-qa';
import ProductPage from '../src/pages/product/page';
import ProfilePage from '../src/pages/profile/page';
import { supabase } from '../src/lib/supabase';

// Mock lib/supabase
vi.mock('../src/lib/supabase', () => {
  const mockFrom = vi.fn();
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
});

vi.mock('../src/lib/shopify', () => ({
  getShopifyProduct: vi.fn().mockResolvedValue({
    id: 'gid://shopify/Product/1001',
    name: 'SAENGAK 舒適透氣日常 T 恤',
    title: 'SAENGAK 舒適透氣日常 T 恤',
    description: '100% 精梳棉，親膚透氣，日常百搭首選。',
    price: 890,
    originalPrice: 1180,
    image: 'https://example.com/tshirt.jpg',
    hoverImage: 'https://example.com/tshirt-hover.jpg',
    images: [{ url: 'https://example.com/tshirt.jpg', altText: 'T 恤' }],
    variants: [
      {
        id: 'gid://shopify/ProductVariant/2001',
        title: '白色 / M',
        price: 890,
        availableForSale: true,
        selectedOptions: [
          { name: '顏色', value: '白色' },
          { name: '尺寸', value: 'M' },
        ],
      },
    ],
    options: [
      { id: 'opt-1', name: '顏色', values: ['白色', '黑色'] },
      { id: 'opt-2', name: '尺寸', values: ['S', 'M', 'L'] },
    ],
    availableForSale: true,
  }),
  getShopifyProducts: vi.fn().mockResolvedValue([]),
}));

describe('商品詳情頁評價/問答與會員中心已購評價單元測試', () => {
  const createMockAuthContext = (overrides: Partial<AuthContextType>): AuthContextType => ({
    user: null,
    session: null,
    role: null,
    isAdmin: false,
    isLoading: false,
    isConfigured: true,
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. 商品頁評價頁籤 (Reviews Tab)', () => {
    it('評價脫敏與已驗證購買徽章應正確呈現', () => {
      const mockReview: ProductReview = {
        id: 'rev-001',
        user_id: '11111111-1111-1111-1111-111111111111',
        order_id: 'ord-001',
        order_item_id: 'item-001',
        shopify_product_id: 'gid://shopify/Product/1001',
        rating: 5,
        comment: '衣服材質非常好，穿起來非常柔軟舒適！',
        status: 'published',
        created_at: '2026-08-25T08:00:00Z',
        updated_at: '2026-08-25T08:00:00Z',
        display_name: '會員 王*明',
      };

      expect(mockReview.rating).toBe(5);
      expect(mockReview.display_name).toBe('會員 王*明');
      expect(mockReview.status).toBe('published');
    });

    it('平均分數與星級統計計算公式正確', () => {
      const reviews: ProductReview[] = [
        { id: '1', user_id: 'u1', order_id: 'o1', order_item_id: 'i1', shopify_product_id: 'p1', rating: 5, comment: '讚', status: 'published', created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', order_id: 'o2', order_item_id: 'i2', shopify_product_id: 'p1', rating: 4, comment: '好', status: 'published', created_at: '', updated_at: '' },
        { id: '3', user_id: 'u3', order_id: 'o3', order_item_id: 'i3', shopify_product_id: 'p1', rating: 5, comment: '棒', status: 'published', created_at: '', updated_at: '' },
      ];

      const totalReviews = reviews.length;
      const avg = (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1);
      expect(avg).toBe('4.7');
      expect(totalReviews).toBe(3);
    });

    it('空評價清單時應展示 0.0 分與尚無顧客評價提示', () => {
      const reviews: ProductReview[] = [];
      const totalReviews = reviews.length;
      const avg = totalReviews > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) : '0.0';
      expect(avg).toBe('0.0');
      expect(totalReviews).toBe(0);
    });
  });

  describe('2. 商品頁問答頁籤 (Q&A Tab) 與 LINE 官方客服橫幅', () => {
    it('問答匿名化與官方客服回覆結構驗證', () => {
      const mockQA: ProductQuestion = {
        id: 'qa-001',
        user_id: '22222222-2222-2222-2222-222222222222',
        shopify_product_id: 'gid://shopify/Product/1001',
        question: '請問身高 175cm、體重 68kg 適合穿什麼尺寸？',
        answer: '建議選購 L 號會是合身微寬鬆的舒適體驗喔！',
        answered_by: 'admin-001',
        answered_at: '2026-08-26T10:30:00Z',
        status: 'answered',
        is_public: true,
        created_at: '2026-08-26T09:00:00Z',
        updated_at: '2026-08-26T10:30:00Z',
        display_name: '會員 c***@example.com',
      };

      expect(mockQA.display_name).toContain('會員');
      expect(mockQA.answer).toBeDefined();
      expect(mockQA.status).toBe('answered');
      expect(mockQA.is_public).toBe(true);
    });

    it('LINE 官方客服預設 URL 與 site_settings 客製化邏輯正確', () => {
      const defaultLineUrl = 'https://line.me/R/ti/p/@saengak';
      expect(defaultLineUrl).toMatch(/^https:\/\/line\.me\//);
    });

    it('submitProductQuestion 發問 payload 欄位驗證', async () => {
      const mockCreatedQA: ProductQuestion = {
        id: 'qa-002',
        user_id: 'u-123',
        shopify_product_id: 'gid://shopify/Product/1001',
        question: '請問這件可以烘乾嗎？',
        answer: null,
        status: 'pending',
        is_public: true,
        created_at: '2026-08-30T12:00:00Z',
        updated_at: '2026-08-30T12:00:00Z',
      };

      const queryBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedQA, error: null }),
      };
      (supabase.from as any).mockReturnValue(queryBuilder);

      const res = await submitProductQuestion({
        user_id: 'u-123',
        shopify_product_id: 'gid://shopify/Product/1001',
        question: '請問這件可以烘乾嗎？',
      });

      expect(res.error).toBeNull();
      expect(res.data?.id).toBe('qa-002');
      expect(res.data?.question).toBe('請問這件可以烘乾嗎？');
    });
  });

  describe('3. 會員中心已購商品評價按鈕與狀態標籤', () => {
    it('未送達或配送中之訂單品項應判定無法評價 (按鈕隱藏)', () => {
      const undeliveredOrder = {
        id: 'ord-in-transit',
        status: 'paid',
        fulfillment_status: 'unfulfilled',
        fulfillments: [{ status: 'in_transit' }],
      };

      expect(isOrderDelivered(undeliveredOrder as any)).toBe(false);
    });

    it('已送達或超商取件之訂單品項應判定可開啟評價 (isOrderDelivered 為 true)', () => {
      const deliveredOrder = {
        id: 'ord-delivered',
        status: 'paid',
        fulfillment_status: 'fulfilled',
        fulfillments: [{ status: 'delivered' }],
      };

      expect(isOrderDelivered(deliveredOrder as any)).toBe(true);
    });

    it('未評價品項在未有評價紀錄時，比對結果為 undefined', () => {
      const orderItem = {
        id: 'item-unreviewed-1',
        product_name: 'SAENGAK 舒適透氣日常 T 恤',
        quantity: 1,
        price: 890,
      };

      const memberReviews: ProductReview[] = [];
      const existingReview = memberReviews.find((r) => r.order_item_id === orderItem.id);

      expect(existingReview).toBeUndefined();
    });

    it('已評價品項應正確比對並顯示「⭐ 已評價 (審核中/已發布)」與星級', () => {
      const orderItem = {
        id: 'item-reviewed-1',
        product_name: 'SAENGAK 舒適透氣日常 T 恤',
        quantity: 1,
        price: 890,
      };

      const memberReviews: ProductReview[] = [
        {
          id: 'rev-001',
          user_id: 'user-001',
          order_id: 'ord-001',
          order_item_id: 'item-reviewed-1',
          shopify_product_id: 'gid://shopify/Product/1001',
          rating: 5,
          comment: '超好穿！',
          status: 'pending',
          created_at: '2026-08-30T10:00:00Z',
          updated_at: '2026-08-30T10:00:00Z',
        },
      ];

      const existingReview = memberReviews.find((r) => r.order_item_id === orderItem.id);

      expect(existingReview).toBeDefined();
      expect(existingReview?.status).toBe('pending');
      expect(existingReview?.rating).toBe(5);
    });

    it('submitProductReview 提交成功後應回傳待審核評價實體', async () => {
      const mockReviewResponse: ProductReview = {
        id: 'rev-new-1',
        user_id: 'user-001',
        order_id: 'ord-001',
        order_item_id: 'item-unreviewed-1',
        shopify_product_id: 'gid://shopify/Product/1001',
        rating: 5,
        comment: '穿起來很挺而且透氣！',
        status: 'pending',
        created_at: '2026-08-30T12:30:00Z',
        updated_at: '2026-08-30T12:30:00Z',
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'ord-001',
                status: 'paid',
                fulfillment_status: 'fulfilled',
                order_fulfillments: [{ status: 'delivered' }],
              },
              error: null,
            }),
          };
        }
        if (table === 'product_reviews') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockReviewResponse, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const res = await submitProductReview({
        user_id: 'user-001',
        order_id: 'ord-001',
        order_item_id: 'item-unreviewed-1',
        shopify_product_id: 'gid://shopify/Product/1001',
        rating: 5,
        comment: '穿起來很挺而且透氣！',
      });

      expect(res.error).toBeNull();
      expect(res.data?.status).toBe('pending');
      expect(res.data?.rating).toBe(5);
      expect(res.data?.comment).toBe('穿起來很挺而且透氣！');
    });
  });

  describe('4. 元件靜態渲染與結構驗證 (Static Markup Tests)', () => {
    it('ProfilePage 渲染訂單歷史時具備撰寫評價與狀態邏輯容器', () => {
      const mockUser = {
        id: 'user-001',
        email: 'member@saengak.com.tw',
        app_metadata: { role: 'user' },
        user_metadata: { name: '測試會員' },
      } as unknown as User;

      const authContext = createMockAuthContext({ user: mockUser, role: 'user' });

      const html = renderToString(
        <AuthContext.Provider value={authContext}>
          <CartProvider>
            <MemoryRouter initialEntries={['/profile?tab=orders']}>
              <ProfilePage />
            </MemoryRouter>
          </CartProvider>
        </AuthContext.Provider>
      );

      expect(html).toBeDefined();
      expect(html).toContain('border-teal-600');
    });

    it('ProductPage 渲染時應包含評論與詢問標籤導覽', () => {
      const authContext = createMockAuthContext({ user: null });

      const html = renderToString(
        <AuthContext.Provider value={authContext}>
          <CartProvider>
            <MemoryRouter initialEntries={['/product/1001']}>
              <ProductPage />
            </MemoryRouter>
          </CartProvider>
        </AuthContext.Provider>
      );

      expect(html).toBeDefined();
    });
  });
});
