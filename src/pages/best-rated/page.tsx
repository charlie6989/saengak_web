
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';

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
  rating?: number;
  isBest?: boolean;
  isNew?: boolean;
  category?: string;
}

interface CategorySection {
  id: string;
  name: string;
  description: string;
  products: Product[];
  image: string;
}

export default function BestRated() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategorySection[]>([]);

  useEffect(() => {
    document.title = '五星好評產品 - LUCISSI CARE | 精選高評分女性護理產品';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', '精選各類別五星好評產品，包含女性護理、每日清潔、深層修護等高品質商品。真實用戶評價，值得信賴的選擇。');
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', '五星好評,高評分產品,女性護理,私密護理,用戶推薦,優質商品');
    }

    loadBestRatedProducts();
  }, []);

  const loadBestRatedProducts = async () => {
    try {
      setLoading(true);
      
      // 模擬載入各類別最佳評分產品
      const mockCategories: CategorySection[] = [
        {
          id: 'feminine-care',
          name: '女性護理',
          description: '專業私密護理產品，溫和配方呵護女性健康',
          image: 'https://readdy.ai/api/search-image?query=Premium%20feminine%20care%20products%20with%20elegant%20packaging%2C%20soft%20pink%20and%20white%20colors%2C%20clean%20minimalist%20Korean%20beauty%20style%2C%20professional%20product%20photography&width=600&height=400&seq=category1&orientation=landscape',
          products: [
            {
              id: 'fc1',
              name: '益生菌私密舒緩凝膠',
              description: '溫和配方，專為敏感肌膚設計的私密護理產品',
              image: 'https://readdy.ai/api/search-image?query=Premium%20feminine%20care%20gel%20product%20with%20clean%20minimalist%20packaging%2C%20soft%20pink%20and%20white%20colors%2C%20professional%20product%20photography%2C%20simple%20background&width=400&height=400&seq=fc1&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Feminine%20care%20gel%20product%20detail%20shot%20showing%20texture%20and%20ingredients%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=fc1-hover&orientation=squarish',
              price: 1280,
              originalPrice: 1600,
              reviews: 1247,
              rating: 4.9,
              isBest: true,
              category: '女性護理'
            },
            {
              id: 'fc2',
              name: '深層修護私密清潔露',
              description: '溫和深層清潔，維持私密部位健康平衡',
              image: 'https://readdy.ai/api/search-image?query=Feminine%20intimate%20wash%20cleanser%20bottle%20with%20elegant%20design%2C%20soft%20blue%20and%20white%20packaging%2C%20professional%20product%20photography&width=400&height=400&seq=fc2&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Intimate%20cleanser%20product%20with%20natural%20ingredients%20display%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=fc2-hover&orientation=squarish',
              price: 680,
              reviews: 892,
              rating: 4.8,
              isBest: true,
              category: '女性護理'
            },
            {
              id: 'fc3',
              name: '溫和私密護理濕巾',
              description: '隨身攜帶，隨時清潔，溫和不刺激',
              image: 'https://readdy.ai/api/search-image?query=Feminine%20care%20wet%20wipes%20package%20with%20clean%20design%2C%20portable%20size%2C%20soft%20colors%2C%20professional%20product%20photography&width=400&height=400&seq=fc3&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Feminine%20care%20wipes%20showing%20texture%20and%20packaging%20details%2C%20clean%20aesthetic&width=400&height=400&seq=fc3-hover&orientation=squarish',
              price: 320,
              reviews: 567,
              rating: 4.7,
              category: '女性護理'
            }
          ]
        },
        {
          id: 'underwear',
          name: '內褲系列',
          description: '舒適透氣，抗菌防護，呵護私密健康',
          image: 'https://readdy.ai/api/search-image?query=Premium%20seamless%20underwear%20collection%20in%20neutral%20colors%2C%20clean%20product%20photography%2C%20minimalist%20Korean%20style%2C%20elegant%20display&width=600&height=400&seq=category2&orientation=landscape',
          products: [
            {
              id: 'uw1',
              name: '抗菌無痕內褲 - 舒適款',
              description: '採用抗菌纖維，無痕設計，全天候舒適穿著',
              image: 'https://readdy.ai/api/search-image?query=Premium%20seamless%20antibacterial%20underwear%20in%20neutral%20colors%2C%20clean%20product%20photography%2C%20minimalist%20style&width=400&height=400&seq=uw1&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Seamless%20underwear%20fabric%20detail%20showing%20texture%20and%20comfort%20features%2C%20professional%20product%20shot&width=400&height=400&seq=uw1-hover&orientation=squarish',
              price: 890,
              originalPrice: 1200,
              reviews: 1456,
              rating: 4.9,
              isBest: true,
              category: '內褲系列'
            },
            {
              id: 'uw2',
              name: '生理褲 - 超薄款',
              description: '超薄設計，生理期專用，提供全方位保護',
              image: 'https://readdy.ai/api/search-image?query=Ultra-thin%20period%20underwear%20in%20soft%20colors%2C%20comfortable%20design%2C%20professional%20product%20photography%2C%20clean%20background&width=400&height=400&seq=uw2&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Period%20underwear%20showing%20absorption%20layers%20and%20comfort%20features%2C%20detailed%20product%20shot&width=400&height=400&seq=uw2-hover&orientation=squarish',
              price: 1450,
              originalPrice: 1800,
              reviews: 1123,
              rating: 4.8,
              isBest: true,
              category: '內褲系列'
            },
            {
              id: 'uw3',
              name: '舒適純棉內褲組合',
              description: '100% 純棉材質，透氣舒適，日常穿著首選',
              image: 'https://readdy.ai/api/search-image?query=Pure%20cotton%20underwear%20set%20in%20natural%20colors%2C%20comfortable%20design%2C%20professional%20product%20photography%2C%20minimalist%20style&width=400&height=400&seq=uw3&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Cotton%20underwear%20fabric%20detail%20showing%20softness%20and%20breathability%2C%20professional%20product%20shot&width=400&height=400&seq=uw3-hover&orientation=squarish',
              price: 1200,
              reviews: 834,
              rating: 4.7,
              category: '內褲系列'
            }
          ]
        },
        {
          id: 'daily-care',
          name: '每日護理',
          description: '日常清潔護理，溫和有效，適合每日使用',
          image: 'https://readdy.ai/api/search-image?query=Daily%20feminine%20care%20products%20collection%20with%20clean%20packaging%2C%20soft%20colors%2C%20professional%20product%20photography%2C%20Korean%20beauty%20style&width=600&height=400&seq=category3&orientation=landscape',
          products: [
            {
              id: 'dc1',
              name: '溫和每日清潔慕斯',
              description: '泡沫豐富，溫和清潔，適合每日使用',
              image: 'https://readdy.ai/api/search-image?query=Feminine%20care%20foam%20cleanser%20with%20pump%20bottle%2C%20elegant%20design%2C%20soft%20colors%2C%20professional%20product%20photography&width=400&height=400&seq=dc1&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Foam%20cleanser%20showing%20texture%20and%20bubbles%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=dc1-hover&orientation=squarish',
              price: 580,
              reviews: 723,
              rating: 4.8,
              category: '每日護理'
            },
            {
              id: 'dc2',
              name: '保濕護理精華液',
              description: '深層滋潤，維持私密部位水潤平衡',
              image: 'https://readdy.ai/api/search-image?query=Feminine%20care%20serum%20bottle%20with%20dropper%2C%20elegant%20packaging%2C%20professional%20product%20photography%2C%20clean%20background&width=400&height=400&seq=dc2&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Serum%20product%20showing%20texture%20and%20ingredients%2C%20professional%20lighting%2C%20clean%20aesthetic&width=400&height=400&seq=dc2-hover&orientation=squarish',
              price: 980,
              originalPrice: 1200,
              reviews: 456,
              rating: 4.7,
              category: '每日護理'
            },
            {
              id: 'dc3',
              name: '舒緩護理噴霧',
              description: '即時舒緩，隨時使用，清爽不黏膩',
              image: 'https://readdy.ai/api/search-image?query=Feminine%20care%20spray%20bottle%20with%20elegant%20design%2C%20portable%20size%2C%20professional%20product%20photography&width=400&height=400&seq=dc3&orientation=squarish',
              hoverImage: 'https://readdy.ai/api/search-image?query=Care%20spray%20showing%20mist%20effect%20and%20packaging%20details%2C%20clean%20aesthetic&width=400&height=400&seq=dc3-hover&orientation=squarish',
              price: 450,
              reviews: 612,
              rating: 4.6,
              category: '每日護理'
            }
          ]
        }
      ];

      setCategories(mockCategories);
    } catch (error) {
      console.error('載入產品時發生錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCategory = (categoryId: string) => {
    const categoryMap: { [key: string]: string } = {
      'feminine-care': '女性護理',
      'underwear': '內褲系列',
      'daily-care': '每日護理'
    };
    
    const categoryName = categoryMap[categoryId];
    if (categoryName) {
      navigate(`/search?category=${encodeURIComponent(categoryName)}`);
    }
  };

  const handleViewAllProducts = () => {
    navigate('/search');
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden">
        <div className="w-full" style={{ height: "500px" }}>
          <img
            src="https://readdy.ai/api/search-image?query=Premium%20feminine%20care%20products%20with%20five%20star%20rating%20display%2C%20elegant%20Korean%20beauty%20style%2C%20soft%20lighting%2C%20clean%20minimalist%20background%2C%20professional%20product%20photography&width=1349&height=500&seq=best-rated-hero&orientation=landscape"
            alt="五星好評產品"
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="absolute inset-0 bg-black/30"></div>
        
        <div className="absolute inset-0 flex items-center">
          <div className="w-full max-w-7xl mx-auto px-4">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-4">
                五星好評產品
              </h1>
              <p className="text-lg md:text-xl text-white/90 drop-shadow mb-6">
                精選各類別最受用戶喜愛的高評分產品，真實評價見證品質
              </p>
              <div className="flex items-center gap-4 text-white/80">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <i key={i} className="ri-star-fill text-yellow-400 text-lg"></i>
                  ))}
                </div>
                <span className="text-sm">平均評分 4.8 分</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* 統計資訊 */}
          <div className="text-center mb-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-600 mb-2">4.8+</div>
                <div className="text-gray-600">平均評分</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-600 mb-2">10,000+</div>
                <div className="text-gray-600">真實評價</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-600 mb-2">95%</div>
                <div className="text-gray-600">回購率</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin h-8 w-8 border-b-2 border-teal-600" style={{ borderRadius: '50%' }}></div>
              <p className="mt-4 text-gray-600">載入產品中...</p>
            </div>
          ) : (
            <div className="space-y-20">
              {categories.map((category, index) => (
                <section key={category.id} className="relative">
                  {/* 類別標題區域 */}
                  <div className="flex flex-col lg:flex-row items-center gap-12 mb-12">
                    <div className="lg:w-1/2">
                      <div className="aspect-[3/2] overflow-hidden rounded-2xl">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    </div>
                    <div className="lg:w-1/2 text-center lg:text-left">
                      <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                        <i className="ri-star-fill text-yellow-500"></i>
                        <span>五星推薦</span>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        {category.name}
                      </h2>
                      <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                        {category.description}
                      </p>
                      <button
                        onClick={() => handleViewCategory(category.id)}
                        className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-full hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>查看更多 {category.name}</span>
                        <i className="ri-arrow-right-line"></i>
                      </button>
                    </div>
                  </div>

                  {/* 產品網格 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8" data-product-shop>
                    {category.products.map((product) => (
                      <div key={product.id} className="group">
                        <ProductCard product={product} />
                        {/* 評分顯示 */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <i
                                  key={i}
                                  className={`text-sm ${
                                    i < Math.floor(product.rating || 0)
                                      ? 'ri-star-fill text-yellow-400'
                                      : 'ri-star-line text-gray-300'
                                  }`}
                                ></i>
                              ))}
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {product.rating}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {product.reviews?.toLocaleString()} 則評價
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* CTA 區域 */}
          <div className="text-center mt-20 py-16 bg-gradient-to-r from-teal-50 to-blue-50 rounded-3xl">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              探索更多優質產品
            </h3>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              我們還有更多經過嚴格篩選的優質產品等待您的發現
            </p>
            <button
              onClick={handleViewAllProducts}
              className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>瀏覽全部商品</span>
              <i className="ri-arrow-right-line"></i>
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
