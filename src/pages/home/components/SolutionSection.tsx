import EditorialHero from '../../../components/feature/EditorialHero';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShopifyProducts } from '../../../lib/shopify';
import { mockProducts } from '../../../mocks/products';
import { rankEditorialProducts } from '../../../domain/algorithms';
import { captureExceptionSafe } from '../../../lib/sentry';
import { isNonSaengakOwnBrandProduct, resolveDisplayVendor } from '../../../lib/brandOwnership';

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
  availableForSale?: boolean;
  subtitle?: string;
  promotionBadge?: string;
  tags?: string[];
  variants?: Array<{
    id?: string;
    availableForSale?: boolean;
    quantityAvailable?: number;
  }>;
}

export default function SolutionSection() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bundles' | 'singles' | 'all'>('bundles');

  useEffect(() => {
    fetchShopifyProducts();
  }, []);

  const isSaengakCareProduct = (p: any) => {
    const title = (p.name || p.title || '').toLowerCase();
    const type = (p.productType || '').toLowerCase();
    const tags: string[] = Array.isArray(p.tags) ? p.tags : [];
    const combined = `${title} ${type} ${tags.join(' ').toLowerCase()}`;

    // 首頁「私密照護，從日常開始。」為 P0 級白名單專區，僅能展示 SAENGAK 私密護理品。
    // 先以 brandOwnership 共用模組排除所有內著／舒適穿著／除毛刀／護衣袋／洗衣袋等非 SAENGAK
    // 自有品牌商品，並沿用原本額外排除的「配件」「收腹」關鍵字，維持既有更嚴格的排除範圍不變。
    if (
      isNonSaengakOwnBrandProduct({ title: p.name || p.title, productType: p.productType, tags }) ||
      /(?:配件|收腹)/i.test(combined)
    ) {
      return false;
    }

    // 必須為 SAENGAK 女性私密保養護理系列
    return /(?:清潔露|慕斯|噴霧|濕巾|凝膠|女性護理|深層修護|每日清潔|私密|保養|組合|套裝|組)/i.test(combined);
  };

  const fetchShopifyProducts = async () => {
    setLoading(true);
    try {
      // 取得商品池並嚴格篩選僅限 SAENGAK 護理商品
      const items = await getShopifyProducts({ first: 50 });
      const saengakItems = (items || []).filter(isSaengakCareProduct);

      let displayList: Product[] = saengakItems.map((p) => ({
        id: p.id,
        name: p.name || p.title,
        image: p.image,
        hoverImage: p.hoverImage || p.image,
        price: p.price,
        originalPrice: p.originalPrice,
        description: p.description,
        model: p.handle,
        isNew: true,
        productType: p.productType || '女性護理',
        vendor: 'SAENGAK',
        availableForSale: p.availableForSale,
        variants: p.variants,
        subtitle: p.subtitle,
        promotionBadge: p.promotionBadge,
        tags: p.tags,
      }));

      // 若 Shopify 後台的 SAENGAK 核心護理品不足 4 款，以 SAENGAK 官方經典品項補足
      if (displayList.length < 4) {
        const canonicalSaengak = rankEditorialProducts(mockProducts).filter(isSaengakCareProduct);
        const existingNames = new Set(displayList.map(p => p.name));
        for (const item of canonicalSaengak) {
          if (!existingNames.has(item.name) && displayList.length < 4) {
            displayList.push({
              ...item,
              vendor: 'SAENGAK'
            });
            existingNames.add(item.name);
          }
        }
      }

      setProducts(displayList);
    } catch (err) {
      captureExceptionSafe(err, { source: 'SolutionSection', fallback: 'mockProducts' });
      setProducts(rankEditorialProducts(mockProducts).filter(isSaengakCareProduct));
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
    navigate(`/product/${numericId}`);
  };

  const handleViewProductClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    handleProductClick(product);
  };

  const isBundle = (p: Product) => {
    const title = (p.name || '').toLowerCase();
    const tags = (p.tags || []).map((t) => t.toLowerCase());
    return (
      title.includes('組') ||
      title.includes('套裝') ||
      tags.includes('超值組合') ||
      tags.includes('shopify bundles') ||
      tags.includes('組合包')
    );
  };

  const bundles = products.filter(isBundle);
  const singles = products.filter((p) => !isBundle(p));

  const displayedProducts = (() => {
    if (activeTab === 'bundles') return bundles.length > 0 ? bundles : products;
    if (activeTab === 'singles') return singles.length > 0 ? singles : products;
    return products;
  })();

  return (
    <>
      <section className="py-16 px-4" style={{ backgroundColor: '#E7D6D4' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                私密照護，從日常開始。
              </h2>
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
                title="重新載入產品"
              >
                <i className="ri-refresh-line text-xl"></i>
              </button>
            </div>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              精選清潔、保濕與舒緩護理，為每天的私密日常，多一點舒適與自在。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* 左側圖片 */}
            <div className="relative lg:sticky lg:top-32 lg:self-start">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src="/images/lucissi-v5/home-solution-portrait.webp"
                  alt="手持 Saengak 修護噴霧的日常護理情境"
                  className="w-full h-full object-cover object-center"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"
                  style={{ height: '85%', bottom: 0, top: 'auto' }}
                ></div>
                <div className="absolute bottom-8 left-8 text-white">
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    純淨呵護方案
                  </h3>
                  <p className="text-sm opacity-90" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    溫和潔淨與深層修護推薦
                  </p>
                </div>
              </div>
            </div>

            {/* 右側產品網格 */}
            <div className="space-y-6">
              {/* 分類切換按鈕 */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#D5C2C0]">
                <span className="text-xs sm:text-sm font-bold text-[#5B3D48] tracking-wider">
                  {activeTab === 'bundles' ? '✨ 官方推薦特惠組合' : activeTab === 'singles' ? '🌿 日常基礎護理單品' : '全系列私密護理品項'}
                </span>

                <div className="inline-flex bg-white/80 backdrop-blur-xs p-1 rounded-xl shadow-2xs border border-gray-200/60 text-xs sm:text-sm">
                  <button
                    onClick={() => setActiveTab('bundles')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'bundles'
                        ? 'bg-[#5B3D48] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>✨ 超值優惠組</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'bundles' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {bundles.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('singles')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'singles'
                        ? 'bg-[#5B3D48] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>經典單品</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'singles' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {singles.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-[#5B3D48] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    全部 ({products.length})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-600">重新載入產品中...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4" data-product-shop>
                  {displayedProducts.map((product) => {
                    const discountRate = calculateDiscountRate(product.price, product.originalPrice);
                    const isSoldOut =
                      product.availableForSale === false ||
                      (Array.isArray(product.variants) &&
                        product.variants.length > 0 &&
                        product.variants.every((v) => v.availableForSale === false));

                    return (
                      <div
                        key={product.id}
                        className="group cursor-pointer bg-white rounded-xl overflow-hidden shadow-2xs border border-gray-100/80 flex flex-col h-full hover:shadow-md transition-shadow"
                        data-product-shop
                        onClick={() => handleProductClick(product)}
                      >
                        {/* Product Image - Standardized square (1:1) ratio */}
                        <div className="aspect-square bg-gray-50 overflow-hidden mb-3 relative flex items-center justify-center">
                          <img
                            src={product.image}
                            alt={product.name}
                            className={`w-full h-full object-cover object-center group-hover:opacity-0 transition-opacity duration-300 ${isSoldOut ? 'opacity-75 grayscale-[30%]' : ''}`}
                          />
                          {product.hoverImage && (
                            <img
                              src={product.hoverImage}
                              alt={product.name}
                              className={`w-full h-full object-cover object-center absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isSoldOut ? 'grayscale-[30%]' : ''}`}
                            />
                          )}
                          {/* Labels */}
                          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                            {isBundle(product) && (
                              <span className="bg-[#5B3D48] text-white text-[11px] px-2 py-0.5 font-bold rounded shadow-xs tracking-wider">
                                組合特惠
                              </span>
                            )}
                            {product.isBest && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 font-medium">BEST</span>
                            )}
                            {product.isNew && !isBundle(product) && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 font-medium">NEW</span>
                            )}
                          </div>

                          {/* 已售完 圖層 (第 1 層) */}
                          {isSoldOut && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20 pointer-events-none">
                              <span
                                className="bg-black/80 text-white text-xs md:text-sm px-3.5 py-1.5 rounded-full font-medium tracking-wider shadow-md border border-white/20"
                                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                              >
                                已售完
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="space-y-2 p-4 flex flex-col flex-1">
                          <div className="flex justify-between items-start gap-2 flex-1" style={{ paddingTop: 'calc(0.5cm - 0.15cm)', paddingBottom: 'calc(0.5cm - 0.15cm)' }}>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                                {product.productType || '女性護理'}
                              </p>
                              <h3 className="text-base font-semibold line-clamp-2 leading-tight mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>
                                {product.name}
                              </h3>
                              {(() => {
                                // 安全解析顯示用品牌名稱：內著／周邊商品絕不可能得到 'SAENGAK'（見 src/lib/brandOwnership.ts）
                                const displayVendor = resolveDisplayVendor(
                                  { productType: product.productType, name: product.name, vendor: product.vendor },
                                  { allowSaengakFallbackForOwnBrand: false }
                                );
                                if (!displayVendor) return null;
                                return (
                                  <p className="text-xs mb-1" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>
                                    {displayVendor}
                                  </p>
                                );
                              })()}
                              {product.promotionBadge && (
                                <div className="mb-1.5">
                                  <span className="inline-block text-[11px] font-bold text-[#8C3A4D] bg-[#F5E6E8] px-2 py-0.5 rounded border border-[#EAC9CE]">
                                    {product.promotionBadge}
                                  </span>
                                </div>
                              )}
                              {product.subtitle && (
                                <p className="text-[11px] text-gray-500 line-clamp-1 mb-1 font-medium">
                                  {product.subtitle}
                                </p>
                              )}
                              <p className="text-sm line-clamp-3 leading-relaxed" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#655859" }}>
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
                          <div className="space-y-1">
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
                                    <span className="text-lg font-bold" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>-{discountRate}%</span>
                                  ) : null}
                                  <span className="text-lg font-bold" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>
                                    ${product.price.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* View Product Button */}
                          <button
                            onClick={(e) => handleViewProductClick(e, product)}
                            aria-label={`查看 ${product.name} 商品詳情`}
                            className="add-to-cart-btn mt-auto cursor-pointer"
                            style={{
                              backgroundColor: isSoldOut ? '#F8F5F1' : '#E7D6D4',
                              color: isSoldOut ? '#655859' : '#34302F',
                              fontFamily: "Noto Sans TC, sans-serif"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isSoldOut ? '#DDD6D1' : '#5B3D48';
                              e.currentTarget.style.color = isSoldOut ? '#655859' : '#FFFDFC';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isSoldOut ? '#F8F5F1' : '#E7D6D4';
                              e.currentTarget.style.color = isSoldOut ? '#655859' : '#34302F';
                            }}
                          >
                            {isSoldOut ? '已售完・查看詳情' : isBundle(product) ? '查看特惠組合' : '查看商品'}
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

      <EditorialHero
        image="/images/lucissi-v5/home-wear-banner.webp"
        alt="親膚棉質內著的蝴蝶結、織紋與車縫細節"
        eyebrow="LUCISSI CARE · EVERYDAY COMFORT"
        headingLevel="h2"
        title="貼身穿著"
        description="每天貼近肌膚的穿著，也是私密日常的一部分。"
      >
        <div className="mt-7 flex flex-wrap gap-4">
          <a href="/search?category=貼身穿著" className="bg-[#5B3D48] px-6 py-3 text-sm font-semibold text-white">立即選購</a>
          <a href="/community" className="border border-[#5B3D48]/30 px-6 py-3 text-sm font-semibold text-[#5B3D48]">了解更多</a>
        </div>
      </EditorialHero>
    </>
  );
}
