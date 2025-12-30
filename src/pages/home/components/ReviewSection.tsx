
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctionUrl } from '../../../lib/supabase';

const ReviewSection: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRatedProducts = async () => {
      setLoading(true);
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(getFunctionUrl('get-products-by-tag') + `?t=${timestamp}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            tags: ['5-star', 'featured'], // Try to match 5-star or featured
            first: 4
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.products) {
            setProducts(data.products);
          }
        }
      } catch (error) {
        console.error('Failed to fetch rated products:', error);
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
            選購五星產品
          </h2>
          <p
            className="text-lg text-gray-600"
            style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
          >
            提醒五星好評：
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
                {/* 星級評分 - Default to 5 stars if no data, or hide if desired. User asked to sort/show. */}
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <i
                      key={i}
                      className="ri-star-fill text-yellow-400 text-lg mr-1"
                    ></i>
                  ))}
                </div>

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
                  {product.description || '深受用戶喜愛的優質產品，品質保證。'}
                </p>

                {/* 評論統計 - Mock/Default for now as backend doesn't have reviews yet */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
                    平均 5.0
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
              選購全部好評產品
            </span>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;
