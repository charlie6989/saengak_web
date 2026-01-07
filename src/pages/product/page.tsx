
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { getMockProductById } from '../../mocks/products';

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
  const { addToCart } = useCart();

  /** --------------------------------------------------------------------
   *  Fetch product & related products
   * ------------------------------------------------------------------- */
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

      const shopifyId = id?.includes('gid://shopify/Product/') ? id : `gid://shopify/Product/${id}`;

      // fetch the main product
      const response = await fetch(
        'https://vcswjiyxqhhdpvmsamil.supabase.co/functions/v1/get-products',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: [shopifyId] }),
        },
      );

      if (!response.ok) throw new Error('Failed to fetch product');

      const data = await response.json();

      if (data.products?.length) {
        setProduct(data.products[0]);

        // fetch related products (hard‑coded list for demo)
        const relatedResponse = await fetch(
          'https://vcswjiyxqhhdpvmsamil.supabase.co/functions/v1/get-products',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productIds: [
                'gid://shopify/Product/9969008509232',
                'gid://shopify/Product/9969008574768',
                'gid://shopify/Product/9969008607536',
                'gid://shopify/Product/9969008673072',
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
    if (id) fetchProduct();
  }, [id]);

  // custom scroll behaviour for the image / right‑hand content
  useEffect(() => {
    const handleScroll = () => {
      const productSection = document.getElementById('product-main-section');
      const mainImageContainer = document.getElementById('main-product-image');
      const rightContent = document.getElementById('right-product-content');

      if (!productSection || !mainImageContainer || !rightContent) return;

      const scrollTop = window.pageYOffset;
      const productSectionTop = productSection.offsetTop;
      const viewportHeight = window.innerHeight;
      const rightContentHeight = rightContent.scrollHeight;
      const rightContentScrollDistance = rightContentHeight - viewportHeight + 200;

      if (scrollTop >= productSectionTop - 100) {
        const relativeScroll = scrollTop - (productSectionTop - 100);
        if (relativeScroll <= rightContentScrollDistance) {
          // stage 1 – right side scrolls, image stays sticky
          mainImageContainer.style.position = 'sticky';
          mainImageContainer.style.top = '120px';
          mainImageContainer.style.zIndex = '10';
          rightContent.style.transform = `translateY(-${relativeScroll}px)`;
        } else {
          // stage 2 – both move together
          mainImageContainer.style.position = 'relative';
          mainImageContainer.style.top = 'auto';
          mainImageContainer.style.zIndex = '0';
          rightContent.style.transform = `translateY(-${rightContentScrollDistance}px)`;
        }
      } else {
        // reset before section enters view
        mainImageContainer.style.position = 'relative';
        mainImageContainer.style.top = 'auto';
        mainImageContainer.style.zIndex = '0';
        rightContent.style.transform = 'translateY(0px)';
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [product]);

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
        console.log('Buy now:', { productId: product.id, quantity });
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
  const productImages = product?.images?.length
    ? product.images.map((img) => img.url)
    : product
      ? [product.image, product.hoverImage || product.image]
      : [];

  const discountPercentage = product?.originalPrice
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

      <div className="max-w-[1440px] mx-auto px-4 md:px-6 pt-[52px]">
        {/* ------------ Main product section ------------ */}
        <div className="max-w-[1440px] mx-auto px-4 md:px-6" style={{ marginTop: 'var(--main-offset, 103px)' }}>
          <div className="flex items-start gap-12">
            {/* Left group: thumbnails + main image (sticky as whole group) */}
            <div
              className="flex items-start gap-[7px] sticky self-start"
              style={{ top: 'calc(var(--nav-h, 72px) + var(--main-offset, 52px))' }}
            >
              {/* Thumbnails column */}
              <aside className="shrink-0 overflow-auto">
                <ul className="flex md:block gap-2 md:gap-3">
                  {productImages.map((url, idx) => (
                    <li key={idx} className="md:mb-3 last:mb-0">
                      <button
                        onClick={() => handleThumbnailClick(idx)}
                        className={`block overflow-hidden rounded border ${selectedImage === idx ? 'border-emerald-600' : 'border-transparent'
                          }`}
                        style={{ width: '117.133px', height: '174.695px' }}
                      >
                        <img
                          src={url}
                          alt={`${product.name}-縮圖${idx + 1}`}
                          style={{ width: '117.133px', height: '174.695px', objectFit: 'cover', display: 'block' }}
                        />
                      </button>
                    </li>
                  ))}

                  {/* Placeholder if fewer than 4 images */}
                  {productImages.length < 4 &&
                    [...Array(4 - productImages.length)].map((_, idx) => (
                      <li key={`placeholder-${idx}`} className="md:mb-3 last:mb-0">
                        <div
                          className="block overflow-hidden rounded border border-transparent"
                          style={{ width: '117.133px', height: '174.695px' }}
                        >
                          <img
                            src="https://via.placeholder.com/117x175?text=Placeholder"
                            alt={`Placeholder ${idx + 1}`}
                            style={{ width: '117.133px', height: '174.695px', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      </li>
                    ))}
                </ul>
              </aside>

              {/* Main image */}
              <section id="main-product-image" className="shrink-0" style={{ width: '606px', height: '909px' }}>
                <img
                  src={productImages[selectedImage]}
                  alt={product.name}
                  onClick={() => handleImageClick(selectedImage)}
                  style={{
                    width: '606px',
                    height: '909px',
                    objectFit: 'contain',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                />
              </section>
            </div>

            {/* Right side content (regular scroll) */}
            <aside id="right-product-content" className="min-w-[360px] shrink-0" style={{ width: '400px' }}>
              <div className="space-y-5">
                {/* Tag */}
                <div>
                  <span className="inline-block bg-teal-100 text-teal-700 px-2 py-1 text-xs font-medium rounded">
                    女性護理
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {product.name}
                </h1>

                {/* Brand */}
                <div className="text-sm text-gray-600" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  韓國 | 韓國 Dermatest | 女性清潔劑
                </div>

                {/* Price */}
                <div className="space-y-1">
                  <div className="text-sm text-gray-400 line-through">15,000韓元</div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-lg font-bold"
                      style={{ fontFamily: 'Noto Sans TC, sans-serif', color: '#225B4F' }}
                    >
                      -{discountPercentage}%
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {product.price.toLocaleString()}韓元
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">2+1 促銷價，享受驚喜折扣！</div>
                  <div className="text-sm text-gray-600">
                    共 61% 折扣 → 最終優惠價格 $ 5,933 韓元
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">不含 21 種有害成分</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">使用植物性萃取成分</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">pH 4.5~5.5 弱酸性配方</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-green-500 mt-0.5 flex-shrink-0"></i>
                    <span className="text-gray-700">醫學等級皮膚測試認證</span>
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

                  {/* Additional product information */}
                  <div className="text-sm text-gray-700 space-y-8">
                    {/* Product features */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        產品特色
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>容量</span>
                          <span>180ml</span>
                        </div>
                        <div className="flex justify-between">
                          <span>製造國</span>
                          <span>韓國</span>
                        </div>
                        <div className="flex justify-between">
                          <span>適用對象</span>
                          <span>敏感肌膚適用</span>
                        </div>
                        <div className="flex justify-between">
                          <span>認證</span>
                          <span>Dermatest 皮膚測試</span>
                        </div>
                      </div>
                    </div>

                    {/* Usage recommendations */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        使用建議
                      </h4>
                      <div className="space-y-3">
                        <p>• 建議每日使用 1-2 次</p>
                        <p>• 適合日常清潔護理</p>
                        <p>• 溫和配方，長期使用無負擔</p>
                        <p>• 搭配溫水使用效果更佳</p>
                        <p>• 使用前請先清潔雙手</p>
                        <p>• 避免接觸眼部</p>
                      </div>
                    </div>

                    {/* Safety guarantee */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        安全保證
                      </h4>
                      <div className="space-y-3">
                        <p>✓ 通過韓國食品藥品安全處認證</p>
                        <p>✓ 無添加人工香料和色素</p>
                        <p>✓ 低敏配方，適合敏感肌膚</p>
                        <p>✓ 環保包裝，可回收利用</p>
                        <p>✓ 嚴格品質控制，確保產品安全</p>
                        <p>✓ 符合國際化妝品安全標準</p>
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        成分說明
                      </h4>
                      <div className="space-y-3">
                        <p>• 植物萃取精華：溫和清潔，不破壞天然屏障</p>
                        <p>• 弱酸性配方：維持私密部位健康pH值</p>
                        <p>• 無皂基配方：減少刺激，適合敏感肌膚</p>
                        <p>• 天然保濕因子：清潔同時保持水分平衡</p>
                        <p>• 蘆薈萃取：舒緩皮膚，減少不適感</p>
                        <p>• 洋甘菊精華：抗炎鎮靜，溫和護理</p>
                      </div>
                    </div>

                    {/* Brand promise */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        品牌承諾
                      </h4>
                      <div className="space-y-3">
                        <p>• 30天滿意保證，不滿意可退換</p>
                        <p>• 全球配送，安全包裝</p>
                        <p>• 24小時客服支援</p>
                        <p>• 會員專享優惠和新品資訊</p>
                        <p>• 定期舉辦健康講座和諮詢</p>
                        <p>• 提供專業的使用指導</p>
                      </div>
                    </div>

                    {/* Customer reviews */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        用戶好評
                      </h4>
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="italic mb-2">
                            "使用後感覺非常舒適，沒有任何不適感，會持續購買！"
                          </p>
                          <p className="text-xs text-gray-500">- 李小姐</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="italic mb-2">
                            "韓國品質真的很棒，包裝精美，效果也很好。"
                          </p>
                          <p className="text-xs text-gray-500">- 王女士</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="italic mb-2">
                            "溫和不刺激，敏感肌膚也能安心使用。"
                          </p>
                          <p className="text-xs text-gray-500">- 陳小姐</p>
                        </div>
                      </div>
                    </div>

                    {/* FAQ */}
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        常見問題
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <p className="font-medium text-gray-900 mb-1">
                            Q: 適合什麼年齡使用？
                          </p>
                          <p>A: 適合18歲以上女性使用，特別推薦給有私密護理需求的女性。</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">
                            Q: 懷孕期間可以使用嗎？
                          </p>
                          <p>A: 建議懷孕期間使用前先諮詢醫師意見。</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">
                            Q: 多久可以看到效果？
                          </p>
                          <p>A: 一般使用1-2週後可感受到明顯改善。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

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
                    src={productImages[selectedImage]}
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
                  評論 (354)
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
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      用戶評價
                    </h3>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <i key={i} className="ri-star-fill text-lg"></i>
                        ))}
                      </div>
                      <span className="text-lg font-medium text-gray-900">4.8</span>
                      <span className="text-gray-600">(53 評價)</span>
                    </div>
                  </div>

                  {/* Review list */}
                  <div className="space-y-6">
                    {[
                      {
                        name: '李小姐',
                        rating: 5,
                        date: '2024-01-15',
                        comment:
                          '非常溫和的產品，使用後感覺很舒適，沒有任何刺激感。包裝也很精美，會繼續購買。',
                        helpful: 12,
                      },
                      {
                        name: '王女士',
                        rating: 5,
                        date: '2024-01-10',
                        comment: '韓國製造的品質真的很好，泡沫很細緻，清潔力也很棒。價格合理，推薦給朋友們。',
                        helpful: 8,
                      },
                      {
                        name: '陳小姐',
                        rating: 4,
                        date: '2024-01-08',
                        comment: '產品效果不錯，但是瓶子設計可以再改進一下。整體來說還是很滿意的。',
                        helpful: 5,
                      },
                    ].map((review, index) => (
                      <div key={index} className="border-b border-gray-100 pb-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                                {review.name}
                              </span>
                              <div className="flex text-yellow-400">
                                {[...Array(review.rating)].map((_, i) => (
                                  <i key={i} className="ri-star-fill text-sm"></i>
                                ))}
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">{review.date}</span>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-3 leading-relaxed" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          {review.comment}
                        </p>
                        <div className="flex items-center gap-4">
                          <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                            <i className="ri-thumb-up-line"></i> 有幫助 ({review.helpful})
                          </button>
                          <button className="text-sm text-gray-500 hover:text-gray-700">回覆</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center">
                    <button
                      className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                    >
                      查看更多評價
                    </button>
                  </div>
                </div>
              )}

              {/* Details */}
              {selectedTab === 'details' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      產品詳細資訊
                    </h3>

                    {/* Specs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          基本資訊
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">產品名稱</span>
                            <span className="text-gray-900">Saengak 平衡調理私密潔淨慕絲</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">容量</span>
                            <span className="text-gray-900">180ml</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">製造國</span>
                            <span className="text-gray-900">韓國</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">保存期限</span>
                            <span className="text-gray-900">3年</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          成分特色
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">pH值</span>
                            <span className="text-gray-900">4.5~5.5 弱酸性</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">主要成分</span>
                            <span className="text-gray-900">植物萃取精華</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">認證</span>
                            <span className="text-gray-900">Dermatest 皮膚測試</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">適用對象</span>
                            <span className="text-gray-900">敏感肌膚適用</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Usage */}
                    <div className="mb-8">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        使用方法
                      </h4>
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <ol className="space-y-3 text-gray-700" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          <li className="flex items-start gap-3">
                            <span className="bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                              1
                            </span>
                            <span>用溫水濕潤私密部位</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                              2
                            </span>
                            <span>按壓2-3下，產生豐富泡沫</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                              3
                            </span>
                            <span>（此處可加入後續步驟說明）</span>
                          </li>
                        </ol>
                      </div>
                    </div>

                    {/* Cautions */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        注意事項
                      </h4>
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <ul className="space-y-2 text-gray-700 text-sm" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          <li>• 僅供外用，避免接觸眼部</li>
                          <li>• 如有過敏反應請立即停止使用</li>
                          <li>• 請存放於陰涼乾燥處，避免陽光直射</li>
                          <li>• 請勿讓兒童接觸</li>
                        </ul>
                      </div>
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
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      常見問題
                    </h3>
                    <p className="text-gray-600">有任何疑問嗎？查看其他顧客的提問或提出您的問題</p>
                  </div>

                  {/* Question form */}
                  <div className="bg-gray-50 p-6 rounded-lg mb-8">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      提出問題
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">您的問題</label>
                        <textarea
                          className="w-full p-2 border rounded"
                          rows={4}
                          placeholder="在此輸入您的問題..."
                        ></textarea>
                      </div>
                      {/* Additional form fields can be added here */}
                      <button
                        className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                      >
                        提交問題
                      </button>
                    </div>
                  </div>

                  {/* Sample questions */}
                  <div className="space-y-6">
                    {[
                      {
                        question: '這個產品可以用來清洗陰道內部嗎？',
                        answer:
                          '不建議用於陰道內部。此產品專門設計用於外陰部清潔，以維持私密部位的自然酸鹼平衡。如有任何不適，請停止使用並諮詢醫師。',
                        helpful: 24,
                      },
                      {
                        question: '成分中的植物萃取會引起過敏嗎？',
                        answer:
                          'Saengak 產品經過嚴格測試，使用低敏配方，但極少數人仍可能對植物成分過敏。建議使用前先在小範圍皮膚測試。若出現紅腫或癢感，請立即停用並諮詢醫師。',
                        helpful: 18,
                      },
                      {
                        question: '懷孕期間可使用嗎？',
                        answer:
                          '懷孕期間荷爾蒙變化可能導致私密部位敏感度提升。建議在懷孕期間使用本產品前，先諮詢專業婦產科醫師意見。',
                        helpful: 12,
                      },
                    ].map((qa, index) => (
                      <div key={index} className="border-b border-gray-200 pb-6">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                            Q
                          </span>
                          <p className="text-gray-900 font-medium">{qa.question}</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                            A
                          </span>
                          <p className="text-gray-700">{qa.answer}</p>
                        </div>
                        <div className="mt-4 ml-9">
                          <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                            <i className="ri-thumb-up-line"></i> 有幫助 ({qa.helpful})
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
