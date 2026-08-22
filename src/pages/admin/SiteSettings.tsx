import React, { useState, useEffect, useCallback } from 'react';
import { siteContent } from '../../content/site';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { captureExceptionSafe } from '../../lib/sentry';
import { useAuth } from '../../contexts/AuthContext';

interface OperationalSettings {
  freeShippingThreshold: number;
  defaultShippingFee: number;
  lowStockThreshold: number;
  maintenanceMode: boolean;
  contactEmail: string;
  supportPhone: string;
}

const DEFAULT_SETTINGS: OperationalSettings = {
  freeShippingThreshold: 1500,
  defaultShippingFee: 80,
  lowStockThreshold: 5,
  maintenanceMode: false,
  contactEmail: 'service@saengak.com.tw',
  supportPhone: '尚待營運確認',
};

// 對應 public.site_settings 表之 key（見 supabase/migrations/20260820000002、20260822000001）
const SETTINGS_KEY_MAP: Record<keyof OperationalSettings, string> = {
  freeShippingThreshold: 'free_shipping_threshold',
  defaultShippingFee: 'default_shipping_fee',
  lowStockThreshold: 'low_stock_threshold',
  maintenanceMode: 'maintenance_mode',
  contactEmail: 'contact_email',
  supportPhone: 'support_phone',
};

const SETTINGS_FIELDS = Object.keys(SETTINGS_KEY_MAP) as Array<keyof OperationalSettings>;

export const SiteSettings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OperationalSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', Object.values(SETTINGS_KEY_MAP));

      if (error) {
        captureExceptionSafe(error, { source: 'AdminSiteSettings.fetchSettings' });
      } else if (data) {
        setSettings((prev) => {
          const next = { ...prev };
          for (const row of data) {
            const field = SETTINGS_FIELDS.find((f) => SETTINGS_KEY_MAP[f] === row.key);
            if (field) {
              next[field] = row.value;
            }
          }
          return next;
        });
      }
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminSiteSettings.fetchSettings.catch' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (field: keyof OperationalSettings, value: OperationalSettings[keyof OperationalSettings]) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isSupabaseConfigured) {
      setErrorMessage('尚未連接 Supabase（本機開發環境缺少金鑰），無法寫入營運參數。');
      return;
    }

    setIsSaving(true);
    try {
      const results = await Promise.all(
        SETTINGS_FIELDS.map((field) =>
          supabase
            .from('site_settings')
            .update({ value: settings[field], updated_by: user?.id })
            .eq('key', SETTINGS_KEY_MAP[field])
        )
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        captureExceptionSafe(failed.error, { source: 'AdminSiteSettings.handleSubmit' });
        setErrorMessage('儲存失敗：請確認目前帳號的 app_metadata.role 為 admin，且 RLS 政策允許寫入。');
        return;
      }

      setSavedMessage('全域營運參數已成功寫入 site_settings 資料表。');
      setTimeout(() => setSavedMessage(''), 4000);
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminSiteSettings.handleSubmit.catch' });
      setErrorMessage('儲存失敗，請稍後再試一次。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">全域營運參數與安全設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理全站運費門檻、低庫存預警、客服聯絡資訊與維護模式；資料直接讀寫 Supabase <code>site_settings</code>。
        </p>
      </div>

      {/* 資安防護準則提示 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 leading-5">
        <div className="flex items-start space-x-3">
          <span className="text-lg">⚙️</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-amber-950">
              安全不變量與防護邊界 (MAIN_SPECIFICATION.md §5.2)：
            </p>
            <p>
              1. <strong>結帳交易已由 Shopify Checkout 全權處理</strong>（TapPay 以 Shopify Payment App 身分於 Shopify 頁面內扣款），本頁不再管理結帳釋出開關，僅管理免運門檻、庫存警示、客服資訊與全站維護模式等營運參數。<br />
              2. <strong>後端強制驗證</strong>：本頁所有寫入皆直接送往 Supabase，由 RLS 政策要求 <code>app_metadata.role = 'admin'</code> 之 JWT 方可成功寫入，前端表單本身不具備任何繞過能力。
            </p>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          ✓ {savedMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          ✕ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 金物流與運費參數 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              🚚 物流與運費規則設定
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  全館免運門檻 (TWD)
                </label>
                <div className="mt-1 relative rounded-md shadow-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-xs">
                    NT$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={settings.freeShippingThreshold}
                    onChange={(e) => handleChange('freeShippingThreshold', Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:border-[#225B4F] focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  當購物車金額達到此門檻時，自動折抵常規超商/宅配運費。
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  基本預設運費 (TWD)
                </label>
                <div className="mt-1 relative rounded-md shadow-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-xs">
                    NT$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={settings.defaultShippingFee}
                    onChange={(e) => handleChange('defaultShippingFee', Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:border-[#225B4F] focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  未達免運門檻時套用之標準物流處理費（配合 ShipAny 超商取貨）。
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  庫存低量預警閥值
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.lowStockThreshold}
                  onChange={(e) => handleChange('lowStockThreshold', Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:border-[#225B4F] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  當單一 Variant 可售庫存低於此數值時，於商品看板標註警示。
                </p>
              </div>
            </div>
          </div>

          {/* 2. 客服聯絡資訊 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              📞 客服聯絡資訊
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700">客服聯絡信箱</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:border-[#225B4F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">客服聯絡電話</label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => handleChange('supportPhone', e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:border-[#225B4F] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. 全站防護與維護模式 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              🔒 全站防護與維護模式
            </h2>
            <div className="mt-4 space-y-4">
              {/* 全站維護模式 */}
              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4 bg-gray-50/50">
                <div>
                  <div className="text-xs font-bold text-gray-900">全站緊急維護模式 (Maintenance Mode)</div>
                  <div className="text-[11px] text-gray-500">
                    開啟後前台將暫停所有展示與 API 存取，僅允許授權 Admin 登入查驗。
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* 測試存取閘門（唯讀狀態徽章：由 middleware.js 控制，非本表可寫欄位） */}
              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4 bg-gray-50/50">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    預覽部署測試閘門 (Preview Test Access Gate)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    由 <code>middleware.js</code> 執行的存取通行碼保護；正式公開切換時需依 LAUNCH_CHECKLIST 移除。
                  </div>
                </div>
                <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  已啟用保護
                </span>
              </div>
            </div>
          </div>

          {/* 4. 品牌法定主檔常數對照 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              🏢 品牌與法定註冊主檔 (唯讀常數 - src/content/site.ts)
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50/40">
                <span className="text-gray-400">品牌名稱：</span>
                <span className="font-semibold text-gray-900 ml-1">{siteContent.brandName}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50/40">
                <span className="text-gray-400">公司登記名稱：</span>
                <span className="font-semibold text-gray-900 ml-1">{siteContent.legalName}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50/40">
                <span className="text-gray-400">統一編號：</span>
                <span className="font-semibold text-gray-900 ml-1">{siteContent.taxId}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50/40">
                <span className="text-gray-400">登記地址：</span>
                <span className="font-semibold text-gray-900 ml-1">{siteContent.registeredAddress}</span>
              </div>
            </div>
          </div>

          {/* 儲存按鈕 */}
          <div className="flex items-center justify-end space-x-3">
            {isLoading && (
              <span className="text-[11px] text-gray-400">正在同步 site_settings 最新數值...</span>
            )}
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="rounded-lg bg-[#225B4F] px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1b483f] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? '儲存中...' : '儲存營運參數'}
            </button>
          </div>
        </form>
    </div>
  );
};

export default SiteSettings;
