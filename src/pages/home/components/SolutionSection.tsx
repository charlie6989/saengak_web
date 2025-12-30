
import { useState, useEffect } from 'react';
import { useCart } from '../../../contexts/CartContext';
import { getFunctionUrl } from '../../../lib/supabase';

interface Product {
  id: string;
  name: string;
  image: string;
  hoverImage: string;
  price: number;
  originalPrice?: number;
  description: string;
  model?: string;
  discountRate?: number;
  reviews?: number;
  isBest?: boolean;
  isNew?: boolean;
  productType?: string;
  vendor?: string;
}

export default function SolutionSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();



  useEffect(() => {
    fetchShopifyProducts();
  }, []);

  const fetchShopifyProducts = async () => {
    setLoading(true);
    try {
      // Add timestamp to force fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(getFunctionUrl('get-products-by-tag') + `?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          tags: ['bundle'],
          first: 4
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();

      if (data.products) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching Shopify products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add manual refresh function
  const handleRefresh = () => {
    fetchShopifyProducts();
  };

  const calculateDiscountRate = (price: number, originalPrice?: number) => {
    if (!originalPrice || originalPrice <= price) return 0;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  const handleProductClick = (product: Product) => {
    const numericId = product.id.replace('gid://shopify/Product/', '');
    window.location.href = `/product/${numericId}`;
  };

  const handleAddToCartClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <>
      <section className="py-16 px-4" style={{ backgroundColor: '#BED2C0' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                這些日子的解決方案
              </h2>
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
                title="重新載入產品"
              >
                <i className="ri-refresh-line text-xl"></i>
              </button>
            </div>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              針對持續性私密部位困擾的解決方案<br />
              內心想法推薦的有效產品
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* 左側圖片 */}
            <div className="relative lg:sticky lg:top-32 lg:self-start">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src="https://readdy.ai/api/search-image?query=Beautiful%20feminine%20wellness%20and%20self-care%20lifestyle%20image%2C%20elegant%20Korean%20woman%20in%20comfortable%20modern%20home%20setting%2C%20soft%20natural%20lighting%2C%20pastel%20colors%2C%20minimalist%20aesthetic%2C%20peaceful%20and%20serene%20atmosphere%2C%20clean%20and%20modern%20interior%20design%2C%20wellness%20routine%2C%20self-care%20moment%2C%20aspirational%20lifestyle%20photography&width=800&height=1000&seq=solution-lifestyle&orientation=portrait"
                  alt="Solutions lifestyle"
                  className="w-full h-full object-cover object-center"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"
                  style={{ height: '85%', bottom: 0, top: 'auto' }}
                ></div>
                <div className="absolute bottom-8 left-8 text-white">
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    專業護理解決方案
                  </h3>
                  <p className="text-sm opacity-90" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    為您的日常護理提供最佳選擇
                  </p>
                </div>
              </div>
            </div>

            {/* 右側產品網格 */}
            <div className="space-y-6">
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-600">重新載入產品中...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4" data-product-shop>
                  {products.map((product) => {
                    const discountRate = calculateDiscountRate(product.price, product.originalPrice);
                    return (
                      <div
                        key={product.id}
                        className="group cursor-pointer bg-white"
                        data-product-shop
                        onClick={() => handleProductClick(product)}
                      >
                        {/* Product Image */}
                        <div className="aspect-[2/3] bg-gray-50 overflow-hidden mb-3 relative">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover object-top group-hover:opacity-0 transition-opacity duration-300"
                          />
                          {product.hoverImage && (
                            <img
                              src={product.hoverImage}
                              alt={product.name}
                              className="w-full h-full object-cover object-top absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                          )}
                          {/* Labels */}
                          <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {product.isBest && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 font-medium">BEST</span>
                            )}
                            {product.isNew && (
                              <span className="bg-blue-5/00 text-white text-xs px-2 py-1 font-medium">NEW</span>
                            )}
                          </div>
                        </div>

                        {/* Product Info */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2 px-4 pt-3" style={{ paddingTop: 'calc(0.5cm - 0.15cm)', paddingBottom: 'calc(0.5cm - 0.15cm)' }}>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                                {product.productType || '女性護理'}
                              </p>
                              <h3 className="text-base font-semibold line-clamp-2 leading-tight mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>
                                {product.name}
                              </h3>
                              {product.vendor && (
                                <p className="text-xs mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif", marginBottom: "0.675rem", color: "#225B4F" }}>
                                  {product.vendor}
                                </p>
                              )}
                              <p className="text-sm line-clamp-3 leading-relaxed" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#BBBBBB" }}>
                                {product.description}
                              </p>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Handle wishlist logic here
                              }}
                              className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
                            >
                              <i className="ri-heart-line text-gray-400 text-sm"></i>
                            </button>
                          </div>

                          {/* Price Block */}
                          <div className="space-y-1 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                {product.originalPrice && product.originalPrice > product.price ? (
                                  <span className="text-sm text-gray-400 line-through" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                                    ${product.originalPrice.toLocaleString()}
                                  </span>
                                ) : (
                                  <div className="h-5"></div>
                                )}
                                <div className="flex items-center gap-2">
                                  {discountRate > 0 ? (
                                    <span className="text-lg font-bold" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>-{discountRate}%</span>
                                  ) : null}
                                  <span className="text-lg font-bold" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>
                                    ${product.price.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Add to Cart Button */}
                          <button
                            onClick={(e) => handleAddToCartClick(e, product)}
                            className="add-to-cart-btn"
                            style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                          >
                            加入購物車
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 舒適無菌內褲 Banner */}
      {/* 白色色塊 - 3公分高 */}
      <div className="w-full h-[3cm] bg-white"></div>

      <section className="relative overflow-hidden">
        <div className="w-full">
          <div className="relative h-[300px] md:h-[400px]">
            <img
              src="https://readdy.ai/api/search-image?query=Premium%20comfortable%20antibacterial%20underwear%20banner%20design%2C%20elegant%20Korean%20woman%20wearing%20comfortable%20white%20cotton%20underwear%2C%20soft%20pastel%20background%2C%20clean%20minimalist%20aesthetic%2C%20health%20and%20wellness%20theme%2C%20modern%20lifestyle%20photography%2C%20gentle%20lighting%2C%20serene%20and%20comfortable%20atmosphere%2C%20premium%20quality%20fabric%20texture&width=1440&height=400&seq=underwear-banner&orientation=landscape"
              alt="舒適無菌內褲"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent"></div>
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto px-4 w-full">
                <div className="max-w-2xl">
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    舒適無菌內褲
                  </h2>
                  <p className="text-lg md:text-xl text-white/90 mb-6 leading-relaxed" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    採用抗菌纖維技術，提供全天候的舒適保護<br />
                    讓您每一天都感受到清新與自信
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a
                      href="/search?category=舒適穿著"
                      className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors duration-300 whitespace-nowrap"
                      style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                    >
                      立即選購
                    </a>
                    <a
                      href="/community"
                      className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold hover:bg-white hover:text-gray-900 transition-colors duration-300 whitespace-nowrap"
                      style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                    >
                      了解更多
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
