import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-36">
        <p className="mb-3 text-sm font-medium tracking-wide text-brand">最後更新：{siteContent.contentReviewedAt}</p>
        <h1 className="mb-5 text-4xl font-bold text-gray-950">退換貨說明</h1>
        <div className="mb-10 rounded-xl border border-gray-200 bg-white p-5 text-gray-800">
          <p className="font-semibold">退換貨以 Email 受理</p>
          <p className="mt-2 text-sm leading-6">請來信 {siteContent.companyEmail}，附上訂單編號、商品照片與退換貨原因，我們會回覆後續的寄回方式。</p>
        </div>

        <div className="space-y-7">
          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">消費者權益原則</h2>
            <p className="mt-4 leading-7">網路交易的解除權與例外依台灣消費者保護相關法令辦理。七日屬猶豫期間而非試用期；商品、包裝、贈品與購買憑證應妥善保存。</p>
            <p className="mt-3 leading-7">個人衛生用品若要主張合理例外，須符合商品性質、密封狀態及事前清楚告知等條件。商品瑕疵、寄錯或運送損壞仍應依個案與法令處理。</p>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">申請方式</h2>
            <p className="mt-4 leading-7">{siteContent.supportContact}請勿自行將商品寄至公司登記地址，請依回覆的退貨指示寄回。{siteContent.supportSafetyNotice}</p>
            <Link to="/customer-service" className="mt-5 inline-flex rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand">前往客服中心</Link>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
