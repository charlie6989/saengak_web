import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

const modules = [
  ['商品目錄', '展示可用', 'Storefront Function 已到達專用 Shopify；Online Store 尚未解鎖'],
  ['搜尋排序', '可用', '繁中同義詞與加權相關性已啟用'],
  ['編輯精選', '可用', '尚未宣稱為真實五星評分'],
  ['購物車／金流', '待解鎖', 'TapPay 商家設定完成；結帳已改接新商店，待 Shopify Online Store、真實 Variant 與三案例 sandbox'],
  ['會員中心', '技術基線完成', '正式註冊／登入／重設表單、Auth URLs、publishable key 與跨帳號 RLS 11/11 已驗證'],
  ['訂單查詢', '串接中', 'App secret、五個 webhook topics、HMAC 與會員唯讀投影已完成；待真實 sandbox delivery'],
  ['物流／發票', '程式整合中', '已選 ShipAny＋Amego；待 App 綁定、後端部署、方案與 sandbox 實單'],
  ['內容中心', '靜態可用', 'Shopify Blog 即時資料待接'],
  ['法務內容', '已建立', '正式發布前仍需法務確認'],
];

export default function Admin() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-36">
        <h1 className="mb-4 text-4xl font-bold text-[#225B4F]">網站模塊狀態</h1>
        <p className="mb-10 max-w-3xl leading-7 text-gray-600">
          這裡只呈現可驗證的功能狀態，不顯示示範營收、假訂單或假會員數。正式營運後台必須在 Supabase Auth 以 <code>app_metadata.role</code> 驗證管理員後才可開放。
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {modules.map(([name, status, note]) => (
            <div key={name} className="grid gap-2 border-b border-gray-100 p-5 last:border-0 md:grid-cols-[180px_140px_1fr]">
              <strong>{name}</strong>
              <span className="text-[#225B4F]">{status}</span>
              <span className="text-gray-600">{note}</span>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
