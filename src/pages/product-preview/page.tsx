import { useState, useRef, useEffect } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ProductCard from '../../components/feature/ProductCard';
import { mockProducts } from '../../mocks/products';
import { formatTwd } from '../../domain/algorithms';

// 範本預設商品資料（對齊 SAENGAK 正式分類：女性護理 / 每日清潔 / 深層修護 / 舒適穿著）
const SAMPLE_PRODUCT = {
  id: 'template-sample',
  name: '【示範範本】益生菌私密舒緩修護凝膠 (5點特點＋產品內容頁籤示範)',
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
  images: [
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=1000'
  ],
  // 產品內容頁籤的示範圖文
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

export default function ProductPreviewPage() {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'content' | 'details' | 'reviews' | 'related' | 'qa'>('content');
  const [selectedOption1, setSelectedOption1] = useState('單瓶裝 (150ml)');
  const [selectedOption2, setSelectedOption2] = useState('無香純淨款 (Fragrance-Free)');
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'inch'>('cm');
  const [quantity, setQuantity] = useState(1);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const thumbnailListRef = useRef<HTMLUListElement>(null);

  const product = SAMPLE_PRODUCT;
  const productImages = product.images;
  const activeImage = productImages[selectedImage] || productImages[0];

  // 自動滾動縮圖
  useEffect(() => {
    if (!thumbnailListRef.current) return;
    const container = thumbnailListRef.current;
    if (window.innerWidth >= 640) {
      container.scrollTo({ top: selectedImage * 76, behavior: 'smooth' });
    } else {
      const slotWidth = container.clientWidth / 5;
      container.scrollTo({ left: selectedImage * slotWidth, behavior: 'smooth' });
    }
  }, [selectedImage]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F7F5' }}>
      <Header />

      {/* 頂部範本展示提示條 */}
      <div className="bg-[#245B50] text-white text-xs sm:text-sm py-2.5 px-4 text-center font-medium shadow-sm fixed top-0 left-0 w-full z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">版面範本預覽模式</span>
          <span>此為新增「產品內容」頁籤與「上方 5 點特點」之示範頁面，原版商品內容未受影響。</span>
        </div>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-[160px] md:pt-[176px] lg:pt-[190px]">
        {/* =========================================================================
            1. 上方核心商品區塊 (Top Section)
            ========================================================================= */}
        <section
          id="product-main-section"
          className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:grid-cols-[760px_420px] xl:justify-center xl:gap-12"
        >
          {/* 左側：垂直縮圖列 + 焦點主圖 */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[90px_minmax(0,1fr)] lg:grid-cols-[96px_minmax(0,1fr)] sm:gap-3.5 lg:sticky lg:top-[124px]">
            {/* 縮圖導航 (桌機垂直 / 手機水平) */}
            <aside className="order-2 min-w-0 sm:order-1 relative select-none w-full">
              <div className="relative flex items-center sm:flex-col w-full gap-1.5 sm:gap-0">
                <div className="flex-1 min-w-0 overflow-hidden sm:w-full">
                  <ul
                    ref={thumbnailListRef}
                    className="w-full flex gap-2 overflow-x-auto sm:overflow-x-hidden sm:flex-col sm:overflow-y-auto sm:h-[540px] sm:max-h-[540px] scroll-smooth no-scrollbar select-none"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {productImages.map((url, idx) => {
                      const isSelected = selectedImage === idx;
                      return (
                        <li key={idx} className="w-[calc((100%-24px)/5)] sm:w-full flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedImage(idx)}
                            aria-label={`切換至第 ${idx + 1} 張圖片`}
                            className={`block w-full aspect-square sm:aspect-auto sm:h-[72px] overflow-hidden rounded-lg transition-all duration-200 border-2 cursor-pointer ${
                              isSelected
                                ? 'border-[#245B50] ring-2 ring-[#245B50]/30 shadow-xs'
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
              </div>
            </aside>

            {/* 焦點大圖展示區 */}
            <div className="order-1 min-w-0 sm:order-2">
              <div
                onClick={() => setIsZoomModalOpen(true)}
                className="relative w-full aspect-square sm:aspect-[4/5] max-h-[580px] bg-white rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs group flex items-center justify-center cursor-zoom-in"
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

                {/* 主圖 */}
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={activeImage}
                    alt={product.name}
                    className="block max-h-full max-w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>

                {/* 標籤角標與放大指示 */}
                <div className="absolute bottom-3 left-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none">
                  <span>{selectedImage + 1} / {productImages.length}</span>
                </div>
                <span className="absolute bottom-3 right-3 bg-black/55 hover:bg-black/75 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 pointer-events-none transition-colors">
                  <i className="ri-zoom-in-line"></i> 點擊放大
                </span>
              </div>
            </div>
          </div>

          {/* 右側：商品資訊、價格、變體、五大特點與購買按鈕 */}
          <aside className="min-w-0 w-full space-y-5">
            {/* 1. 商品類別 */}
            <div>
              <span className="inline-block bg-[#E8F5F1] text-[#245B50] px-3 py-1 text-xs font-bold rounded-md tracking-wider">
                {product.category}
              </span>
            </div>

            {/* 2. 商品標題與副標 */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                {product.name}
              </h1>
              <p className="mt-1 text-sm text-gray-500 font-medium tracking-wide">
                {product.subtitle}
              </p>
            </div>

            {/* 3. 價格與優惠區塊 (原價 + 折扣價) */}
            <div className="space-y-1.5 p-4 rounded-xl bg-white border border-gray-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">建議售價</span>
                <span className="text-sm text-gray-400 line-through">
                  {formatTwd(product.originalPrice)}
                </span>
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

              {/* 促銷橫幅 */}
              {product.promotionBadge && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs text-[#245B50] font-medium">
                  <i className="ri-gift-line text-sm"></i>
                  <span>{product.promotionBadge}</span>
                </div>
              )}
            </div>

            {/* 4. 產品變體選擇 (容量規格 / 香氛類型) */}
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white/70 p-4 shadow-2xs">
              {/* 容量規格 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">容量規格：</span>
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
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">香氛類型：</span>
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

            {/* 5. 產品特色亮點 (無標題、使用符號標示、支援 4~5 點) */}
            {product.highlights && product.highlights.length > 0 && (
              <div className="rounded-xl border border-gray-200/80 bg-white/70 p-4 shadow-2xs">
                <ul className="space-y-2.5">
                  {product.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-gray-800">
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
            <div className="space-y-3 pt-2">
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
                  className="flex-1 h-12 border-2 border-[#245B50] text-[#245B50] hover:bg-emerald-50/60 font-semibold rounded-xl shadow-2xs transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2"
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
              <div className="pt-2 flex items-center justify-between text-xs text-gray-500 border-t border-gray-200/60">
                <div className="flex items-center gap-1.5">
                  <i className="ri-shield-check-line text-[#245B50]"></i>
                  <span>正品原廠保證</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-truck-line text-[#245B50]"></i>
                  <span>超商 / 宅配 24H 快速出貨</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-refresh-line text-[#245B50]"></i>
                  <span>7 天安心鑑賞期</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* =========================================================================
            2. 下方頁籤系統 (Tabs Section) - 包含【產品內容】與【商品細節】
            ========================================================================= */}
        <div className="w-full bg-white py-12 mt-16 rounded-3xl shadow-xs border border-gray-200/70">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            {/* 頁籤選單導航列 (Tab Headers) */}
            <div className="mb-10 border-b border-gray-200">
              <div className="flex flex-wrap sm:flex-nowrap justify-center gap-2 sm:gap-0 max-w-4xl mx-auto">
                {[
                  { id: 'content', label: '產品內容' },
                  { id: 'details', label: '商品細節' },
                  { id: 'reviews', label: '顧客評價 (28)' },
                  { id: 'related', label: '相關推薦' },
                  { id: 'qa', label: '諮詢與問答' }
                ].map((tab) => {
                  const isActive = selectedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedTab(tab.id as any)}
                      className={`relative flex-1 min-w-[120px] sm:min-w-0 h-[54px] text-sm sm:text-base font-bold transition-all duration-200 border-b-2 cursor-pointer flex items-center justify-center ${
                        isActive
                          ? 'border-[#245B50] text-[#245B50] bg-emerald-50/40'
                          : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                      style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                    >
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 頁籤內容主面板 (Tab Panels) */}
            <div className="min-h-[460px]">
              {/* -------------------------------------------------------------
                  頁籤一：【產品內容】 (情境圖、特點細節圖、規格圖表、安心保證)
                  ------------------------------------------------------------- */}
              {selectedTab === 'content' && (
                <div className="space-y-16 animate-fadeIn">
                  {/* 1. 情境大圖與生活美學 (Lifestyle & Scenario Showcase) */}
                  <div className="space-y-12">
                    {product.contentSections.map((sec, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${
                          idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'
                        } items-center gap-8 bg-gray-50/70 p-6 sm:p-8 rounded-3xl border border-gray-200/60 transition-all hover:border-[#245B50]/30`}
                      >
                        <div className="w-full md:w-1/2 aspect-[4/3] rounded-2xl overflow-hidden shadow-xs relative group">
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

                  {/* 2. 產品特點與細節近拍 (Feature & Detail Highlights) */}
                  <div className="space-y-6">
                    <div className="border-l-4 border-[#245B50] pl-3">
                      <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        細部做工與核心特色
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

                  {/* 3. 規格尺寸與容量對照圖表 (Dimensions & Spec Chart) */}
                  <div className="bg-[#FAF9F6] border border-gray-200 rounded-3xl p-6 sm:p-8 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#245B50] text-white flex items-center justify-center text-lg shadow-xs">
                        <i className="ri-ruler-2-line"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                          規格尺寸與包裝容量對照
                        </h3>
                        <p className="text-xs text-gray-500">韓國原廠標準製造，每批次均經嚴格品管與無菌充填包裝</p>
                      </div>
                    </div>

                    {/* 規格表格 */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-2xs">
                      <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-100/90 text-xs font-bold text-gray-700 uppercase">
                          <tr>
                            <th className="px-5 py-3.5">包裝規格</th>
                            <th className="px-5 py-3.5">單瓶容量</th>
                            <th className="px-5 py-3.5">酸鹼值 (pH)</th>
                            <th className="px-5 py-3.5">保存期限</th>
                            <th className="px-5 py-3.5">建議使用頻率與場景</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-5 py-4 font-bold text-[#245B50]">單瓶日常裝</td>
                            <td className="px-5 py-4">150 ml</td>
                            <td className="px-5 py-4">pH 4.5 ~ 5.5</td>
                            <td className="px-5 py-4">未開封 36 個月</td>
                            <td className="px-5 py-4">每日沐浴清潔護理、運動沐浴後使用</td>
                          </tr>
                          <tr className="hover:bg-emerald-50/30 transition-colors bg-gray-50/40">
                            <td className="px-5 py-4 font-bold text-[#245B50]">2+1 囤貨優惠組</td>
                            <td className="px-5 py-4">150 ml x 3 瓶</td>
                            <td className="px-5 py-4">pH 4.5 ~ 5.5</td>
                            <td className="px-5 py-4">未開封 36 個月</td>
                            <td className="px-5 py-4">生理期前後加強舒緩、定期居家常備</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. 品質承諾與安心保證 (Trust & Guarantees) */}
                  <div className="rounded-3xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200/80 p-6 sm:p-8 space-y-6">
                    <div className="text-center max-w-xl mx-auto space-y-1">
                      <span className="text-xs font-bold text-[#245B50] uppercase tracking-widest">
                        SAENGAK Quality Guarantee
                      </span>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        官方四大品質與安心承諾
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                      <div className="p-5 rounded-2xl bg-white border border-emerald-100/80 text-center space-y-2 shadow-2xs">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#245B50] flex items-center justify-center text-xl mx-auto">
                          <i className="ri-shield-check-line"></i>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">韓國原裝直營正品</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">首爾原廠官方授權進口，防偽雷射標籤，保證 100% 正品。</p>
                      </div>

                      <div className="p-5 rounded-2xl bg-white border border-emerald-100/80 text-center space-y-2 shadow-2xs">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#245B50] flex items-center justify-center text-xl mx-auto">
                          <i className="ri-award-line"></i>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">國際權威醫學認證</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">榮獲德國 Dermatest 優異認證，通過肌膚刺激性嚴格測試。</p>
                      </div>

                      <div className="p-5 rounded-2xl bg-white border border-emerald-100/80 text-center space-y-2 shadow-2xs">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#245B50] flex items-center justify-center text-xl mx-auto">
                          <i className="ri-truck-line"></i>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">現貨 24H 快速出貨</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">台灣在地倉庫即時庫存，超商取貨或宅配到府快速安全送達。</p>
                      </div>

                      <div className="p-5 rounded-2xl bg-white border border-emerald-100/80 text-center space-y-2 shadow-2xs">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#245B50] flex items-center justify-center text-xl mx-auto">
                          <i className="ri-customer-service-2-line"></i>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">7 天安心鑑賞與售後</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">享有 7 天猶豫期保障，專屬 LINE 客服提供一對一諮詢服務。</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  頁籤二：【商品細節】 (規格參數與注意事項)
                  ------------------------------------------------------------- */}
              {/* -------------------------------------------------------------
                  頁籤二：【商品細節】 (Musinsa 風格：版型特徵指標 ＋ 尺碼測量表 ＋ 詳細參數)
                  ------------------------------------------------------------- */}
              {selectedTab === 'details' && (
                <div className="space-y-12 animate-fadeIn">
                  {/* 1. Musinsa 經典：版型與著感指標 (Fit & Feeling Guide) */}
                  <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
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

                  {/* 2. 實測尺碼指南 (Size Guide & Measurement Table) */}
                  <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
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
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
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

                  {/* 3. 商品詳細規格與洗滌保養 (Product Information & Care) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 詳細參數 */}
                    <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-6 sm:p-8 shadow-2xs space-y-4">
                      <h4 className="text-base font-bold text-gray-900 border-b border-gray-200/70 pb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                        基本商品資訊 (Product Details)
                      </h4>
                      <dl className="space-y-3.5 text-xs sm:text-sm">
                        <div className="flex justify-between border-b border-gray-200/50 pb-2.5">
                          <dt className="text-gray-500">商品品名</dt>
                          <dd className="font-semibold text-gray-900">{product.name}</dd>
                        </div>
                        <div className="flex justify-between border-b border-gray-200/50 pb-2.5">
                          <dt className="text-gray-500">商品類別</dt>
                          <dd className="font-semibold text-gray-900">{product.category}</dd>
                        </div>
                        <div className="flex justify-between border-b border-gray-200/50 pb-2.5">
                          <dt className="text-gray-500">製造國別 (Origin)</dt>
                          <dd className="font-semibold text-gray-900">韓國 (Made in Korea)</dd>
                        </div>
                        <div className="flex justify-between border-b border-gray-200/50 pb-2.5">
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
                    <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-6 sm:p-8 shadow-2xs space-y-4">
                      <h4 className="text-base font-bold text-gray-900 border-b border-gray-200/70 pb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
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
                  頁籤三：【顧客評價】
                  ------------------------------------------------------------- */}
              {selectedTab === 'reviews' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
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
                  頁籤四：【相關推薦】
                  ------------------------------------------------------------- */}
              {selectedTab === 'related' && (
                <div className="animate-fadeIn">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 text-center" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                    為您精選的搭配選品
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {mockProducts.slice(0, 4).map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  頁籤五：【諮詢與問答】
                  ------------------------------------------------------------- */}
              {selectedTab === 'qa' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-[#1a473e] flex items-center gap-2">
                        <i className="ri-line-fill text-2xl text-[#06C755]"></i>
                        LINE 官方客服專屬諮詢
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        若您對此範本之尺寸規格、保養方式有任何問題，歡迎隨時加入官方 LINE 諮詢。
                      </p>
                    </div>
                    <a
                      href="https://line.me/R/ti/p/@saengak"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors whitespace-nowrap"
                    >
                      <i className="ri-line-fill text-lg"></i>
                      加 LINE 諮詢客服
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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
