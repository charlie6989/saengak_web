
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { getMockProductById } from '../../mocks/products';
import { getFunctionHeaders, getFunctionUrl, isShopifyStorefrontEnabled } from '../../lib/supabase';
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
  images?: { url: string }[];
  variants?: any[];
  reviews?: number;
  handle?: string;
  tags?: string[];
  productType?: string;
  vendor?: string;
}

/**
 * Product detail page.
 * Handles fetching product data, related products, and UI interactions.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'reviews' | 'details' | 'related' | 'qa'>('related');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, setIsCartOpen } = useCart();

  /** --------------------------------------------------------------------
   *  Fetch product & related products
   * ------------------------------------------------------------------- */
  const fetchProduct = async () => {
    setLoading(true);
    try {
      // 1. Try to find in mock data first if it looks like a simple ID
      const mockProduct = getMockProductById(id || '');
      if (mockProduct && !id?.startsWith('gid://')) {
        setProduct(mockProduct);
        setLoading(false);
        return;
      }

      if (!isShopifyStorefrontEnabled) return;

      const shopifyId = id?.includes('gid://shopify/Product/') ? id : `gid://shopify/Product/${id}`;

      // fetch the main product
      const response = await fetch(
        getFunctionUrl('get-products'),
        {
          method: 'POST',
          headers: getFunctionHeaders(),
          body: JSON.stringify({ productIds: [shopifyId] }),
        },
      );

      if (!response.ok) throw new Error('Failed to fetch product');

      const data = await response.json();

      if (data.products?.length) {
        setProduct(data.products[0]);

        // fetch related products (hard‑coded list for demo)
        const relatedResponse = await fetch(
          getFunctionUrl('get-products'),
          {
            method: 'POST',
            headers: getFunctionHeaders(),
            body: JSON.stringify({
              productIds: [
                'gid://shopify/Product/7786993614915',
              ],
            }),
          },
        );

        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json();
          if (relatedData.products) {
            const filtered = relatedData.products.filter((p: Product) => p.id !== shopifyId);
            setRelatedProducts(filtered.slice(0, 4));
          }
        }
      } else {
        // Fallback: if API returns empty/success but no product found, try mock
        // This handles cases where ID might be "1" but passed as shopify ID to API and failed
        const fallbackMock = getMockProductById(id || '');
        if (fallbackMock) {
          setProduct(fallbackMock);
        }
      }
    } catch (err) {
      console.error('Error fetching product data:', err);
      // Final fallback to mock data on error
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
   *  Handlers
   * ------------------------------------------------------------------- */
  const handleAddToCart = () => {
    if (product) {
      try {
        addToCart(product, quantity);
      } catch (e) {
        console.error('Add to cart failed:', e);
      }
    }
  };

  const handleBuyNow = () => {
    if (product) {
      try {
        addToCart(product, quantity);
        setIsCartOpen(true);
      } catch (e) {
        console.error('Buy now failed:', e);
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

  const discountPercentage = product?.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
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
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="text-sm text-gray-400 line-through">{formatTwd(product.originalPrice)}</div>
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
                    <span className="text-2xl font-bold text-gray-900">
                      {formatTwd(product.price)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    最終售價、稅金與優惠以 Shopify Checkout 顯示為準。
                  </div>
                </div>

                {/* Source status */}
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">商品名稱與展示價格來自目前目錄資料</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">結帳前必須取得有效 Shopify 規格 ID</span>
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
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900"
                      >
                        -
                      </button>
                      <span className="w-12 text-center text-sm border-l border-r border-gray-300 py-2">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="flex-1 h-12 border font-medium transition-colors"
                      style={{
                        backgroundColor: '#ffffff',
                        borderColor: '#245B50',
                        color: '#245B50',
                        fontFamily: "Noto Sans TC, sans-serif"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0fdf4';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      加入購物車
                    </button>
                    {/* Modified Buy Now button */}
                    <button
                      onClick={handleBuyNow}
                      className="flex-1 h-12 border font-medium transition-colors"
                      style={{
                        backgroundColor: '#245B50',
                        borderColor: '#245B50',
                        color: '#ffffff',
                        fontFamily: "Noto Sans TC, sans-serif"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#1a4239';
                        e.currentTarget.style.borderColor = '#1a4239';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#245B50';
                        e.currentTarget.style.borderColor = '#245B50';
                      }}
                    >
                      立即購買
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
