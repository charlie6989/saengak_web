import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { captureExceptionSafe } from '../../lib/sentry';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  birth_date?: string;
  gender?: string;
  instagram?: string;
  created_at: string;
  avatar?: string;
  role?: string;
}

export const AdminStaff: React.FC = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchAdmins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. 優先嘗試呼叫 RPC 取得包含 role 的資料
      const { data, error: rpcError } = await supabase.rpc('get_admin_profiles');

      if (rpcError) {
        // RPC 尚未在資料庫建立時，採用相容模式
        console.warn('RPC get_admin_profiles 未建立，降級讀取目前登入管理員資訊:', rpcError);

        const { data: tableData, error: tableError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (tableError) {
          throw tableError;
        }

        // 過濾出目前已授權之管理員
        const filtered = (tableData || [])
          .filter((p: any) => p.id === user?.id || p.email === user?.email || p.role === 'admin')
          .map((p: any) => ({
            ...p,
            role: 'admin',
          }));

        // 如果 profiles 中未找到當前登入者，以當前 session 建構
        if (filtered.length === 0 && user) {
          filtered.push({
            id: user.id,
            email: user.email || '',
            name: (user.user_metadata?.name as string) || '系統管理員',
            created_at: user.created_at,
            role: 'admin',
          });
        }

        setAdmins(filtered);
        return;
      }

      // 篩選出 role 為 admin 的使用者
      const adminList = (data || []).filter((u: AdminUser) => u.role === 'admin');
      setAdmins(adminList);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminStaff.fetchAdmins' });
      setError(err?.message || '讀取管理員名冊失敗');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const filteredAdmins = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return admins.filter((admin) => {
      return (
        term === '' ||
        admin.email?.toLowerCase().includes(term) ||
        admin.name?.toLowerCase().includes(term) ||
        admin.phone?.toLowerCase().includes(term)
      );
    });
  }, [admins, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 標題與操作區 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">🛡️ 後台系統管理員管理</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              最高權限存取控制
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            檢視與維護具備後台操作權限（<code>app_metadata.role = 'admin'</code>）的管理人員清單。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={fetchAdmins}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '同步中...' : '🔄 重新載入名冊'}
          </button>
        </div>
      </div>

      {/* 資安防護告示 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 leading-relaxed">
        <div className="flex items-start space-x-3">
          <span className="text-lg">🔒</span>
          <div>
            <span className="font-semibold text-sm text-blue-950 block mb-1">管理員身分認證安全不變量 (Security Invariant)：</span>
            <p>
              • <strong>不可偽造之權限中樞</strong>：管理員權限一律由 Supabase 伺服器端簽發之 JWT <code>app_metadata.role === 'admin'</code> 決定，嚴禁使用可被前端竄改的 <code>user_metadata</code>。<br />
              • <strong>跨權限存取隔離</strong>：一般前台會員無法讀取或變更管理員帳號；權限異動必須由持有專屬服務密鑰的後端管理者執行。
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* 搜尋工具列 */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 items-center space-x-3">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="搜尋管理員姓名、Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs focus:border-[#225B4F] focus:outline-none"
            />
          </div>
        </div>
        <div className="text-xs text-gray-500">
          共 {filteredAdmins.length} 位授權管理員
        </div>
      </div>

      {/* 管理員列表表格 */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-4 font-semibold">管理員人員</th>
                <th className="px-6 py-4 font-semibold">登入帳號 (Email)</th>
                <th className="px-6 py-4 font-semibold">權限身分</th>
                <th className="px-6 py-4 font-semibold text-center">授權加入時間</th>
                <th className="px-6 py-4 font-semibold text-right">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading && admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#225B4F]" />
                    <p className="mt-2 text-xs">載入管理員名冊中...</p>
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-xs">
                    沒有符合條件的管理人員
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const isCurrent = admin.email === user?.email || admin.id === user?.id;
                  return (
                    <tr key={admin.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#225B4F] text-white font-bold text-sm">
                            {admin.name?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center space-x-1.5">
                              <span>{admin.name || '管理員'}</span>
                              {isCurrent && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                  您目前登入
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">ID: {admin.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{admin.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-700/10">
                          👑 Super Admin
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-gray-600">
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString('zh-TW') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          ● 正常啟用中
                        </span>
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

export default AdminStaff;
