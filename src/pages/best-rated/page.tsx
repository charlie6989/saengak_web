import EditorialHero from '../../components/feature/EditorialHero';
import { useEffect, useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { mockProducts } from '../../mocks/products';
import { rankEditorialProducts } from '../../domain/algorithms';
import { getShopifyProducts, isFeaturedShopifyProduct, type ShopifyProduct } from '../../lib/shopify';
import { captureExceptionSafe } from '../../lib/sentry';

export default function BestRated() {
  const [products, setProducts] = useState<any[]>(rankEditorialProducts(mockProducts));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = '精選商品 | LUCISSI CARE';

    const loadFeaturedProducts = async () => {
      setLoading(true);
      try {
        const items = await getShopifyProducts({ first: 50 });
        if (items && items.length > 0) {
          const CORE_ORDER = [
            '深層修護私密清潔露',
            '私密雙層修護精華噴霧',
            '益生菌私密養膚濕巾',
            '平衡調理私密潔淨慕斯',
            '益生菌私密舒緩凝膠',
          ];

          const taggedFeatured = items.filter(isFeaturedShopifyProduct);
          let displayItems: ShopifyProduct[] = [];

          if (taggedFeatured.length > 0) {
            const taggedIds = new Set(taggedFeatured.map((p) => p.id));
            const supplementaryCore = items
              .filter((p) => !taggedIds.has(p.id) && CORE_ORDER.some((kw) => (p.name || p.title || '').includes(kw)))
              .sort((a, b) => {
                const idxA = CORE_ORDER.findIndex((kw) => (a.name || a.title || '').includes(kw));
                const idxB = CORE_ORDER.findIndex((kw) => (b.name || b.title || '').includes(kw));
                return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
              });
            displayItems = [...taggedFeatured, ...supplementaryCore];
          } else {
            displayItems = items
              .filter((p) => CORE_ORDER.some((kw) => (p.name || p.title || '').includes(kw)))
              .sort((a, b) => {
                const idxA = CORE_ORDER.findIndex((kw) => (a.name || a.title || '').includes(kw));
                const idxB = CORE_ORDER.findIndex((kw) => (b.name || b.title || '').includes(kw));
                return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
              });
          }

          if (displayItems.length > 0) {
            setProducts(displayItems.map((p) => ({
              id: p.id,
              name: p.name || p.title,
              image: p.image,
              hoverImage: p.hoverImage || p.image,
              price: p.price,
              originalPrice: p.originalPrice,
              description: p.description,
              model: p.handle,
              isNew: true,
              availableForSale: p.availableForSale,
              variants: p.variants,
            })));
          }
        }
      } catch (err) {
        captureExceptionSafe(err, { source: 'BestRated', fallback: 'mockProducts' });
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedProducts();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F5F1]">
      <Header />
      <main className="pb-20 pt-24">
        <EditorialHero
          image="/images/lucissi-v5/best-rated.webp"
          alt="細心整理 Saengak 護理精選產品"
          eyebrow="LUCISSI CARE · SELECTION"
          title="精選商品"
          description="從私密護理到貼身穿著，為每天的生活挑選更舒適、自在的選擇。"
        />
        <section className="mx-auto max-w-7xl px-4 pt-12">
          {loading && products.length === 0 ? (
            <div className="py-20 flex justify-center">
              <div className="inline-block animate-spin h-8 w-8 border-b-2 border-brand"></div>
            </div>
          ) : (
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
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
