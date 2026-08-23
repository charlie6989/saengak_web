import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();

  const navItems = [
    { to: '/admin/dashboard', label: '📊 營運主控台', end: true },
    { to: '/admin/products', label: '📦 商品庫存看板' },
    { to: '/admin/orders', label: '📑 訂單與交易對帳' },
    { to: '/admin/members', label: '👤 前台會員管理' },
    { to: '/admin/admins', label: '🛡️ 後台管理員管理' },
    { to: '/admin/settings', label: '⚙️ 全域營運參數' },
    { to: '/admin/modules', label: '🏗️ 網站模塊狀態' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-gray-900">
      {/* 頂部管理員導覽列 */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <Link to="/admin/dashboard" className="flex items-center space-x-2">
              <span className="rounded-md bg-[#225B4F] px-2.5 py-1 text-sm font-black tracking-widest text-white">
                SAENGAK
              </span>
              <span className="text-sm font-bold text-gray-800">管理後台系統</span>
            </Link>
            <span className="hidden rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 md:inline-block">
              第 1 階段：商品展示與上線
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium text-gray-500">已授權管理員</div>
              <div className="text-xs font-semibold text-gray-800">{user?.email || 'Admin'}</div>
            </div>
            <Link
              to="/"
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              🌐 前台商城
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
            >
              安全登出
            </button>
          </div>
        </div>

        {/* 次級導覽分頁頁籤 */}
        <div className="border-t border-gray-100 bg-gray-50/70 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#225B4F] text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-200/70 hover:text-gray-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      {/* 主內容區塊 */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default AdminLayout;
