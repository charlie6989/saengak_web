/**
 * SAENGAK 商品評價 (Reviews) 與問答 (Q&A) 資料存取與商業邏輯函式庫
 * 遵循 docs/00_DECISION_LOG.md、繁體中文規範與 Sentry 安全脫敏標準
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { captureExceptionSafe, maskEmail, maskName } from './sentry';
import type {
  ProductReview,
  ProductQuestion,
  ReviewStatus,
  QuestionStatus,
  SubmitReviewPayload,
  SubmitQuestionPayload,
  AdminReplyQuestionPayload,
} from '../types/reviews-qa';

/**
 * 顧客名稱與身份標識匿名化脫敏函式
 * 適用於前台商品評價與問答列表之防窺保護
 *
 * 範例：
 * - Email: `charlie@saengak.com` -> `會員 c***@saengak.com`
 * - 姓名: `王小明` -> `王*明`, `Alice` -> `A***e`
 * - UUID: `d3b07384-d113-46d8-b2a8-a3f2d8a0b0d3` -> `會員 #d3b0`
 *
 * @param emailOrId 會員 Email、姓名或 UUID
 * @returns 脫敏後之友善稱呼
 */
export function maskUserIdentifier(emailOrId?: string | null): string {
  if (!emailOrId || typeof emailOrId !== 'string' || !emailOrId.trim()) {
    return 'SAENGAK 會員';
  }

  const trimmed = emailOrId.trim();

  // 1. 若為 Email 格式
  if (trimmed.includes('@')) {
    const masked = maskEmail(trimmed);
    return `會員 ${masked}`;
  }

  // 2. 若為 UUID 格式 (36 字元包含破折號)
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed);
  if (isUuid) {
    return `會員 #${trimmed.slice(0, 4)}`;
  }

  // 3. 若為純文字姓名/使用者暱稱
  if (trimmed.length <= 1) {
    return `會員 ${trimmed}*`;
  }
  if (trimmed.length === 2) {
    return `會員 ${trimmed[0]}*`;
  }

  return `會員 ${maskName(trimmed)}`;
}

/**
 * 檢查訂單是否已由物流系統確認送達或超商取件完成
 * 依據 /grill-me 決策：必須物流狀態為 delivered, picked_up, success 或 fulfillment_status 為 fulfilled
 *
 * @param order 包含 fulfillment_status 與 fulfillments 陣列之訂單物件
 * @returns 是否符合評價開啟條件
 */
export function isOrderDelivered(order?: {
  status?: string;
  fulfillment_status?: string | null;
  fulfillments?: Array<{ status?: string | null }> | null;
} | null): boolean {
  if (!order) return false;

  // 1. 若履約陣列中有任一筆狀態為 delivered, picked_up, success
  if (Array.isArray(order.fulfillments) && order.fulfillments.length > 0) {
    const hasDeliveredFulfillment = order.fulfillments.some((f) => {
      if (!f || !f.status) return false;
      const s = f.status.toLowerCase().trim();
      return s === 'delivered' || s === 'picked_up' || s === 'success';
    });
    if (hasDeliveredFulfillment) return true;
  }

  // 2. 若訂單履約主狀態為 fulfilled 且未被判定為其他在途中狀態
  if (order.fulfillment_status && order.fulfillment_status.toLowerCase().trim() === 'fulfilled') {
    return true;
  }

  return false;
}

/**
 * 取得指定商品之已發布評價列表 (前台公開讀取)
 *
 * @param shopifyProductId Shopify 商品 GID 或 ID
 * @returns 已發布之評價列表 (依建立時間由新到舊排序)
 */
export async function fetchPublishedReviews(shopifyProductId: string): Promise<ProductReview[]> {
  if (!shopifyProductId) return [];

  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('shopify_product_id', shopifyProductId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      captureExceptionSafe(error, {
        source: 'fetchPublishedReviews',
        shopifyProductId,
      });
      return [];
    }

    const reviews = (data || []) as ProductReview[];
    return reviews.map((rev) => ({
      ...rev,
      display_name: maskUserIdentifier(rev.user_name || rev.user_email || rev.user_id),
    }));
  } catch (err) {
    captureExceptionSafe(err, {
      source: 'fetchPublishedReviews.catch',
      shopifyProductId,
    });
    return [];
  }
}

/**
 * 取得指定商品之已回答且公開的問答列表 (前台公開讀取)
 *
 * @param shopifyProductId Shopify 商品 GID 或 ID
 * @returns 已回覆之問答列表 (依建立時間由新到舊排序)
 */
export async function fetchProductQA(shopifyProductId: string): Promise<ProductQuestion[]> {
  if (!shopifyProductId) return [];

  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('product_questions')
      .select('*')
      .eq('shopify_product_id', shopifyProductId)
      .eq('status', 'answered')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      captureExceptionSafe(error, {
        source: 'fetchProductQA',
        shopifyProductId,
      });
      return [];
    }

    const questions = (data || []) as ProductQuestion[];
    return questions.map((q) => ({
      ...q,
      display_name: maskUserIdentifier(q.user_name || q.user_email || q.user_id),
    }));
  } catch (err) {
    captureExceptionSafe(err, {
      source: 'fetchProductQA.catch',
      shopifyProductId,
    });
    return [];
  }
}

