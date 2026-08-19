import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-36">
        <p className="mb-3 text-sm font-medium tracking-wide text-teal-700">內容盤點日期：{siteContent.contentReviewedAt}</p>
        <h1 className="mb-5 text-4xl font-bold text-gray-950">退換貨說明</h1>
        <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="font-semibold">正式流程尚未開放</p>
          <p className="mt-2 text-sm leading-6">網站目前沒有站內退貨申請、退貨單列印或自動退款功能。物流商、退貨地址、退款時程與正式客服管道仍待營運確認。</p>
        </div>

        <div className="space-y-7">
          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">消費者權益原則</h2>
            <p className="mt-4 leading-7">網路交易的解除權與例外依台灣消費者保護相關法令辦理。七日屬猶豫期間而非試用期；商品、包裝、贈品與購買憑證應妥善保存。</p>
            <p className="mt-3 leading-7">個人衛生用品若要主張合理例外，須符合商品性質、密封狀態及事前清楚告知等條件。商品瑕疵、寄錯或運送損壞仍應依個案與法令處理。</p>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">正式營運前必須補齊</h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-7">
              <li>正式客服電話、電子郵件或官方 LINE。</li>
              <li>可受理退貨的地址與物流方式；登記地址不等於退貨地址。</li>
              <li>依付款方式定義的退款作業時間與通知方式。</li>
              <li>每項商品是否屬通訊交易解除權合理例外的清楚標示。</li>
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">目前聯絡狀態</h2>
            <p className="mt-4 leading-7">{siteContent.supportStatus}。請勿自行將商品寄至公司登記地址；應等待官方受理與退貨指示。{siteContent.supportSafetyNotice}</p>
            <Link to="/customer-service" className="mt-5 inline-flex rounded-md bg-teal-800 px-5 py-3 text-sm font-medium text-white hover:bg-teal-900">查看客服狀態</Link>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
