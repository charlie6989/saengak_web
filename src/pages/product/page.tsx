
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { getMockProductById } from '../../mocks/products';
import { getShopifyProduct, getShopifyProducts, type ShopifyProductVariant, type ShopifyProductOption } from '../../lib/shopify';
import { captureExceptionSafe } from '../../lib/sentry';
import { formatTwd } from '../../domain/algorithms';

interface Product {
  id: string;
  name: string;
  description: string;
  descriptionHtml?: string;
  price: number;
  originalPrice?: number;
  image: string;
  hoverImage: string;
  images?: { url: string; altText?: string }[];
  variants?: ShopifyProductVariant[];
  options?: ShopifyProductOption[];
  reviews?: number;
  handle?: string;
  tags?: string[];
  productType?: string;
  vendor?: string;
  availableForSale?: boolean;
}

/**
 * Product detail page.
 * Handles fetching product data, related products, multi-variant selection, and UI interactions.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'reviews' | 'details' | 'related' | 'qa'>('related');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, setIsCartOpen } = useCart();

  /** --------------------------------------------------------------------
   *  Fetch product & related products
   * ------------------------------------------------------------------- */
  const fetchProduct = async () => {
    setLoading(true);
    try {
      if (id) {
        const shopifyProduct = await getShopifyProduct(id);
        if (shopifyProduct) {
          // 初始化規格選項 (Options)
          let initialOptions: Record<string, string> = {};
          const firstVariant = shopifyProduct.variants?.[0];
          if (firstVariant?.selectedOptions && firstVariant.selectedOptions.length > 0) {
            firstVariant.selectedOptions.forEach((opt: { name: string; value: string }) => {
              initialOptions[opt.name] = opt.value;
            });
          } else if (shopifyProduct.options && shopifyProduct.options.length > 0) {
            shopifyProduct.options.forEach((opt) => {
              if (opt.values?.[0]) {
                initialOptions[opt.name] = opt.values[0];
              }
            });
          }

          setSelectedOptions(initialOptions);
          setProduct({
            id: shopifyProduct.id,
            name: shopifyProduct.name || shopifyProduct.title,
            description: shopifyProduct.description,
            descriptionHtml: shopifyProduct.descriptionHtml,
            price: shopifyProduct.price,
            originalPrice: shopifyProduct.originalPrice,
            image: shopifyProduct.image,
            hoverImage: shopifyProduct.hoverImage || shopifyProduct.image,
            images: shopifyProduct.images,
            variants: shopifyProduct.variants,
            options: shopifyProduct.options,
            handle: shopifyProduct.handle,
            tags: shopifyProduct.tags,
            productType: shopifyProduct.productType,
            vendor: shopifyProduct.vendor,
            availableForSale: shopifyProduct.availableForSale,
          });

          // Fetch related products
          const related = await getShopifyProducts({ first: 5 });
          const filtered = related.filter((p) => p.id !== shopifyProduct.id);
          setRelatedProducts(filtered.slice(0, 4).map((p) => ({
            id: p.id,
            name: p.name || p.title,
            description: p.description,
            price: p.price,
            originalPrice: p.originalPrice,
            image: p.image,
            hoverImage: p.hoverImage || p.image,
            handle: p.handle,
          })));
          setLoading(false);
          return;
        }
      }

      // Fallback to mock
      const fallbackMock = getMockProductById(id || '');
      if (fallbackMock) {
        setProduct(fallbackMock);
      }
    } catch (err) {
      console.error('Error fetching product data:', err);
      captureExceptionSafe(err, { source: 'ProductPage', fallback: 'mockProducts' });
      const fallbackMock = getMockProductById(id || '');
      if (fallbackMock) {
        setProduct(fallbackMock);
      }
    } finally {
      setLoading(false);
    }
  };

  /** --------------------------------------------------------------------
   *  Effects
   * ------------------------------------------------------------------- */
  // fetch product when id changes
  useEffect(() => {
    if (id) {
      setSelectedImage(0);
      fetchProduct();
    }
  }, [id]);

  /** --------------------------------------------------------------------
   *  Computed: Active Variant, Price, Stock & Options List
   * ------------------------------------------------------------------- */
  const optionsList = useMemo(() => {
    if (product?.options && product.options.length > 0) {
      return product.options.filter(
        (opt) => opt.values.length > 0 && !(opt.name === 'Title' && opt.values[0] === 'Default Title')
      );
    }

    // 若 options 未直接提供，自 variants.selectedOptions 動態萃取
    if (product?.variants && product.variants.length > 0) {
      const extracted: Record<string, Set<string>> = {};
      for (const v of product.variants) {
        if (v.selectedOptions) {
          for (const so of v.selectedOptions) {
            if (so.name === 'Title' && so.value === 'Default Title') continue;
            if (!extracted[so.name]) extracted[so.name] = new Set();
            extracted[so.name].add(so.value);
          }
        }
      }
      return Object.entries(extracted).map(([name, set]) => ({
        name,
        values: Array.from(set),
      }));
    }

    return [];
  }, [product]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;
    const matched = product.variants.find((v) => {
      if (!v.selectedOptions || v.selectedOptions.length === 0) return false;
      return v.selectedOptions.every((opt) => selectedOptions[opt.name] === opt.value);
    });
    return matched || product.variants[0] || null;
  }, [product, selectedOptions]);

  const currentPrice = selectedVariant ? selectedVariant.price : (product?.price ?? 0);
  const currentCompareAtPrice = selectedVariant?.compareAtPrice ?? product?.originalPrice;
  const isAvailableForSale = selectedVariant ? selectedVariant.availableForSale : (product?.availableForSale ?? true);

  /**
   * 多層級規格庫存可用性判定演算法 (Hierarchical Option Availability Check)
   * - 第 1 層 (如顏色): 檢查該顏色底下是否有任一尺寸庫存為 true。若全缺貨則返回 false (灰階)。
   * - 第 2 層 (如尺寸): 結合目前選取的第 1 層顏色，檢查 (當前顏色 + 該尺寸) 是否有庫存。
   * - 第 N 層 (以此類推): 結合先前已選定之層級規格進行庫存檢查。
   */
  const checkOptionAvailability = (optionIndex: number, optionName: string, optionValue: string): boolean => {
    if (!product?.variants || product.variants.length === 0) return true;

    if (optionIndex === 0) {
      // 第 1 層：檢查該選項值底下是否有任一可售規格
      return product.variants.some((v) => {
        const matchValue = v.selectedOptions?.some((so) => so.name === optionName && so.value === optionValue);
        return matchValue && v.availableForSale !== false;
      });
    }

    // 第 2 層及更深層：比對先前已選定之各層選項值
    const precedingConditions: Record<string, string> = {};
    for (let i = 0; i < optionIndex; i++) {
      const prevOpt = optionsList[i];
      if (prevOpt && selectedOptions[prevOpt.name]) {
        precedingConditions[prevOpt.name] = selectedOptions[prevOpt.name];
      }
    }

    const targetConditions = { ...precedingConditions, [optionName]: optionValue };

    return product.variants.some((v) => {
      if (!v.selectedOptions) return false;
      const matchesAll = Object.entries(targetConditions).every(([name, val]) =>
        v.selectedOptions?.some((so) => so.name === name && so.value === val)
      );
      return matchesAll && v.availableForSale !== false;
    });
  };

  /** --------------------------------------------------------------------
   *  Handlers
   * ------------------------------------------------------------------- */
  const handleAddToCart = () => {
    if (product) {
      try {
        addToCart({
          ...product,
          variantId: selectedVariant?.id,
          variantTitle: selectedVariant?.title,
          price: currentPrice,
          originalPrice: currentCompareAtPrice,
          image: selectedVariant?.image?.url || activeImage,
        }, quantity);
      } catch (e) {
        console.error('Add to cart failed:', e);
      }
    }
  };

  const handleBuyNow = () => {
    if (product) {
      try {
        addToCart({
          ...product,
          variantId: selectedVariant?.id,
          variantTitle: selectedVariant?.title,
          price: currentPrice,
          originalPrice: currentCompareAtPrice,
          image: selectedVariant?.image?.url || activeImage,
        }, quantity);
        setIsCartOpen(true);
      } catch (e) {
        console.error('Buy now failed:', e);
      }
    }
  };

  const handleOptionSelect = (optionName: string, optionValue: string) => {
    const nextOptions = { ...selectedOptions, [optionName]: optionValue };
    setSelectedOptions(nextOptions);

    // 切換至該規格專屬圖片（若有）
    if (product?.variants) {
      const targetVariant = product.variants.find((v) =>
        v.selectedOptions?.every((opt) => nextOptions[opt.name] === opt.value)
      );
      if (targetVariant?.image?.url) {
        const foundIndex = productImages.findIndex((url) => url === targetVariant.image?.url);
        if (foundIndex !== -1) {
          setSelectedImage(foundIndex);
        }
      }
    }
  };

  const handleImageClick = (index: number) => {
    setSelectedImage(index);
    setIsImageModalOpen(true);
  };

  const handleThumbnailClick = (index: number) => setSelectedImage(index);
  const handleModalClose = () => setIsImageModalOpen(false);

  /** --------------------------------------------------------------------
   *  Render helpers
   * ------------------------------------------------------------------- */
  const productImages = product
    ? Array.from(
      new Set(
        (product.images?.length
          ? product.images.map((img) => img.url)
          : [product.image, product.hoverImage]
        ).filter((url): url is string => Boolean(url)),
      ),
    )
    : [];
  const activeImage = productImages[selectedImage] ?? product?.image ?? '';

  const discountPercentage = currentCompareAtPrice && currentCompareAtPrice > currentPrice
    ? Math.round(((currentCompareAtPrice - currentPrice) / currentCompareAtPrice) * 100)
    : 0;

  /** --------------------------------------------------------------------
   *  Render
   * ------------------------------------------------------------------- */
  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Loading product...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h1>
            <a href="/" className="text-blue-600 hover:text-blue-800">
              Return to Home
            </a>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5' }}>
      <Header />

      {/* Background colour that extends behind the navigation */}
      <div
        className="absolute top-0 left-0 w-full z-[-1]"
        style={{ backgroundColor: '#F7F7F5', height: '100vh', minHeight: '100vh' }}
      ></div>

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-[120px] md:px-6 md:pt-[128px] lg:pt-[156px]">
        {/* ------------ Main product section ------------ */}
        <div>
          <section
            id="product-main-section"
            data-testid="product-main-section"
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:grid-cols-[760px_400px] xl:justify-center xl:gap-12"
          >
            {/* Left group: thumbnails + main image (sticky as whole group) */}
            <div
              data-testid="product-gallery"
              className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[88px_minmax(0,1fr)] lg:sticky lg:top-[124px]"
            >
              {/* Thumbnails column */}
              <aside className="order-2 min-w-0 sm:order-1">
                <ul className="flex gap-2 overflow-x-auto pb-1 sm:block sm:space-y-3 sm:overflow-visible sm:pb-0">
                  {productImages.map((url, idx) => (
                    <li key={url} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleThumbnailClick(idx)}
                        aria-label={`選擇第 ${idx + 1} 張商品圖片`}
                        aria-pressed={selectedImage === idx}
                        data-testid={`product-thumbnail-${idx}`}
                        className={`block aspect-[2/3] w-20 overflow-hidden rounded border sm:w-[88px] ${selectedImage === idx ? 'border-emerald-600' : 'border-transparent'
                          }`}
                      >
                        <img
                          src={url}
                          alt={`${product.name}-縮圖${idx + 1}`}
                          className="block h-full w-full object-cover object-top"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Main image */}
              <section id="main-product-image" className="order-1 min-w-0 sm:order-2">
                <button
                  type="button"
                  onClick={() => handleImageClick(selectedImage)}
                  aria-label="放大商品圖片"
                  className="block aspect-square w-full overflow-hidden bg-white"
                >
                  <img
                    src={activeImage}
                    alt={product.name}
                    data-testid="product-main-image"
                    className="block h-full w-full object-contain object-center"
                  />
                </button>
              </section>
            </div>

            {/* Right side content (regular scroll) */}
            <aside id="right-product-content" data-testid="product-info" className="min-w-0 w-full">
              <div className="space-y-5">
                {/* Tag */}
                <div>
                  <span className="inline-block bg-teal-100 text-teal-700 px-2 py-1 text-xs font-medium rounded">
                    {product.productType || product.tags?.[0] || '展示商品'}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {product.name}
                </h1>

                {/* Brand */}
                <div className="text-sm text-gray-600" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {product.vendor || '展示目錄'}
                </div>

                {/* Price */}
                <div className="space-y-1">
                  {currentCompareAtPrice && currentCompareAtPrice > currentPrice && (
                    <div className="text-sm text-gray-400 line-through">{formatTwd(currentCompareAtPrice)}</div>
                  )}
                  <div className="flex items-baseline gap-2">
                    {discountPercentage > 0 && (
                      <span
                        className="text-lg font-bold"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif', color: '#225B4F' }}
                      >
                        -{discountPercentage}%
                      </span>
                    )}
                    <span className="text-2xl font-bold text-gray-900" data-testid="product-price">
                      {formatTwd(currentPrice)}
                    </span>
                    {!isAvailableForSale && (
                      <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded ml-2">
                        已售完 / 缺貨中
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    最終售價、稅金與優惠以 Shopify Checkout 顯示為準。
                  </div>
                </div>

                {/* Multi-Variant / Options Selector */}
                {optionsList.length > 0 && (
                  <div className="space-y-4 rounded-xl border border-gray-200 bg-white/70 p-4 shadow-2xs" data-testid="variant-options">
                    {optionsList.map((option, optIdx) => {
                      const selectedVal = selectedOptions[option.name];
                      return (
                        <div key={option.name} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                              {option.name}：
                              <strong className="text-teal-900 ml-1 font-semibold">
                                {selectedVal || '請選擇'}
                              </strong>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {option.values.map((val) => {
                              const isSelected = selectedVal === val;
                              const isAvailable = checkOptionAvailability(optIdx, option.name, val);

                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleOptionSelect(option.name, val)}
                                  data-testid={`option-${option.name}-${val}`}
                                  title={isAvailable ? `${option.name}: ${val}` : `${option.name}: ${val} (缺貨中)`}
                                  className={`relative px-3.5 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
                                    isSelected
                                      ? isAvailable
                                        ? 'bg-teal-700 text-white font-semibold shadow-xs ring-2 ring-teal-700 ring-offset-1'
                                        : 'bg-gray-200 text-gray-500 font-semibold border border-gray-400 ring-2 ring-gray-400 ring-offset-1'
                                      : isAvailable
                                        ? 'bg-white text-gray-700 border border-gray-300 hover:border-teal-600 hover:bg-teal-50/50'
                                        : 'bg-gray-100 text-gray-400 border border-dashed border-gray-300 opacity-65 hover:opacity-100 hover:bg-gray-200/60'
                                  }`}
                                  style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                                >
                                  <span className={!isAvailable ? 'line-through decoration-gray-400' : ''}>
                                    {val}
                                  </span>
                                  {!isAvailable && (
                                    <span className="text-[11px] ml-1 opacity-75 font-normal">
                                      (缺貨)
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Source status */}
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">商品名稱與展示價格來自目前目錄資料</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">結帳前已對齊正式 Shopify 規格 ID</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">未接入的成分、容量與認證資訊不在此推定</span>
                  </li>
                </ul>

                {/* Quantity & buttons */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">數量</span>
                    <div className="flex items-center border border-gray-300 rounded">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={!isAvailableForSale}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-12 text-center text-sm border-l border-r border-gray-300 py-2">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        disabled={!isAvailableForSale}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAddToCart}
                      disabled={!isAvailableForSale}
                      data-testid="add-to-cart-button"
                      className="flex-1 h-12 border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        backgroundColor: isAvailableForSale ? '#ffffff' : '#f3f4f6',
                        borderColor: isAvailableForSale ? '#245B50' : '#d1d5db',
                        color: isAvailableForSale ? '#245B50' : '#9ca3af',
                        fontFamily: "Noto Sans TC, sans-serif"
                      }}
                      onMouseEnter={(e) => {
                        if (isAvailableForSale) e.currentTarget.style.backgroundColor = '#f0fdf4';
                      }}
                      onMouseLeave={(e) => {
                        if (isAvailableForSale) e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      {isAvailableForSale ? '加入購物車' : '此規格已售完'}
                    </button>
                    {/* Modified Buy Now button */}
                    <button
                      onClick={handleBuyNow}
                      disabled={!isAvailableForSale}
                      data-testid="buy-now-button"
                      className="flex-1 h-12 border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        backgroundColor: isAvailableForSale ? '#245B50' : '#9ca3af',
                        borderColor: isAvailableForSale ? '#245B50' : '#9ca3af',
                        color: '#ffffff',
                        fontFamily: "Noto Sans TC, sans-serif"
                      }}
                      onMouseEnter={(e) => {
                        if (isAvailableForSale) {
                          e.currentTarget.style.backgroundColor = '#1a4239';
                          e.currentTarget.style.borderColor = '#1a4239';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isAvailableForSale) {
                          e.currentTarget.style.backgroundColor = '#245B50';
                          e.currentTarget.style.borderColor = '#245B50';
                        }
                      }}
                    >
                      {isAvailableForSale ? '立即購買' : '暫無庫存'}
                    </button>
                  </div>

                  {/* Source-backed product information */}
                  <div className="text-sm text-gray-700 space-y-8">
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        商品說明
                      </h4>
                      <p className="leading-7">{product.description}</p>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        資料狀態
                      </h4>
                      <p className="leading-7">
                        目前頁面包含展示目錄內容。容量、完整成分、製造資訊與認證，須以正式 Shopify 商品欄位及實際包裝標示為準；尚未接入的欄位不在此推定。
                      </p>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        使用與購買提醒
                      </h4>
                      <div className="space-y-3">
                        <p>• 使用方式與注意事項請依商品包裝標示。</p>
                        <p>• 若出現不適請停止使用；孕期或有特殊健康狀況時，先諮詢合格專業人員。</p>
                        <p>• 付款、稅金、運送與最終售價以 Shopify Checkout 顯示為準。</p>
                        <p>• 退換貨條件請參閱 <a className="underline" href="/return-policy">退換貨說明</a>。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          {/* 下方內容與主區塊距離：固定用 mt-12，避免空白異常 */}
          <section id="product-details" className="mt-12">
            {/* Image modal */}
            {isImageModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="relative max-w-4xl max-h-full">
                  <button
                    onClick={handleModalClose}
                    className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 z-10"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                  <img
                    src={activeImage}
                    alt={product.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* --------- Full-width white section (tabs) --------- */}
        <div className="w-full bg-white py-16">
          <div className="max-w-7xl mx-auto px-4">
            {/* Tab navigation */}
            <div className="mb-12">
              <div className="flex gap-0 justify-center">
                <button
                  onClick={() => setSelectedTab('reviews')}
                  className={`text-base font-normal transition-all duration-300 ${selectedTab === 'reviews' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  style={{
                    fontFamily: 'Noto Sans TC, sans-serif',
                    width: '355px',
                    height: '50px',
                    fontSize: '16px',
                    backgroundColor: selectedTab === 'reviews' ? '#D8D6CA' : '#EBF3EC',
                    border: 'none',
                    borderRadius: '0',
                  }}
                >
                  評論
                </button>

                <button
                  onClick={() => setSelectedTab('details')}
                  className={`text-base font-normal transition-all duration-300 ${selectedTab === 'details' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  style={{
                    fontFamily: 'Noto Sans TC, sans-serif',
                    width: '355px',
                    height: '50px',
                    fontSize: '16px',
                    backgroundColor: selectedTab === 'details' ? '#D8D6CA' : '#EBF3EC',
                    border: 'none',
                    borderRadius: '0',
                  }}
                >
                  細節
                </button>

                <button
                  onClick={() => setSelectedTab('related')}
                  className={`text-base font-normal transition-all duration-300 ${selectedTab === 'related' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  style={{
                    fontFamily: 'Noto Sans TC, sans-serif',
                    width: '355px',
                    height: '50px',
                    fontSize: '16px',
                    backgroundColor: selectedTab === 'related' ? '#D8D6CA' : '#EBF3EC',
                    border: 'none',
                    borderRadius: '0',
                  }}
                >
                  相關產品
                </button>

                <button
                  onClick={() => setSelectedTab('qa')}
                  className={`text-base font-normal transition-all duration-300 ${selectedTab === 'qa' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  style={{
                    fontFamily: 'Noto Sans TC, sans-serif',
                    width: '355px',
                    height: '50px',
                    fontSize: '16px',
                    backgroundColor: selectedTab === 'qa' ? '#D8D6CA' : '#EBF3EC',
                    border: 'none',
                    borderRadius: '0',
                  }}
                >
                  詢問
                </button>
              </div>
            </div>

            {/* Tab panels */}
            <div className="min-h-[400px]">
              {/* Reviews */}
              {selectedTab === 'reviews' && (
                <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                    可驗證評價尚未接入
                  </h3>
                  <p className="leading-7 text-gray-600">
                    本頁不使用示範姓名、星級或心得冒充真實評論。待 Shopify 或其他可稽核評價來源接妥後，才會顯示評分與回饋數。
                  </p>
                </div>
              )}

              {/* Details */}
              {selectedTab === 'details' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      產品詳細資訊
                    </h3>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                      <dl className="space-y-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                          <dt className="text-gray-600">產品名稱</dt>
                          <dd className="font-medium text-gray-900">{product.name}</dd>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                          <dt className="text-gray-600">目錄分類</dt>
                          <dd className="font-medium text-gray-900">{product.productType || product.tags?.[0] || '尚未提供'}</dd>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                          <dt className="text-gray-600">品牌／供應商</dt>
                          <dd className="font-medium text-gray-900">{product.vendor || '尚未提供'}</dd>
                        </div>
                      </dl>
                      <p className="mt-6 leading-7 text-gray-600">
                        其餘規格、完整成分、保存方式與使用方法尚未從正式商品欄位取得，請以實際包裝標示為準。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Related */}
              {selectedTab === 'related' && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-6 text-center" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                    相關產品推薦
                  </h3>
                  {relatedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {relatedProducts.map((relatedProduct) => (
                        <ProductCard key={relatedProduct.id} product={relatedProduct} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">暫無相關產品</p>
                    </div>
                  )}
                </div>
              )}

              {/* Q&A */}
              {selectedTab === 'qa' && (
                <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                    商品問題請由客服確認
                  </h3>
                  <p className="mb-6 leading-7 text-gray-600">
                    問答資料庫尚未接入，因此不顯示示範提問或醫療效果回答。請提供商品名稱與問題，由客服依正式包裝及供應商資料回覆。
                  </p>
                  <a
                    href="/customer-service"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
                  >
                    聯絡客服
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
