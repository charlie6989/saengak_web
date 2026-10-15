import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

export default function AdChoicesPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-36">
        <p className="mb-3 text-sm font-medium tracking-wide text-brand">最後更新：{siteContent.contentReviewedAt}</p>
        <h1 className="mb-5 text-4xl font-bold text-gray-950">廣告與追蹤偏好</h1>
        <section className="rounded-2xl bg-white p-7 shadow-xs">
          <h2 className="text-2xl font-semibold">目前狀態</h2>
          <p className="mt-4 leading-7">{siteContent.brandName} 目前沒有提供獨立的個人化廣告偏好中心。若日後加入廣告或分析服務，本頁將列明供應商、用途、資料類型與退出方式。</p>
        </section>
        <section className="mt-8 rounded-2xl bg-white p-7 shadow-xs">
          <h2 className="text-2xl font-semibold">您目前可以控制的項目</h2>
          <ul className="mt-4 list-disc space-y-3 pl-6 leading-7">
            <li>透過瀏覽器設定限制或刪除 Cookie 與網站資料。</li>
            <li>在裝置或瀏覽器中停用跨網站追蹤。</li>
            <li>清除本網站儲存的購物車與登入狀態。</li>
          </ul>
          <p className="mt-4 text-sm text-gray-600">停用必要的網站儲存可能影響登入與購物車功能。</p>
        </section>
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-xl font-semibold text-amber-950">需要提出資料請求？</h2>
          <p className="mt-3 leading-7 text-amber-900">請來信 {siteContent.companyEmail} 提出資料查詢、更正或刪除申請。{siteContent.supportSafetyNotice}</p>
          <Link to="/privacy" className="mt-5 inline-flex rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand">閱讀隱私權政策</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
