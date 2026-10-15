import { useSearchParams, Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { useAuth } from '../../contexts/AuthContext';
import { siteContent } from '../../content/site';

const ordersPath = '/profile?tab=orders';

export default function OrderStatusPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const { user } = useAuth();
  const isSandbox = import.meta.env.VITE_COMMERCE_SANDBOX_MODE === 'true';

  // 只有結帳返回時帶著 order_id 才顯示感謝訊息；一般從頁尾進入的顧客看到的是訂單查詢說明
  if (orderId) {
    return (
      <div className="min-h-screen bg-[#F8F5F1]">
        <Header />
        <main className="mx-auto max-w-4xl px-4 pb-20 pt-36">
          <section className="rounded-2xl border border-stone-200 bg-white p-8 md:p-12 shadow-xs text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blush mb-6">
              <svg className="h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-stone-900">感謝您的訂購！</h1>
            <p className="mb-6 text-lg font-medium text-brand bg-blush inline-block px-4 py-2 rounded-lg">
              訂單編號：{orderId.replace('gid://shopify/Order/', '#')}
            </p>
            <p className="mx-auto max-w-2xl leading-7 text-stone-600">
              我們已收到您的訂單，確認信會寄到您結帳時填寫的電子郵件信箱。
              {isSandbox && (
                <span className="block mt-2 font-bold text-amber-600">
                  [注意] 目前系統處於測試沙盒模式，此為測試訂單，不會進行真實物流派送。
                </span>
              )}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/products"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-brand px-8 py-3.5 font-semibold text-white transition-colors hover:bg-brand shadow-md"
              >
                繼續購物
              </Link>
              <Link
                to={user ? ordersPath : '/customer-service'}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-8 py-3.5 font-semibold text-stone-700 transition-colors hover:bg-stone-50"
              >
                {user ? '查看我的訂單' : '聯絡客服'}
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F1]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-36">
        <section className="rounded-2xl border border-stone-200 bg-white p-8 md:p-12 shadow-xs">
          <h1 className="mb-4 text-3xl font-bold text-stone-900">訂單查詢</h1>
          <p className="leading-7 text-stone-600">
            登入會員即可在「我的訂單」查看付款、出貨與物流進度。
          </p>
          <div className="mt-6">
            {user ? (
              <Link
                to={ordersPath}
                className="inline-flex items-center justify-center rounded-xl bg-brand px-8 py-3.5 font-semibold text-white transition-colors hover:bg-brand shadow-md"
              >
                查看我的訂單
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: { pathname: ordersPath } }}
                className="inline-flex items-center justify-center rounded-xl bg-brand px-8 py-3.5 font-semibold text-white transition-colors hover:bg-brand shadow-md"
              >
                登入查看訂單
              </Link>
            )}
          </div>
          <div className="mt-10 border-t border-stone-200 pt-6 text-sm leading-7 text-stone-600">
            <p>找不到訂單？請先查看下單時收到的訂單確認信，信中附有訂單狀態連結。</p>
            <p>{siteContent.supportContact}</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
