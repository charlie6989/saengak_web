import { Link } from 'react-router-dom';
import Footer from '../../components/feature/Footer';
import Header from '../../components/feature/Header';
import { siteContent } from '../../content/site';

export default function CustomerService() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
      <Header />

      <div className="bg-teal-700 pb-20 pt-32 text-white">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h1 className="mb-5 text-4xl font-bold sm:text-5xl">客服中心</h1>
          <p className="mx-auto max-w-2xl text-base text-teal-50 sm:text-lg">
            我們只公布已確認的官方管道，不使用示範電話、跨品牌信箱或未啟用的即時聊天。
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="relative -mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-lg sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <i className="ri-information-line text-2xl text-amber-700" />
            </div>
            <div>
              <h2 className="mb-2 text-xl font-bold text-gray-900">客服聯絡資料確認中</h2>
              <p className="mb-3 text-gray-700">{siteContent.supportStatus}。</p>
              <p className="text-sm leading-6 text-amber-900">{siteContent.supportSafetyNotice}</p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <i className="ri-building-line mb-4 block text-3xl text-teal-700" />
            <h2 className="mb-4 text-xl font-bold text-gray-900">營運公司</h2>
            <dl className="space-y-3 text-sm text-gray-700">
              <div>
                <dt className="font-semibold text-gray-900">公司名稱</dt>
                <dd>{siteContent.legalName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">統一編號</dt>
                <dd>{siteContent.taxId}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">登記地址</dt>
                <dd>{siteContent.registeredAddress}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <i className="ri-question-answer-line mb-4 block text-3xl text-teal-700" />
            <h2 className="mb-4 text-xl font-bold text-gray-900">自助查詢</h2>
            <p className="mb-5 text-sm leading-6 text-gray-600">
              網站目前是公開展示與會員接線階段；正式訂單、付款、配送及退換貨條件，將在 Shopify 與物流服務完成驗收後公告。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/faq" className="rounded-md bg-teal-700 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800">
                查看常見問題
              </Link>
              <Link to="/return-policy" className="rounded-md border border-teal-700 px-5 py-3 text-sm font-medium text-teal-700 hover:bg-teal-50">
                查看退換貨說明
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-gray-500">
          內容檢核日期：{siteContent.contentReviewedAt}
        </p>
      </main>

      <Footer />
    </div>
  );
}
