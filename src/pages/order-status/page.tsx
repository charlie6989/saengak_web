import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function OrderStatusPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-36">
        <section className="border-t border-[#D8DDD8] bg-white px-6 py-12 md:px-12 md:py-16">
          <p className="mb-3 text-sm font-medium text-[#225B4F]">付款返回</p>
          <h1 className="mb-6 text-4xl font-bold text-gray-900">已返回 SAENGAK</h1>
          <p className="max-w-2xl leading-8 text-gray-600">
            付款結果仍以 Shopify 訂單確認頁與訂單確認信為準。若交易已完成，系統會寄送確認信；請使用信中的「查看訂單」連結確認付款、出貨與物流狀態。
          </p>
          <div className="mt-8 border-l-4 border-[#225B4F] bg-[#EEF4F1] p-5 text-[#19483F]">
            若尚未收到確認信，請稍候幾分鐘後再次檢查信箱。仍未收到時，請聯絡客服並提供下單姓名、電子郵件與大約下單時間；請勿傳送完整卡號或驗證碼。
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex bg-[#225B4F] px-6 py-3 font-medium text-white hover:bg-[#19483f]"
            >
              繼續購物
            </a>
            <a
              href="/customer-service"
              className="inline-flex border border-[#225B4F] px-6 py-3 font-medium text-[#225B4F] hover:bg-[#EEF4F1]"
            >
              聯絡客服
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
