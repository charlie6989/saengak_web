import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { captureExceptionSafe } from '../../lib/sentry';

interface UserProfile {
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

export const AdminMembers: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. 優先嘗試呼叫 RPC 取得資料
      const { data, error: rpcError } = await supabase.rpc('get_admin_profiles');

      if (rpcError) {
        // RPC 尚未部署時降級直查 profiles 表
        const { data: tableData, error: tableError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (tableError) {
          throw tableError;
        }

        // 排除管理員，只保留一般會員
        const membersOnly = (tableData || []).map((p: any) => ({
          ...p,
          role: (p.id === user?.id || p.email === user?.email) ? 'admin' : (p.role || 'member'),
        })).filter((p: any) => p.role !== 'admin');

        setProfiles(membersOnly);
        return;
      }

      // 透過 RPC 篩選非 admin 的一般會員
      const membersOnly = (data || []).filter((p: UserProfile) => p.role !== 'admin');
      setProfiles(membersOnly);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminMembers.fetchProfiles' });
      setError(err?.message || '讀取會員清單失敗');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    setIsUpdating(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: editingProfile.name,
          phone: editingProfile.phone,
          address: editingProfile.address,
          gender: editingProfile.gender,
          birth_date: editingProfile.birth_date,
          instagram: editingProfile.instagram,
        })
        .eq('id', editingProfile.id);

      if (updateError) throw updateError;

      // Update local state
      setProfiles((prev) =>
        prev.map((p) => p.id === editingProfile.id ? editingProfile : p)
      );

      setEditingProfile(null);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminMembers.updateProfile' });
      alert('更新失敗: ' + (err?.message || '未知錯誤'));
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return profiles.filter((profile) => {
      return (
        term === '' ||
        profile.email?.toLowerCase().includes(term) ||
        profile.name?.toLowerCase().includes(term) ||
        profile.phone?.toLowerCase().includes(term)
      );
    });
  }, [profiles, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 標題與操作列 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">👤 前台會員使用者管理</h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              顧客名冊
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            檢視與維護在前台商城註冊的一般消費者與顧客資料。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={fetchProfiles}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '同步中...' : '🔄 重新載入會員'}
          </button>
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
              placeholder="搜尋會員姓名、Email 或手機..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs focus:border-[#225B4F] focus:outline-none"
            />
          </div>
        </div>
        <div className="text-xs text-gray-500">
          共 {filteredProfiles.length} 位前台會員
        </div>
      </div>

      {/* 會員列表 */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-4 font-semibold">會員資訊</th>
                <th className="px-6 py-4 font-semibold">Email 帳號</th>
                <th className="px-6 py-4 font-semibold">聯絡電話 / 地址</th>
                <th className="px-6 py-4 font-semibold text-center">註冊加入日期</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading && profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#225B4F]" />
                    <p className="mt-2 text-xs">載入會員名冊中...</p>
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-xs">
                    目前暫無一般前台會員資料
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
                          {profile.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {profile.name || '未設定姓名'}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">ID: {profile.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">{profile.email}</td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-800">{profile.phone || '-'}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-xs" title={profile.address}>
                        {profile.address || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs text-gray-600">
                        {profile.created_at ? new Date(profile.created_at).toLocaleDateString('zh-TW') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setEditingProfile({ ...profile })}
                        className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer"
                      >
                        編輯資料
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 編輯 Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">編輯會員資料</h3>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Email (唯讀)</label>
                <input
                  type="text"
                  value={editingProfile.email}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">姓名</label>
                <input
                  type="text"
                  value={editingProfile.name || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#225B4F] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">手機號碼</label>
                <input
                  type="tel"
                  value={editingProfile.phone || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#225B4F] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">聯絡地址</label>
                <textarea
                  value={editingProfile.address || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, address: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#225B4F] focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">生日</label>
                  <input
                    type="date"
                    value={editingProfile.birth_date || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, birth_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#225B4F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">性別</label>
                  <select
                    value={editingProfile.gender || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, gender: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#225B4F] focus:outline-none"
                  >
                    <option value="">未設定</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Instagram 帳號</label>
                <input
                  type="text"
                  value={editingProfile.instagram || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, instagram: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#225B4F] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-lg bg-[#225B4F] px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? '儲存中...' : '儲存變更'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMembers;
