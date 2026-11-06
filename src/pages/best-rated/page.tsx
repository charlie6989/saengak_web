import EditorialHero from '../../components/feature/EditorialHero';
import { useEffect, useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { deriveCatalogSignals, sortAvailableFirst } from '../../domain/algorithms';
import { selectFeaturedProducts } from '../../domain/featuredProducts';
import { getShopifyProducts, isFeaturedShopifyProduct, type ShopifyProduct } from '../../lib/shopify';
import { captureExceptionSafe } from '../../lib/sentry';

export default function BestRated() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      setLoading(true);
      try {
        const items = await getShopifyProducts({ first: 50 });
        if (items && items.length > 0) {
          const displayItems: ShopifyProduct[] = selectFeaturedProducts(items, isFeaturedShopifyProduct);

          if (displayItems.length > 0) {
            setProducts(sortAvailableFirst(displayItems.map((p) => ({
              id: p.id,
              name: p.name || p.title,
              image: p.image,
              hoverImage: p.hoverImage || p.image,
              price: p.price,
              originalPrice: p.originalPrice,
              description: p.description,
              model: p.handle,
              isNew: deriveCatalogSignals({ tags: p.tags }).isNew,
              availableForSale: p.availableForSale,
              variants: p.variants,
            }))));
          }
        }
      } catch (err) {
        captureExceptionSafe(err, { source: 'BestRated' });
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedProducts();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <Header />
      <main className="pb-20 pt-24">
        <EditorialHero
          image="/images/lucissi-v5/best-rated.webp"
          alt="細心整理 Saengak 護理精選產品"
          eyebrow="LUCISSI CARE · SELECTION"
          title="精選商品"
          description="從私密保養到舒適內搭，為每天的生活挑選更舒適、自在的選擇。"
        />
        <section className="mx-auto max-w-7xl px-4 pt-12">
          {loading && products.length === 0 ? (
            <div className="py-20 flex justify-center">
              <div className="inline-block animate-spin h-8 w-8 border-b-2 border-brand"></div>
            </div>
          ) : products.length === 0 ? (
            <p className="py-20 text-center text-gray-600">
              {loadFailed ? '目前無法載入商品，請稍後重新整理頁面。' : '精選商品整理中，歡迎先瀏覽全部商品。'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div key={product.id} className="relative">
                  <span className="absolute right-3 top-3 z-10 rounded-sm bg-white/90 px-2 py-1 text-xs font-medium text-brand">
                    精選
                  </span>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
