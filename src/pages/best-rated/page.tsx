import EditorialHero from '../../components/feature/EditorialHero';
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
    <div className="min-h-screen bg-[#F8F5F1]">
      <Header />
      <main className="pb-20 pt-24">
        <EditorialHero image="/images/lucissi-v5/best-rated.webp" alt="細心整理 Saengak 護理精選產品" eyebrow="LUCISSI CARE · SELECTION" title="精選商品" description="從私密護理到貼身穿著，為每天的生活挑選更舒適、自在的選擇。" />
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <span className="absolute right-3 top-3 z-10 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[#5B3D48] shadow-xs">
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
