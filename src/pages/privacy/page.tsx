import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

const dataUses = [
  ['帳號與會員資料', '電子郵件、姓名及您主動填寫的會員資料，用於登入、帳號安全與會員功能。'],
  ['購物與訂單資料', '購物車、商品、收件與訂單狀態會在 Shopify Checkout 啟用後，依結帳畫面所示方式處理。'],
  ['網站運作資料', '瀏覽器可能儲存購物車或登入狀態；主機與服務供應商也可能留下必要的安全與錯誤紀錄。'],
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-36">
        <p className="mb-3 text-sm font-medium tracking-wide text-teal-700">內容盤點日期：{siteContent.contentReviewedAt}</p>
        <h1 className="mb-5 text-4xl font-bold text-gray-950">隱私權政策</h1>
        <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="font-semibold">發布前審閱中</p>
          <p className="mt-2 text-sm leading-6">本頁已移除舊品牌與未確認聯絡資料，並依目前網站架構整理；正式營運前仍須由營運與法務確認最終文字、保存期間及正式聯絡管道。</p>
        </div>

        <section className="space-y-4 rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold">資料控管者</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-gray-500">品牌</dt><dd>{siteContent.brandName}</dd>
            <dt className="text-gray-500">營運公司</dt><dd>{siteContent.legalName}</dd>
            <dt className="text-gray-500">統一編號</dt><dd>{siteContent.taxId}</dd>
            <dt className="text-gray-500">登記地址</dt><dd>{siteContent.registeredAddress}</dd>
          </dl>
        </section>

        <section className="mt-8 space-y-5 rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold">目前可能處理的資料</h2>
          {dataUses.map(([title, description]) => (
            <div key={title} className="border-l-4 border-teal-700 pl-4">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-4 rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold">服務供應商與資料安全</h2>
          <p className="leading-7">網站目前使用或規劃使用 Vercel（網站託管）、Supabase（會員與訂單投影資料）及 Shopify（商品、購物車與結帳）。實際付款資料將由啟用後的付款服務商依其結帳畫面與政策處理。</p>
          <p className="leading-7">會員與訂單資料已設定帳號隔離規則；但任何網路服務都無法保證絕對安全，請勿在非官方管道提供密碼、卡號或驗證碼。</p>
        </section>

        <section className="mt-8 space-y-4 rounded-2xl bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold">查詢、更正與刪除</h2>
          <p className="leading-7">您可依適用法令請求查詢、閱覽、更正、停止利用或刪除個人資料。{siteContent.supportStatus}；正式管道公告前，請先參考客服狀態頁，且不要向非官方帳號提供敏感資料。</p>
          <Link to="/customer-service" className="inline-flex rounded-md bg-teal-800 px-5 py-3 text-sm font-medium text-white hover:bg-teal-900">查看客服狀態</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
