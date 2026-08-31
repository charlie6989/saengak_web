import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import { AuthContext } from '../src/contexts/AuthContext';
import { AdminReviews } from '../src/pages/admin/AdminReviews';
import { AdminQA } from '../src/pages/admin/AdminQA';
import { SiteSettings } from '../src/pages/admin/SiteSettings';
import { AdminLayout } from '../src/pages/admin/AdminLayout';
import * as reviewsQaLib from '../src/lib/reviews-qa';

const mockAdminContext = {
  user: {
    id: 'admin_test_123',
    email: 'admin@saengak.com.tw',
    app_metadata: { role: 'admin' },
  } as unknown as User,
  session: null as unknown as Session,
  role: 'admin',
  isAdmin: true,
  isLoading: false,
  isConfigured: true,
  signOut: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn().mockResolvedValue(undefined),
};

describe('SAENGAK 後台商品評價審核、問答客服與營運設定測試 (Admin Reviews, QA & Settings)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. AdminReviews 商品評價審核頁面渲染與規格測試', () => {
    it('應正確渲染頁面標題、說明與統計卡片', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <AdminReviews />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // 標題與說明
      expect(html).toContain('⭐ 商品評價審核與管理');
      expect(html).toContain('顧客回饋');
      expect(html).toContain('審核前台消費者對商品的星級評價與使用心得');

      // 統計指標
      expect(html).toContain('總評價數');
      expect(html).toContain('待審核數');
      expect(html).toContain('已發布數');
      expect(html).toContain('已隱藏數');

      // 篩選頁籤
      expect(html).toContain('全部');
      expect(html).toContain('待審核');
      expect(html).toContain('已發布');
      expect(html).toContain('已隱藏');

      // 搜尋與重新載入按鈕
      expect(html).toContain('搜尋評價、商品 ID、訂單 ID 或會員...');
      expect(html).toMatch(/同步中|重新載入評價/);
    });

    it('應正確渲染評價表格欄位標題與空狀態/載入狀態', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <AdminReviews />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('評分與內容');
      expect(html).toContain('Shopify 商品 ID');
      expect(html).toContain('關聯訂單與品項');
      expect(html).toContain('提交會員 / 時間');
      expect(html).toContain('當前狀態');
      expect(html).toContain('操作');
    });
  });

  describe('2. AdminQA 商品問答與客服管理頁面渲染與規格測試', () => {
    it('應正確渲染問答管理標題、客服標籤與統計卡片', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <AdminQA />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // 標題與說明
      expect(html).toContain('💬 商品問答與客服管理');
      expect(html).toContain('線上客服');
      expect(html).toContain('解答顧客對商品材質、尺寸及穿著的疑問');

      // 統計指標
      expect(html).toContain('總提問數');
      expect(html).toContain('待回覆數');
      expect(html).toContain('已回覆數');
      expect(html).toContain('已隱藏數');

      // 篩選頁籤
      expect(html).toContain('全部');
      expect(html).toContain('待回覆');
      expect(html).toContain('已回覆');
      expect(html).toContain('已隱藏');

      // 搜尋與重新整理
      expect(html).toContain('搜尋提問、回答、商品 ID 或會員...');
      expect(html).toMatch(/同步中|重新載入問答/);
    });

    it('應正確渲染問答表格欄位標題', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <AdminQA />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('顧客提問與官方回覆');
      expect(html).toContain('Shopify 商品 ID');
      expect(html).toContain('提問會員 / 時間');
      expect(html).toContain('當前狀態');
      expect(html).toContain('操作');
    });
  });

  describe('3. SiteSettings 全域營運參數表單擴充驗證', () => {
    it('應包含「💬 商品問答與即時客服設定」區塊及對應輸入欄位', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <SiteSettings />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // 問答與客服設定區塊
      expect(html).toContain('💬 商品問答與即時客服設定');
      expect(html).toContain('開放前台商品問答表單 (allow_product_qa)');
      expect(html).toContain('官方 LINE 客服連結 (line_oa_url)');
      expect(html).toContain('https://line.me/R/ti/p/@saengak');
    });
  });

  describe('4. AdminLayout 導覽選單完整性驗證', () => {
    it('導覽列應包含評價審核與問答客服項目連結', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter initialEntries={['/admin/dashboard']}>
            <AdminLayout>
              <div>後台主頁</div>
            </AdminLayout>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('⭐ 商品評價審核');
      expect(html).toContain('💬 商品問答客服');
      expect(html).toContain('href="/admin/reviews"');
      expect(html).toContain('href="/admin/qa"');
    });
  });

  describe('5. reviews-qa 函式庫管理員 API 整合驗證', () => {
    it('驗證 updateReviewStatus, deleteReview, replyProductQuestion, updateQuestionStatus, deleteQuestion 匯出完整', () => {
      expect(typeof reviewsQaLib.fetchAdminReviews).toBe('function');
      expect(typeof reviewsQaLib.updateReviewStatus).toBe('function');
      expect(typeof reviewsQaLib.deleteReview).toBe('function');
      expect(typeof reviewsQaLib.fetchAdminQuestions).toBe('function');
      expect(typeof reviewsQaLib.replyProductQuestion).toBe('function');
      expect(typeof reviewsQaLib.updateQuestionStatus).toBe('function');
      expect(typeof reviewsQaLib.deleteQuestion).toBe('function');
    });
  });
});
