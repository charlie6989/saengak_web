/**
 * SAENGAK 商品評價 (Reviews) 與商品問答 (Q&A) 型別定義
 * 規範來源: docs/00_DECISION_LOG.md
 */

/** 評價審查與呈現狀態 */
export type ReviewStatus = 'pending' | 'published' | 'hidden' | 'deleted';

/** 問答審查與呈現狀態 */
export type QuestionStatus = 'pending' | 'answered' | 'hidden' | 'deleted';

/**
 * 商品評價資料實體
 */
export interface ProductReview {
  /** 評價唯一識別碼 (UUID) */
  id: string;
  /** 評論者會員識別碼 (UUID) */
  user_id: string;
  /** 關聯訂單編號 (UUID) */
  order_id: string;
  /** 關聯訂單品項編號 (UUID, 一對一約束) */
  order_item_id: string;
  /** Shopify 商品 ID (如: gid://shopify/Product/... 或純數字 ID) */
  shopify_product_id: string;
  /** 星級評分 (1 ~ 5) */
  rating: number;
  /** 評價評論文字 */
  comment: string;
  /** 評價狀態 */
  status: ReviewStatus;
  /** 建立時間 (ISO-8601) */
  created_at: string;
  /** 更新時間 (ISO-8601) */
  updated_at: string;

  /** 前台展示用脫敏或關聯會員名稱 (可選) */
  user_name?: string;
  /** 會員信箱 (後台管理或脫敏用, 可選) */
  user_email?: string;
  /** 匿名化展示名稱 (如: c***k 或 會員 a***@...) */
  display_name?: string;
}

/**
 * 商品問答資料實體
 */
export interface ProductQuestion {
  /** 問答唯一識別碼 (UUID) */
  id: string;
  /** 發問者會員識別碼 (UUID) */
  user_id: string;
  /** Shopify 商品 ID (如: gid://shopify/Product/... 或純數字 ID) */
  shopify_product_id: string;
  /** 顧客提問內容 */
  question: string;
  /** 管理員回覆內容 */
  answer?: string | null;
  /** 回覆管理員識別碼 (UUID) */
  answered_by?: string | null;
  /** 回覆時間 (ISO-8601) */
  answered_at?: string | null;
  /** 問答狀態 */
  status: QuestionStatus;
  /** 是否公開展示於前台 */
  is_public: boolean;
  /** 建立時間 (ISO-8601) */
  created_at: string;
  /** 更新時間 (ISO-8601) */
  updated_at: string;

  /** 前台展示用脫敏或關聯會員名稱 (可選) */
  user_name?: string;
  /** 會員信箱 (後台管理或脫敏用, 可選) */
  user_email?: string;
  /** 匿名化展示名稱 */
  display_name?: string;
}

/**
 * 顧客提交商品評價之 Payload
 */
export interface SubmitReviewPayload {
  /** 會員識別碼 */
  user_id: string;
  /** 訂單識別碼 */
  order_id: string;
  /** 訂單品項識別碼 */
  order_item_id: string;
  /** Shopify 商品 ID */
  shopify_product_id: string;
  /** 星級評分 (1 ~ 5) */
  rating: number;
  /** 評價內容 */
  comment: string;
}

/**
 * 顧客提交商品問答之 Payload
 */
export interface SubmitQuestionPayload {
  /** 發問者會員識別碼 */
  user_id: string;
  /** Shopify 商品 ID */
  shopify_product_id: string;
  /** 提問內容 */
  question: string;
  /** 是否預設公開 (預設為 true) */
  is_public?: boolean;
}

/**
 * 管理員回覆商品問答之 Payload
 */
export interface AdminReplyQuestionPayload {
  /** 問答識別碼 */
  question_id: string;
  /** 管理員回覆文字 */
  answer: string;
  /** 回覆管理員識別碼 */
  admin_user_id: string;
  /** 是否公開於前台 (預設為 true) */
  is_public?: boolean;
  /** 更新之狀態 (預設為 'answered') */
  status?: QuestionStatus;
}
