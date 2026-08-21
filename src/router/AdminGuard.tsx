import React from 'react';
import { Navigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdminGuardProps {
  children?: React.ReactNode;
}

/**
 * 後台管理員路由守衛組件 (AdminGuard)
 * 依據 docs/MAIN_SPECIFICATION.md §5.2 安全不變量：
 * 1. 未登入導向 /login
 * 2. 登入但非 admin 角色（嚴格檢查 user.app_metadata.role === 'admin'）阻擋並呈現 403 畫面
 * 3. 具備 admin 權限才可進入受保護路由
 */
export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const location = useLocation();

  // 1. 驗證載入中狀態
  if (isLoading) {
    return (
      <div
        data-testid="admin-guard-loading"
        className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-4"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#225B4F] border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-600">正在驗證管理員安全憑證...</p>
        </div>
      </div>
    );
  }

  // 2. 未登入：導向登入頁面並保留原本嘗試進入的路徑
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. 已登入但無 admin 角色：呈現 403 權限不足頁面
  if (!isAdmin) {
    return (
      <div
        data-testid="admin-guard-forbidden"
        className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-4 text-center"
      >
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
            403 Forbidden
          </span>

          <h2 className="mt-3 text-2xl font-bold text-gray-900">存取權限不足</h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            您目前的帳號（<code>{user.email || '未設定 Email'}</code>）未具備後台管理權限。
            系統嚴格限制僅有 <code>app_metadata.role = 'admin'</code> 之授權人員方可存取。
          </p>

          <div className="mt-6 flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#225B4F] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1b483f]"
            >
              返回商城首頁
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.href = '/login';
              }}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 cursor-pointer"
            >
              切換其他帳號
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. 驗證通過：渲染受保護頁面
  return children ? <>{children}</> : <Outlet />;
};

export default AdminGuard;
