
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShopifyProducts } from '../../../lib/shopify';
import { mockProducts } from '../../../mocks/products';
import { rankEditorialProducts } from '../../../domain/algorithms';
import { captureExceptionSafe } from '../../../lib/sentry';

const ReviewSection: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRatedProducts = async () => {
      setLoading(true);
      try {
        const items = await getShopifyProducts({ first: 4 });
        if (items && items.length > 0) {
          setProducts(items.map((p) => ({
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
            編輯精選商品
          </h2>
          <p
            className="text-lg text-gray-600"
            style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
          >
            依商品標記、回饋量與優惠資訊排序，不以展示資料冒充即時星級
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
                <div className="text-xs font-medium text-teal-700 mb-4">編輯推薦</div>

                {/* 產品名稱 */}
                <h3
                  className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2"
                  style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
                >
                  {product.name}
                </h3>

                {/* 評論文字 - Use description or generic text if no specific review comment */}
                <p
                  className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3"
                  style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
                >
                  {product.description || '目前沒有可顯示的商品說明，待正式目錄補齊。'}
                </p>

                {/* Source status */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
                    編輯資料
                  </span>
                  <span style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
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
              查看全部編輯精選
            </span>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;
