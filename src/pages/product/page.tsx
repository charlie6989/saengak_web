
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { getMockProductById, mockProducts } from '../../mocks/products';
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

const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800';

/**
 * Product detail page.
 * Handles fetching product data, related products, multi-variant selection, and UI interactions.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'details' | 'reviews' | 'related' | 'qa'>('details');
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const thumbnailListRef = useRef<HTMLUListElement>(null);
  const { addToCart, setIsCartOpen } = useCart();

  // 焦點大圖手勢拖曳狀態 (支援手機滑動與滑鼠拖曳切換上一張/下一張)
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const hasDragged = useRef(false);

  // 縮圖列手勢拖曳狀態 (支援手機觸控滑動與滑鼠直接拖曳)
  const thumbDragStartX = useRef<number | null>(null);
  const thumbScrollStartX = useRef<number>(0);
  const isThumbDragging = useRef(false);
  const hasThumbDragged = useRef(false);

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

          // Fetch related products from Shopify
          try {
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
          } catch (relErr) {
            console.warn('Failed to load related Shopify products, fallback to mock:', relErr);
            const allMocks = mockProducts.filter((p) => p.id !== (id || ''));
            setRelatedProducts(allMocks.slice(0, 4));
          }

          setLoading(false);
          return;
        }
      }

      // Fallback to mock
      const fallbackMock = getMockProductById(id || '');
      if (fallbackMock) {
        setProduct(fallbackMock);
        const allMocks = mockProducts.filter((p) => p.id !== (id || ''));
        setRelatedProducts(allMocks.slice(0, 4));
      }
    } catch (err) {
      console.error('Error fetching product data:', err);
      captureExceptionSafe(err, { source: 'ProductPage', fallback: 'mockProducts' });
      const fallbackMock = getMockProductById(id || '');
      if (fallbackMock) {
        setProduct(fallbackMock);
        const allMocks = mockProducts.filter((p) => p.id !== (id || ''));
        setRelatedProducts(allMocks.slice(0, 4));
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

  const handleThumbnailClick = (index: number) => {
    if (hasThumbDragged.current) {
      return;
    }
    setSelectedImage(index);
  };

  // 縮圖列拖曳與觸控滑動 Handlers
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!thumbnailListRef.current) return;
    thumbDragStartX.current = e.clientX;
    thumbScrollStartX.current = thumbnailListRef.current.scrollLeft;
    isThumbDragging.current = true;
    hasThumbDragged.current = false;
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!isThumbDragging.current || thumbDragStartX.current === null || !thumbnailListRef.current) return;
    const deltaX = e.clientX - thumbDragStartX.current;
    if (Math.abs(deltaX) > 6) {
      hasThumbDragged.current = true;
    }
    thumbnailListRef.current.scrollLeft = thumbScrollStartX.current - deltaX;
  };

  const handleThumbPointerUp = () => {
    isThumbDragging.current = false;
    thumbDragStartX.current = null;
    setTimeout(() => {
      hasThumbDragged.current = false;
    }, 60);
  };

  const handleThumbPointerCancel = () => {
    isThumbDragging.current = false;
    thumbDragStartX.current = null;
    hasThumbDragged.current = false;
  };

  // 焦點圖拖曳與滑動切換 Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragStartX.current = e.clientX;
    hasDragged.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragStartX.current === null) return;
    const deltaX = e.clientX - dragStartX.current;
    if (Math.abs(deltaX) > 8) {
      hasDragged.current = true;
    }
    setDragOffset(deltaX);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 40; // 滑動切換門檻 40px
    if (dragOffset < -threshold) {
      // 向左滑動 -> 下一張
      setSelectedImage((prev) => Math.min(productImages.length - 1, prev + 1));
    } else if (dragOffset > threshold) {
      // 向右滑動 -> 上一張
      setSelectedImage((prev) => Math.max(0, prev - 1));
    }
    setDragOffset(0);
    dragStartX.current = null;
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragOffset(0);
    dragStartX.current = null;
  };

  const handleMainImageClick = () => {
    if (hasDragged.current) {
      hasDragged.current = false;
      return;
    }
    handleImageClick(selectedImage);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage((prev) => Math.max(0, prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage((prev) => Math.min(productImages.length - 1, prev + 1));
  };

  // 自動聯動滾動：當選中縮圖時，自動調整縮圖捲軸位置（若選中超過當前視野，自動滾動讓選中縮圖可見）
  useEffect(() => {
    if (!thumbnailListRef.current) return;
    const container = thumbnailListRef.current;

    if (window.innerWidth >= 640) {
      // 桌機版直向滾動 (顯示 7 格)
      const slotHeight = 76; // 68px item + 8px gap
      const maxTopIndex = Math.max(0, productImages.length - 7);
      const targetTopIndex = Math.min(maxTopIndex, Math.max(0, selectedImage - 5));
      const targetScrollTop = targetTopIndex * slotHeight;
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    } else {
      // 手機版橫向滾動 (一次顯示 5 格)
      const slotWidth = container.clientWidth / 5;
      const maxLeftIndex = Math.max(0, productImages.length - 5);
      const targetLeftIndex = Math.min(maxLeftIndex, Math.max(0, selectedImage - 4));
      const targetScrollLeft = targetLeftIndex * slotWidth;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [selectedImage, productImages.length]);

  const handleScrollDownThumbnails = () => {
    if (thumbnailListRef.current) {
      thumbnailListRef.current.scrollBy({ top: 76, behavior: 'smooth' });
    }
  };

  const handleScrollUpThumbnails = () => {
    if (thumbnailListRef.current) {
      thumbnailListRef.current.scrollBy({ top: -76, behavior: 'smooth' });
    }
  };

  const handleScrollLeftThumbnails = () => {
    if (thumbnailListRef.current) {
      const container = thumbnailListRef.current;
      const scrollStep = container.clientWidth;
      container.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    }
  };

  const handleScrollRightThumbnails = () => {
    if (thumbnailListRef.current) {
      const container = thumbnailListRef.current;
      const scrollStep = container.clientWidth;
      container.scrollBy({ left: scrollStep, behavior: 'smooth' });
    }
  };

  const handleModalClose = () => setIsImageModalOpen(false);

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
              className={`grid min-w-0 grid-cols-1 gap-3 ${
                productImages.length > 1
                  ? 'sm:grid-cols-[82px_minmax(0,1fr)] md:grid-cols-[90px_minmax(0,1fr)] lg:grid-cols-[98px_minmax(0,1fr)] sm:gap-3.5'
                  : ''
              } lg:sticky lg:top-[124px] items-stretch`}
            >
              {/* Thumbnails column / row */}
              {productImages.length > 1 && (
                <aside className="order-2 min-w-0 sm:order-1 relative select-none w-full">
                  <div className="relative flex items-center sm:flex-col w-full gap-1.5 sm:gap-0">
                    {/* Mobile Left Arrow (超過 5 張時顯示) */}
                    {productImages.length > 5 && (
                      <button
                        type="button"
                        onClick={handleScrollLeftThumbnails}
                        aria-label="向左瀏覽上一組縮圖"
                        className="sm:hidden flex-shrink-0 w-6 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 bg-white/95 hover:bg-white border border-gray-200 rounded-md text-sm shadow-2xs z-10 cursor-pointer active:scale-95 transition-all"
                      >
                        <i className="ri-arrow-left-s-line text-base"></i>
                      </button>
                    )}

                    {/* Desktop Top scroll arrow if > 7 images */}
                    {productImages.length > 7 && (
                      <button
                        type="button"
                        onClick={handleScrollUpThumbnails}
                        aria-label="向上瀏覽縮圖"
                        className="hidden sm:flex w-full py-1 items-center justify-center text-gray-500 hover:text-gray-900 bg-white/90 hover:bg-white border border-gray-200 rounded-md text-xs mb-1.5 transition-colors shadow-2xs z-10 cursor-pointer flex-shrink-0"
                      >
                        <i className="ri-arrow-up-s-line text-sm"></i>
                      </button>
                    )}

                    {/* Thumbnail List */}
                    <div className="flex-1 min-w-0 overflow-hidden sm:overflow-visible w-full">
                      <ul
                        ref={thumbnailListRef}
                        onPointerDown={handleThumbPointerDown}
                        onPointerMove={handleThumbPointerMove}
                        onPointerUp={handleThumbPointerUp}
                        onPointerCancel={handleThumbPointerCancel}
                        className="w-full flex gap-1.5 sm:gap-2 overflow-x-auto sm:overflow-x-hidden sm:flex-col sm:overflow-y-auto sm:h-[524px] sm:max-h-[524px] scroll-smooth no-scrollbar snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none touch-pan-y"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        {productImages.map((url, idx) => {
                          const isSelected = selectedImage === idx;
                          return (
                            <li
                              key={`${url}-${idx}`}
                              className={`${
                                productImages.length > 5
                                  ? 'w-[calc((100%-24px)/5)] flex-shrink-0 snap-start'
                                  : 'flex-1 min-w-0'
                              } sm:w-full sm:flex-shrink-0 overflow-hidden`}
                            >
                              <button
                                type="button"
                                onClick={() => handleThumbnailClick(idx)}
                                aria-label={`選擇第 ${idx + 1} 張商品圖片`}
                                aria-pressed={isSelected}
                                data-testid={`product-thumbnail-${idx}`}
                                className={`block w-full aspect-square sm:aspect-auto sm:h-[68px] overflow-hidden rounded-md transition-all duration-200 border-2 cursor-pointer ${
                                  isSelected
                                    ? 'border-[#245B50] ring-1 ring-[#245B50] shadow-2xs'
                                    : 'border-transparent hover:border-gray-300 opacity-70 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={url}
                                  alt={`${product.name}-縮圖${idx + 1}`}
                                  onError={(e) => {
                                    e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                                  }}
                                  draggable={false}
                                  className="block h-full w-full object-cover object-center pointer-events-none"
                                  loading="lazy"
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Mobile Right Arrow (超過 5 張時顯示) */}
                    {productImages.length > 5 && (
                      <button
                        type="button"
                        onClick={handleScrollRightThumbnails}
                        aria-label="向右瀏覽下一組縮圖"
                        className="sm:hidden flex-shrink-0 w-6 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 bg-white/95 hover:bg-white border border-gray-200 rounded-md text-sm shadow-2xs z-10 cursor-pointer active:scale-95 transition-all"
                      >
                        <i className="ri-arrow-right-s-line text-base"></i>
                      </button>
                    )}

                    {/* Desktop Bottom scroll arrow if > 7 images */}
                    {productImages.length > 7 && (
                      <button
                        type="button"
                        onClick={handleScrollDownThumbnails}
                        aria-label="向下瀏覽更多縮圖"
                        className="hidden sm:flex w-full py-1 items-center justify-center text-gray-500 hover:text-gray-900 bg-white/90 hover:bg-white border border-gray-200 rounded-md text-xs mt-1.5 transition-colors shadow-2xs z-10 cursor-pointer flex-shrink-0"
                      >
                        <i className="ri-arrow-down-s-line text-sm"></i>
                      </button>
                    )}
                  </div>
                </aside>
              )}

              {/* Main focal image (支援左右拖曳/滑動手勢切換圖片) */}
              <section id="main-product-image" className="order-1 min-w-0 sm:order-2 h-full">
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onClick={handleMainImageClick}
                  className="relative w-full aspect-square sm:aspect-[4/5] max-h-[580px] bg-white rounded-xl overflow-hidden border border-gray-200/80 shadow-2xs group flex items-center justify-center select-none touch-pan-y cursor-grab active:cursor-grabbing"
                >
                  {/* Left navigation arrow button */}
                  {selectedImage > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevImage}
                      aria-label="上一張圖片"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center z-10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    >
                      <i className="ri-arrow-left-s-line text-lg"></i>
                    </button>
                  )}

                  {/* Right navigation arrow button */}
                  {selectedImage < productImages.length - 1 && (
                    <button
                      type="button"
                      onClick={handleNextImage}
                      aria-label="下一張圖片"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center z-10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    >
                      <i className="ri-arrow-right-s-line text-lg"></i>
                    </button>
                  )}

                  {/* Image with real-time drag translation */}
                  <div
                    className="w-full h-full flex items-center justify-center p-3"
                    style={{
                      transform: `translateX(${dragOffset}px)`,
                      transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                  >
                    <img
                      src={activeImage}
                      alt={product.name}
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                      }}
                      data-testid="product-main-image"
                      draggable={false}
                      className="block max-h-full max-w-full object-contain object-center pointer-events-none transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  {/* Image counter indicator */}
                  <div className="absolute bottom-3 left-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none">
                    <span>{selectedImage + 1} / {productImages.length}</span>
                  </div>

                  <span className="absolute bottom-3 right-3 bg-black/55 hover:bg-black/75 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none transition-colors">
                    <i className="ri-zoom-in-line"></i> 點擊放大
                  </span>
                </div>
              </section>
            </div>

            {/* Right side content (compact purchase flow) */}
            <aside id="right-product-content" data-testid="product-info" className="min-w-0 w-full">
              <div className="space-y-5">
                {/* Tag */}
                <div>
                  <span className="inline-block bg-teal-100 text-teal-700 px-2.5 py-1 text-xs font-medium rounded-md">
                    {product.productType || product.tags?.[0] || '展示商品'}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-semibold leading-snug text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {product.name}
                </h1>

                {/* Brand */}
                <div className="text-sm text-gray-600 font-medium" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {product.vendor || 'SAENGAK'}
                </div>

                {/* Price */}
                <div className="space-y-1">
                  {currentCompareAtPrice && currentCompareAtPrice > currentPrice && (
                    <div className="text-sm text-gray-400 line-through">{formatTwd(currentCompareAtPrice)}</div>
                  )}
                  <div className="flex items-baseline gap-2">
                    {discountPercentage > 0 && (
                      <span
                        className="text-xl font-bold"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif', color: '#225B4F' }}
                      >
                        -{discountPercentage}%
                      </span>
                    )}
                    <span className="text-3xl font-bold text-gray-900" data-testid="product-price">
                      {formatTwd(currentPrice)}
                    </span>
                    {!isAvailableForSale && (
                      <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded ml-2">
                        已售完 / 缺貨中
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
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

                {/* Compact Source / Service Badges */}
                <div className="rounded-lg bg-gray-50/80 border border-gray-200/70 p-3 space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <i className="ri-shield-check-line text-[#245B50] flex-shrink-0 text-sm"></i>
                    <span>官方直營 正品保證與即時庫存同步</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="ri-truck-line text-[#245B50] flex-shrink-0 text-sm"></i>
                    <span>支援超商取貨與宅配到府（結帳頁面選擇）</span>
                  </div>
                </div>

                {/* Quantity & buttons */}
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">數量</span>
                    <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={!isAvailableForSale}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-40 cursor-pointer hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-12 text-center text-sm font-medium border-l border-r border-gray-200 py-2">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        disabled={!isAvailableForSale}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-40 cursor-pointer hover:bg-gray-50"
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
                      className="flex-1 h-12 border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-lg shadow-2xs"
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
                    <button
                      onClick={handleBuyNow}
                      disabled={!isAvailableForSale}
                      data-testid="buy-now-button"
                      className="flex-1 h-12 border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-lg shadow-xs"
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
                </div>
              </div>
            </aside>
          </section>

          {/* Modal for image zoom */}
          {isImageModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
              <div className="relative max-w-4xl max-h-full">
                <button
                  onClick={handleModalClose}
                  className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black/80 rounded-full p-2.5 z-10 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
                <img
                  src={activeImage}
                  alt={product.name}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          )}
        </div>

        {/* --------- Full-width white section (Tabs & Detailed Content) --------- */}
        <div className="w-full bg-white py-16 mt-16 rounded-2xl shadow-2xs border border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            {/* Tab navigation */}
            <div className="mb-12 border-b border-gray-200">
              <div className="flex flex-wrap sm:flex-nowrap justify-center max-w-3xl mx-auto">
                {[
                  { id: 'details', label: '商品詳情' },
                  { id: 'reviews', label: '顧客評價' },
                  { id: 'related', label: '相關推薦' },
                  { id: 'qa', label: '常見問題' },
                ].map((tab) => {
                  const isActive = selectedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedTab(tab.id as any)}
                      className={`flex-1 min-w-[120px] sm:min-w-0 h-[52px] text-base font-medium transition-all duration-200 border-b-2 cursor-pointer ${
                        isActive
                          ? 'border-[#245B50] text-[#245B50] bg-emerald-50/30'
                          : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab panels */}
            <div className="min-h-[400px]">
              {/* Tab 1: Details (Detailed Images First + Specs & Content Below) */}
              {selectedTab === 'details' && (
                <div className="space-y-12">
                  {/* Section 1: Detailed Images (先展示圖片) */}
                  <div className="space-y-6">
                    <div className="text-center pb-4 border-b border-gray-100">
                      <h3
                        className="text-xl font-bold text-gray-900 tracking-wide"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                      >
                        商品詳細展示
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">DETAILED IMAGES</p>
                    </div>

                    {/* Detail Images Stack with Show More collapse */}
                    <div className="relative">
                      <div
                        className={`space-y-4 transition-all duration-500 ease-in-out ${
                          !isDetailExpanded && productImages.length > 2
                            ? 'max-h-[850px] overflow-hidden'
                            : 'max-h-none'
                        }`}
                      >
                        {productImages.map((url, idx) => (
                          <div
                            key={`detail-img-${idx}`}
                            className="w-full bg-white rounded-xl overflow-hidden shadow-2xs border border-gray-100"
                          >
                            <img
                              src={url}
                              alt={`${product.name} - 詳細展示 ${idx + 1}`}
                              className="w-full h-auto object-cover object-center block"
                              loading={idx === 0 ? 'eager' : 'lazy'}
                            />
                          </div>
                        ))}

                        {/* Rich HTML Content from Shopify if available */}
                        {product.descriptionHtml && (
                          <div
                            className="prose max-w-none text-gray-700 py-4"
                            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                          />
                        )}
                      </div>

                      {/* Musinsa-style Expand Button (Show More) */}
                      {!isDetailExpanded && productImages.length > 2 && (
                        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/90 to-transparent flex items-end justify-center pb-6">
                          <button
                            type="button"
                            onClick={() => setIsDetailExpanded(true)}
                            className="px-8 py-3 bg-white border border-gray-300 hover:border-[#245B50] text-[#245B50] hover:bg-emerald-50/40 rounded-full font-medium text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer group"
                            style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                          >
                            <span>展開完整商品圖片與說明</span>
                            <i className="ri-arrow-down-s-line text-lg group-hover:translate-y-0.5 transition-transform"></i>
                          </button>
                        </div>
                      )}

                      {isDetailExpanded && productImages.length > 2 && (
                        <div className="flex justify-center pt-6">
                          <button
                            type="button"
                            onClick={() => setIsDetailExpanded(false)}
                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                            style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                          >
                            <span>收起商品大圖</span>
                            <i className="ri-arrow-up-s-line text-base"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 2: Product Description, Specs & Notice (再顯示內容) */}
                  <div className="space-y-8 pt-8 border-t border-gray-200">
                    {/* 1. 商品說明 */}
                    {product.description && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 sm:p-8 shadow-2xs">
                        <h4
                          className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"
                          style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                        >
                          <i className="ri-file-text-line text-[#245B50]"></i>
                          商品說明
                        </h4>
                        <p className="leading-8 text-gray-700 whitespace-pre-line text-base">
                          {product.description}
                        </p>
                      </div>
                    )}

                    {/* 2. 規格細節 */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 sm:p-8 shadow-2xs">
                      <h4
                        className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                      >
                        <i className="ri-list-check-2 text-[#245B50]"></i>
                        產品詳細規格與資訊
                      </h4>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm border-t border-gray-200/60 pt-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-100">
                          <dt className="text-gray-500">產品名稱</dt>
                          <dd className="font-medium text-gray-900">{product.name}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-100">
                          <dt className="text-gray-500">目錄分類</dt>
                          <dd className="font-medium text-gray-900">{product.productType || product.tags?.[0] || '展示商品'}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-100">
                          <dt className="text-gray-500">品牌／供應商</dt>
                          <dd className="font-medium text-gray-900">{product.vendor || 'SAENGAK'}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-100">
                          <dt className="text-gray-500">規格樣式</dt>
                          <dd className="font-medium text-gray-900">
                            {selectedVariant?.title && selectedVariant.title !== 'Default Title'
                              ? selectedVariant.title
                              : '標準規格'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* 3. 資料狀態聲明 */}
                    <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-6 sm:p-7">
                      <h4
                        className="text-base font-semibold text-teal-900 mb-2 flex items-center gap-2"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                      >
                        <i className="ri-information-line text-teal-700"></i>
                        資料狀態說明
                      </h4>
                      <p className="leading-7 text-sm text-teal-800">
                        目前頁面包含展示目錄內容。容量、完整成分、製造資訊與認證，須以正式 Shopify 商品欄位及實際包裝標示為準；尚未接入的欄位不在此推定。
                      </p>
                    </div>

                    {/* 4. 使用與購買提醒 */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 sm:p-8 shadow-2xs">
                      <h4
                        className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                      >
                        <i className="ri-shield-check-line text-[#245B50]"></i>
                        使用與購買提醒
                      </h4>
                      <ul className="space-y-3 text-sm text-gray-700 leading-relaxed">
                        <li className="flex items-start gap-2">
                          <span className="text-[#245B50] font-bold">•</span>
                          <span>使用方式與注意事項請依商品包裝標示。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#245B50] font-bold">•</span>
                          <span>若出現不適請停止使用；孕期或有特殊健康狀況時，先諮詢合格專業人員。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#245B50] font-bold">•</span>
                          <span>付款、稅金、運送與最終售價以 Shopify Checkout 顯示為準。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#245B50] font-bold">•</span>
                          <span>
                            退換貨條件請參閱{' '}
                            <a className="text-[#245B50] underline font-medium hover:text-[#1a4239]" href="/return-policy">
                              退換貨說明
                            </a>
                            。
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Reviews */}
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

              {/* Tab 3: Related */}
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

              {/* Tab 4: Q&A */}
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
                    className="inline-flex items-center justify-center rounded-lg bg-[#245B50] px-6 py-3 font-medium text-white hover:bg-[#1a4239] transition-colors"
                  >
                    聯絡客服
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Zoom Modal */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
          onClick={handleModalClose}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleModalClose}
              aria-label="關閉放大圖"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
            <img
              src={activeImage}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
              }}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
