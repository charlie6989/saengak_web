import { useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { mockProducts } from '../../mocks/products';
import { calculateEditorialScore, rankEditorialProducts } from '../../domain/algorithms';

export default function BestRated() {
  const products = rankEditorialProducts(mockProducts);

  useEffect(() => {
    document.title = '精選商品 | 內心想法';
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Header />
      <main className="px-4 pb-20 pt-36">
        <section className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <h1 className="mb-5 text-4xl font-bold text-[#225B4F] md:text-6xl">精選商品</h1>
            <p className="text-lg leading-8 text-gray-600">
              嚴選韓國熱銷好評私密護理系列，以純淨植萃精華滋養，為妳守護每一個細膩健康時刻。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <span className="absolute right-3 top-3 z-10 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[#225B4F] shadow-xs">
                  人氣推薦
                </span>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
