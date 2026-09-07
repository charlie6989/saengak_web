import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { captureExceptionSafe } from '../../lib/sentry';
import {
  getTaiwanCities,
  getTaiwanDistricts,
  getTaiwanZipCode,
  formatTaiwanAddress,
  parseTaiwanAddress,
} from '../../lib/taiwanDistricts';

export interface SocialAccount {
  id?: string;
  provider: string;
  provider_user_id?: string;
  provider_email?: string;
  provider_name?: string;
  avatar_url?: string;
  last_sign_in_at?: string;
  created_at?: string;
}

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
  social_accounts?: SocialAccount[];
}

export const AdminMembers: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 台灣地址二級連動選單狀態 (管理員編輯)
  const [adminAddrCity, setAdminAddrCity] = useState('');
  const [adminAddrDistrict, setAdminAddrDistrict] = useState('');
  const [adminAddrZip, setAdminAddrZip] = useState('');
  const [adminAddrStreet, setAdminAddrStreet] = useState('');

  const handleOpenEditModal = (profile: UserProfile) => {
    setEditingProfile({ ...profile });
    const parsed = parseTaiwanAddress(profile.address || '');
    setAdminAddrCity(parsed.city);
    setAdminAddrDistrict(parsed.district);
    setAdminAddrZip(parsed.zip);
    setAdminAddrStreet(parsed.street);
  };

  const handleAdminCityChange = (newCity: string) => {
    setAdminAddrCity(newCity);
    setAdminAddrDistrict('');
    setAdminAddrZip('');
    const formatted = formatTaiwanAddress({
      city: newCity,
      district: '',
      zip: '',
      street: adminAddrStreet,
    });
    setEditingProfile((prev) => prev ? { ...prev, address: formatted } : null);
  };

  const handleAdminDistrictChange = (newDistrict: string) => {
    setAdminAddrDistrict(newDistrict);
    const newZip = getTaiwanZipCode(adminAddrCity, newDistrict);
    setAdminAddrZip(newZip);
    const formatted = formatTaiwanAddress({
      city: adminAddrCity,
      district: newDistrict,
      zip: newZip,
      street: adminAddrStreet,
    });
    setEditingProfile((prev) => prev ? { ...prev, address: formatted } : null);
  };

  const handleAdminStreetChange = (newStreet: string) => {
    setAdminAddrStreet(newStreet);
    const formatted = formatTaiwanAddress({
      city: adminAddrCity,
      district: adminAddrDistrict,
      zip: adminAddrZip,
      street: newStreet,
    });
    setEditingProfile((prev) => prev ? { ...prev, address: formatted } : null);
  };

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. 優先嘗試呼叫專屬 API 端點 (包含伺服器端 auth.users 與 profiles 整合查詢)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const apiRes = await fetch('/api/admin-users', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.success && Array.isArray(json.members)) {
              setProfiles(json.members);
              return;
            }
          }
        }
      } catch (apiErr) {
        console.warn('API /api/admin-users 呼叫失敗，嘗試資料庫 RPC / 表直查:', apiErr);
      }

      // 2. 次選嘗試呼叫 RPC 取得資料
      const { data, error: rpcError } = await supabase.rpc('get_admin_profiles');

      if (!rpcError && data) {
        const membersOnly = (data || []).filter((p: UserProfile) => p.role !== 'admin');
        setProfiles(membersOnly);
        return;
      }

      // 3. 降級直查 profiles 表 + user_social_accounts 表
      const [{ data: tableData, error: tableError }, { data: socialData }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_social_accounts').select('*'),
      ]);

      if (tableError) {
        throw tableError;
      }

      const socialMap = new Map<string, any[]>();
      (socialData || []).forEach((s: any) => {
        const list = socialMap.get(s.user_id) || [];
        list.push(s);
        socialMap.set(s.user_id, list);
      });

      const KNOWN_ADMINS = ['worktester2019@gmail.com', 'charlie.liu6989@gmail.com', 'charlie.liu0809@gmail.com'];
      const membersOnly = (tableData || []).map((p: any) => ({
        ...p,
        role: (p.id === user?.id || p.email === user?.email || KNOWN_ADMINS.includes(p.email?.toLowerCase())) ? 'admin' : (p.role || 'member'),
        social_accounts: socialMap.get(p.id) || [],
      })).filter((p: any) => p.role !== 'admin');

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

    if (!editingProfile.name || !editingProfile.name.trim()) {
      alert('請填寫會員姓名（姓名為必填項目）');
      return;
    }

    setIsUpdating(true);
    try {
      const formatted = formatTaiwanAddress({
        city: adminAddrCity,
        district: adminAddrDistrict,
        zip: adminAddrZip,
        street: adminAddrStreet,
      });
      const finalAddress = formatted || (editingProfile.address?.trim() || null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: editingProfile.name || '',
          phone: editingProfile.phone || null,
          address: finalAddress,
          gender: editingProfile.gender || null,
          birth_date: editingProfile.birth_date ? editingProfile.birth_date : null,
          instagram: editingProfile.instagram || null,
          updated_at: new Date().toISOString(),
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
                <th className="px-6 py-4 font-semibold">登入管道 / 社群綁定</th>
                <th className="px-6 py-4 font-semibold">聯絡電話 / 地址</th>
                <th className="px-6 py-4 font-semibold text-center">註冊加入日期</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading && profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#225B4F]" />
                    <p className="mt-2 text-xs">載入會員名冊中...</p>
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-xs">
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        {profile.social_accounts && profile.social_accounts.length > 0 ? (
                          profile.social_accounts.map((sa, idx) => {
                            const isFB = sa.provider?.toLowerCase() === 'facebook';
                            const isGoogle = sa.provider?.toLowerCase() === 'google';
                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                  isFB
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : isGoogle
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-gray-50 text-gray-700 border border-gray-200'
                                }`}
                                title={`綁定信箱: ${sa.provider_email || '-'}\n社群姓名: ${sa.provider_name || '-'}`}
                              >
                                {isFB && <span>🔵 FB</span>}
                                {isGoogle && <span>🔴 Google</span>}
                                {!isFB && !isGoogle && <span>🔗 {sa.provider}</span>}
                                {sa.provider_name ? `: ${sa.provider_name}` : ''}
                              </span>
                            );
                          })
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                            ✉️ Email/密碼
                          </span>
                        )}
                      </div>
                    </td>
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
                        onClick={() => handleOpenEditModal(profile)}
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
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="請填寫會員姓名（必填）"
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

              {/* 台灣地址人性化二級連動 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-800">
                    聯絡地址 (台灣標準格式)
                  </label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    自動對齊 Shopify 規格
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">縣市</label>
                    <select
                      value={adminAddrCity}
                      onChange={(e) => handleAdminCityChange(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-[#225B4F] focus:outline-none"
                    >
                      <option value="">選擇縣市</option>
                      {getTaiwanCities().map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">鄉鎮市區</label>
                    <select
                      value={adminAddrDistrict}
                      onChange={(e) => handleAdminDistrictChange(e.target.value)}
                      disabled={!adminAddrCity}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-[#225B4F] focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">{adminAddrCity ? '選擇區域' : '先選縣市'}</option>
                      {getTaiwanDistricts(adminAddrCity).map((dist) => (
                        <option key={dist.name} value={dist.name}>
                          {dist.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">郵遞區號</label>
                    <input
                      type="text"
                      value={adminAddrZip}
                      readOnly
                      placeholder="區號"
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-2 py-1.5 text-xs font-mono text-center text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                    詳細地址 (街道 / 巷弄 / 門牌 / 樓層)
                  </label>
                  <input
                    type="text"
                    placeholder="例：忠孝東路四段100號5樓"
                    value={adminAddrStreet}
                    onChange={(e) => handleAdminStreetChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-[#225B4F] focus:outline-none"
                  />
                </div>
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

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">已綁定社群帳號</label>
                {editingProfile.social_accounts && editingProfile.social_accounts.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {editingProfile.social_accounts.map((sa, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          {sa.avatar_url ? (
                            <img src={sa.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-white">
                              {sa.provider[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-gray-800">
                              {sa.provider === 'facebook' ? 'Facebook' : sa.provider === 'google' ? 'Google' : sa.provider}
                            </span>
                            {sa.provider_name && <span className="ml-1 text-gray-600">({sa.provider_name})</span>}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-500">
                          <div>{sa.provider_email || '-'}</div>
                          {sa.last_sign_in_at && (
                            <div className="text-[10px] text-gray-400">
                              上次登入: {new Date(sa.last_sign_in_at).toLocaleDateString('zh-TW')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400">
                    尚未綁定第三方社群帳號 (使用信箱密碼註冊)
                  </div>
                )}
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
