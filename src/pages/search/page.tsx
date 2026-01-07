import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { useShopifyCollections, useShopifyCollectionProducts } from '../../hooks/useShopifyCollections';
import { useShopifyProductsByTag, COMMON_TAGS, TAG_COMBINATIONS } from '../../hooks/useShopifyTags';
import { mockProducts, type Product } from '../../mocks/products';

export default function Search() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('最受歡迎');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<'default' | 'collection' | 'tag'>('default');

  // 新增篩選狀態 - 改為多選
  const [selectedUsages, setSelectedUsages] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    category: true,
    usage: true,
    size: false,
    color: false
  });

  // Shopify hooks
  const { collections } = useShopifyCollections();
  const { collection, products: collectionProducts, fetchCollectionProducts } = useShopifyCollectionProducts();
  const { products: tagProducts, productsByTag, fetchProductsByTag } = useShopifyProductsByTag();

  // 從 URL 參數讀取分類和搜尋字串
  const category = searchParams.get('category') || '';
  const q = searchParams.get('q') || '';
  const collectionHandle = searchParams.get('collection') || '';
  const tag = searchParams.get('tag') || '';

  const categories = [
    '女性護理',
    '每日清潔',
    '深層修護',
    '生理褲',
    '抗菌無痕內褲',
    '超薄無痕內褲',
    '無痕收腹內褲',
    '舒適純棉內褲'
  ];

  // 新增篩選選項
  const usageOptions = [
    '日常護理',
    '生理期護理',
    '運動時穿著',
    '睡眠時穿著',
    '特殊場合',
    '敏感肌適用'
  ];

  const sizeOptions = [
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    'Free Size'
  ];

  const colorOptions = [
    '黑色',
    '白色',
    '膚色',
    '粉色',
    '灰色',
    '藍色',
    '紫色'
  ];

  const brands = [
    'Inner Saengak',
    '私密護理專家',
    '女性健康',
    '溫和配方'
  ];

  const sortOptions = [
    '相關性',
    '最受歡迎',
    '評分',
    '最新上架',
    '價格低到高',
    '價格高到低'
  ];

  const shopifyProductIds = [
    'gid://shopify/Product/9969008509232',
    'gid://shopify/Product/9969008542000',
    'gid://shopify/Product/9969008574768',
    'gid://shopify/Product/9969008607536',
    'gid://shopify/Product/9969008673072',
    'gid://shopify/Product/9975451189552'
  ];

  // 載入產品數據
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        console.log('Loading products - method determination...');

        // 優先級：collection > tag > category > default
        if (collectionHandle) {
          console.log('Loading products from collection:', collectionHandle);
          setLoadingMethod('collection');
          await fetchCollectionProducts(collectionHandle);
          return;
        }

        if (tag) {
          console.log('Loading products by tag:', tag);
          setLoadingMethod('tag');
          await fetchProductsByTag([tag]);
          return;
        }

        if (category) {
          console.log('Loading products by category tag:', category);
          setLoadingMethod('tag');
          // 根據分類映射到對應的標籤
          const categoryTagMap: { [key: string]: string[] } = {
            '女性護理': [COMMON_TAGS.FEMININE_CARE, '私密護理', 'feminine'],
            '每日清潔': [COMMON_TAGS.DAILY_CLEAN, '清潔', 'clean'],
            '深層修護': [COMMON_TAGS.DEEP_REPAIR, '修護', 'repair'],
            '生理褲': [COMMON_TAGS.PERIOD_CARE, '生理', 'period'],
            '抗菌無痕內褲': [COMMON_TAGS.ANTIBACTERIAL, COMMON_TAGS.SEAMLESS, '抗菌', '無痕'],
            '超薄無痕內褲': [COMMON_TAGS.SEAMLESS, '超薄', '無痕'],
            '無痕收腹內褲': [COMMON_TAGS.SEAMLESS, '收腹', '無痕'],
            '舒適純棉內褲': [COMMON_TAGS.COTTON, '純棉', '舒適']
          };

          const tagsToSearch = categoryTagMap[category] || [category];
          await fetchProductsByTag(tagsToSearch);
          return;
        }

        // 默認載入方式
        console.log('Loading products from Shopify (default)...');
        setLoadingMethod('default');

        const response = await fetch('https://vcswjiyxqhhdpvmsamil.supabase.co/functions/v1/get-products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productIds: shopifyProductIds
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status ${response.status}`);
        }

        const data = await response.json();
        console.log('Products loaded:', data);

        if (data.success && data.products) {
          // 轉換 Shopify 產品數據格式
          const transformedProducts = data.products.map((product: any) => ({
            id: product.id,
            name: product.name || product.title,
            description: product.description,
            image: product.image,
            hoverImage: product.hoverImage || product.image,
            price: product.price,
            originalPrice: product.originalPrice,
            model: product.handle,
            reviews: Math.floor(Math.random() * 500) + 50,
            isBest: Math.random() > 0.7,
            isNew: Math.random() > 0.8,
            tags: product.tags || [],
            productType: product.productType || '',
            vendor: product.vendor || ''
          }));

          setProducts(transformedProducts);
          console.log('Products set:', transformedProducts.length);
        } else {
          console.error('Failed to load products:', data);
          setProducts(getFallbackProducts());
        }
      } catch (error) {
        console.error('Error loading products:', error);
        setProducts(getFallbackProducts());
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [collectionHandle, tag, category]);

  // 監聽不同數據源的產品變化
  useEffect(() => {
    if (loadingMethod === 'collection' && collectionProducts.length > 0) {
      const transformedProducts = collectionProducts.map((product: any) => ({
        id: product.id,
        name: product.name || product.title,
        description: product.description,
        image: product.image,
        hoverImage: product.hoverImage || product.image,
        price: product.price,
        originalPrice: product.originalPrice,
        model: product.handle,
        reviews: Math.floor(Math.random() * 500) + 50,
        isBest: Math.random() > 0.7,
        isNew: Math.random() > 0.8,
        tags: product.tags || [],
        productType: product.productType || '',
        vendor: product.vendor || ''
      }));
      setProducts(transformedProducts);
      setLoading(false);
    }
  }, [collectionProducts, loadingMethod]);

  useEffect(() => {
    if (loadingMethod === 'tag' && tagProducts.length > 0) {
      const transformedProducts = tagProducts.map((product: any) => ({
        id: product.id,
        name: product.name || product.title,
        description: product.description,
        image: product.image,
        hoverImage: product.hoverImage || product.image,
        price: product.price,
        originalPrice: product.originalPrice,
        model: product.handle,
        reviews: Math.floor(Math.random() * 500) + 50,
        isBest: Math.random() > 0.7,
        isNew: Math.random() > 0.8,
        tags: product.tags || [],
        productType: product.productType || '',
        vendor: product.vendor || ''
      }));
      setProducts(transformedProducts);
      setLoading(false);
    }
  }, [tagProducts, loadingMethod]);

  // 監聽 URL 參數變化並更新狀態
  useEffect(() => {
    console.log('URL 參數變化 - category:', category, 'q:', q, 'collection:', collectionHandle, 'tag:', tag);

    // 重置所有篩選
    setSelectedCategories(category ? [category] : []);
    setSelectedUsages([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedBrands([]);
    setPriceRange([0, 200000]);
    setSearchQuery(q || '');
    setSortBy('最受歡迎');
  }, [category, q, collectionHandle, tag]);

  // 🆕 Filter 開啟時鎖 body 捲動
  useEffect(() => {
    document.body.classList.toggle("no-scroll", isFilterOpen);
    return () => document.body.classList.remove("no-scroll");
  }, [isFilterOpen]);

  // 備用產品數據
  const getFallbackProducts = (): Product[] => {
    return mockProducts;
  };

  // 切換展開狀態
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 處理多選邏輯
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleUsageToggle = (usage: string) => {
    setSelectedUsages(prev =>
      prev.includes(usage)
        ? prev.filter(u => u !== usage)
        : [...prev, usage]
    );
  };

  const handleSizeToggle = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const handleColorToggle = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const handleBrandToggle = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedUsages([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceRange([0, 200000]);
    setSelectedBrands([]);
    setSortBy('最受歡迎');
    setSearchQuery('');
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());

    // 改進分類匹配邏輯 - 更寬鬆的匹配規則
    const matchesCategory = selectedCategories.length === 0 ||
      selectedCategories.some(category => {
        const productText = `${product.name} ${product.description}`.toLowerCase();
        const categoryLower = category.toLowerCase();

        // 直接關鍵字匹配
        if (productText.includes(categoryLower)) {
          return true;
        }

        // 檢查 Shopify 標籤
        if (product.tags && Array.isArray(product.tags)) {
          const hasTagMatch = product.tags.some(tag =>
            tag.toLowerCase().includes(categoryLower) ||
            categoryLower.includes(tag.toLowerCase())
          );
          if (hasTagMatch) return true;
        }

        // 檢查產品類型
        if (product.productType) {
          const productTypeLower = product.productType.toLowerCase();
          if (productTypeLower.includes(categoryLower) ||
            categoryLower.includes(productTypeLower)) {
            return true;
          }
        }

        // 更寬鬆的關鍵字匹配規則
        switch (category) {
          case '女性護理':
            return productText.includes('女性') ||
              productText.includes('護理') ||
              productText.includes('私密') ||
              productText.includes('凝膠') ||
              productText.includes('清潔') ||
              productText.includes('益生菌') ||
              productText.includes('舒緩') ||
              productText.includes('feminine') ||
              productText.includes('intimate');
          case '每日清潔':
            return productText.includes('清潔') ||
              productText.includes('洗') ||
              productText.includes('日常') ||
              productText.includes('每日') ||
              productText.includes('清洗') ||
              productText.includes('wash') ||
              productText.includes('clean');
          case '深層修護':
            return productText.includes('修護') ||
              productText.includes('深層') ||
              productText.includes('精華') ||
              productText.includes('修復') ||
              productText.includes('滋養') ||
              productText.includes('repair') ||
              productText.includes('treatment');
          case '生理褲':
          case '抗菌無痕內褲':
          case '超薄無痕內褲':
          case '無痕收腹內褲':
          case '舒適純棉內褲':
            return productText.includes('內褲') ||
              productText.includes('褲') ||
              productText.includes('穿著') ||
              productText.includes('生理') ||
              productText.includes('無痕') ||
              productText.includes('抗菌') ||
              productText.includes('純棉') ||
              productText.includes('收腹') ||
              productText.includes('underwear') ||
              productText.includes('panties');
          default:
            const categoryWords = category.split('');
            return categoryWords.some(word =>
              word.length > 0 && productText.includes(word)
            );
        }
      });

    const matchesUsage = selectedUsages.length === 0 ||
      selectedUsages.some(usage =>
        product.name.includes(usage) || product.description.includes(usage)
      );
    const matchesSize = selectedSizes.length === 0 ||
      selectedSizes.some(size =>
        product.name.includes(size) || product.description.includes(size)
      );
    const matchesColor = selectedColors.length === 0 ||
      selectedColors.some(color =>
        product.name.includes(color) || product.description.includes(color)
      );
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const matchesBrand = selectedBrands.length === 0 || selectedBrands.some(brand =>
      product.name.includes(brand) || product.description.includes(brand)
    );

    return matchesSearch && matchesCategory && matchesUsage && matchesSize && matchesColor && matchesPrice && matchesBrand;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case '價格低到高':
        return a.price - b.price;
      case '價格高到低':
        return b.price - a.price;
      case '最新上架':
        return b.isNew ? 1 : -1;
      case '評分':
        return (b.reviews || 0) - (a.reviews || 0);
      case '相關性':
        if (searchQuery) {
          const getRelevanceScore = (product: Product) => {
            let score = 0;
            const query = searchQuery.toLowerCase();
            const name = product.name.toLowerCase();
            const description = product.description.toLowerCase();

            if (name === query) score += 100;
            else if (name.startsWith(query)) score += 80;
            else if (name.includes(query)) score += 60;

            if (description.includes(query)) score += 30;

            return score;
          };

          return getRelevanceScore(b) - getRelevanceScore(a);
        }
        return 0;
      default:
        return 0;
    }
  });

  // 檢查是否有任何篩選條件
  const hasActiveFilters = selectedCategories.length > 0 || selectedUsages.length > 0 ||
    selectedSizes.length > 0 || selectedColors.length > 0 ||
    selectedBrands.length > 0 || priceRange[0] > 0 || priceRange[1] < 200000;

  // 獲取當前頁面標題
  const getPageTitle = () => {
    if (collection) {
      return collection.title;
    }
    if (tag) {
      return `標籤: ${tag}`;
    }
    if (category) {
      return category;
    }
    if (q) {
      return `搜尋: ${q}`;
    }
    return "全部商品";
  };

  // 獲取當前頁面描述
  const getPageDescription = () => {
    if (collection) {
      return collection.description || '精選商品系列';
    }
    if (tag) {
      return `包含 ${tag} 標籤的所有商品`;
    }
    if (category) {
      return '專業女性護理產品，呵護您的健康';
    }
    if (q) {
      return `"${q}" 的搜尋結果`;
    }
    return '專業女性護理產品，呵護您的健康';
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />

      {/* Hero Banner Section - 手機版優化 */}
      <div className="relative w-full overflow-hidden">
        <div className="w-full h-[280px] sm:h-[400px] lg:h-[695px]">
          <img
            src={collection?.image || "https://readdy.ai/api/search-image?query=Premium%20feminine%20care%20products%20arranged%20elegantly%20on%20wooden%20platform%20with%20soft%20natural%20lighting%2C%20clean%20minimalist%20Korean%20beauty%20style%2C%20warm%20beige%20and%20cream%20tones%2C%20professional%20product%20photography%2C%20simple%20background&width=1349&height=695&seq=search-hero&orientation=landscape"}
            alt={getPageTitle()}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-full sm:max-w-[70%] lg:max-w-[60%]">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg mb-2 sm:mb-3">
                {getPageTitle()}
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-white/90 drop-shadow">
                {getPageDescription()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="page-content">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-4 sm:py-6">
            {/* Product Count and Controls - 手機版優化 */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              {/* Product Count */}
              <div className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">{sortedProducts.length}</span> 件商品
                {loadingMethod === 'collection' && collection && (
                  <span className="hidden sm:inline ml-2 text-teal-600">來自 {collection.title}</span>
                )}
                {loadingMethod === 'tag' && tag && (
                  <span className="hidden sm:inline ml-2 text-teal-600">標籤: {tag}</span>
                )}
              </div>

              {/* Sort and Filter Controls - 手機版優化 */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Sort By - 手機版簡化 */}
                <div className="relative">
                  <button
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 hover:border-teal-500 transition-colors cursor-pointer rounded-lg"
                    onClick={() => {
                      setIsSortOpen(!isSortOpen);
                      setIsFilterOpen(false);
                    }}
                  >
                    <i className="ri-arrow-up-down-line text-gray-600 text-base sm:text-lg"></i>
                    <span className="hidden sm:inline text-sm text-gray-700">{sortBy}</span>
                  </button>

                  {isSortOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsSortOpen(false)}
                      ></div>
                      <div className="absolute top-full right-0 mt-2 w-48 sm:w-56 bg-white border border-gray-200 shadow-xl z-40 rounded-lg overflow-hidden">
                        <div className="py-2">
                          {sortOptions.map((option) => (
                            <button
                              key={option}
                              onClick={() => {
                                setSortBy(option);
                                setIsSortOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-teal-50 transition-colors ${sortBy === option ? 'bg-teal-50 font-medium text-teal-700' : 'font-normal text-gray-700'
                                }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Filter - 手機版優化 */}
                <div className="relative">
                  <button
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer rounded-lg"
                    onClick={() => {
                      setIsFilterOpen(!isFilterOpen);
                      setIsSortOpen(false);
                    }}
                  >
                    <i className="ri-equalizer-line text-base sm:text-lg"></i>
                    <span className="text-sm font-medium">篩選</span>
                    {hasActiveFilters && (
                      <span className="w-2 h-2 bg-white rounded-full"></span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* === Filter Sidebar - 手機版全屏優化 === */}
          <AnimatePresence>
            {isFilterOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black bg-opacity-50 z-40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsFilterOpen(false)}
                />
                {/* Panel - 手機版全屏 */}
                <motion.aside
                  className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-xl z-50 overflow-y-auto"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: "tween", duration: 0.3 }}
                >
                  <div className="flex flex-col h-full">
                    {/* Header - 固定在頂部 */}
                    <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
                      <div className="flex items-center justify-between p-4 sm:p-6">
                        <h3 className="text-lg font-semibold text-gray-900">篩選條件</h3>
                        <button
                          onClick={() => setIsFilterOpen(false)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer rounded-lg"
                        >
                          <i className="ri-close-line text-xl text-gray-600"></i>
                        </button>
                      </div>

                      {/* Applied Filters Tags - 手機版優化 */}
                      {hasActiveFilters && (
                        <div className="px-4 sm:px-6 pb-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedCategories.map((category) => (
                              <span key={category} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs sm:text-sm rounded-full">
                                {category}
                                <button
                                  onClick={() => handleCategoryToggle(category)}
                                  className="hover:text-teal-900 cursor-pointer"
                                >
                                  <i className="ri-close-line text-sm"></i>
                                </button>
                              </span>
                            ))}

                            {selectedUsages.map((usage) => (
                              <span key={usage} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs sm:text-sm rounded-full">
                                {usage}
                                <button
                                  onClick={() => handleUsageToggle(usage)}
                                  className="hover:text-teal-900 cursor-pointer"
                                >
                                  <i className="ri-close-line text-sm"></i>
                                </button>
                              </span>
                            ))}

                            {selectedSizes.map((size) => (
                              <span key={size} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs sm:text-sm rounded-full">
                                {size}
                                <button
                                  onClick={() => handleSizeToggle(size)}
                                  className="hover:text-teal-900 cursor-pointer"
                                >
                                  <i className="ri-close-line text-sm"></i>
                                </button>
                              </span>
                            ))}

                            {selectedColors.map((color) => (
                              <span key={color} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs sm:text-sm rounded-full">
                                {color}
                                <button
                                  onClick={() => handleColorToggle(color)}
                                  className="hover:text-teal-900 cursor-pointer"
                                >
                                  <i className="ri-close-line text-sm"></i>
                                </button>
                              </span>
                            ))}

                            {selectedBrands.map((brand) => (
                              <span key={brand} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs sm:text-sm rounded-full">
                                {brand}
                                <button
                                  onClick={() => handleBrandToggle(brand)}
                                  className="hover:text-teal-900 cursor-pointer"
                                >
                                  <i className="ri-close-line text-sm"></i>
                                </button>
                              </span>
                            ))}

                            {(priceRange[0] > 0 || priceRange[1] < 200000) && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs sm:text-sm rounded-full">
                                ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
                                <button
                                  onClick={() => setPriceRange([0, 200000])}
                                  className="hover:text-teal-900 cursor-pointer"
                                >
                                  <i className="ri-close-line text-sm"></i>
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Filter Content - 可滾動區域 */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                      {/* Category Filter */}
                      <div className="mb-6">
                        <button
                          onClick={() => toggleSection('category')}
                          className="w-full flex items-center justify-between py-3 text-left border-b border-gray-200"
                        >
                          <span className="text-sm font-semibold text-gray-900">類別</span>
                          <i className={`ri-${expandedSections.category ? 'subtract' : 'add'}-line text-gray-500 text-lg transition-transform duration-200`}></i>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.category ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="pt-4 space-y-3">
                            {categories.map((category) => (
                              <label key={category} className="flex items-center cursor-pointer group">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(category)}
                                    onChange={() => handleCategoryToggle(category)}
                                    className="sr-only"
                                  />
                                  <div className={`w-5 h-5 border-2 rounded transition-all duration-200 ${selectedCategories.includes(category)
                                    ? 'border-teal-600 bg-teal-600'
                                    : 'border-gray-300 bg-white group-hover:border-teal-400'
                                    }`}>
                                    {selectedCategories.includes(category) && (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <i className="ri-check-line text-white text-xs"></i>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className={`ml-3 text-sm transition-colors duration-200 ${selectedCategories.includes(category) ? 'text-gray-900 font-medium' : 'text-gray-700'
                                  }`}>
                                  {category}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Usage Filter */}
                      <div className="mb-6">
                        <button
                          onClick={() => toggleSection('usage')}
                          className="w-full flex items-center justify-between py-3 text-left border-b border-gray-200"
                        >
                          <span className="text-sm font-semibold text-gray-900">用途</span>
                          <i className={`ri-${expandedSections.usage ? 'subtract' : 'add'}-line text-gray-500 text-lg transition-transform duration-200`}></i>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.usage ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="pt-4 space-y-3">
                            {usageOptions.map((usage) => (
                              <label key={usage} className="flex items-center cursor-pointer group">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={selectedUsages.includes(usage)}
                                    onChange={() => handleUsageToggle(usage)}
                                    className="sr-only"
                                  />
                                  <div className={`w-5 h-5 border-2 rounded transition-all duration-200 ${selectedUsages.includes(usage)
                                    ? 'border-teal-600 bg-teal-600'
                                    : 'border-gray-300 bg-white group-hover:border-teal-400'
                                    }`}>
                                    {selectedUsages.includes(usage) && (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <i className="ri-check-line text-white text-xs"></i>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className={`ml-3 text-sm transition-colors duration-200 ${selectedUsages.includes(usage) ? 'text-gray-900 font-medium' : 'text-gray-700'
                                  }`}>
                                  {usage}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Size Filter */}
                      <div className="mb-6">
                        <button
                          onClick={() => toggleSection('size')}
                          className="w-full flex items-center justify-between py-3 text-left border-b border-gray-200"
                        >
                          <span className="text-sm font-semibold text-gray-900">尺寸</span>
                          <i className={`ri-${expandedSections.size ? 'subtract' : 'add'}-line text-gray-500 text-lg transition-transform duration-200`}></i>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.size ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="pt-4 grid grid-cols-3 gap-2">
                            {sizeOptions.map((size) => (
                              <button
                                key={size}
                                onClick={() => handleSizeToggle(size)}
                                className={`py-2.5 text-sm font-medium border-2 rounded-lg transition-all duration-200 ${selectedSizes.includes(size)
                                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-teal-400'
                                  }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Color Filter */}
                      <div className="mb-6">
                        <button
                          onClick={() => toggleSection('color')}
                          className="w-full flex items-center justify-between py-3 text-left border-b border-gray-200"
                        >
                          <span className="text-sm font-semibold text-gray-900">顏色</span>
                          <i className={`ri-${expandedSections.color ? 'subtract' : 'add'}-line text-gray-500 text-lg transition-transform duration-200`}></i>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.color ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="pt-4 space-y-3">
                            {colorOptions.map((color) => (
                              <label key={color} className="flex items-center cursor-pointer group">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={selectedColors.includes(color)}
                                    onChange={() => handleColorToggle(color)}
                                    className="sr-only"
                                  />
                                  <div className={`w-5 h-5 border-2 rounded transition-all duration-200 ${selectedColors.includes(color)
                                    ? 'border-teal-600 bg-teal-600'
                                    : 'border-gray-300 bg-white group-hover:border-teal-400'
                                    }`}>
                                    {selectedColors.includes(color) && (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <i className="ri-check-line text-white text-xs"></i>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className={`ml-3 text-sm transition-colors duration-200 ${selectedColors.includes(color) ? 'text-gray-900 font-medium' : 'text-gray-700'
                                  }`}>
                                  {color}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Buttons - 固定在底部 */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6 space-y-3">
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="w-full py-3.5 bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap rounded-lg"
                      >
                        查看 {sortedProducts.length} 項結果
                      </button>
                      <button
                        onClick={() => {
                          clearAllFilters();
                        }}
                        className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        清除所有篩選
                      </button>
                    </div>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {loading && (
            <div className="text-center py-16">
              <div className="inline-block animate-spin h-8 w-8 border-b-2 border-teal-600 rounded-full"></div>
              <p className="mt-4 text-sm sm:text-base text-gray-600">載入商品中...</p>
            </div>
          )}

          {/* 產品 Grid - 手機版優化 */}
          {!loading && sortedProducts.length > 0 && (
            <motion.div
              className="pb-8 sm:pb-12"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 1 },
                show: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
            >
              <div
                className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"
                data-product-shop
              >
                {sortedProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
                    }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {!loading && sortedProducts.length === 0 && (
            <div className="text-center py-12 sm:py-16">
              <i className="ri-search-line text-3xl sm:text-4xl text-gray-400 mb-3 sm:mb-4"></i>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                找不到符合條件的商品
              </h3>
              <p className="text-sm sm:text-base text-gray-600">
                請嘗試調整搜尋條件或篩選設定
              </p>
            </div>
          )}

          {/* Pagination - 手機版優化 */}
          {!loading && sortedProducts.length > 0 && (
            <div className="flex justify-center items-center gap-2 py-6 sm:py-8">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-lg hover:bg-gray-100">
                <i className="ri-arrow-left-s-line text-lg"></i>
              </button>
              <button className="px-3 py-1.5 sm:px-4 sm:py-2 bg-teal-600 text-white font-medium cursor-pointer rounded-lg text-sm">1</button>
              <button className="px-3 py-1.5 sm:px-4 sm:py-2 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer rounded-lg text-sm">2</button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-lg hover:bg-gray-100">
                <i className="ri-arrow-right-s-line text-lg"></i>
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
