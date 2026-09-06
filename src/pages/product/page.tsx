import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ShopifyDescriptionViewer from '../../components/feature/ShopifyDescriptionViewer';
import { getMockProductById, mockProducts } from '../../mocks/products';
import {
  getShopifyProduct,
  getShopifyProducts,
  type ShopifyProductVariant,
  type ShopifyProductOption,
  type MusinsaFitGuide,
  type SizeChartItem,
  type CareSpecs,
  type LifestyleShowcaseItem,
  type CraftDetailItem,
} from '../../lib/shopify';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { fetchPublishedReviews, fetchProductQA, submitProductQuestion } from '../../lib/reviews-qa';
import type { ProductReview, ProductQuestion } from '../../types/reviews-qa';
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
  category?: string;
  vendor?: string;
  availableForSale?: boolean;
  highlights?: string[];
  subtitle?: string;
  promotionBadge?: string;
  fitGuide?: MusinsaFitGuide;
  sizeChart?: SizeChartItem[];
  careSpecs?: CareSpecs;
  careInstructions?: string[];
  lifestyleShowcase?: LifestyleShowcaseItem[];
  craftDetails?: CraftDetailItem[];
}

const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=900&h=1200';

export default function ProductPage() {
  const params = useParams<{ id?: string; '*'?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // 智慧解析與正規化商品 ID：支援純數字 ID、Shopify GID 以及格式非預期的 /product/gid:/shopify/Product/...
  const resolvedId = useMemo(() => {
    // 1. 若 params.id 存在且不是截斷前綴 "gid:"
    if (params.id && params.id !== 'gid:') {
      return params.id.split('/').pop() || params.id;
    }
    // 2. 從萬用路由或 location.pathname 中提取末尾 ID
    const fullPath = location.pathname;
    const match = fullPath.match(/\/product\/(?:gid:\/*shopify\/Product\/)?([^/?#]+)/i);
    if (match && match[1]) {
      return match[1].split('/').pop() || match[1];
    }
    return params['*']?.split('/').pop() || params.id || '';
  }, [params.id, params['*'], location.pathname]);

  // 若當前網址為非標準格式（如包含 gid: 或多層斜線），自動在瀏覽器網址列無感修正為乾淨標準網址
  useEffect(() => {
    if (location.pathname.includes('gid:') && resolvedId) {
      navigate(`/product/${resolvedId}`, { replace: true });
    }
  }, [location.pathname, resolvedId, navigate]);

  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'details' | 'reviews' | 'related' | 'qa'>('details');
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [catalogPool, setCatalogPool] = useState<Product[]>([]);
  const [recommendationMode, setRecommendationMode] = useState<'category' | 'popular' | 'top_rated' | 'random'>('category');
  const [rotationIndex, setRotationIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const [ratingsMap, setRatingsMap] = useState<Record<string, { rating: number; count: number }>>({});
  const [relatedWishlist, setRelatedWishlist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const thumbnailListRef = useRef<HTMLUListElement>(null);
  const { addToCart, setIsCartOpen } = useCart();

  // 商品評價與問答狀態 (Supabase 串接)
  const [publishedReviews, setPublishedReviews] = useState<ProductReview[]>([]);
  const [productQA, setProductQA] = useState<ProductQuestion[]>([]);
  const [allowProductQA, setAllowProductQA] = useState<boolean>(true);
  const [lineOaUrl, setLineOaUrl] = useState<string>('https://line.me/R/ti/p/@saengak');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState<boolean>(false);
  const [questionMessage, setQuestionMessage] = useState<string>('');
  const [questionError, setQuestionError] = useState<string>('');
  const [likedQuestions, setLikedQuestions] = useState<Record<string, boolean>>({});

  // 焦點大圖手勢拖曳狀態 (Pointer Events)
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const hasDragged = useRef(false);

  // 縮圖列手勢拖曳狀態
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
      if (resolvedId) {
        const shopifyProduct = await getShopifyProduct(resolvedId);
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
            category: shopifyProduct.productType || shopifyProduct.tags?.[0] || '女性護理',
            productType: shopifyProduct.productType,
            vendor: shopifyProduct.vendor,
            availableForSale: shopifyProduct.availableForSale,
            highlights: shopifyProduct.highlights && shopifyProduct.highlights.length > 0
              ? shopifyProduct.highlights
              : [
                  '嚴選優質材料與人體工學細緻剪裁，日常使用舒適安心',
                  '通過多重出廠品質檢驗合格，呵護敏弱肌膚無負擔',
                  '重視每個微小工藝細節，帶來極致貼身與陪伴感',
                  '簡約高雅生活美學設計，提升居家生活品質',
                  '官方旗艦直營正品保證，享 7 天安心鑑賞期'
                ],
            subtitle: shopifyProduct.subtitle || `${shopifyProduct.vendor || 'SAENGAK'} 官方旗艦直營 | 原裝正品品質保證`,
            promotionBadge: shopifyProduct.promotionBadge || '春季特別優惠・滿 2 件享免運折扣',
            fitGuide: shopifyProduct.fitGuide,
            sizeChart: shopifyProduct.sizeChart,
            careSpecs: shopifyProduct.careSpecs,
            careInstructions: shopifyProduct.careInstructions,
            lifestyleShowcase: shopifyProduct.lifestyleShowcase,
            craftDetails: shopifyProduct.craftDetails,
          });

          // 取得全店真實商品池供智慧推薦引擎運作 (最多 50 件，依暢銷排序)
          try {
            const allProducts = await getShopifyProducts({ first: 50, sortKey: 'BEST_SELLING' });
            const currentNum = (shopifyProduct.id || '').split('/').pop() || shopifyProduct.id;
            const filtered = allProducts.filter((p) => {
              const pNum = (p.id || '').split('/').pop() || p.id;
              return pNum !== currentNum;
            });
            const mappedPool: Product[] = filtered.map((p) => ({
              id: (p.id || '').split('/').pop() || p.id,
              name: p.name || p.title,
              description: p.description,
              price: p.price,
              originalPrice: p.originalPrice,
              image: p.image,
              hoverImage: p.hoverImage || p.image,
              handle: p.handle,
              tags: p.tags || [],
              productType: p.productType,
              category: p.productType || p.tags?.[0] || '女性護理',
            }));
            setCatalogPool(mappedPool);
            setRelatedProducts(mappedPool.slice(0, 4));
          } catch (relErr) {
            console.warn('載入 Shopify 推薦商品池失敗，使用預設商品:', relErr);
            const allMocks = mockProducts.filter((p) => p.id !== (resolvedId || ''));
            const mappedMocks: Product[] = allMocks.map((p) => ({
              ...p,
              tags: p.tags || [],
              category: p.category || '女性護理',
            }));
            setCatalogPool(mappedMocks);
            setRelatedProducts(mappedMocks.slice(0, 4));
          }

          setLoading(false);
          return;
        }
      }

      // Fallback to mock
      const fallbackMock = getMockProductById(resolvedId || '');
      if (fallbackMock) {
        setProduct({
          ...fallbackMock,
          category: fallbackMock.category || '女性護理',
          highlights: fallbackMock.highlights || [
            '通過德國 Dermatest 最高等級優異皮膚耐受性測試認證',
            '嚴選天然植萃與專利益生菌微生態配方，維持 pH4.5~5.5 弱酸健康平衡',
            '堅持不添加 21 種有害化學成分與人工香精，敏弱肌膚也能安心使用',
            '水潤凝膠質地清爽好吸收，深層滋潤不黏膩',
            '韓國原廠直營進口正品保證，享 7 天安心鑑賞期'
          ],
          subtitle: fallbackMock.subtitle || '韓國原裝進口 | Dermatest 醫學肌膚認證 | 溫和弱酸配方',
          promotionBadge: fallbackMock.promotionBadge || '春季特別優惠・滿 2 件享免運折扣',
        });
        const allMocks = mockProducts.filter((p) => p.id !== (resolvedId || ''));
        const mappedMocks: Product[] = allMocks.map((p) => ({
          ...p,
          tags: p.tags || [],
          category: p.category || '女性護理',
        }));
        setCatalogPool(mappedMocks);
        setRelatedProducts(mappedMocks.slice(0, 4));
      }
    } catch (err) {
      console.error('Error fetching product data:', err);
      captureExceptionSafe(err, { source: 'ProductPage', fallback: 'mockProducts' });
      const fallbackMock = getMockProductById(resolvedId || '');
      if (fallbackMock) {
        setProduct({
          ...fallbackMock,
          category: fallbackMock.category || '女性護理',
        });
        const allMocks = mockProducts.filter((p) => p.id !== (resolvedId || ''));
        const mappedMocks: Product[] = allMocks.map((p) => ({
          ...p,
          tags: p.tags || [],
          category: p.category || '女性護理',
        }));
        setCatalogPool(mappedMocks);
        setRelatedProducts(mappedMocks.slice(0, 4));
      }
    } finally {
      setLoading(false);
    }
  };

  /** --------------------------------------------------------------------
   *  Fetch reviews, Q&A and site settings
   * ------------------------------------------------------------------- */
  const loadReviewsAndQA = async (productId: string) => {
    try {
      const [reviews, qa] = await Promise.all([
        fetchPublishedReviews(productId),
        fetchProductQA(productId),
      ]);
      setPublishedReviews(reviews);
      setProductQA(qa);
    } catch (err) {
      console.error('載入商品評價與問答失敗:', err);
    }
  };

  const loadSiteSettings = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['allow_product_qa', 'line_oa_url']);

      if (!error && data) {
        for (const row of data) {
          if (row.key === 'allow_product_qa') {
            setAllowProductQA(Boolean(row.value));
          } else if (row.key === 'line_oa_url' && typeof row.value === 'string' && row.value) {
            setLineOaUrl(row.value);
          }
        }
      }
    } catch (err) {
      console.error('載入全站設定失敗:', err);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !product) return;

    if (!questionInput.trim()) {
      setQuestionError('請輸入提問內容');
      return;
    }

    setIsSubmittingQuestion(true);
    setQuestionError('');

    try {
      const res = await submitProductQuestion({
        user_id: user.id,
        shopify_product_id: product.id,
        question: questionInput.trim(),
      });

      if (res.error) {
        setQuestionError(res.error.message || '提問送出失敗，請稍後再試');
      } else {
        setQuestionInput('');
        setQuestionMessage('提問已送出，官方客服回覆後將公開於下方列表');
        setTimeout(() => setQuestionMessage(''), 5000);
      }
    } catch (err: any) {
      setQuestionError(err?.message || '提問送出失敗，請稍後再試');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleToggleHelpful = (id: string) => {
    setLikedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const loadRatingsMap = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('shopify_product_id, rating')
        .eq('status', 'published');
      if (!error && data) {
        const stats: Record<string, { total: number; count: number }> = {};
        for (const r of data) {
          const pid = String(r.shopify_product_id);
          const numId = pid.split('/').pop() || pid;
          if (!stats[pid]) stats[pid] = { total: 0, count: 0 };
          stats[pid].total += Number(r.rating) || 5;
          stats[pid].count += 1;
          if (numId !== pid) {
            if (!stats[numId]) stats[numId] = { total: 0, count: 0 };
            stats[numId].total += Number(r.rating) || 5;
            stats[numId].count += 1;
          }
        }
        const map: Record<string, { rating: number; count: number }> = {};
        for (const [key, s] of Object.entries(stats)) {
          map[key] = {
            rating: Number((s.total / s.count).toFixed(1)),
            count: s.count,
          };
        }
        setRatingsMap(map);
      }
    } catch (err) {
      console.warn('載入全商品評分統計失敗:', err);
    }
  };

  const handleRotateRelated = () => {
    setIsRotating(true);
    setRotationIndex((prev) => prev + 1);
    setTimeout(() => {
      setIsRotating(false);
    }, 400);
  };

  /** --------------------------------------------------------------------
   *  Effects
   * ------------------------------------------------------------------- */
  useEffect(() => {
    if (resolvedId) {
      setSelectedImage(0);
      setRotationIndex(0);
      fetchProduct();
      loadReviewsAndQA(resolvedId);
      loadRatingsMap();
      loadSiteSettings();
    }
  }, [resolvedId]);

  /** --------------------------------------------------------------------
   *  Computed: Active Variant, Price, Stock & Options List, Reviews Stats
   * ------------------------------------------------------------------- */
  const totalReviews = publishedReviews.length;
  const averageRating = useMemo(() => {
    if (totalReviews === 0) return '0.0';
    const sum = publishedReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / totalReviews).toFixed(1);
  }, [publishedReviews, totalReviews]);

  const optionsList = useMemo(() => {
    if (product?.options && product.options.length > 0) {
      return product.options.filter(
        (opt) => opt.values.length > 0 && !(opt.name === 'Title' && opt.values[0] === 'Default Title')
      );
    }

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
  const isAllSoldOut =
    product?.availableForSale === false ||
    (Array.isArray(product?.variants) &&
      product.variants.length > 0 &&
      product.variants.every((v) => v.availableForSale === false));

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
  const activeImage = productImages[selectedImage] ?? product?.image ?? FALLBACK_PRODUCT_IMAGE;

  const discountPercentage = currentCompareAtPrice && currentCompareAtPrice > currentPrice
    ? Math.round(((currentCompareAtPrice - currentPrice) / currentCompareAtPrice) * 100)
    : 0;

  /**
   * 智慧相關產品推薦演算法 (同類精選、暢銷熱賣、好評榜單、隨機探索與換一批輪動)
   */
  const displayedRelatedProducts = useMemo(() => {
    const pool = catalogPool.length > 0 ? catalogPool : relatedProducts;
    if (!product || pool.length === 0) {
      return pool.slice(0, 4);
    }

    const currentNum = (product.id || '').split('/').pop() || product.id;
    const available = pool.filter((p) => {
      const pNum = (p.id || '').split('/').pop() || p.id;
      return pNum !== currentNum;
    });
    if (available.length === 0) return [];

    // 1. 隨機探索模式 (Random Shuffle)
    if (recommendationMode === 'random') {
      const shuffled = [...available].sort((a, b) => {
        const hashA = (a.id + rotationIndex).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hashB = (b.id + rotationIndex).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return Math.sin(hashA * 997) - Math.sin(hashB * 997);
      });
      return shuffled.slice(0, 4);
    }

    // 2. 暢銷熱賣模式 (Best Selling / Sales Rank)
    if (recommendationMode === 'popular') {
      const batchSize = 4;
      const start = (rotationIndex * batchSize) % available.length;
      const res: Product[] = [];
      for (let i = 0; i < Math.min(batchSize, available.length); i++) {
        res.push(available[(start + i) % available.length]);
      }
      return res;
    }

    // 3. 好評榜單模式 (Top Rated / High Reviews)
    if (recommendationMode === 'top_rated') {
      const sorted = [...available].sort((a, b) => {
        const cleanA = (a.id || '').split('/').pop() || a.id;
        const cleanB = (b.id || '').split('/').pop() || b.id;
        const rateA = ratingsMap[a.id]?.rating ?? ratingsMap[cleanA]?.rating ?? 4.9;
        const rateB = ratingsMap[b.id]?.rating ?? ratingsMap[cleanB]?.rating ?? 4.9;
        const countA = ratingsMap[a.id]?.count ?? ratingsMap[cleanA]?.count ?? 12;
        const countB = ratingsMap[b.id]?.count ?? ratingsMap[cleanB]?.count ?? 12;
        if (rateB !== rateA) return rateB - rateA;
        return countB - countA;
      });
      const batchSize = 4;
      const start = (rotationIndex * batchSize) % sorted.length;
      const res: Product[] = [];
      for (let i = 0; i < Math.min(batchSize, sorted.length); i++) {
        res.push(sorted[(start + i) % sorted.length]);
      }
      return res;
    }

    // 4. 同類精選模式 (Same Category & Tag Relevance)
    const currentType = (product.productType || product.category || '').trim().toLowerCase();
    const currentTags = (product.tags || []).map((t) => t.toLowerCase());
    const currentName = (product.name || '').toLowerCase();

    const scored = available.map((cand) => {
      let score = 0;
      const candType = (cand.productType || cand.category || '').trim().toLowerCase();
      const candTags = (cand.tags || []).map((t) => t.toLowerCase());
      const candName = (cand.name || '').toLowerCase();

      // 同一品類 (如 舒適穿著, 每日清潔, 女性護理) 給予大幅加權
      if (currentType && candType && (currentType === candType || candType.includes(currentType) || currentType.includes(candType))) {
        score += 25;
      }

      // 共同標籤權重
      const commonTags = candTags.filter((t) => currentTags.includes(t));
      score += commonTags.length * 5;

      // 關鍵品類詞比對加權 (內褲、胸罩、除毛、護衣袋、慕斯、濕巾等)
      const keywords = [
        '內褲', '三角褲', '平口褲', '生理褲', '丁字褲', '無痕', '純棉',
        '內衣', '胸罩', '睡衣',
        '除毛', '刮毛', '修整',
        '護衣袋', '洗衣袋', '清洗袋',
        '潔淨', '慕斯', '清潔露',
        '濕巾', '噴霧', '凝膠', '保養', '護理'
      ];
      for (const kw of keywords) {
        if (currentName.includes(kw) && candName.includes(kw)) {
          score += 12;
        }
      }

      return { cand, score };
    });

    // 依相關度高至低排序
    scored.sort((a, b) => b.score - a.score);
    const candidateList = scored.map((s) => s.cand);

    // 支援換一批批次輪動
    const batchSize = 4;
    const start = (rotationIndex * batchSize) % Math.max(1, candidateList.length);
    const res: Product[] = [];
    for (let i = 0; i < Math.min(batchSize, candidateList.length); i++) {
      res.push(candidateList[(start + i) % candidateList.length]);
    }
    return res;
  }, [product, catalogPool, relatedProducts, recommendationMode, rotationIndex, ratingsMap]);

  /**
   * 多層級規格庫存可用性判定演算法
   */
  const checkOptionAvailability = (optionIndex: number, optionName: string, optionValue: string): boolean => {
    if (!product?.variants || product.variants.length === 0) return true;

    if (optionIndex === 0) {
      return product.variants.some((v) => {
        const matchValue = v.selectedOptions?.some((so) => so.name === optionName && so.value === optionValue);
        return matchValue && v.availableForSale !== false;
      });
    }

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
        setIsCartOpen(true);
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

  const handleThumbnailClick = (index: number) => {
    if (hasThumbDragged.current) return;
    setSelectedImage(index);
  };

  // 自動平滑滾動縮圖列 (選中第 7 張以上自動調整視窗)
  useEffect(() => {
    if (!thumbnailListRef.current) return;
    const container = thumbnailListRef.current;

    if (window.innerWidth >= 640) {
      // 桌面版垂直滾動 (顯示 7 個)
      const slotHeight = 76; // 68px item + 8px gap
      const maxTopIndex = Math.max(0, productImages.length - 7);
      const targetTopIndex = Math.min(maxTopIndex, Math.max(0, selectedImage - 5));
      const targetScrollTop = targetTopIndex * slotHeight;
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    } else {
      // 手機版橫向滾動 (一次顯示 5 個)
      const slotWidth = container.clientWidth / 5;
      const maxLeftIndex = Math.max(0, productImages.length - 5);
      const targetLeftIndex = Math.min(maxLeftIndex, Math.max(0, selectedImage - 4));
      const targetScrollLeft = targetLeftIndex * slotWidth;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [selectedImage, productImages.length]);

  // 縮圖拖曳 Handlers
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

  // 縮圖列捲動按鈕 Handlers（支援 6 張一版平滑捲動）
  const handleScrollUpThumbnails = () => {
    if (!thumbnailListRef.current) return;
    const container = thumbnailListRef.current;
    if (window.innerWidth >= 640) {
      container.scrollBy({ top: -container.clientHeight, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
    }
  };

  const handleScrollDownThumbnails = () => {
    if (!thumbnailListRef.current) return;
    const container = thumbnailListRef.current;
    if (window.innerWidth >= 640) {
      container.scrollBy({ top: container.clientHeight, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
    }
  };

  const handleScrollLeftThumbnails = () => {
    if (!thumbnailListRef.current) return;
    thumbnailListRef.current.scrollBy({ left: -thumbnailListRef.current.clientWidth, behavior: 'smooth' });
  };

  const handleScrollRightThumbnails = () => {
    if (!thumbnailListRef.current) return;
    thumbnailListRef.current.scrollBy({ left: thumbnailListRef.current.clientWidth, behavior: 'smooth' });
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage((prev) => Math.max(0, prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage((prev) => Math.min(productImages.length - 1, prev + 1));
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
    const threshold = 40;
    if (dragOffset < -threshold) {
      setSelectedImage((prev) => Math.min(productImages.length - 1, prev + 1));
    } else if (dragOffset > threshold) {
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
    setIsZoomModalOpen(true);
  };

  /** --------------------------------------------------------------------
   *  Render
   * ------------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5' }}>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#245B50] mb-4"></div>
            <p className="text-gray-600 font-medium">正在載入商品資料...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5' }}>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
              找不到該商品
            </h1>
            <p className="text-gray-500 text-sm">該商品可能已下架或網址不正確</p>
            <Link
              to="/"
              className="inline-block px-6 py-2.5 bg-[#245B50] hover:bg-[#1a4239] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
            >
              返回首頁
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5' }}>
      <Header />

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-[108px] sm:pt-[116px] md:pt-[124px] lg:pt-[132px]">
        {/* =========================================================================
            1. 上方核心商品展示區塊 (Top Section)
            ========================================================================= */}
        <section
          id="product-main-section"
          data-testid="product-main-section"
          className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] xl:grid-cols-[720px_460px] xl:justify-center xl:gap-12"
        >
          {/* Left group: thumbnails + main image (sticky as whole group, 高度嚴格控制在右邊立即購買按鈕之內) */}
          <div
            data-testid="product-gallery"
            className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[78px_minmax(0,1fr)] md:grid-cols-[84px_minmax(0,1fr)] lg:grid-cols-[90px_minmax(0,1fr)] sm:gap-3.5 lg:sticky lg:top-[108px] sm:h-[520px] sm:max-h-[520px]"
          >
            {/* 縮圖導航 (總長度嚴格控制不超過右邊立即購買高度，支援多圖平滑捲動) */}
            <aside className="order-2 min-w-0 sm:order-1 relative select-none w-full sm:h-[520px] min-h-0 flex flex-col overflow-hidden">
              <div className="relative flex items-center sm:flex-col w-full h-full min-h-0 gap-1.5 sm:gap-1">
                {/* 桌機版：頂部向上箭頭 (超過 6 張時顯示) */}
                {productImages.length > 6 && (
                  <button
                    type="button"
                    onClick={handleScrollUpThumbnails}
                    aria-label="向上瀏覽更多縮圖"
                    className="hidden sm:flex w-full h-6 flex-shrink-0 items-center justify-center text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200/90 rounded text-xs transition-colors shadow-2xs z-10 cursor-pointer mb-0.5"
                  >
                    <i className="ri-arrow-up-s-line text-xs"></i>
                  </button>
                )}

                {/* 手機版：左箭頭 */}
                {productImages.length > 6 && (
                  <button
                    type="button"
                    onClick={handleScrollLeftThumbnails}
                    aria-label="向左瀏覽更多縮圖"
                    className="sm:hidden flex-shrink-0 w-6 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-md text-sm shadow-2xs z-10 cursor-pointer active:scale-95 transition-all"
                  >
                    <i className="ri-arrow-left-s-line text-base"></i>
                  </button>
                )}

                {/* 縮圖列表 (完全在 520px 容器內，每張縮圖等比正方形不變形，超出則內部平滑滾動) */}
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden sm:w-full sm:h-full">
                  <ul
                    ref={thumbnailListRef}
                    onPointerDown={handleThumbPointerDown}
                    onPointerMove={handleThumbPointerMove}
                    onPointerUp={handleThumbPointerUp}
                    onPointerCancel={handleThumbPointerCancel}
                    className="w-full h-full flex gap-1.5 sm:gap-2 overflow-x-auto sm:overflow-x-hidden sm:flex-col sm:overflow-y-auto scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing touch-pan-y"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {productImages.map((url, idx) => {
                      const isSelected = selectedImage === idx;
                      return (
                        <li key={idx} className="w-[calc((100%-25px)/6)] sm:w-full sm:h-[calc((100%-25px)/6)] flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleThumbnailClick(idx)}
                            aria-label={`切換至第 ${idx + 1} 張圖片`}
                            aria-pressed={isSelected}
                            data-testid={`product-thumbnail-${idx}`}
                            className={`block w-full h-full overflow-hidden rounded-md transition-all duration-200 border-2 cursor-pointer bg-white flex items-center justify-center p-0.5 ${
                              isSelected
                                ? 'border-[#245B50] ring-1 ring-[#245B50] shadow-xs'
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
                              className={`block max-h-full max-w-full object-contain object-center pointer-events-none ${isAllSoldOut ? 'grayscale-[30%]' : ''}`}
                              loading="lazy"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* 手機版：右箭頭 */}
                {productImages.length > 6 && (
                  <button
                    type="button"
                    onClick={handleScrollRightThumbnails}
                    aria-label="向右瀏覽更多縮圖"
                    className="sm:hidden flex-shrink-0 w-6 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-md text-sm shadow-2xs z-10 cursor-pointer active:scale-95 transition-all"
                  >
                    <i className="ri-arrow-right-s-line text-base"></i>
                  </button>
                )}

                {/* 桌機版：底部向下箭頭 (超過 6 張時顯示) */}
                {productImages.length > 6 && (
                  <button
                    type="button"
                    onClick={handleScrollDownThumbnails}
                    aria-label="向下瀏覽更多縮圖"
                    className="hidden sm:flex w-full h-6 flex-shrink-0 items-center justify-center text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200/90 rounded text-xs transition-colors shadow-2xs z-10 cursor-pointer mt-0.5"
                  >
                    <i className="ri-arrow-down-s-line text-xs"></i>
                  </button>
                )}
              </div>
            </aside>

            {/* 焦點大圖展示區 (高度與縮圖齊平 520px，全圖滿版無白邊) */}
            <div className="order-1 min-w-0 sm:order-2 aspect-square sm:aspect-auto sm:h-[520px]">
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={handleMainImageClick}
                className="relative w-full h-full rounded-xl overflow-hidden group flex items-center justify-center select-none touch-pan-y cursor-grab active:cursor-grabbing"
                style={{ backgroundColor: '#F7F7F5' }}
              >
                {/* 左右導覽箭頭 */}
                {selectedImage > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="上一張圖片"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center z-10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line text-lg"></i>
                  </button>
                )}

                {selectedImage < productImages.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="下一張圖片"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center z-10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line text-lg"></i>
                  </button>
                )}

                {/* 焦點主圖 (高度與寬度自然置中，100% 完整呈現絕不裁切上下任何像素) */}
                <div
                  className="w-full h-full flex items-center justify-center p-2 sm:p-3 transition-transform duration-200"
                  style={{
                    transform: isDragging ? `translateX(${dragOffset * 0.4}px)` : 'none'
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
                    className={`block max-w-full max-h-full w-auto h-auto object-contain object-center pointer-events-none transition-transform duration-300 group-hover:scale-[1.01] rounded-lg m-auto ${isAllSoldOut ? 'opacity-75 grayscale-[30%]' : ''}`}
                  />
                </div>

                {/* 已售完 圖層 */}
                {isAllSoldOut && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20 pointer-events-none">
                    <span
                      className="bg-black/80 text-white text-sm md:text-base px-5 py-2 rounded-full font-medium tracking-wider shadow-md border border-white/20"
                      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                    >
                      已售完
                    </span>
                  </div>
                )}

                {/* 標籤角標與放大指示 */}
                <div className="absolute bottom-3 left-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none z-10">
                  <span>{selectedImage + 1} / {productImages.length}</span>
                </div>
                <span className="absolute bottom-3 right-3 bg-black/55 hover:bg-black/75 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none transition-colors z-10">
                  <i className="ri-zoom-in-line"></i> 點擊放大 / 拖曳切換
                </span>
              </div>
            </div>
          </div>

          {/* 右側：商品資訊、價格、變體、產品特點與購買按鈕 */}
          <aside id="right-product-content" data-testid="product-info" className="min-w-0 w-full space-y-6">
            {/* 1. 商品類別 (實心淡雅底色標籤) */}
            <div>
              <span className="inline-block bg-[#E3EFEA] text-[#245B50] px-3 py-1 text-xs sm:text-sm font-bold rounded-md tracking-wider">
                {product.category || product.productType || product.tags?.[0] || '女性護理'}
              </span>
            </div>

            {/* 2. 商品標題與副標 */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                {product.name}
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                {product.subtitle || product.vendor || 'SAENGAK 官方旗艦直營'}
              </p>
            </div>

            {/* 3. 原價與折扣價 */}
            <div className="space-y-1 border-t border-gray-200/60 pt-4">
              {currentCompareAtPrice && currentCompareAtPrice > currentPrice && (
                <div className="text-sm text-gray-400 line-through">
                  原價 {formatTwd(currentCompareAtPrice)}
                </div>
              )}
              <div className="flex items-baseline gap-3">
                {discountPercentage > 0 && (
                  <span className="text-2xl font-extrabold text-[#245B50]">
                    -{discountPercentage}%
                  </span>
                )}
                <span className="text-3xl sm:text-4xl font-black text-gray-900" data-testid="product-price" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {formatTwd(currentPrice)}
                </span>
                {currentCompareAtPrice && currentCompareAtPrice > currentPrice && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full ml-1">
                    現省 NT$ {currentCompareAtPrice - currentPrice}
                  </span>
                )}
                {!isAvailableForSale && (
                  <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded ml-2">
                    已售完 / 缺貨中
                  </span>
                )}
              </div>

              {product.promotionBadge && (
                <div className="pt-1.5 flex items-center gap-1.5 text-xs text-[#245B50] font-medium">
                  <i className="ri-gift-line"></i>
                  <span>{product.promotionBadge}</span>
                </div>
              )}
            </div>

            {/* 4. 產品變體選擇 (膠囊風格) */}
            {optionsList.length > 0 && (
              <div className="space-y-4 border-t border-gray-200/60 pt-4" data-testid="variant-options">
                {optionsList.map((option, optIdx) => {
                  const selectedVal = selectedOptions[option.name];
                  return (
                    <div key={option.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-800">{option.name}：</span>
                        <span className="text-[#245B50] font-semibold text-xs">{selectedVal || '請選擇規格'}</span>
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
                              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#245B50] text-white shadow-xs ring-2 ring-[#245B50] ring-offset-1'
                                  : isAvailable
                                    ? 'bg-white text-gray-700 border border-gray-300 hover:border-[#245B50] hover:bg-emerald-50/40'
                                    : 'bg-gray-100 text-gray-400 border border-dashed border-gray-300 opacity-60'
                              }`}
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

            {/* 5. 產品特點清單 */}
            {product.highlights && product.highlights.length > 0 && (
              <div className="border-t border-gray-200/60 pt-4 space-y-2.5" data-testid="product-highlights">
                <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  產品特點
                </h3>
                <ul className="space-y-2">
                  {product.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-gray-700">
                      <span className="flex-shrink-0 text-[#245B50] mt-0.5" aria-hidden="true">
                        <svg className="w-4 h-4 text-[#245B50]" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                      <span className="font-normal" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. 數量與購買按鈕 */}
            <div className="space-y-3 border-t border-gray-200/60 pt-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">購買數量</span>
                <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={!isAvailableForSale}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-semibold border-l border-r border-gray-200 py-2">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    disabled={!isAvailableForSale}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!isAvailableForSale}
                  data-testid="add-to-cart-button"
                  className="flex-1 h-12 border-2 border-[#245B50] text-[#245B50] hover:bg-emerald-50/60 font-semibold rounded-xl shadow-2xs transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-shopping-bag-line text-lg"></i>
                  {isAvailableForSale ? '加入購物車' : '此規格已售完'}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!isAvailableForSale}
                  data-testid="buy-now-button"
                  className="flex-1 h-12 bg-[#245B50] hover:bg-[#1a4239] text-white font-semibold rounded-xl shadow-xs transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-flashlight-fill text-lg"></i>
                  {isAvailableForSale ? '立即購買' : '暫無庫存'}
                </button>
              </div>

              {/* 官方保證小標籤 */}
              <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <i className="ri-shield-check-line text-[#245B50]"></i>
                  <span>正品原廠保證</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-truck-line text-[#245B50]"></i>
                  <span>超商 / 宅配 快速出貨</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-refresh-line text-[#245B50]"></i>
                  <span>7 天安心鑑賞期</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* =========================================================================
          2. 下方全寬四大核心頁籤與內容區塊 (Full-Width Tabs Section)
          ========================================================================= */}
      <div className="w-full bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* 頁籤選單導航列 (4 大頁籤：產品內容、評論、相關產品、詢問) */}
          <div className="mb-12">
            <div className="flex gap-0 justify-center">
              {[
                { id: 'details', label: '產品內容' },
                { id: 'reviews', label: totalReviews > 0 ? `顧客評價 (${totalReviews})` : '顧客評價' },
                { id: 'related', label: '相關產品' },
                { id: 'qa', label: '商品詢問' }
              ].map((tab) => {
                const isActive = selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={(e) => {
                      setSelectedTab(tab.id as any);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                    className={`text-base font-normal transition-all duration-300 flex-1 max-w-[355px] cursor-pointer select-none ${
                      isActive ? 'text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{
                      fontFamily: '"Noto Sans TC", sans-serif',
                      height: '50px',
                      fontSize: '16px',
                      backgroundColor: isActive ? 'rgb(216, 214, 202)' : 'rgb(235, 243, 236)',
                      borderWidth: 'medium',
                      borderStyle: 'none',
                      borderColor: 'currentColor',
                      borderImage: 'none',
                      borderRadius: '0px',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 頁籤內容主面板 */}
          <div className="min-h-[400px]">
            {/* -------------------------------------------------------------
                頁籤一：【產品內容】 (整合 ShopifyDescriptionViewer 方案 A 雙軌富文本)
                ------------------------------------------------------------- */}
            {selectedTab === 'details' && (
              <ShopifyDescriptionViewer
                html={product.descriptionHtml || product.description}
                category={product.category || product.productType || product.tags?.[0] || '女性護理'}
                tags={product.tags || []}
                productName={product.name}
                subtitle={product.subtitle}
                highlights={product.highlights || []}
                images={productImages}
                vendor={product.vendor || 'SAENGAK'}
                fitGuide={product.fitGuide}
                sizeChart={product.sizeChart}
                careSpecs={product.careSpecs}
                careInstructions={product.careInstructions}
                lifestyleShowcase={product.lifestyleShowcase}
                craftDetails={product.craftDetails}
              />
            )}

            {/* -------------------------------------------------------------
                頁籤二：【顧客評論】 (真實 Supabase 評價資料串接)
                ------------------------------------------------------------- */}
            {selectedTab === 'reviews' && (
              <div className="space-y-8 animate-fadeIn" data-testid="product-reviews-tab">
                {/* 評論總覽評分卡 */}
                <div
                  className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs"
                  data-testid="reviews-summary"
                >
                  <div className="flex items-center gap-5">
                    <div className="text-5xl font-black text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      {averageRating}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center text-amber-400 text-lg">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const numRating = parseFloat(averageRating);
                          const isFull = numRating >= star;
                          const isHalf = !isFull && numRating >= star - 0.5;
                          return (
                            <i
                              key={star}
                              className={
                                isFull
                                  ? 'ri-star-fill'
                                  : isHalf
                                  ? 'ri-star-half-fill'
                                  : 'ri-star-line text-gray-300'
                              }
                            ></i>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 font-medium">共 {totalReviews} 則已驗證顧客評價</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 max-w-xs sm:text-right">
                    所有評價皆來自完成訂單之會員真實反饋，並通過 SAENGAK 內容審查機制。
                  </div>
                </div>

                {/* 評價列表 / 空狀態 */}
                {publishedReviews.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center"
                    data-testid="no-reviews-prompt"
                  >
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-50 text-[#245B50] flex items-center justify-center text-2xl">
                      <i className="ri-chat-smile-2-line"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      尚無顧客評價
                    </h3>
                    <p className="leading-6 text-gray-500 text-sm max-w-md mx-auto">
                      此商品目前尚無顧客評價，歡迎購買後於會員中心分享您的使用心得！
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="reviews-list">
                    {publishedReviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-xl border border-gray-200 bg-white p-6 shadow-2xs space-y-3"
                        data-testid={`review-card-${review.id}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center text-amber-400 text-sm">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <i
                                  key={s}
                                  className={
                                    s <= review.rating ? 'ri-star-fill' : 'ri-star-line text-gray-300'
                                  }
                                ></i>
                              ))}
                            </div>
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              data-testid="verified-badge"
                            >
                              <i className="ri-check-line"></i> ✓ 已驗證購買
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                        </div>

                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                          {review.comment}
                        </p>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                          <span className="font-medium text-gray-600">
                            {review.display_name || 'SAENGAK 會員'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                頁籤三：【相關推薦】 (支援同類精選、暢銷熱賣、好評榜單、隨機探索與換一批輪動)
                ------------------------------------------------------------- */}
            {selectedTab === 'related' && (
              <div className="animate-fadeIn space-y-6">
                {/* 頂部標題、推薦維度切換與換一批輪動按鈕 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#245B50] inline-block"></span>
                      <h3
                        className="text-xl sm:text-2xl font-bold text-gray-900"
                        style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                      >
                        相關產品推薦
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500">
                      根據當前商品品類與人氣指標，為妳智慧搭配專屬生活美學好物
                    </p>
                  </div>

                  {/* 模式切換器與換一批輪動按鈕 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => { setRecommendationMode('category'); setRotationIndex(0); }}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          recommendationMode === 'category'
                            ? 'bg-white text-[#245B50] shadow-2xs font-bold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <i className="ri-layout-grid-line text-xs"></i>
                        <span>同類精選</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setRecommendationMode('popular'); setRotationIndex(0); }}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          recommendationMode === 'popular'
                            ? 'bg-white text-[#245B50] shadow-2xs font-bold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <i className="ri-fire-line text-xs"></i>
                        <span>暢銷熱賣</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setRecommendationMode('top_rated'); setRotationIndex(0); }}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          recommendationMode === 'top_rated'
                            ? 'bg-white text-[#245B50] shadow-2xs font-bold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <i className="ri-star-smile-line text-xs"></i>
                        <span>好評榜單</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setRecommendationMode('random'); setRotationIndex((r) => r + 1); }}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          recommendationMode === 'random'
                            ? 'bg-white text-[#245B50] shadow-2xs font-bold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <i className="ri-shuffle-line text-xs"></i>
                        <span>隨機探索</span>
                      </button>
                    </div>

                    {/* 換一批輪動按鈕 */}
                    <button
                      type="button"
                      onClick={handleRotateRelated}
                      className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50/80 hover:border-[#245B50]/40 text-[#245B50] text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="點擊換一批商品輪動"
                    >
                      <i className={`ri-refresh-line text-sm transition-transform duration-500 ${isRotating ? 'rotate-180 text-emerald-700' : ''}`}></i>
                      <span>換一批</span>
                    </button>
                  </div>
                </div>

                {/* 卡片網格 */}
                {displayedRelatedProducts.length > 0 ? (
                  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-300 ${isRotating ? 'opacity-40' : 'opacity-100'}`}>
                    {displayedRelatedProducts.map((item, idx) => {
                      const cleanId = (item.id || '').split('/').pop() || item.id;
                      const isWishlisted = !!(relatedWishlist[item.id] || relatedWishlist[cleanId]);
                      const itemDiscount = item.originalPrice && item.originalPrice > item.price
                        ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                        : 0;

                      // Badge 徽章文案
                      const badgeLabel = (() => {
                        if (recommendationMode === 'category') return item.category || '同類精選';
                        if (recommendationMode === 'popular') return `熱銷 TOP ${idx + 1}`;
                        if (recommendationMode === 'top_rated') {
                          const rating = ratingsMap[item.id]?.rating ?? ratingsMap[cleanId]?.rating ?? 4.9;
                          return `★ ${rating.toFixed(1)} 好評`;
                        }
                        return '生活精選';
                      })();

                      return (
                        <div
                          key={item.id}
                          className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-2xs border border-gray-200/80 hover:shadow-md hover:border-[#245B50]/40 transition-all duration-300"
                        >
                          {/* 3:4 直長型長方形圖片 */}
                          <div className="relative aspect-[3/4] overflow-hidden bg-[#F5F5F3]">
                            <Link to={`/product/${cleanId}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                              <img
                                src={item.image || FALLBACK_PRODUCT_IMAGE}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                loading="lazy"
                              />
                            </Link>

                            {/* 左上角徽章 */}
                            <span className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wider uppercase shadow-2xs pointer-events-none">
                              {badgeLabel}
                            </span>

                            {/* 懸浮查看商品按鈕 */}
                            <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                              <Link
                                to={`/product/${cleanId}`}
                                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="block w-full py-2.5 bg-white/95 hover:bg-[#245B50] hover:text-white text-gray-900 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all text-center cursor-pointer"
                                style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
                              >
                                查看商品
                              </Link>
                            </div>
                          </div>

                          {/* 商品資訊區塊 */}
                          <div className="p-4 sm:p-5 space-y-1.5 flex-1 flex flex-col justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>{item.category || '女性護理'}</span>
                                <button
                                  type="button"
                                  aria-label="收藏商品"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRelatedWishlist((prev) => ({
                                      ...prev,
                                      [item.id]: !prev[item.id],
                                      [cleanId]: !prev[cleanId]
                                    }));
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-0.5"
                                >
                                  <i
                                    className={
                                      isWishlisted
                                        ? 'ri-heart-fill text-red-500 text-base'
                                        : 'ri-heart-line text-base'
                                    }
                                  ></i>
                                </button>
                              </div>

                              <Link
                                to={`/product/${cleanId}`}
                                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-[#245B50] transition-colors line-clamp-2 leading-snug"
                                style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
                              >
                                {item.name}
                              </Link>
                            </div>

                            <div className="pt-2 border-t border-gray-100 space-y-0.5">
                              {item.originalPrice && item.originalPrice > item.price && (
                                <div className="text-xs text-gray-400 line-through">
                                  {formatTwd(item.originalPrice)}
                                </div>
                              )}
                              <div className="flex items-baseline gap-2">
                                {itemDiscount > 0 && (
                                  <span className="text-sm font-extrabold text-[#245B50]">
                                    -{itemDiscount}%
                                  </span>
                                )}
                                <span className="text-base sm:text-lg font-black text-gray-900">
                                  {formatTwd(item.price)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-200/70 text-gray-500 space-y-2">
                    <i className="ri-inbox-line text-3xl text-gray-400"></i>
                    <p className="text-sm">暫無更多相關產品推薦</p>
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                頁籤四：【商品詢問】 (真實 Supabase 問答)
                ------------------------------------------------------------- */}
            {selectedTab === 'qa' && (
              <div className="space-y-8 animate-fadeIn" data-testid="product-qa-tab">
                {/* 提出問題區塊 */}
                {allowProductQA ? (
                  user ? (
                    <div
                      className="rounded-2xl border border-gray-200/90 bg-gray-50/70 p-6 sm:p-8 space-y-4 shadow-2xs"
                      data-testid="ask-question-section"
                    >
                      <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        提出商品疑問
                      </h3>

                      {questionMessage && (
                        <div
                          data-testid="question-success-message"
                          className="p-3.5 bg-emerald-50 text-[#245B50] text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 animate-fadeIn"
                        >
                          <i className="ri-checkbox-circle-fill text-base text-emerald-600"></i>
                          <span>{questionMessage}</span>
                        </div>
                      )}

                      {questionError && (
                        <div
                          data-testid="question-error-message"
                          className="p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
                        >
                          <i className="ri-error-warning-line text-red-500 text-sm"></i>
                          <span>{questionError}</span>
                        </div>
                      )}

                      <form onSubmit={handleSubmitQuestion} className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                              您的問題
                            </label>
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <i className="ri-shield-user-line text-[#245B50]"></i>
                              <span>為保護隱私，提問將以部分遮蔽之帳號公開</span>
                            </span>
                          </div>
                          <textarea
                            rows={4}
                            value={questionInput}
                            onChange={(e) => setQuestionInput(e.target.value)}
                            placeholder="在此輸入您的問題（如成分配方、保存期限或使用時機）..."
                            data-testid="question-input"
                            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:border-[#245B50] focus:ring-1 focus:ring-[#245B50] focus:outline-none bg-white placeholder-gray-400 resize-none transition-all shadow-2xs"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingQuestion || !questionInput.trim()}
                          data-testid="submit-question-btn"
                          className="w-full py-3.5 bg-[#245B50] hover:bg-[#1a4239] text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSubmittingQuestion ? '送出中...' : '提交問題'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl border border-gray-200 bg-gray-50/80 p-8 text-center shadow-2xs space-y-3"
                      data-testid="login-to-ask-prompt"
                    >
                      <p className="text-sm text-gray-700 font-medium">請登入會員以填寫提問</p>
                      <Link
                        to="/login"
                        className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-semibold text-white bg-[#245B50] hover:bg-[#1a4239] rounded-xl shadow-2xs transition-colors"
                      >
                        立即登入會員
                      </Link>
                    </div>
                  )
                ) : (
                  <div
                    className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center text-xs text-amber-800 font-medium"
                    data-testid="qa-disabled-notice"
                  >
                    目前商品問答表單暫停開放
                  </div>
                )}

                {/* 3. 顧客提問與專業回覆列表 */}
                {productQA.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center"
                    data-testid="no-qa-prompt"
                  >
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-2xl">
                      <i className="ri-question-answer-line"></i>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      尚無相關問答
                    </h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      此商品目前尚無公開問答，歡迎登入會員提出您的商品疑問或透過 LINE 官方客服洽詢。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 pt-2" data-testid="qa-list">
                    {productQA.map((item) => {
                      const isLiked = !!likedQuestions[item.id];
                      return (
                        <div
                          key={item.id}
                          className="border-b border-gray-200/70 pb-6 last:border-b-0 last:pb-0 space-y-3"
                          data-testid={`qa-card-${item.id}`}
                        >
                          {/* 會員資訊列 */}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-[#245B50] text-[11px]">
                                <i className="ri-mail-line"></i>
                              </span>
                              <span className="font-mono text-gray-700 font-medium">{item.display_name || 'SAENGAK 會員'}</span>
                            </div>
                            <span className="text-gray-400 text-xs font-mono">{formatDate(item.created_at)}</span>
                          </div>

                          {/* 問題 */}
                          <div className="flex items-start gap-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-200 text-gray-700 text-xs font-bold flex-shrink-0 mt-0.5 select-none">
                              Q
                            </span>
                            <h4
                              className="text-base font-bold text-gray-900 leading-snug"
                              style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                            >
                              {item.question}
                            </h4>
                          </div>

                          {/* 回覆 */}
                          {item.answer && (
                            <div className="flex items-start gap-3 bg-[#F9FBFA] p-3.5 rounded-xl border border-gray-100">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#E3EFEA] text-[#245B50] text-xs font-bold flex-shrink-0 mt-0.5 select-none">
                                A
                              </span>
                              <div className="space-y-1">
                                <span
                                  className="text-xs font-bold text-[#245B50]"
                                  data-testid="official-reply-badge"
                                >
                                  SAENGAK 官方專業團隊回覆
                                </span>
                                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                                  {item.answer}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 有幫助互動按鈕 */}
                          <div className="ml-9">
                            <button
                              type="button"
                              onClick={() => handleToggleHelpful(item.id)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer select-none ${
                                isLiked
                                  ? 'text-[#245B50] font-bold'
                                  : 'text-gray-500 hover:text-[#245B50]'
                              }`}
                            >
                              <i
                                className={
                                  isLiked
                                    ? 'ri-thumb-up-fill text-sm text-[#245B50]'
                                    : 'ri-thumb-up-line text-sm'
                                }
                              ></i>
                              <span>有幫助</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 圖片放大檢視 Modal */}
      {isZoomModalOpen && (
        <div
          onClick={() => setIsZoomModalOpen(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-xs cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsZoomModalOpen(false)}
              className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black/80 rounded-full p-2.5 z-10 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
            <img
              src={activeImage}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
              }}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
