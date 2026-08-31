import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  maskUserIdentifier,
  isOrderDelivered,
  fetchPublishedReviews,
  fetchProductQA,
  fetchMemberReviews,
  submitProductReview,
  submitProductQuestion,
  fetchAdminReviews,
  updateReviewStatus,
  deleteReview,
  fetchAdminQuestions,
  replyProductQuestion,
  updateQuestionStatus,
  deleteQuestion,
} from '../src/lib/reviews-qa';
import { supabase } from '../src/lib/supabase';

vi.mock('../src/lib/supabase', () => {
  const mockFrom = vi.fn();
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: mockFrom,
    },
  };
});

describe('reviews-qa 資料存取與脫敏模組測試', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('maskUserIdentifier 匿名化脫敏', () => {
    it('應正確處理 Email 脫敏', () => {
      expect(maskUserIdentifier('alice@saengak.com')).toBe('會員 a***@saengak.com');
      expect(maskUserIdentifier('charlie.chen@example.com')).toBe('會員 c***@example.com');
    });

    it('應正確處理 UUID 識別碼脫敏', () => {
      expect(maskUserIdentifier('d3b07384-d113-46d8-b2a8-a3f2d8a0b0d3')).toBe('會員 #d3b0');
    });

    it('應正確處理中文姓名脫敏', () => {
      expect(maskUserIdentifier('陳')).toBe('會員 陳*');
      expect(maskUserIdentifier('王明')).toBe('會員 王*');
      expect(maskUserIdentifier('王小明')).toBe('會員 王*明');
      expect(maskUserIdentifier('歐陽小明')).toBe('會員 歐**明');
    });

    it('應正確處理空值與無效字串', () => {
      expect(maskUserIdentifier(null)).toBe('SAENGAK 會員');
      expect(maskUserIdentifier(undefined)).toBe('SAENGAK 會員');
      expect(maskUserIdentifier('')).toBe('SAENGAK 會員');
      expect(maskUserIdentifier('   ')).toBe('SAENGAK 會員');
    });
  });

  describe('2. isOrderDelivered 物流送達與取件狀態判定', () => {
    it('若 fulfillments 陣列包含 delivered, picked_up, success 應判定為已送達', () => {
      expect(isOrderDelivered({ fulfillments: [{ status: 'delivered' }] })).toBe(true);
      expect(isOrderDelivered({ fulfillments: [{ status: 'picked_up' }] })).toBe(true);
      expect(isOrderDelivered({ fulfillments: [{ status: 'success' }] })).toBe(true);
      expect(isOrderDelivered({ fulfillments: [{ status: 'Delivered' }] })).toBe(true);
    });

    it('若 fulfillment_status 為 fulfilled 應判定為已送達', () => {
      expect(isOrderDelivered({ fulfillment_status: 'fulfilled' })).toBe(true);
      expect(isOrderDelivered({ fulfillment_status: 'FULFILLED' })).toBe(true);
    });

    it('若尚未送達 (unfulfilled, in_transit, pending, null) 應判定為未送達', () => {
      expect(isOrderDelivered(null)).toBe(false);
      expect(isOrderDelivered(undefined)).toBe(false);
      expect(isOrderDelivered({ fulfillment_status: 'unfulfilled', fulfillments: [] })).toBe(false);
      expect(isOrderDelivered({ fulfillments: [{ status: 'in_transit' }] })).toBe(false);
      expect(isOrderDelivered({ fulfillments: [{ status: 'open' }] })).toBe(false);
    });
  });

  describe('3. 評價與問答資料存取函式', () => {
    it('fetchPublishedReviews 應過濾 published 狀態並帶有 display_name', async () => {
      const mockReviews = [
        {
          id: 'rev-1',
          user_id: 'd3b07384-d113-46d8-b2a8-a3f2d8a0b0d3',
          order_id: 'ord-1',
          order_item_id: 'item-1',
          shopify_product_id: 'prod-123',
          rating: 5,
          comment: '商品材質非常舒適！',
          status: 'published',
          created_at: '2026-08-30T10:00:00Z',
          updated_at: '2026-08-30T10:00:00Z',
          user_name: '王小明',
        },
      ];

      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReviews, error: null }),
      };
      (supabase.from as any).mockReturnValue(queryBuilder);

      const result = await fetchPublishedReviews('prod-123');
      expect(supabase.from).toHaveBeenCalledWith('product_reviews');
      expect(queryBuilder.eq).toHaveBeenCalledWith('shopify_product_id', 'prod-123');
      expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'published');
      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('會員 王*明');
    });

    it('fetchProductQA 應過濾 answered 與 is_public = true 之問答', async () => {
      const mockQA = [
        {
          id: 'q-1',
          user_id: 'd3b07384-d113-46d8-b2a8-a3f2d8a0b0d3',
          shopify_product_id: 'prod-123',
          question: '請問尺寸版型偏大還是偏小？',
          answer: '此款為標準韓系合身版型，建議選購平常常穿尺碼。',
          answered_by: 'admin-1',
          answered_at: '2026-08-30T11:00:00Z',
          status: 'answered',
          is_public: true,
          created_at: '2026-08-30T09:00:00Z',
          updated_at: '2026-08-30T11:00:00Z',
        },
      ];

      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockQA, error: null }),
      };
      (supabase.from as any).mockReturnValue(queryBuilder);

      const result = await fetchProductQA('prod-123');
      expect(supabase.from).toHaveBeenCalledWith('product_questions');
      expect(queryBuilder.eq).toHaveBeenCalledWith('shopify_product_id', 'prod-123');
      expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'answered');
      expect(queryBuilder.eq).toHaveBeenCalledWith('is_public', true);
      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('會員 #d3b0');
    });

    it('submitProductReview 應驗證評分範圍與評論內容', async () => {
      const invalidRatingRes = await submitProductReview({
        user_id: 'u-1',
        order_id: 'o-1',
        order_item_id: 'i-1',
        shopify_product_id: 'p-1',
        rating: 6,
        comment: '太棒了',
      });
      expect(invalidRatingRes.error?.message).toContain('評分必須介於 1 到 5');

      const emptyCommentRes = await submitProductReview({
        user_id: 'u-1',
        order_id: 'o-1',
        order_item_id: 'i-1',
        shopify_product_id: 'p-1',
        rating: 5,
        comment: '',
      });
      expect(emptyCommentRes.error?.message).toContain('請填寫評價內容');
    });

    it('submitProductReview 應拒絕未確認送達/取件之訂單', async () => {
      const orderQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'o-unfulfilled', status: 'paid', fulfillment_status: 'unfulfilled', order_fulfillments: [] },
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValue(orderQueryBuilder);

      const res = await submitProductReview({
        user_id: 'u-1',
        order_id: 'o-unfulfilled',
        order_item_id: 'i-1',
        shopify_product_id: 'p-1',
        rating: 5,
        comment: '衣服超棒！',
      });

      expect(res.error).not.toBeNull();
      expect(res.error?.message).toContain('尚未確認送達或超商取件完成');
      expect(res.data).toBeNull();
    });

    it('submitProductReview 於訂單已送達時成功寫入並回傳資料', async () => {
      const mockCreated = {
        id: 'rev-2',
        user_id: 'u-1',
        order_id: 'o-1',
        order_item_id: 'i-1',
        shopify_product_id: 'p-1',
        rating: 5,
        comment: '品質超棒！',
        status: 'pending',
        created_at: '2026-08-30T12:00:00Z',
        updated_at: '2026-08-30T12:00:00Z',
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'o-1',
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
            single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const res = await submitProductReview({
        user_id: 'u-1',
        order_id: 'o-1',
        order_item_id: 'i-1',
        shopify_product_id: 'p-1',
        rating: 5,
        comment: '品質超棒！',
      });

      expect(res.error).toBeNull();
      expect(res.data?.id).toBe('rev-2');
    });

    it('replyProductQuestion 應正確更新問答狀態與回覆', async () => {
      const queryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as any).mockReturnValue(queryBuilder);

      const res = await replyProductQuestion({
        question_id: 'q-1',
        answer: '我們已補貨中！',
        admin_user_id: 'admin-1',
        is_public: true,
      });

      expect(res.success).toBe(true);
      expect(queryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          answer: '我們已補貨中！',
          answered_by: 'admin-1',
          status: 'answered',
          is_public: true,
        })
      );
    });

    it('updateReviewStatus 與 deleteReview 應正確操作', async () => {
      const queryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as any).mockReturnValue(queryBuilder);

      const updateRes = await updateReviewStatus('rev-1', 'published');
      expect(updateRes.success).toBe(true);

      const delRes = await deleteReview('rev-1');
      expect(delRes.success).toBe(true);
    });
  });
});
