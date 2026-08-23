import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import {
  AuthContext,
  extractUserRole,
  isUserAdmin,
  type AuthContextType,
} from '../src/contexts/AuthContext';
import { AdminGuard } from '../src/router/AdminGuard';
import { Dashboard } from '../src/pages/admin/Dashboard';
import { ProductList } from '../src/pages/admin/ProductList';
import { OrderList } from '../src/pages/admin/OrderList';
import { SiteSettings } from '../src/pages/admin/SiteSettings';

describe('SAENGAK 後台管理系統與權限隔離測試 (Admin Portal & Role Isolation)', () => {
  describe('1. 角色權限判定與資安不變量 (Auth Role & Invariants)', () => {
    it('未登入 (user 為 null) 時，角色為 null 且非管理員', () => {
      expect(extractUserRole(null)).toBeNull();
      expect(isUserAdmin(null)).toBe(false);
    });

    it('一般使用者 (app_metadata.role = "user") 角色正確提取且非管理員', () => {
      const regularUser = {
        id: 'user_123',
        app_metadata: { role: 'user' },
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-08-20T00:00:00Z',
      } as unknown as User;

      expect(extractUserRole(regularUser)).toBe('user');
      expect(isUserAdmin(regularUser)).toBe(false);
    });

    it('管理員 (app_metadata.role = "admin") 成功識別為管理員權限', () => {
      const adminUser = {
        id: 'admin_456',
        app_metadata: { role: 'admin' },
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-08-20T00:00:00Z',
      } as unknown as User;

      expect(extractUserRole(adminUser)).toBe('admin');
      expect(isUserAdmin(adminUser)).toBe(true);
    });

    it('【重大資安防禦】使用者偽造 user_metadata.role = "admin" 時，嚴格拒絕管理員權限 (防提權漏洞)', () => {
      // 攻擊場景：惡意用戶透過客戶端直接修改可寫的 user_metadata
      const maliciousUser = {
        id: 'attacker_789',
        app_metadata: { provider: 'email' }, // app_metadata 無 admin 角色
        user_metadata: { role: 'admin', is_superadmin: true }, // 偽造欄位
        aud: 'authenticated',
        created_at: '2026-08-20T00:00:00Z',
      } as unknown as User;

      expect(extractUserRole(maliciousUser)).toBeNull();
      expect(isUserAdmin(maliciousUser)).toBe(false);
    });

    it('缺少 app_metadata 物件之異常用戶物件安全處理不發生崩潰', () => {
      const brokenUser = {
        id: 'broken_000',
        user_metadata: {},
      } as unknown as User;

      expect(extractUserRole(brokenUser)).toBeNull();
      expect(isUserAdmin(brokenUser)).toBe(false);
    });
  });

  describe('2. AdminGuard 路由守衛隔離驗證 (Route Protection)', () => {
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

    it('當處於 isLoading 載入中狀態時，渲染 Loading 提示，不洩漏受保護內容', () => {
      const mockContext = createMockAuthContext({
        isLoading: true,
        user: null,
        isAdmin: false,
      });

      const html = renderToString(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/admin/dashboard']}>
            <AdminGuard>
              <div data-testid="protected-secret">管理員機密頁面內容</div>
            </AdminGuard>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('正在驗證管理員安全憑證');
      expect(html).not.toContain('管理員機密頁面內容');
    });

    it('未登入用戶 (user 為 null) 存取受保護路由時，重定向至 /login', () => {
      const mockContext = createMockAuthContext({
        isLoading: false,
        user: null,
        isAdmin: false,
      });

      const html = renderToString(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/admin/dashboard']}>
            <Routes>
              <Route
                path="/admin/dashboard"
                element={
                  <AdminGuard>
                    <div data-testid="protected-secret">管理員機密頁面內容</div>
                  </AdminGuard>
                }
              />
              <Route path="/login" element={<div>登入頁面</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Navigate to /login occurs, protected content is omitted
      expect(html).not.toContain('管理員機密頁面內容');
    });

    it('一般登入用戶 (非 admin) 存取受保護路由時，渲染 403 Forbidden 提示並阻擋存取', () => {
      const mockUser = {
        id: 'customer_111',
        email: 'customer@saengak.com.tw',
        app_metadata: { role: 'user' },
        user_metadata: {},
      } as unknown as User;

      const mockContext = createMockAuthContext({
        isLoading: false,
        user: mockUser,
        role: 'user',
        isAdmin: false,
      });

      const html = renderToString(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/admin/dashboard']}>
            <AdminGuard>
              <div data-testid="protected-secret">管理員機密頁面內容</div>
            </AdminGuard>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('403 Forbidden');
      expect(html).toContain('存取權限不足');
      expect(html).toContain('app_metadata.role = &#x27;admin&#x27;');
      expect(html).toContain('customer@saengak.com.tw');
      expect(html).not.toContain('管理員機密頁面內容');
    });

    it('已授權之管理員 (app_metadata.role = "admin") 存取受保護路由時，成功渲染目標內容', () => {
      const mockAdmin = {
        id: 'admin_999',
        email: 'admin@saengak.com.tw',
        app_metadata: { role: 'admin' },
        user_metadata: {},
      } as unknown as User;

      const mockContext = createMockAuthContext({
        isLoading: false,
        user: mockAdmin,
        role: 'admin',
        isAdmin: true,
      });

      const html = renderToString(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/admin/dashboard']}>
            <AdminGuard>
              <div data-testid="protected-secret">管理員機密頁面內容</div>
            </AdminGuard>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('管理員機密頁面內容');
      expect(html).not.toContain('403 Forbidden');
      expect(html).not.toContain('正在驗證管理員安全憑證');
    });
  });

  describe('3. 後台管理介面結構與架構規範驗證 (Admin Pages Compliance)', () => {
    const mockAdminContext = {
      user: {
        id: 'admin_1',
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

    it('Dashboard 頁面呈現架構權威源與連線狀態', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('營運指標與系統主控台');
      expect(html).toContain('SiteGiant ERP');
      expect(html).toContain('Shopify Storefront');
      expect(html).toContain('tmqzkagkrzhioftvwbqo');
      expect(html).toContain('Shopify Checkout');
      expect(html).not.toContain('Phase 2 待建');
    });

    it('ProductList 頁面包含唯讀看板宣告與防止 ERP 寫入衝突說明', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <ProductList />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('Shopify Storefront 商品與庫存唯讀看板');
      expect(html).toContain('SiteGiant ERP');
      expect(html).toContain('寫入衝突防護');
    });

    it('OrderList 頁面呈現 Shopify 訂單與光貿發票狀態權威規範，不再宣稱已廢棄的交易狀態機', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <OrderList />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('訂單與發票狀態管理');
      expect(html).toContain('Shopify Checkout');
      expect(html).toContain('光貿電子發票採 Outbox 模式派送');
      expect(html).toContain('總訂單數');
      expect(html).toContain('發票已開立');
      expect(html).toContain('發票等待回讀 (Outbox)');
      expect(html).toContain('搜尋訂單編號或 Shopify GID');
      expect(html).not.toContain('Idempotency Key');
      expect(html).not.toContain('transaction_logs');
    });

    it('SiteSettings 頁面呈現 Shopify Checkout 現況、真實運費設定，不再宣稱已失效的 CheckoutReleaseEnabled', () => {
      const html = renderToString(
        <AuthContext.Provider value={mockAdminContext}>
          <MemoryRouter>
            <SiteSettings />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(html).toContain('全域營運參數與安全設定');
      expect(html).toContain('Shopify Checkout');
      expect(html).toContain('app_metadata.role = &#x27;admin&#x27;');
      expect(html).toContain('全館免運門檻');
      expect(html).not.toContain('CheckoutReleaseEnabled');
    });
  });
});
