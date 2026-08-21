import React, { useState } from 'react';
import { siteContent } from '../../content/site';

interface OperationalSettings {
  freeShippingThreshold: number;
  defaultShippingFee: number;
  lowStockThreshold: number;
  maintenanceMode: boolean;
  checkoutReleaseEnabled: boolean;
  sandboxMode: boolean; // 測試沙盒模式與防誤出貨保護
  testAccessGateEnabled: boolean;
  contactEmail: string;
  supportPhone: string;
}

export const SiteSettings: React.FC = () => {
  const [settings, setSettings] = useState<OperationalSettings>({
    freeShippingThreshold: 1000,
    defaultShippingFee: 80,
    lowStockThreshold: 5,
    maintenanceMode: false,
    checkoutReleaseEnabled: true, // 測試階段開放
    sandboxMode: true, // 預設開啟防誤出貨保護
    testAccessGateEnabled: true, // Preview 部署測試閘門啟用
    contactEmail: 'service@saengak.com.tw',
    supportPhone: '尚待營運確認',
  });

  const [savedMessage, setSavedMessage] = useState<string>('');

  const handleChange = (field: keyof OperationalSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMessage('營運參數已儲存至管理快取（正式生產環境需透過後端 API 寫入驗證）');
    setTimeout(() => {
      setSavedMessage('');
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">全域營運參數與安全設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理全站運費門檻、低庫存預警、第 2 階段結帳釋出開關與資安不變量配置。
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
              1. <strong>預設封閉 (Fail-Closed)</strong>：<code>checkoutReleaseEnabled</code> 必須精確設為 <code>true</code> 方可開放結帳，未設定前一律拒絕交易。<br />
              2. <strong>後端強制驗證</strong>：敏感參數之變更必須經由 Vercel / Supabase 後端進行身份與 <code>app_metadata.role = 'admin'</code> 簽名校驗，前端開關僅作為狀態展示與請求送出門戶。
            </p>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          ✓ {savedMessage}
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

        {/* 2. 階段發布與安全開關 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
            🔒 階段功能釋出與測試閘門
          </h2>
          <div className="mt-4 space-y-4">
            {/* 測試沙盒模式與防誤出貨開關 */}
            <div className="flex items-center justify-between rounded-lg border border-teal-200 p-4 bg-teal-50/60">
              <div>
                <div className="text-xs font-bold text-teal-950 flex items-center gap-2">
                  <span>🧪 測試沙盒模式與防誤出貨開關 (Commerce Sandbox Mode)</span>
                  {settings.sandboxMode ? (
                    <span className="rounded bg-teal-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      防誤出貨保護中 🛡️
                    </span>
                  ) : (
                    <span className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      正式模式 (會真實派單)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-teal-800 mt-1">
                  {settings.sandboxMode
                    ? '已啟用：建立的訂單自動附加「TEST_ORDER, DO_NOT_SHIP」防護標籤，收件人註明測試，絕不觸發實體物流出貨。'
                    : '已關閉：訂單將作為正式商業訂單建立並正常通知物流商。'}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sandboxMode}
                  onChange={(e) => handleChange('sandboxMode', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-700"></div>
              </label>
            </div>

            {/* 結帳開關 */}
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4 bg-gray-50/50">
              <div>
                <div className="text-xs font-bold text-gray-900">
                  第 2 階段自建結帳交易開關 (CheckoutReleaseEnabled)
                </div>
                <div className="text-[11px] text-gray-500">
                  自建 React Checkout + TapPay 授權扣款開關。
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.checkoutReleaseEnabled}
                  onChange={(e) => handleChange('checkoutReleaseEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#225B4F]"></div>
              </label>
            </div>

            {/* 測試存取閘門 */}
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
          </div>
        </div>

        {/* 3. 品牌法定主檔常數對照 */}
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
        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            className="rounded-lg bg-[#225B4F] px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1b483f] transition-colors cursor-pointer"
          >
            儲存營運參數
          </button>
        </div>
      </form>
    </div>
  );
};

export default SiteSettings;