/**
 * 取得特定會員本人的所有商品評價 (會員中心讀取)
 *
 * @param userId 會員 UUID
 * @returns 該會員發布的所有評價 (包含審查中、已發布、已隱藏)
 */
export async function fetchMemberReviews(userId: string): Promise<ProductReview[]> {
  if (!userId) return [];

  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      captureExceptionSafe(error, {
        source: 'fetchMemberReviews',
        userId,
      });
      return [];
    }

    return (data || []) as ProductReview[];
  } catch (err) {
    captureExceptionSafe(err, {
      source: 'fetchMemberReviews.catch',
      userId,
    });
    return [];
  }
}

/**
 * 登入會員提交商品評價
 *
 * @param payload 評價資料內容
 * @returns 寫入結果或錯誤物件
 */
export async function submitProductReview(
  payload: SubmitReviewPayload
): Promise<{ data: ProductReview | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase 服務尚未設定，無法提交評價') };
  }

  // 前端商業規則基本驗證
  if (!payload.user_id || !payload.order_id || !payload.order_item_id || !payload.shopify_product_id) {
    return { data: null, error: new Error('缺少訂單或商品關聯資訊') };
  }

  const rating = Math.round(payload.rating);
  if (rating < 1 || rating > 5) {
    return { data: null, error: new Error('評分必須介於 1 到 5 顆星之間') };
  }

  if (!payload.comment || !payload.comment.trim()) {
    return { data: null, error: new Error('請填寫評價內容') };
  }

  try {
    // 雙重防禦：查詢該訂單是否已由物流系統回報送達/取件
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, status, fulfillment_status, order_fulfillments(status)')
      .eq('id', payload.order_id)
      .single();

    if (orderError || !orderData) {
      return { data: null, error: new Error('無法查驗該筆訂單的物流履約狀態') };
    }

    const fulfillments = (orderData as any).order_fulfillments || [];
    const isDelivered = isOrderDelivered({
      status: orderData.status,
      fulfillment_status: orderData.fulfillment_status,
      fulfillments,
    });

    if (!isDelivered) {
      return {
        data: null,
        error: new Error('商品尚未確認送達或超商取件完成，尚無法填寫評價'),
      };
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .insert({
        user_id: payload.user_id,
        order_id: payload.order_id,
        order_item_id: payload.order_item_id,
        shopify_product_id: payload.shopify_product_id,
        rating,
        comment: payload.comment.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      captureExceptionSafe(error, {
        source: 'submitProductReview',
        orderItemId: payload.order_item_id,
      });
      return { data: null, error: new Error(error.message || '評價提交失敗') };
    }

    return { data: data as ProductReview, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'submitProductReview.catch',
      orderItemId: payload.order_item_id,
    });
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 登入會員提交商品提問
 *
 * @param payload 提問內容
 * @returns 寫入結果或錯誤物件
 */
export async function submitProductQuestion(
  payload: SubmitQuestionPayload
): Promise<{ data: ProductQuestion | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase 服務尚未設定，無法提交提問') };
  }

  if (!payload.user_id || !payload.shopify_product_id) {
    return { data: null, error: new Error('缺少發問者或商品識別資訊') };
  }

  if (!payload.question || !payload.question.trim()) {
    return { data: null, error: new Error('請填寫提問內容') };
  }

  try {
    const { data, error } = await supabase
      .from('product_questions')
      .insert({
        user_id: payload.user_id,
        shopify_product_id: payload.shopify_product_id,
        question: payload.question.trim(),
        is_public: payload.is_public ?? true,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      captureExceptionSafe(error, {
        source: 'submitProductQuestion',
        shopifyProductId: payload.shopify_product_id,
      });
      return { data: null, error: new Error(error.message || '提問提交失敗') };
    }

    return { data: data as ProductQuestion, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'submitProductQuestion.catch',
      shopifyProductId: payload.shopify_product_id,
    });
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 後台管理員查詢全站評價列表
 *
 * @param filterStatus 狀態過濾條件 ('all' 或特定 ReviewStatus)
 * @returns 評價清單 (依建立時間由新到舊排序)
 */
export async function fetchAdminReviews(
  filterStatus?: ReviewStatus | 'all'
): Promise<ProductReview[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    let query = supabase.from('product_reviews').select('*').order('created_at', { ascending: false });

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      captureExceptionSafe(error, {
        source: 'fetchAdminReviews',
        filterStatus,
      });
      return [];
    }

    return (data || []) as ProductReview[];
  } catch (err) {
    captureExceptionSafe(err, {
      source: 'fetchAdminReviews.catch',
      filterStatus,
    });
    return [];
  }
}

/**
 * 後台管理員更新評價狀態 (發布/隱藏/刪除)
 *
 * @param reviewId 評價 ID
 * @param status 目標狀態
 * @returns 執行結果
 */
export async function updateReviewStatus(
  reviewId: string,
  status: ReviewStatus
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: new Error('Supabase 服務尚未設定') };
  }

  if (!reviewId) {
    return { success: false, error: new Error('未指定評價識別碼') };
  }

  try {
    const { error } = await supabase
      .from('product_reviews')
      .update({ status })
      .eq('id', reviewId);

    if (error) {
      captureExceptionSafe(error, {
        source: 'updateReviewStatus',
        reviewId,
        status,
      });
      return { success: false, error: new Error(error.message || '更新評價狀態失敗') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'updateReviewStatus.catch',
      reviewId,
      status,
    });
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 後台管理員永久刪除評價
 *
 * @param reviewId 評價 ID
 * @returns 執行結果
 */
export async function deleteReview(
  reviewId: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: new Error('Supabase 服務尚未設定') };
  }

  if (!reviewId) {
    return { success: false, error: new Error('未指定評價識別碼') };
  }

  try {
    const { error } = await supabase
      .from('product_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      captureExceptionSafe(error, {
        source: 'deleteReview',
        reviewId,
      });
      return { success: false, error: new Error(error.message || '刪除評價失敗') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'deleteReview.catch',
      reviewId,
    });
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 後台管理員查詢全站商品問答列表
 *
 * @param filterStatus 狀態過濾條件 ('all' 或特定 QuestionStatus)
 * @returns 問答清單 (依建立時間由新到舊排序)
 */
