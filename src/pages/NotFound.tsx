import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../components/feature/Header';
import Footer from '../components/feature/Footer';
import { NOINDEX_ROBOTS } from '../lib/pageTitle';

const DESTINATIONS = [
  { to: '/products', label: '全部商品' },
  { to: '/promotion', label: '優惠活動' },
  { to: '/faq', label: '常見問題' },
  { to: '/customer-service', label: '客服中心' },
];

export default function NotFound() {
  const { pathname } = useLocation();

  // ScrollToTop 在 layout effect 依路徑設定 robots，這裡的 effect 較晚執行，因此能覆寫成 noindex。
  // 不需還原：離開本頁時 ScrollToTop 會依新路徑重設。
  useEffect(() => {
    document.querySelector('meta[name="robots"]')?.setAttribute('content', NOINDEX_ROBOTS);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F6F3] text-gray-800">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-20 pt-36 text-center">
        <p className="text-sm font-medium tracking-[0.18em] text-brand">404</p>
        <h1 className="mt-4 text-3xl font-bold text-gray-950 sm:text-4xl">找不到這個頁面</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
          網址可能已變更，或輸入時有誤。您可以回到首頁，或從下方前往想找的內容。
        </p>
        <Link to="/" className="mt-8 inline-flex bg-brand px-8 py-3 text-sm font-semibold text-white hover:bg-brand-ink">
          回到首頁
        </Link>
        <nav aria-label="常用頁面" className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
          {DESTINATIONS.map(({ to, label }) => (
            <Link key={to} to={to} className="border-b border-gray-400 pb-0.5 text-gray-700 hover:border-brand hover:text-brand">
              {label}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </div>
  );
}
