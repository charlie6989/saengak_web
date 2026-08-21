import React from 'react';
import { Link } from 'react-router-dom';

const modules = [
  ['商品目錄', '展示可用', 'Storefront Function 已到達專用 Shopify；Online Store 尚未解鎖'],
  ['搜尋排序', '可用', '繁中同義詞與加權相關性已啟用'],
  ['編輯精選', '可用', '尚未宣稱為真實五星評分'],
  ['購物車／金流', '待解鎖', 'TapPay 商家設定完成；結帳已改接新商店，待 Shopify Online Store、真實 Variant 與三案例 sandbox'],
  ['會員中心', '技術基線完成', '正式註冊／登入／重設表單、Auth URLs、publishable key 與跨帳號 RLS 11/11 已驗證'],
  ['訂單查詢', '串接中', 'App secret、五個訂單 topics 已完成；新增退款 topic、折讓與真實 sandbox delivery 待部署驗收'],
  ['物流／發票', '程式整合中', '已選 ShipAny＋Amego；待 App 綁定、後端部署、方案與 sandbox 實單'],
  ['內容中心', '靜態可用', 'Shopify Blog 即時資料待接'],
  ['法務內容', '已建立', '正式發布前仍需法務確認'],
];

export default function AdminModulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#225B4F]">全站 9 大核心技術模組狀態</h1>
          <p className="mt-1 text-sm text-gray-600">
            這裡只呈現可驗證的功能狀態，不顯示示範營收、假訂單或假會員數。正式營運後台在 Supabase Auth 以 <code>app_metadata.role = 'admin'</code> 嚴格驗證。
          </p>
        </div>
        <Link
          to="/admin/dashboard"
          className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#225B4F] shadow-xs hover:bg-gray-50"
        >
          ← 返回營運主控台
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        {modules.map(([name, status, note]) => (
          <div
            key={name}
            className="grid gap-2 border-b border-gray-100 p-5 last:border-0 md:grid-cols-[180px_140px_1fr] text-xs hover:bg-gray-50/50 transition-colors"
          >
            <strong className="text-gray-900 text-sm">{name}</strong>
            <span className="font-semibold text-[#225B4F]">{status}</span>
            <span className="text-gray-600 leading-5">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
