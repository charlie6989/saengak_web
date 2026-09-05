import { useState, useRef, useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { formatTwd } from '../../domain/algorithms';

// 預設商品資料（對齊 SAENGAK 正式分類：女性護理）
const SAMPLE_PRODUCT = {
  id: 'template-sample',
  name: '益生菌私密舒緩修護凝膠 (150ml)',
  subtitle: '韓國原裝進口 | Dermatest 醫學肌膚認證 | 溫和弱酸配方',
  category: '女性護理',
  price: 1280,
  originalPrice: 1680,
  discountPercentage: 24,
  promotionBadge: '春季特別優惠・滿 2 件享免運折扣',
  highlights: [
    '通過德國 Dermatest 最高等級優異皮膚耐受性測試認證',
    '嚴選天然植萃與專利益生菌微生態配方，維持 pH4.5~5.5 弱酸健康平衡',
    '堅持不添加 21 種有害化學成分與人工香精，敏弱肌膚也能安心使用',
    '水潤凝膠質地清爽好吸收，深層滋潤不黏膩',
    '韓國原廠直營進口正品保證，享 7 天安心鑑賞期'
  ],
  options: [
    {
      name: '容量規格',
      values: ['單瓶裝 (150ml)', '2+1 囤貨優惠組 (150ml x 3)']
    },
    {
      name: '香氛類型',
      values: ['無香純淨款 (Fragrance-Free)', '草本微風 (Herbal Breeze)']
    }
  ],
  // 比例為直長型 (3:4 或 2:3) 之商品展示圖
  images: [
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=900&h=1200',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=900&h=1200',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=900&h=1200',
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=900&h=1200',
    'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=900&h=1200',
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=900&h=1200'
  ],
  // 細節頁籤之情境圖文
  contentSections: [
    {
      title: '專利益生菌生態平衡・溫和守護女性健康',
      description: '為女性私密肌膚量身打造，富含高活性益生菌複合成分與天然植萃精華，深層維持微生態弱酸屏障。',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1200',
      badge: 'CARE 01'
    },
    {
      title: '極致親膚質地・一抹即化零負擔',
      description: '水感凝露質地，輕盈水潤好推開，能快速被肌膚吸收並形成透氣鎖水保護膜，告別悶熱黏膩。',
      image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=1200',
      badge: 'TEXTURE 02'
    },
    {
      title: '德國 Dermatest 權威檢驗・全成分透明公開',
      description: '無酒精、無色素、無paraben防腐劑，通過人體皮膚刺激測試，敏感時期與每日日常皆可放心使用。',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1200',
      badge: 'SAFETY 03'
    }
  ]
};

// 對齊 Readdy 第 1 版原版規格之相關產品推薦資料（3:4 長方形圖片、簡介與折扣價格）
const RELATED_PREVIEW_PRODUCTS = [
  {
    id: 'rel-1',
    category: '女性護理',
    name: 'SAENGAK 私密護理潔淨慕斯',
    description: '專為敏感肌膚設計的溫和潔膚產品，低刺激配方適合敏感性肌膚，有效緩解異味問題',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=900&h=1200',
    originalPrice: 19,
    price: 14,
    discountPercentage: 24
  },
  {
    id: 'rel-2',
    category: '女性護理',
    name: '抗菌無痕內褲 - 舒適款',
    description: '專為敏感肌膚設計的溫和潔膚產品，低刺激配方適合敏感性肌膚，有效緩解異味問題',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=900&h=1200',
    originalPrice: 14,
    price: 11,
    discountPercentage: 22
  },
  {
    id: 'rel-3',
    category: '女性護理',
    name: '深層修護私密清潔露',
    description: '專為敏感肌膚設計的溫和潔膚產品，低刺激配方適合敏感性肌膚，有效緩解異味問題',
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=900&h=1200',
    originalPrice: 22,
    price: 17,
    discountPercentage: 20
  },
  {
    id: 'rel-4',
    category: '女性護理',
    name: '生理褲 - 超薄款',
    description: '專為敏感肌膚設計的溫和潔膚產品，低刺激配方適合敏感性肌膚，有效緩解異味問題',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=900&h=1200',
    originalPrice: 21,
    price: 16,
    discountPercentage: 23
  }
];

export default function ProductPreviewPage() {
  const [selectedImage, setSelectedImage] = useState(0);
  // 頁籤狀態（預設選中產品內容）
  const [selectedTab, setSelectedTab] = useState<'details' | 'reviews' | 'related' | 'qa'>('details');
  const [selectedOption1, setSelectedOption1] = useState('單瓶裝 (150ml)');
  const [selectedOption2, setSelectedOption2] = useState('無香純淨款 (Fragrance-Free)');
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'inch'>('cm');
  const [quantity, setQuantity] = useState(1);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [relatedWishlist, setRelatedWishlist] = useState<Record<string, boolean>>({});
  const thumbnailListRef = useRef<HTMLUListElement>(null);

  // 焦點圖拖曳與滑動切換手勢狀態
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const hasDragged = useRef(false);

  // 縮圖列拖曳狀態
  const isThumbDragging = useRef(false);
  const thumbDragStartX = useRef<number | null>(null);
  const thumbScrollStartX = useRef<number>(0);
  const hasThumbDragged = useRef(false);

  const product = SAMPLE_PRODUCT;
  const productImages = product.images;
  const activeImage = productImages[selectedImage] || productImages[0];

  // 詢問 (Q&A) 虛擬問答資料與互動狀態（會員資訊以部分遮蔽之 Email 呈現以保護隱私）
  const [qaList, setQaList] = useState([
    {
      id: 'qa-1',
      author: 'li***9@gmail.com',
      date: '2026/02/24',
      question: '這個產品可以用來清洗陰道內部嗎？',
      answer: '不建議用於陰道內部。此產品專門設計用於外陰部清潔，以維持私密部位的自然酸鹼平衡。如有任何不適，請停止使用並諮詢醫師。',
      helpful: 24
    },
    {
      id: 'qa-2',
      author: 'yu***6@gmail.com',
      date: '2026/02/18',
      question: '成分中的植物萃取會引起過敏嗎？',
      answer: 'Saengak 產品經過嚴格測試，使用低敏配方，但極少數人仍可能對植物成分過敏。建議使用前先在小範圍皮膚測試。若出現紅腫或癢感，請立即停用並諮詢醫師。',
      helpful: 18
    },
    {
      id: 'qa-3',
      author: 'ch***7@gmail.com',
      date: '2026/02/09',
      question: '懷孕期間可使用嗎？',
      answer: '懷孕期間荷爾蒙變化可能導致私密部位敏感度提升。建議在懷孕期間使用本產品前，先諮詢專業婦產科醫師意見。',
      helpful: 12
    },
    {
      id: 'qa-4',
      author: 'cl***8@yahoo.com.tw',
      date: '2026/01/28',
      question: '建議的每日使用次數與清潔方式為何？',
      answer: '建議每日沐浴時使用 1 次，按壓約 1-2 下凝膠於掌心起泡後輕柔清潔外陰部位，再以溫水徹底沖淨即可。生理期間或運動過後亦可視需要適度使用。',
      helpful: 15
    },
    {
      id: 'qa-5',
      author: 'le***3@gmail.com',
      date: '2026/01/15',
      question: '商品開封後可以保存多久？',
      answer: '未開封狀態下保質期為 3 年。開封後為維持益生菌微生態與植萃活性，建議置於陰涼通風處，並於 6 至 12 個月內使用完畢。',
      helpful: 9
    }
  ]);
  const [questionInput, setQuestionInput] = useState('');
  const [likedQuestions, setLikedQuestions] = useState<Record<string, boolean>>({});
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);

  const handleToggleHelpful = (id: string) => {
    setLikedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const newQa = {
      id: `qa-${Date.now()}`,
      author: 'yo***@gmail.com (您)',
      date: formattedDate,
      question: questionInput.trim(),
      answer: '感謝您的提問！我們的專業護理團隊將於 24 小時內完成回覆並更新於此。',
      helpful: 0
    };
    setQaList((prev) => [newQa, ...prev]);
    setQuestionInput('');
    setShowSuccessNotice(true);
    setTimeout(() => {
      setShowSuccessNotice(false);
    }, 4000);
  };

  // 自動滾動縮圖（選中第 7 張以上自動平滑滾動）
  useEffect(() => {
    if (!thumbnailListRef.current) return;
    const container = thumbnailListRef.current;
    if (window.innerWidth >= 640) {
      const itemHeight = container.clientHeight / 6;
      const targetScrollTop = Math.max(0, (selectedImage - 5) * itemHeight);
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    } else {
      const slotWidth = container.clientWidth / 6;
      const targetScrollLeft = Math.max(0, (selectedImage - 5) * slotWidth);
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [selectedImage]);

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

  const handleThumbnailClick = (index: number) => {
    if (hasThumbDragged.current) return;
    setSelectedImage(index);
  };

  // 焦點圖滑鼠/觸控拖曳手勢 Handlers
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
    setIsZoomModalOpen(true);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5' }}>
      <Header />

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-[108px] sm:pt-[116px] md:pt-[124px] lg:pt-[132px]">
        {/* =========================================================================
            1. 上方核心商品展示區塊 (Top Section)
            ========================================================================= */}
        <section
          id="product-main-section"
          className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] xl:grid-cols-[720px_460px] xl:justify-center xl:gap-12"
        >
          {/* 左側：直長型縮圖導航列 + 直長型焦點主圖 (高度嚴格控制在右邊立即購買按鈕之內，約 520px) */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[78px_minmax(0,1fr)] md:grid-cols-[84px_minmax(0,1fr)] lg:grid-cols-[90px_minmax(0,1fr)] sm:gap-3.5 lg:sticky lg:top-[108px] sm:h-[520px] sm:max-h-[520px]">
            {/* 縮圖導航 (總長度嚴格控制不超過右邊立即購買高度，展示 6 張縮圖，超出支援平滑捲動) */}
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
                            className={`block w-full h-full overflow-hidden rounded-md transition-all duration-200 border-2 cursor-pointer ${
                              isSelected
                                ? 'border-[#245B50] ring-1 ring-[#245B50] shadow-xs'
                                : 'border-transparent hover:border-gray-300 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={url}
                              alt={`縮圖 ${idx + 1}`}
                              className="block h-full w-full object-cover object-center pointer-events-none"
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

            {/* 焦點大圖展示區 (高度與縮圖齊平 520px，全圖完整自然展示) */}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage((prev) => Math.max(0, prev - 1));
                    }}
                    aria-label="上一張圖片"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center z-10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line text-lg"></i>
                  </button>
                )}

                {selectedImage < productImages.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage((prev) => Math.min(productImages.length - 1, prev + 1));
                    }}
                    aria-label="下一張圖片"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center z-10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line text-lg"></i>
                  </button>
                )}

                {/* 焦點主圖 (高度與寬度自然填滿容器，全圖滿版無白邊) */}
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-200"
                  style={{
                    transform: isDragging ? `translateX(${dragOffset * 0.4}px)` : 'none'
                  }}
                >
                  <img
                    src={activeImage}
                    alt={product.name}
                    draggable={false}
                    className="block w-full h-full object-cover object-center pointer-events-none transition-transform duration-300 group-hover:scale-[1.01] rounded-xl"
                  />
                </div>

                {/* 標籤角標與放大指示 */}
                <div className="absolute bottom-3 left-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none">
                  <span>{selectedImage + 1} / {productImages.length}</span>
                </div>
                <span className="absolute bottom-3 right-3 bg-black/55 hover:bg-black/75 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none transition-colors">
                  <i className="ri-zoom-in-line"></i> 點擊放大 / 拖曳切換
                </span>
              </div>
            </div>
          </div>

          {/* 右側：商品資訊、價格、變體、產品特點與購買按鈕 */}
          <aside className="min-w-0 w-full space-y-6">
            {/* 1. 商品類別 (實心淡雅底色標籤) */}
            <div>
              <span className="inline-block bg-[#E3EFEA] text-[#245B50] px-3 py-1 text-xs sm:text-sm font-bold rounded-md tracking-wider">
                {product.category}
              </span>
            </div>

            {/* 2. 商品標題與副標 */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                {product.name}
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                {product.subtitle}
              </p>
            </div>

            {/* 3. 原價與折扣價 */}
            <div className="space-y-1 border-t border-gray-200/60 pt-4">
              <div className="text-sm text-gray-400 line-through">
                原價 {formatTwd(product.originalPrice)}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-extrabold text-[#245B50]">
                  -{product.discountPercentage}%
                </span>
                <span className="text-3xl sm:text-4xl font-black text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {formatTwd(product.price)}
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full ml-1">
                  現省 NT$ {product.originalPrice - product.price}
                </span>
              </div>

              {product.promotionBadge && (
                <div className="pt-1.5 flex items-center gap-1.5 text-xs text-[#245B50] font-medium">
                  <i className="ri-gift-line"></i>
                  <span>{product.promotionBadge}</span>
                </div>
              )}
            </div>

            {/* 4. 產品變體選擇 */}
            <div className="space-y-4 border-t border-gray-200/60 pt-4">
              {/* 容量規格 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">容量規格：</span>
                  <span className="text-[#245B50] font-semibold text-xs">{selectedOption1}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.options[0].values.map((val) => {
                    const isSelected = selectedOption1 === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSelectedOption1(val)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#245B50] text-white shadow-xs ring-2 ring-[#245B50] ring-offset-1'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-[#245B50] hover:bg-emerald-50/40'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 香氛類型 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">香氛類型：</span>
                  <span className="text-[#245B50] font-semibold text-xs">{selectedOption2}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.options[1].values.map((val) => {
                    const isSelected = selectedOption2 === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSelectedOption2(val)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#245B50] text-white shadow-xs ring-2 ring-[#245B50] ring-offset-1'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-[#245B50] hover:bg-emerald-50/40'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. 產品特點（標題與特色條列清單） */}
            <div className="border-t border-gray-200/60 pt-4 space-y-2.5">
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

            {/* 6. 數量與購買按鈕 */}
            <div className="space-y-3 border-t border-gray-200/60 pt-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">購買數量</span>
                <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-semibold border-l border-r border-gray-200 py-2">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  className="flex-1 h-12 border-2 border-[#245B50] text-[#245B50] hover:bg-emerald-50/60 font-semibold rounded-xl shadow-2xs transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 bg-white"
                >
                  <i className="ri-shopping-bag-line text-lg"></i>
                  加入購物車
                </button>
                <button
                  type="button"
                  className="flex-1 h-12 bg-[#245B50] hover:bg-[#1a4239] text-white font-semibold rounded-xl shadow-xs transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  <i className="ri-flashlight-fill text-lg"></i>
                  立即購買
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
          2. 下方全寬頁籤與內容區塊 (Full-Width Tabs Section - 調整全寬背景純白與頁籤底色，消除區塊色差)
          ========================================================================= */}
      <div className="w-full bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* 頁籤選單導航列 (Tab Navigation - 保持原版 4 頁籤名稱與順序，對齊原版平整無框按鈕與底色) */}
          <div className="mb-12">
            <div className="flex gap-0 justify-center">
              {[
                { id: 'details', label: '產品內容' },
                { id: 'reviews', label: '顧客評價 (354)' },
                { id: 'related', label: '相關產品' },
                { id: 'qa', label: '詢問' }
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
                      isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
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

          {/* 頁籤內容主面板 (Tab Panels - 內容完全保持原樣不變) */}
          <div className="min-h-[400px]">
              {/* -------------------------------------------------------------
                  單一核心頁籤：【產品內容】 (包含生活情境圖文、其他功能/細節圖片、尺寸、版型、規格)
                  ------------------------------------------------------------- */}
              {selectedTab === 'details' && (
                <div className="space-y-12 animate-fadeIn">
                  {/* 1. 商品生活情境圖文 (Scenario Showcase) */}
                  <div className="space-y-6">
                    {product.contentSections.map((sec, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${
                          idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'
                        } items-center gap-8 bg-white p-6 sm:p-8 rounded-2xl border border-gray-200/70 shadow-2xs`}
                      >
                        <div className="w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden shadow-2xs relative group">
                          <img
                            src={sec.image}
                            alt={sec.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                          <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {sec.badge}
                          </span>
                        </div>
                        <div className="w-full md:w-1/2 space-y-3 text-left">
                          <span className="text-xs font-bold text-[#245B50] tracking-widest uppercase">
                            Lifestyle & Feature
                          </span>
                          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                            {sec.title}
                          </h3>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {sec.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 2. 商品其他功能與細節圖片 (包含尺寸、功能等) */}
                  <div className="space-y-6">
                    <div className="border-l-4 border-[#245B50] pl-3">
                      <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        商品其他功能與細節圖片
                      </h3>
                      <p className="text-xs text-gray-500">深入解析商品材質工藝、質地觸感與獨家機能設計</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 特點圖 1 */}
                      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs group">
                        <div className="aspect-[16/10] overflow-hidden bg-gray-100">
                          <img
                            src="https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800"
                            alt="細部特寫・親膚水感凝露質地"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-5 space-y-1.5">
                          <span className="text-xs font-bold text-[#245B50]">質地與吸收</span>
                          <h4 className="text-base font-bold text-gray-900">極致水感凝露・深層滋潤不黏膩</h4>
                          <p className="text-xs text-gray-600 leading-relaxed">輕透水潤質地，觸膚即化，快速形成透氣保濕鎖水屏障，維持全天候清新舒適。</p>
                        </div>
                      </div>

                      {/* 特點圖 2 */}
                      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs group">
                        <div className="aspect-[16/10] overflow-hidden bg-gray-100">
                          <img
                            src="https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800"
                            alt="細部特寫・按壓式定量真空瓶器"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-5 space-y-1.5">
                          <span className="text-xs font-bold text-[#245B50]">瓶器與包裝工藝</span>
                          <h4 className="text-base font-bold text-gray-900">按壓式定量壓頭・隔絕空氣無菌保鮮</h4>
                          <p className="text-xs text-gray-600 leading-relaxed">特殊氣密式瓶器設計，防止外界水氣與空氣回流，確保每滴成分活性長效新鮮。</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. 版型與著感指標 (Fit & Feeling Guide / Musinsa Specs) */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <div className="flex items-center gap-2.5">
                        <i className="ri-dashboard-line text-xl text-[#245B50]"></i>
                        <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          版型與著感指標 (Fit & Feeling Guide)
                        </h3>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">Musinsa Standard Specs</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-10">
                      {/* 版型 Fit */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-gray-700">
                          <span>版型 (Fit)</span>
                          <span className="text-[#245B50]">合身 (Regular Fit)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">緊身 (Slim)</div>
                          <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">合身 (Regular)</div>
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">寬鬆 (Oversized)</div>
                        </div>
                      </div>

                      {/* 厚度 Thickness */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-gray-700">
                          <span>厚度 (Thickness)</span>
                          <span className="text-[#245B50]">適中 (Moderate)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">輕薄 (Light)</div>
                          <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">適中 (Moderate)</div>
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">厚實 (Heavy)</div>
                        </div>
                      </div>

                      {/* 彈性 Elasticity */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-gray-700">
                          <span>彈性 (Elasticity)</span>
                          <span className="text-[#245B50]">彈性良好 (High)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">無彈性 (None)</div>
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">微彈 (Slight)</div>
                          <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">良好 (High)</div>
                        </div>
                      </div>

                      {/* 透度 Sheerness */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-gray-700">
                          <span>透膚度 (Sheerness)</span>
                          <span className="text-[#245B50]">不透 (Opaque)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                          <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">不透 (Opaque)</div>
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">微透 (Slight)</div>
                          <div className="py-2 rounded-lg bg-gray-100 text-gray-400">透膚 (Sheer)</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. 實測尺碼指南 (Size Guide & Measurement Table) */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          實測尺碼對照指南 (Size Guide)
                        </h3>
                        <p className="text-xs text-gray-500">所有尺碼皆為平放手工量測，誤差值 ±1~2cm 為正常範圍</p>
                      </div>

                      {/* 單位切換 (cm / inch) */}
                      <div className="flex items-center bg-gray-100 p-1 rounded-xl w-fit">
                        <button
                          type="button"
                          onClick={() => setSizeUnit('cm')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            sizeUnit === 'cm'
                              ? 'bg-white text-gray-900 shadow-2xs'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          公分 (cm)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSizeUnit('inch')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            sizeUnit === 'inch'
                              ? 'bg-white text-gray-900 shadow-2xs'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          英吋 (inch)
                        </button>
                      </div>
                    </div>

                    {/* 尺寸表格 */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                      <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-100/80 text-xs font-bold text-gray-700 uppercase">
                          <tr>
                            <th className="px-5 py-3.5">尺碼 (Size)</th>
                            <th className="px-5 py-3.5">總長 ({sizeUnit})</th>
                            <th className="px-5 py-3.5">肩寬 / 寬度 ({sizeUnit})</th>
                            <th className="px-5 py-3.5">胸寬 / 深度 ({sizeUnit})</th>
                            <th className="px-5 py-3.5">建議身高 / 體型</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-5 py-4 font-bold text-[#245B50]">S (01)</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '68.0' : '26.7'}</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '50.0' : '19.6'}</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '54.0' : '21.2'}</td>
                            <td className="px-5 py-4 text-xs text-gray-600">155 ~ 165 cm / 45 ~ 55 kg</td>
                          </tr>
                          <tr className="hover:bg-emerald-50/30 transition-colors bg-gray-50/40">
                            <td className="px-5 py-4 font-bold text-[#245B50]">M (02)</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '71.0' : '27.9'}</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '52.5' : '20.6'}</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '56.5' : '22.2'}</td>
                            <td className="px-5 py-4 text-xs text-gray-600">165 ~ 175 cm / 55 ~ 68 kg</td>
                          </tr>
                          <tr className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-5 py-4 font-bold text-[#245B50]">L (03)</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '74.0' : '29.1'}</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '55.0' : '21.6'}</td>
                            <td className="px-5 py-4">{sizeUnit === 'cm' ? '59.0' : '23.2'}</td>
                            <td className="px-5 py-4 text-xs text-gray-600">175 ~ 185 cm / 68 ~ 82 kg</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 5. 基本商品資訊 & 洗滌保養說明 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 詳細參數 */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
                      <h4 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        基本商品資訊 (Product Details)
                      </h4>
                      <dl className="space-y-3.5 text-xs sm:text-sm">
                        <div className="flex justify-between border-b border-gray-100 pb-2.5">
                          <dt className="text-gray-500">商品品名</dt>
                          <dd className="font-semibold text-gray-900">{product.name}</dd>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2.5">
                          <dt className="text-gray-500">商品類別</dt>
                          <dd className="font-semibold text-gray-900">{product.category}</dd>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2.5">
                          <dt className="text-gray-500">製造國別 (Origin)</dt>
                          <dd className="font-semibold text-gray-900">韓國 (Made in Korea)</dd>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2.5">
                          <dt className="text-gray-500">材質與成分</dt>
                          <dd className="font-semibold text-gray-900">100% 精梳純棉 / 天然植萃纖維</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">製造年份 / 批次</dt>
                          <dd className="font-semibold text-gray-900">2026 年度最新批次</dd>
                        </div>
                      </dl>
                    </div>

                    {/* 洗滌與保養 */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
                      <h4 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        洗滌與保養說明 (Care Instructions)
                      </h4>
                      <div className="space-y-3 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-start gap-2.5">
                          <i className="ri-hand-sanitizer-line text-[#245B50] text-base mt-0.5"></i>
                          <span>建議使用 30°C 以下冷水手洗或放入洗衣袋慢速弱洗。</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <i className="ri-sun-line text-[#245B50] text-base mt-0.5"></i>
                          <span>請置於陰涼通風處懸掛晾乾，避免長時間烈日曝曬。</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <i className="ri-prohibited-line text-[#245B50] text-base mt-0.5"></i>
                          <span>請勿使用含漂白成分或螢光劑之強效洗劑，切勿高溫烘乾。</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <i className="ri-t-shirt-air-line text-[#245B50] text-base mt-0.5"></i>
                          <span>深淺色衣物請分開洗滌，避免互染。</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  頁籤二：【顧客評價】
                  ------------------------------------------------------------- */}
              {selectedTab === 'reviews' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
                    <div className="flex items-center gap-5">
                      <div className="text-5xl font-black text-gray-900">4.9</div>
                      <div className="space-y-1">
                        <div className="flex items-center text-amber-400 text-lg">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <i key={s} className="ri-star-fill"></i>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 font-medium">共 28 則已驗證顧客評價</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 max-w-xs sm:text-right">
                      所有評價皆來自完成訂單之會員真實反饋。
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { name: '王*晴 (台北市)', rating: 5, date: '2026/02/20', comment: '質感真的非常棒！實品顏色跟照片完全零色差，5大特點的防潑水真的很厲害，非常推薦！' },
                      { name: '陳*宏 (台中市)', rating: 5, date: '2026/02/15', comment: '出貨速度很快，尺寸剛好放進床頭櫃，做工非常細膩，很滿意的一次購物體驗。' }
                    ].map((rev, idx) => (
                      <div key={idx} className="p-5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-800">{rev.name}</span>
                          <span className="text-gray-400">{rev.date}</span>
                        </div>
                        <div className="text-amber-400 text-xs">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <i key={i} className="ri-star-fill mr-0.5"></i>
                          ))}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  頁籤三：【相關推薦】
                  ------------------------------------------------------------- */}
              {/* -------------------------------------------------------------
                  頁籤三：【相關推薦】（對齊 Readdy 第 1 版原版規格：長方形 3:4 圖片與滿版商品卡片）
                  ------------------------------------------------------------- */}
              {selectedTab === 'related' && (
                <div className="animate-fadeIn space-y-6">
                  <h3
                    className="text-xl sm:text-2xl font-bold text-gray-900 text-center"
                    style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                  >
                    相關產品推薦
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {RELATED_PREVIEW_PRODUCTS.map((item) => {
                      const isWishlisted = !!relatedWishlist[item.id];
                      return (
                        <div
                          key={item.id}
                          className="group cursor-pointer flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-2xs border border-gray-100/80 hover:shadow-md transition-shadow"
                          onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          {/* 3:4 直長型長方形圖片 (對齊第 1 版規格) */}
                          <div className="relative aspect-[3/4] overflow-hidden bg-[#F5F5F3]">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                              loading="lazy"
                            />
                            {/* 懸浮查看商品按鈕 */}
                            <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="w-full py-2.5 bg-white/95 hover:bg-[#245B50] hover:text-white text-gray-900 text-xs sm:text-sm font-medium shadow-sm transition-all text-center cursor-pointer"
                                style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                              >
                                查看商品
                              </button>
                            </div>
                          </div>

                          {/* 商品資訊區塊 */}
                          <div className="p-4 space-y-1 flex-1 flex flex-col">
                            {/* 類別與收藏圖示 */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{item.category}</span>
                              <button
                                type="button"
                                aria-label="收藏商品"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRelatedWishlist((prev) => ({
                                    ...prev,
                                    [item.id]: !prev[item.id]
                                  }));
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-0.5"
                              >
                                <i
                                  className={
                                    isWishlisted
                                      ? 'ri-heart-fill text-red-500'
                                      : 'ri-heart-line'
                                  }
                                ></i>
                              </button>
                            </div>

                            {/* 商品名稱 */}
                            <h4
                              className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-[#245B50] transition-colors line-clamp-1"
                              style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                            >
                              {item.name}
                            </h4>

                            {/* 簡短描述 */}
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed flex-1 pt-0.5">
                              {item.description}
                            </p>

                            {/* 價格資訊 */}
                            <div className="pt-2 space-y-0.5">
                              {item.originalPrice && (
                                <div className="text-xs text-gray-400 line-through">
                                  ${item.originalPrice}
                                </div>
                              )}
                              <div className="flex items-baseline gap-2">
                                {item.discountPercentage && (
                                  <span className="text-sm font-bold text-[#245B50]">
                                    -{item.discountPercentage}%
                                  </span>
                                )}
                                <span className="text-base font-bold text-gray-900">
                                  ${item.price}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  頁籤四：【詢問 (Q&A)】（對齊 Readdy 原版規格與虛擬資料）
                  ------------------------------------------------------------- */}
              {selectedTab === 'qa' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* 1. 提出問題區塊 */}
                  <div className="rounded-2xl border border-gray-200/90 bg-gray-50/70 p-6 sm:p-8 space-y-4 shadow-2xs">
                    <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                      提出問題
                    </h3>

                    {showSuccessNotice && (
                      <div className="p-3.5 bg-emerald-50 text-[#245B50] text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 animate-fadeIn">
                        <i className="ri-checkbox-circle-fill text-base text-emerald-600"></i>
                        <span>提問已成功送出！客服人員將於 24 小時內回覆並公開於下方列表。</span>
                      </div>
                    )}

                    <form onSubmit={handleQuestionSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-gray-700">
                            您的問題
                          </label>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <i className="ri-shield-user-line text-[#245B50]"></i>
                            <span>為保護隱私，提問將以部分遮蔽之 Email 帳號公開</span>
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={questionInput}
                          onChange={(e) => setQuestionInput(e.target.value)}
                          placeholder="在此輸入您的問題..."
                          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:border-[#245B50] focus:ring-1 focus:ring-[#245B50] focus:outline-none bg-white placeholder-gray-400 resize-none transition-all shadow-2xs"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!questionInput.trim()}
                        className="w-full py-3.5 bg-[#245B50] hover:bg-[#1a4239] text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        提交問題
                      </button>
                    </form>
                  </div>

                  {/* 2. 顧客提問與專業回覆列表 */}
                  <div className="space-y-6 pt-2">
                    {qaList.map((item) => {
                      const isLiked = !!likedQuestions[item.id];
                      return (
                        <div
                          key={item.id}
                          className="border-b border-gray-200/70 pb-6 last:border-b-0 last:pb-0 space-y-3"
                        >
                          {/* 會員資訊列 (遮蔽之 Email 與提問日期) */}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-[#245B50] text-[11px]">
                                <i className="ri-mail-line"></i>
                              </span>
                              <span className="font-mono text-gray-700 font-medium">{item.author}</span>
                            </div>
                            <span className="text-gray-400 text-xs font-mono">{item.date}</span>
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
                          <div className="flex items-start gap-3 bg-[#F9FBFA] p-3.5 rounded-xl border border-gray-100">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#E3EFEA] text-[#245B50] text-xs font-bold flex-shrink-0 mt-0.5 select-none">
                              A
                            </span>
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-[#245B50]">
                                SAENGAK 官方專業團隊回覆
                              </span>
                              <p className="text-sm text-gray-600 leading-relaxed">
                                {item.answer}
                              </p>
                            </div>
                          </div>

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
                              <span>有幫助 ({item.helpful + (isLiked ? 1 : 0)})</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setIsZoomModalOpen(false)}
              className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black/80 rounded-full p-2.5 z-10 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
            <img
              src={activeImage}
              alt={product.name}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