export async function fetchAdminQuestions(
  filterStatus?: QuestionStatus | 'all'
): Promise<ProductQuestion[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    let query = supabase.from('product_questions').select('*').order('created_at', { ascending: false });

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      captureExceptionSafe(error, {
        source: 'fetchAdminQuestions',
        filterStatus,
      });
      return [];
    }

    return (data || []) as ProductQuestion[];
  } catch (err) {
    captureExceptionSafe(err, {
      source: 'fetchAdminQuestions.catch',
      filterStatus,
    });
    return [];
  }
}

/**
 * 後台管理員回覆商品問答
 *
 * @param payload 回覆資料
 * @returns 執行結果
 */
export async function replyProductQuestion(
  payload: AdminReplyQuestionPayload
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: new Error('Supabase 服務尚未設定') };
  }

  if (!payload.question_id || !payload.answer || !payload.answer.trim()) {
    return { success: false, error: new Error('缺少問答識別碼或回覆內容') };
  }

  try {
    const { error } = await supabase
      .from('product_questions')
      .update({
        answer: payload.answer.trim(),
        answered_by: payload.admin_user_id || null,
        answered_at: new Date().toISOString(),
        status: payload.status ?? 'answered',
        is_public: payload.is_public ?? true,
      })
      .eq('id', payload.question_id);

    if (error) {
      captureExceptionSafe(error, {
        source: 'replyProductQuestion',
        questionId: payload.question_id,
      });
      return { success: false, error: new Error(error.message || '回覆問答失敗') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'replyProductQuestion.catch',
      questionId: payload.question_id,
    });
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 後台管理員更新問答狀態與前台公開設定
 *
 * @param questionId 問答 ID
 * @param status 目標狀態
 * @param isPublic 是否公開展示於前台 (可選)
 * @returns 執行結果
 */
export async function updateQuestionStatus(
  questionId: string,
  status: QuestionStatus,
  isPublic?: boolean
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: new Error('Supabase 服務尚未設定') };
  }

  if (!questionId) {
    return { success: false, error: new Error('未指定問答識別碼') };
  }

  try {
    const updates: Record<string, any> = { status };
    if (typeof isPublic === 'boolean') {
      updates.is_public = isPublic;
    }

    const { error } = await supabase
      .from('product_questions')
      .update(updates)
      .eq('id', questionId);

    if (error) {
      captureExceptionSafe(error, {
        source: 'updateQuestionStatus',
        questionId,
        status,
      });
      return { success: false, error: new Error(error.message || '更新問答狀態失敗') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'updateQuestionStatus.catch',
      questionId,
      status,
    });
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 後台管理員永久刪除問答
 *
 * @param questionId 問答 ID
 * @returns 執行結果
 */
export async function deleteQuestion(
  questionId: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: new Error('Supabase 服務尚未設定') };
  }

  if (!questionId) {
    return { success: false, error: new Error('未指定問答識別碼') };
  }

  try {
    const { error } = await supabase
      .from('product_questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      captureExceptionSafe(error, {
        source: 'deleteQuestion',
        questionId,
      });
      return { success: false, error: new Error(error.message || '刪除問答失敗') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, {
      source: 'deleteQuestion.catch',
      questionId,
    });
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
