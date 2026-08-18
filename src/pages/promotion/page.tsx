import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

const releaseChecks = [
  '活動名稱、折扣或贈品內容與適用商品',
  '開始與結束時間、使用次數及是否可併用',
  '運費、退貨與取消後的優惠處理方式',
  'Shopify Checkout 的實際折扣回讀結果',
];

export default function Promotion() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-36">
        <section className="mb-10 max-w-3xl">
          <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-[#225B4F]">PROMOTIONS</p>
          <h1 className="mb-5 text-4xl font-bold text-gray-900 md:text-5xl">優惠活動狀態</h1>
          <p className="text-lg leading-8 text-gray-600">
            目前沒有已核准且可在本站使用的公開優惠。舊版頁面中的過期折扣碼、韓元免運門檻、生日與推薦優惠均不是 SAENGAK 現行活動，已停止顯示。
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="border border-gray-200 bg-white p-7">
            <h2 className="mb-3 text-xl font-bold text-gray-900">現在可以確認的事</h2>
            <ul className="space-y-3 text-gray-600">
              <li>• 展示目錄可瀏覽，但 Shopify Online Store 尚未解鎖。</li>
              <li>• TapPay 商家設定已完成；交易、物流與發票尚未完成 sandbox 對帳。</li>
              <li>• 未公告優惠時，購物車不會自行承諾折扣或免運。</li>
            </ul>
          </article>

          <article className="border border-gray-200 bg-white p-7">
            <h2 className="mb-3 text-xl font-bold text-gray-900">正式活動上線前必須具備</h2>
            <ul className="space-y-3 text-gray-600">
              {releaseChecks.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
        </section>

        <section className="mt-8 border border-[#BED2C0] bg-[#EBF3EC] p-7">
          <h2 className="mb-3 text-xl font-bold text-[#225B4F]">通知與資料收集原則</h2>
          <p className="leading-7 text-gray-700">
            優惠通知訂閱後端尚未建立，因此本頁目前不收集電子郵件。未來若啟用，會先提供用途、寄送頻率、退訂方式與隱私說明。
          </p>
        </section>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/search?query=all" className="bg-[#225B4F] px-6 py-3 text-center font-semibold text-white">
            瀏覽展示商品
          </Link>
          <Link to="/terms" className="border border-[#225B4F] px-6 py-3 text-center font-semibold text-[#225B4F]">
            查看交易狀態與條款
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
