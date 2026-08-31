import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAdminReviews,
  updateReviewStatus,
  deleteReview,
} from '../../lib/reviews-qa';
import type { ProductReview, ReviewStatus } from '../../types/reviews-qa';
import { captureExceptionSafe } from '../../lib/sentry';

type FilterTab = 'all' | 'pending' | 'published' | 'hidden';

export const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      // 讀取全部評價以精準計算各狀態統計卡片數值
      const data = await fetchAdminReviews('all');
      setReviews(data);
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminReviews.loadReviews' });
      setStatusMessage({ type: 'error', text: '讀取商品評價清單失敗，請稍後重試' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // 統計各狀態數量
  const stats = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter((r) => r.status === 'pending').length;
    const published = reviews.filter((r) => r.status === 'published').length;
    const hidden = reviews.filter((r) => r.status === 'hidden').length;
    return { total, pending, published, hidden };
  }, [reviews]);

  // 根據頁籤與搜尋字詞過濾
  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      // 頁籤過濾
      if (activeTab !== 'all' && review.status !== activeTab) {
        return false;
      }
      // 關鍵字搜尋
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchComment = review.comment?.toLowerCase().includes(term);
        const matchProduct = review.shopify_product_id?.toLowerCase().includes(term);
        const matchOrder = review.order_id?.toLowerCase().includes(term);
        const matchUser =
          review.user_name?.toLowerCase().includes(term) ||
          review.user_email?.toLowerCase().includes(term) ||
          review.display_name?.toLowerCase().includes(term) ||
          review.user_id?.toLowerCase().includes(term);
        return matchComment || matchProduct || matchOrder || matchUser;
      }
      return true;
    });
  }, [reviews, activeTab, searchTerm]);

  // 執行狀態變更 (發布/隱藏)
  const handleStatusChange = async (reviewId: string, nextStatus: ReviewStatus) => {
    setActionLoadingId(reviewId);
    setStatusMessage(null);
    try {
      const { success, error } = await updateReviewStatus(reviewId, nextStatus);
      if (error || !success) {
        throw error || new Error('更新評價狀態失敗');
      }

      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: nextStatus } : r))
      );
      setStatusMessage({
        type: 'success',
        text: nextStatus === 'published' ? '評價已成功審核發布！' : '評價已設定為隱藏。',
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminReviews.handleStatusChange', reviewId, nextStatus });
      setStatusMessage({ type: 'error', text: err?.message || '狀態更新失敗' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 執行刪除
  const handleDelete = async (reviewId: string) => {
    if (!window.confirm('確定要永久刪除此則評價嗎？此動作無法復原。')) {
      return;
    }

    setActionLoadingId(reviewId);
    setStatusMessage(null);
    try {
      const { success, error } = await deleteReview(reviewId);
      if (error || !success) {
        throw error || new Error('刪除評價失敗');
      }

      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setStatusMessage({ type: 'success', text: '評價已成功刪除。' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminReviews.handleDelete', reviewId });
      setStatusMessage({ type: 'error', text: err?.message || '刪除評價失敗' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 渲染星級圖示
  const renderStars = (rating: number) => {
    const validRating = Math.max(1, Math.min(5, Math.round(rating)));
    return (
      <div className="flex items-center space-x-1" title={`${validRating} / 5 顆星`}>
        <div className="flex text-amber-400 text-sm">
          {'★'.repeat(validRating)}
          <span className="text-gray-300">{'★'.repeat(5 - validRating)}</span>
        </div>
        <span className="text-xs font-bold text-gray-700 ml-1">{validRating}.0</span>
      </div>
    );
  };

  // 狀態徽章
  const renderStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            ● 已發布
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            ⏳ 待審核
          </span>
        );
      case 'hidden':
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 border border-gray-200">
            🔒 已隱藏
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與重新載入 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">⭐ 商品評價審核與管理</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              顧客回饋
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            審核前台消費者對商品的星級評價與使用心得，維護優質真實的品牌社群回饋。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadReviews}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '同步中...' : '🔄 重新載入評價'}
          </button>
        </div>
      </div>

      {/* 狀態訊息提示 */}
      {statusMessage && (
        <div
          className={`rounded-xl border p-4 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? '✓ ' : '✕ '}
          {statusMessage.text}
        </div>
      )}

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500">總評價數</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="text-xs font-medium text-amber-700">待審核數</div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{stats.pending}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="text-xs font-medium text-emerald-700">已發布數</div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{stats.published}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500">已隱藏數</div>
          <div className="mt-1 text-2xl font-bold text-gray-700">{stats.hidden}</div>
        </div>
      </div>

      {/* 篩選頁籤與搜尋列 */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* 頁籤 */}
        <div className="flex space-x-1 border-b border-gray-100 pb-2 sm:border-0 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#225B4F] text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            全部 ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white'
                : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            待審核 ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('published')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'published'
                ? 'bg-emerald-700 text-white'
                : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            已發布 ({stats.published})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hidden')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'hidden'
                ? 'bg-gray-700 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            已隱藏 ({stats.hidden})
          </button>
        </div>

        {/* 搜尋框 */}
        <div className="relative w-full max-w-xs">
          <input
            type="text"
            placeholder="搜尋評價、商品 ID、訂單 ID 或會員..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs focus:border-[#225B4F] focus:outline-none"
          />
        </div>
      </div>

      {/* 評價列表 Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-4 font-semibold">評分與內容</th>
                <th className="px-6 py-4 font-semibold">Shopify 商品 ID</th>
                <th className="px-6 py-4 font-semibold">關聯訂單與品項</th>
                <th className="px-6 py-4 font-semibold">提交會員 / 時間</th>
                <th className="px-6 py-4 font-semibold text-center">當前狀態</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading && reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#225B4F]" />
                    <p className="mt-2 text-xs">載入評價資料中...</p>
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-xs">
                    {searchTerm ? '查無符合條件的商品評價' : '目前尚無評價記錄'}
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => {
                  const isBusy = actionLoadingId === review.id;
                  return (
                    <tr key={review.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* 評分與內容 */}
                      <td className="px-6 py-4 max-w-sm">
                        <div className="space-y-1">
                          {renderStars(review.rating)}
                          <p className="text-xs font-medium text-gray-900 line-clamp-3 whitespace-pre-wrap">
                            {review.comment}
                          </p>
                        </div>
                      </td>

                      {/* Shopify 商品 ID */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block">
                          {review.shopify_product_id}
                        </div>
                      </td>

                      {/* 關聯訂單 ID */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-mono text-gray-800">
                          訂單: {review.order_id ? `${review.order_id.slice(0, 8)}...` : '-'}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                          品項: {review.order_item_id ? `${review.order_item_id.slice(0, 8)}...` : '-'}
                        </div>
                      </td>

                      {/* 提交會員 / 時間 */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-gray-900">
                          {review.user_name || review.display_name || 'SAENGAK 會員'}
                        </div>
                        {review.user_email && (
                          <div className="text-[11px] text-gray-500">{review.user_email}</div>
                        )}
                        <div className="text-[11px] text-gray-400 mt-1">
                          {review.created_at
                            ? new Date(review.created_at).toLocaleString('zh-TW', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </div>
                      </td>

                      {/* 當前狀態 Badge */}
                      <td className="px-6 py-4 text-center">
                        {renderStatusBadge(review.status)}
                      </td>

                      {/* 操作功能 */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {review.status !== 'published' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(review.id, 'published')}
                              disabled={isBusy}
                              className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
                              title="通過審核並於前台發布"
                            >
                              {isBusy ? '處理中' : '✓ 通過審核'}
                            </button>
                          )}

                          {review.status !== 'hidden' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(review.id, 'hidden')}
                              disabled={isBusy}
                              className="rounded bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                              title="隱藏此則評價"
                            >
                              {isBusy ? '處理中' : '🔒 隱藏'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(review.id)}
                            disabled={isBusy}
                            className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="刪除此則評價"
                          >
                            🗑️ 刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReviews;
