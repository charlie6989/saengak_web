
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShopifyProducts } from '../../../lib/shopify';
import { mockProducts } from '../../../mocks/products';
import { rankEditorialProducts } from '../../../domain/algorithms';
import { captureExceptionSafe } from '../../../lib/sentry';
import { sanitizeProductTitle, extractSingleSentenceDescription } from '../../../components/feature/ProductCard';

const ReviewSection: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRatedProducts = async () => {
      setLoading(true);
      try {
        const items = await getShopifyProducts({ first: 50 });
        if (items && items.length > 0) {
          const CORE_ORDER = [
            '深層修護私密清潔露',
            '私密雙層修護精華噴霧',
            '益生菌私密養膚濕巾',
            '平衡調理私密潔淨慕斯',
          ];
          const coreItems = items.filter((p) =>
            CORE_ORDER.some((kw) => (p.name || p.title || '').includes(kw))
          );
          const displayItems = coreItems.length > 0 ? coreItems : items.slice(0, 4);
          displayItems.sort((a, b) => {
            const idxA = CORE_ORDER.findIndex((kw) => (a.name || a.title || '').includes(kw));
            const idxB = CORE_ORDER.findIndex((kw) => (b.name || b.title || '').includes(kw));
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
          });

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
            productType: p.productType,
            vendor: p.vendor,
          })));
          return;
        }

        const allItems = await getShopifyProducts({ first: 4 });
        if (allItems && allItems.length > 0) {
          setProducts(allItems.map((p) => ({
            id: p.id,
            name: p.name || p.title,
            image: p.image,
            hoverImage: p.hoverImage || p.image,
            price: p.price,
            originalPrice: p.originalPrice,
            description: p.description,
            model: p.handle,
            isNew: true,
            productType: p.productType,
            vendor: p.vendor,
          })));
          return;
        }

        setProducts(rankEditorialProducts(mockProducts).slice(0, 4));
      } catch (err) {
        captureExceptionSafe(err, { source: 'ReviewSection', fallback: 'mockProducts' });
        setProducts(rankEditorialProducts(mockProducts).slice(0, 4));
      } finally {
        setLoading(false);
      }
    };

    fetchRatedProducts();
  }, []);

  const handleShopAllProducts = () => {
    navigate('/best-rated');
  };

  if (loading) {
    return (
      <section className="py-20 bg-gray-50 flex justify-center">
        <div className="inline-block animate-spin h-8 w-8 border-b-2 border-gray-900"></div>
      </section>
    );
  }

  // If no products found, we might want to hide the section or show nothing
  if (products.length === 0) return null;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 標題區域 */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl font-bold text-gray-900 mb-4"
            style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
          >
            精選商品
          </h2>
          <p
            className="text-lg text-gray-600"
            style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
          >
            嚴選韓國人氣私密護理好物，為妳的日常帶來純淨、安心與極致溫和呵護
          </p>
        </div>

        {/* 評論網格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer"
              onClick={() => {
                const numericId = product.id.replace('gid://shopify/Product/', '');
                window.location.href = `/product/${numericId}`;
              }}
            >
              {/* 產品圖片 */}
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* 評論內容 */}
              <div className="p-6">
                <div className="text-xs font-medium text-teal-700 mb-3">精選推薦</div>

                {/* 產品名稱 */}
                <h3
                  className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem]"
                  style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
                >
                  {sanitizeProductTitle(product.name)}
                </h3>

                {/* 評論文字 / 極簡單句描述 */}
                <p
                  className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2"
                  style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
                >
                  {extractSingleSentenceDescription(product)}
                </p>

                {/* Source status */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
                    SAENGAK
                  </span>
                  <span className="font-semibold text-gray-900" style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
                    ${product.price.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 查看更多按鈕 */}
        <div className="text-center mt-12">
          <button
            onClick={handleShopAllProducts}
            className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
              查看全部精選商品
            </span>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;
