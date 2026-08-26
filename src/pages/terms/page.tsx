import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-36">
        <p className="mb-3 text-sm font-medium tracking-wide text-teal-700">內容盤點日期：{siteContent.contentReviewedAt}</p>
        <h1 className="mb-5 text-4xl font-bold text-gray-950">網站使用與訂購條款</h1>
        <div className="mb-10 rounded-xl border border-teal-200 bg-teal-50 p-5 text-teal-950">
          <p className="font-semibold">正式結帳已啟用</p>
          <p className="mt-2 text-sm leading-6">本站使用 Shopify Checkout 與 TapPay 正式金流；可用付款方式、運費、配送條件與最終金額以當次結帳頁面顯示為準。物流、發票、客服與本條款仍會依實際營運狀態持續更新。</p>
        </div>

        <div className="space-y-7">
          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">網站營運者</h2>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-gray-500">品牌</dt><dd>{siteContent.brandName}</dd>
              <dt className="text-gray-500">公司</dt><dd>{siteContent.legalName}</dd>
              <dt className="text-gray-500">統一編號</dt><dd>{siteContent.taxId}</dd>
              <dt className="text-gray-500">登記地址</dt><dd>{siteContent.registeredAddress}</dd>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">商品與訂單</h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-7">
              <li>商品名稱、規格、價格、庫存與促銷，以實際商品頁及 Shopify 結帳畫面為準。</li>
              <li>購物車內容不等於訂單成立；只有 Shopify 接受結帳並回傳訂單後，才進入正式訂單流程。</li>
              <li>付款方式、運費、配送區域與預估時間，必須以正式結帳畫面及訂單通知為準。</li>
              <li>前端購物車與頁面提示不代表付款成功；付款與訂單狀態以 Shopify 訂單記錄為準。</li>
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">使用規範</h2>
            <p className="mt-4 leading-7">使用者不得以自動化濫用、未授權存取、冒用身分或其他違法方式干擾網站。產品資訊屬一般資訊，不取代醫師、藥師或其他專業醫療建議。</p>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">退換貨與個人資料</h2>
            <p className="mt-4 leading-7">消費者權益依適用法令及正式交易條款辦理。個人衛生用品是否屬合理例外，須依商品性質、密封狀態、事前告知與主管機關規範判斷，不能僅以「已拆封」一概排除。</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/return-policy" className="rounded-md border border-teal-800 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50">退換貨說明</Link>
              <Link to="/privacy" className="rounded-md border border-teal-800 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50">隱私權政策</Link>
              <Link to="/customer-service" className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900">客服狀態</Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
