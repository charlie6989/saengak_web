import { useSearchParams, Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function OrderStatusPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-36">
        <section className="rounded-2xl border border-stone-200 bg-white p-8 md:p-12 shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 mb-6">
            <svg className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-stone-900">感謝您的訂購！</h1>
          {orderId && (
            <p className="mb-6 text-lg font-medium text-teal-800 bg-teal-50 inline-block px-4 py-2 rounded-lg">
              訂單編號：{orderId.replace('gid://shopify/Order/', '#')}
            </p>
          )}
          <p className="mx-auto max-w-2xl leading-7 text-stone-600">
            您的付款已成功授權，訂單正在處理中。我們已發送確認信至您的電子郵件信箱。
            {process.env.COMMERCE_SANDBOX_MODE === 'true' && (
              <span className="block mt-2 font-bold text-amber-600">
                [注意] 目前系統處於測試沙盒模式，此為測試訂單，不會進行真實物流派送。
              </span>
            )}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/products"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-teal-600 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-teal-700 shadow-md"
            >
              繼續購物
            </Link>
            <Link
              to="/customer-service"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-8 py-3.5 font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              聯絡客服
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
