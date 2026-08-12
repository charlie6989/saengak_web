import { useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { mockProducts } from '../../mocks/products';
import { calculateEditorialScore, rankEditorialProducts } from '../../domain/algorithms';

export default function BestRated() {
  const products = rankEditorialProducts(mockProducts);

  useEffect(() => {
    document.title = '編輯精選商品 | 內心想法';
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Header />
      <main className="px-4 pb-20 pt-36">
        <section className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <h1 className="mb-5 text-4xl font-bold text-[#225B4F] md:text-6xl">編輯精選</h1>
            <p className="text-lg leading-8 text-gray-600">
              目前尚未串接可稽核的即時星級來源，因此本頁不宣稱「五星好評」。排序依編輯標記、優惠幅度與上新訊號計算；來源若提供可驗證回饋數才會納入，接妥後再升級為真實評價榜單。
            </p>
          </div>

          <div className="mb-8 rounded-xl border border-emerald-100 bg-white p-5 text-sm text-gray-600">
            排序公式：編輯標記 25 分、回饋證據最多 35 分、優惠最多 30 分、上新 10 分；同一批資料會得到相同結果。
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <span className="absolute right-3 top-3 z-10 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[#225B4F]">
                  精選分數 {calculateEditorialScore(product)}
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
