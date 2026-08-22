import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { AuthContext, type AuthContextType } from '../src/contexts/AuthContext';
import { AdminGuard } from '../src/router/AdminGuard';
import { AdminLayout } from '../src/pages/admin/AdminLayout';

/**
 * 驗證 src/router/config.tsx 實際採用的巢狀路由結構：
 *   /admin (AdminGuard) -> AdminLayout -> 子路由
 *
 * 這裡不直接 import src/router/config.tsx，因為該檔案內所有頁面皆以
 * React.lazy() 載入，renderToString 無法同步處理 Suspense/lazy chunk；
 * 改以相同的巢狀路由「寫法」在測試內重建，驗證 AdminGuard／AdminLayout
 * 在真正掛上路由樹（而非各自單獨 render）時仍會正確擋權限、正確顯示外殼。
 *
 * 這正是舊版 admin-portal.test.tsx 從未涵蓋的缺口：AdminGuard／AdminLayout
 * 過去雖有元件層級測試，但從未真正被 src/router/config.tsx 引用，
 * 導致 /admin/* 路由長期未受保護且無法存取，測試卻始終全數通過。
 */
describe('SAENGAK /admin 路由接線驗證 (Admin Route Wiring)', () => {
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

  const renderAdminRouteTree = (authContext: AuthContextType, initialPath: string) =>
    renderToString(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/admin" element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="dashboard" element={<div data-testid="admin-page">後台機密內容</div>} />
                <Route path="products" element={<div data-testid="admin-page">商品機密內容</div>} />
              </Route>
            </Route>
            <Route path="/login" element={<div>登入頁面</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

  it('未登入使用者存取 /admin/dashboard 時，路由層 AdminGuard 阻擋機密內容', () => {
    const html = renderAdminRouteTree(
      createMockAuthContext({ user: null, isAdmin: false }),
      '/admin/dashboard'
    );

    expect(html).not.toContain('後台機密內容');
  });

  it('非 admin 使用者存取 /admin/products 時，路由層渲染 403 而非商品內容', () => {
    const mockUser = {
      id: 'customer_1',
      email: 'customer@saengak.com.tw',
      app_metadata: { role: 'user' },
      user_metadata: {},
    } as unknown as User;

    const html = renderAdminRouteTree(
      createMockAuthContext({ user: mockUser, role: 'user', isAdmin: false }),
      '/admin/products'
    );

    expect(html).toContain('403 Forbidden');
    expect(html).not.toContain('商品機密內容');
  });

  it('已授權 admin 存取 /admin/dashboard 時，AdminLayout 外殼與目標子路由內容皆正確渲染', () => {
    const mockAdmin = {
      id: 'admin_1',
      email: 'admin@saengak.com.tw',
      app_metadata: { role: 'admin' },
      user_metadata: {},
    } as unknown as User;

    const html = renderAdminRouteTree(
      createMockAuthContext({ user: mockAdmin, role: 'admin', isAdmin: true }),
      '/admin/dashboard'
    );

    // AdminLayout 導覽外殼確實包住了子路由內容
    expect(html).toContain('管理後台系統');
    expect(html).toContain('📊 營運主控台');
    // 巢狀子路由的目標頁面內容
    expect(html).toContain('後台機密內容');
    expect(html).not.toContain('403 Forbidden');
    expect(html).not.toContain('商品機密內容');
  });
});
