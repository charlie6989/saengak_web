import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAdminQuestions,
  replyProductQuestion,
  updateQuestionStatus,
  deleteQuestion,
} from '../../lib/reviews-qa';
import type { ProductQuestion, QuestionStatus } from '../../types/reviews-qa';
import { useAuth } from '../../contexts/AuthContext';
import { captureExceptionSafe } from '../../lib/sentry';

type FilterTab = 'all' | 'pending' | 'answered' | 'hidden';

export const AdminQA: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 回覆 Modal 狀態
  const [replyingQuestion, setReplyingQuestion] = useState<ProductQuestion | null>(null);
  const [replyAnswer, setReplyAnswer] = useState<string>('');
  const [replyIsPublic, setReplyIsPublic] = useState<boolean>(true);
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminQuestions('all');
      setQuestions(data);
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminQA.loadQuestions' });
      setStatusMessage({ type: 'error', text: '讀取商品問答清單失敗，請稍後重試' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // 統計各狀態數量
  const stats = useMemo(() => {
    const total = questions.length;
    const pending = questions.filter((q) => q.status === 'pending').length;
    const answered = questions.filter((q) => q.status === 'answered').length;
    const hidden = questions.filter((q) => q.status === 'hidden').length;
    return { total, pending, answered, hidden };
  }, [questions]);

  // 根據頁籤與搜尋字詞過濾
  const filteredQuestions = useMemo(() => {
    return questions.filter((item) => {
      // 頁籤過濾
      if (activeTab !== 'all' && item.status !== activeTab) {
        return false;
      }
      // 關鍵字搜尋
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchQuestion = item.question?.toLowerCase().includes(term);
        const matchAnswer = item.answer?.toLowerCase().includes(term);
        const matchProduct = item.shopify_product_id?.toLowerCase().includes(term);
        const matchUser =
          item.user_name?.toLowerCase().includes(term) ||
          item.user_email?.toLowerCase().includes(term) ||
          item.display_name?.toLowerCase().includes(term) ||
          item.user_id?.toLowerCase().includes(term);
        return matchQuestion || matchAnswer || matchProduct || matchUser;
      }
      return true;
    });
  }, [questions, activeTab, searchTerm]);

  // 開啟回覆對話框
  const handleOpenReplyModal = (question: ProductQuestion) => {
    setReplyingQuestion(question);
    setReplyAnswer(question.answer || '');
    setReplyIsPublic(question.is_public ?? true);
  };

  // 提交官方回覆
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingQuestion) return;

    if (!replyAnswer.trim()) {
      alert('請輸入回覆內容');
      return;
    }

    setIsSubmittingReply(true);
    setStatusMessage(null);
    try {
      const adminUserId = user?.id || 'saengak-admin';
      const { success, error } = await replyProductQuestion({
        question_id: replyingQuestion.id,
        answer: replyAnswer.trim(),
        admin_user_id: adminUserId,
        is_public: replyIsPublic,
        status: 'answered',
      });

      if (error || !success) {
        throw error || new Error('提交客服回覆失敗');
      }

      const nowIso = new Date().toISOString();
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === replyingQuestion.id
            ? {
                ...q,
                answer: replyAnswer.trim(),
                answered_by: adminUserId,
                answered_at: nowIso,
                status: 'answered',
                is_public: replyIsPublic,
              }
            : q
        )
      );

      setStatusMessage({ type: 'success', text: '客服回覆已成功送出並更新狀態！' });
      setTimeout(() => setStatusMessage(null), 3500);
      setReplyingQuestion(null);
    } catch (err: any) {
      captureExceptionSafe(err, {
        source: 'AdminQA.handleSubmitReply',
        questionId: replyingQuestion.id,
      });
      setStatusMessage({ type: 'error', text: err?.message || '回覆發布失敗' });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // 切換公開/隱藏狀態
  const handleToggleStatus = async (question: ProductQuestion) => {
    const nextStatus: QuestionStatus = question.status === 'hidden'
      ? (question.answer ? 'answered' : 'pending')
      : 'hidden';
    const nextIsPublic = nextStatus !== 'hidden';

    setActionLoadingId(question.id);
    setStatusMessage(null);
    try {
      const { success, error } = await updateQuestionStatus(
        question.id,
        nextStatus,
        nextIsPublic
      );

      if (error || !success) {
        throw error || new Error('更新問答狀態失敗');
      }

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === question.id
            ? { ...q, status: nextStatus, is_public: nextIsPublic }
            : q
        )
      );

      setStatusMessage({
        type: 'success',
        text: nextStatus === 'hidden' ? '問答已成功隱藏。' : '問答已重新設定為發布顯示。',
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminQA.handleToggleStatus', questionId: question.id });
      setStatusMessage({ type: 'error', text: err?.message || '狀態更新失敗' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 執行刪除
  const handleDelete = async (questionId: string) => {
    if (!window.confirm('確定要永久刪除此則問答嗎？此動作無法復原。')) {
      return;
    }

    setActionLoadingId(questionId);
    setStatusMessage(null);
    try {
      const { success, error } = await deleteQuestion(questionId);
      if (error || !success) {
        throw error || new Error('刪除問答失敗');
      }

      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setStatusMessage({ type: 'success', text: '問答已成功刪除。' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminQA.handleDelete', questionId });
      setStatusMessage({ type: 'error', text: err?.message || '刪除問答失敗' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 狀態徽章
  const renderStatusBadge = (status: QuestionStatus) => {
    switch (status) {
      case 'answered':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            ● 已回覆
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            ⏳ 待回覆
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
            <h1 className="text-2xl font-bold text-gray-900">💬 商品問答與客服管理</h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              線上客服
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            解答顧客對商品材質、尺寸及穿著的疑問，建立透明值得信賴的諮詢體驗。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadQuestions}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '同步中...' : '🔄 重新載入問答'}
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
          <div className="text-xs font-medium text-gray-500">總提問數</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="text-xs font-medium text-amber-700">待回覆數</div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{stats.pending}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="text-xs font-medium text-emerald-700">已回覆數</div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{stats.answered}</div>
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
            待回覆 ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('answered')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'answered'
                ? 'bg-emerald-700 text-white'
                : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            已回覆 ({stats.answered})
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
            placeholder="搜尋提問、回答、商品 ID 或會員..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs focus:border-[#225B4F] focus:outline-none"
          />
        </div>
      </div>

      {/* 問答列表 Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-4 font-semibold">顧客提問與官方回覆</th>
                <th className="px-6 py-4 font-semibold">Shopify 商品 ID</th>
                <th className="px-6 py-4 font-semibold">提問會員 / 時間</th>
                <th className="px-6 py-4 font-semibold text-center">當前狀態</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading && questions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#225B4F]" />
                    <p className="mt-2 text-xs">載入商品問答資料中...</p>
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-xs">
                    {searchTerm ? '查無符合條件的商品問答' : '目前尚無顧客問答記錄'}
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q) => {
                  const isBusy = actionLoadingId === q.id;
                  return (
                    <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* 顧客提問與官方回覆 */}
                      <td className="px-6 py-4 max-w-md">
                        <div className="space-y-2">
                          <div className="flex items-start space-x-2">
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 flex-shrink-0 mt-0.5">
                              問
                            </span>
                            <p className="text-xs font-semibold text-gray-900 whitespace-pre-wrap leading-relaxed">
                              {q.question}
                            </p>
                          </div>

                          {q.answer ? (
                            <div className="rounded-lg bg-emerald-50/70 p-3 border border-emerald-100 text-xs space-y-1">
                              <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-[11px]">
                                <span>💬 SAENGAK 官方客服回覆：</span>
                              </div>
                              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {q.answer}
                              </p>
                              {q.answered_at && (
                                <div className="text-[10px] text-gray-400 mt-1">
                                  回覆時間：
                                  {new Date(q.answered_at).toLocaleString('zh-TW', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-amber-700 bg-amber-50/50 px-2.5 py-1.5 rounded border border-amber-100 inline-block font-medium">
                              ⏳ 尚未回覆此提問
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Shopify 商品 ID */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block">
                          {q.shopify_product_id}
                        </div>
                      </td>

                      {/* 提問會員 / 時間 */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-gray-900">
                          {q.user_name || q.display_name || 'SAENGAK 會員'}
                        </div>
                        {q.user_email && (
                          <div className="text-[11px] text-gray-500">{q.user_email}</div>
                        )}
                        <div className="text-[11px] text-gray-400 mt-1">
                          {q.created_at
                            ? new Date(q.created_at).toLocaleString('zh-TW', {
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
                        <div className="space-y-1">
                          <div>{renderStatusBadge(q.status)}</div>
                          <div className="text-[10px] text-gray-400">
                            {q.is_public ? '🌐 前台公開' : '🔒 前台隱藏'}
                          </div>
                        </div>
                      </td>

                      {/* 操作功能 */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenReplyModal(q)}
                            className="rounded bg-[#225B4F] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1b483f] transition-colors cursor-pointer shadow-xs"
                          >
                            {q.answer ? '✏️ 修改回覆' : '💬 撰寫回覆'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(q)}
                            disabled={isBusy}
                            className="rounded bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title={q.status === 'hidden' ? '恢復為公開發布' : '隱藏此問答'}
                          >
                            {isBusy ? '處理中' : q.status === 'hidden' ? '👁️ 恢復發布' : '🔒 隱藏'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(q.id)}
                            disabled={isBusy}
                            className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="刪除此則問答"
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

      {/* 回覆 Modal */}
      {replyingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {replyingQuestion.answer ? '✏️ 編輯客服回覆' : '💬 撰寫官方回覆'}
              </h3>
              <button
                type="button"
                onClick={() => setReplyingQuestion(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 顧客提問內容回顧 */}
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-200 text-xs space-y-2">
              <div className="flex justify-between items-center text-gray-500">
                <span className="font-semibold text-gray-700">顧客提問：</span>
                <span className="font-mono text-[11px]">商品: {replyingQuestion.shopify_product_id}</span>
              </div>
              <p className="text-gray-900 font-medium whitespace-pre-wrap">
                {replyingQuestion.question}
              </p>
              <div className="text-[11px] text-gray-400">
                提問者：{replyingQuestion.user_name || replyingQuestion.display_name || 'SAENGAK 會員'}
              </div>
            </div>

            <form onSubmit={handleSubmitReply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  官方客服回覆內容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={replyAnswer}
                  onChange={(e) => setReplyAnswer(e.target.value)}
                  placeholder="請輸入專業、親切的客服回覆內容..."
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs focus:border-[#225B4F] focus:outline-none resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="replyIsPublicCheckbox"
                  checked={replyIsPublic}
                  onChange={(e) => setReplyIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#225B4F] focus:ring-[#225B4F]"
                />
                <label htmlFor="replyIsPublicCheckbox" className="text-xs text-gray-700 font-medium cursor-pointer">
                  在前台商品頁公開展示此問答回覆
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReplyingQuestion(null)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReply || !replyAnswer.trim()}
                  className="rounded-lg bg-[#225B4F] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b483f] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReply ? '發布中...' : '發布客服回覆'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQA;
