import { useState, useRef, useEffect, useMemo } from 'react';
import type {
  MusinsaFitGuide,
  SizeChartItem,
  CareSpecs,
  LifestyleShowcaseItem,
  CraftDetailItem,
} from '../../lib/shopify';
import { isNonSaengakOwnBrandProduct, resolveDisplayVendor } from '../../lib/brandOwnership';

export interface ContentSection {
  title: string;
  description: string;
  image: string;
  badge: string;
}

export interface ShopifyDescriptionViewerProps {
  html?: string;
  category?: string;
  tags?: string[];
  productName?: string;
  subtitle?: string;
  highlights?: string[];
  images?: string[];
  vendor?: string;
  contentSections?: ContentSection[];
  fitGuide?: MusinsaFitGuide;
  sizeChart?: SizeChartItem[];
  careSpecs?: CareSpecs;
  careInstructions?: string[];
  lifestyleShowcase?: LifestyleShowcaseItem[];
  craftDetails?: CraftDetailItem[];
  descriptionImages?: { src: string; alt?: string }[];
}

export default function ShopifyDescriptionViewer({
  html,
  category = '',
  tags = [],
  productName = 'SAENGAK 商品',
  images = [],
  vendor = '',
  contentSections,
  fitGuide,
  sizeChart,
  careSpecs,
  careInstructions,
  lifestyleShowcase,
  craftDetails,
  descriptionImages = [],
}: ShopifyDescriptionViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'inch'>('cm');

  // 判斷是否為服飾／內著類商品（若為是，才展示版型與尺寸對照）
  const isApparel = (() => {
    const combined = `${category} ${tags.join(' ')} ${productName}`.toLowerCase();
    // 排除除毛刀、護衣袋/洗衣袋、凝膠、噴霧、清潔露、濕巾等用品
    if (
      combined.includes('護衣') ||
      combined.includes('洗衣') ||
      combined.includes('清洗袋') ||
      combined.includes('除毛') ||
      combined.includes('刮毛') ||
      combined.includes('凝膠') ||
      combined.includes('噴霧') ||
      combined.includes('濕巾') ||
      combined.includes('清潔露') ||
      combined.includes('慕斯')
    ) {
      return false;
    }
    return (
      combined.includes('內褲') ||
      combined.includes('生理褲') ||
      combined.includes('內著') ||
      combined.includes('睡衣') ||
      combined.includes('內衣') ||
      combined.includes('服飾') ||
      combined.includes('衣服') ||
      combined.includes('衣物') ||
      combined.includes('underwear') ||
      combined.includes('apparel')
    );
  })();

  // 品牌歸屬判斷（是否為「非 SAENGAK 自有品牌」之內著／周邊商品）—— 統一呼叫
  // src/lib/brandOwnership.ts 共用模組，不得再自行複製關鍵字正則。
  // 注意：此判斷刻意與上方 isApparel 分開維護——isApparel 僅用於挑選「內容模板」
  // （服飾版型／尺碼表 vs. 護理規格卡），其排除清單(除毛|護衣|洗衣)會讓除毛刀、護衣袋
  // 等周邊配件，以及安全褲、三角褲、平口褲、丁字褲等衣物落在 isApparel === false 分支；
  // 若沿用 isApparel 判斷是否顯示 SAENGAK 品牌／韓國產地，會導致這些非自有品牌商品被誤標
  // （即本次修復的 BRAND-2 疑慮）。品牌／產地顯示一律以下方 brandCandidate 為準。
  const brandCandidate = { productType: category, title: productName, tags, vendor };
  const isNonOwnBrand = isNonSaengakOwnBrandProduct(brandCandidate);

  // 顯示用品牌名稱：全元件僅計算一次並共用，避免各處各自重複呼叫 resolveDisplayVendor。
  // 非自有品類且無合法第三方 vendor 時一律為空字串，由各區塊自行決定中性替代文案。
  const legitVendor = resolveDisplayVendor(brandCandidate, { allowSaengakFallbackForOwnBrand: false });

  // 是否應套用「萬用通用商品模板」：非服飾類、且非 SAENGAK 自有保養品類的第三方配件/工具
  // （例如除毛刀、護衣袋、洗衣袋等）。這類商品既不適用服飾版型卡，也不該套用保養品專屬的
  // 「主要成分」「韓國原裝進口」等預設文案（此為 BRAND-2 修復後續發現的內容模板缺口）。
  const isGenericAccessory = !isApparel && isNonOwnBrand;

  // 三分支文案選擇小工具：服飾／萬用通用配件／SAENGAK 自有保養品，全元件共用同一套判斷，
  // 避免各區塊（生活情境圖文、工藝細節、跨品類自適應卡、使用注意事項）各自重複三元運算子。
  const pickByCategory = <T,>(apparelValue: T, genericValue: T, careValue: T): T =>
    isApparel ? apparelValue : isGenericAccessory ? genericValue : careValue;

  // 攔截 HTML 內部圖片點擊以支援點擊放大燈箱
  useEffect(() => {
    if (!containerRef.current) return;
    const imgs = containerRef.current.querySelectorAll('img');
    const handleClick = (e: Event) => {
      const target = e.target as HTMLImageElement;
      if (target && target.src) {
        setZoomImageSrc(target.src);
      }
    };

    imgs.forEach((img) => {
      img.addEventListener('click', handleClick);
      img.style.cursor = 'zoom-in';
    });

    return () => {
      imgs.forEach((img) => {
        img.removeEventListener('click', handleClick);
      });
    };
  }, [html]);

  // 智慧分離：將 html 拆分為「純文字生活引言 (leadTextHtml)」與「所有描述圖卡 (extractedDescriptionImages)」
  const { leadTextHtml, extractedDescriptionImages } = useMemo(() => {
    const list: { src: string; alt: string }[] = [];

    // 0. 加入 props 傳入的 descriptionImages (若有)
    if (descriptionImages && descriptionImages.length > 0) {
      for (const item of descriptionImages) {
        if (item?.src && !list.some((img) => img.src === item.src)) {
          list.push({ src: item.src, alt: item.alt || '' });
        }
      }
    }

    if (!html) return { leadTextHtml: '', extractedDescriptionImages: list };

    // 1. 提取所有 <img> 標籤中的 src 與 alt
    const imgRegex = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;

    const getAlt = (tagStr: string) => {
      const altMatch = tagStr.match(/\balt=["']([^"']*)["']/i);
      return altMatch ? altMatch[1] : '';
    };

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      const alt = getAlt(match[0]);
      if (src && !list.some((img) => img.src === src)) {
        list.push({ src, alt });
      }
    }

    // 2. 清除 html 中的所有描述圖容器與 img 標籤，保留乾淨的生活引言或文字內容
    let cleanedHtml = html
      .replace(/<div\b[^>]*class=["'][^"']*product-description-images[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<p\b[^>]*>\s*<img\b[^>]*>\s*<\/p>/gi, '')
      .replace(/<img\b[^>]*>/gi, '')
      .trim();

    return {
      leadTextHtml: cleanedHtml,
      extractedDescriptionImages: list,
    };
  }, [html, descriptionImages]);

  const hasLeadContent = Boolean(leadTextHtml && leadTextHtml.trim().length > 10);

  // 檢驗是否適合放入五大圖文卡位（嚴格排除帶有文字排版、問答大字或白邊條的圖卡，優先使用純實拍攝影圖）
  const isEligibleShowcaseImage = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (
      lower.includes('03_f0255fc5') ||
      lower.includes('03_商品圖') ||
      lower.includes('faq') ||
      lower.includes('問答') ||
      lower.includes('q&a') ||
      lower.includes('qa') ||
      lower.includes('尺碼表') ||
      lower.includes('size_chart')
    ) {
      return false;
    }
    return true;
  };

  // 智慧建立商品內容前 5 張圖片資源池：
  // 依據規範：優先從「商品圖 (images)」開始取得，嚴格過濾白邊與文字圖卡；除非商品圖不足 5 張，才依序從「描述圖片 (extractedDescriptionImages)」取用合格圖片遞補
  const contentImagesPool = useMemo(() => {
    const pool: string[] = [];

    // 1. 優先從商品圖 (images) 開始取得，排除帶字/白邊圖卡
    for (const url of images) {
      if (url && isEligibleShowcaseImage(url) && !pool.includes(url)) {
        pool.push(url);
        if (pool.length >= 5) break;
      }
    }

    // 2. 除非商品圖不足 5 張，才依序取用合適的描述圖片遞補（同樣排除 FAQ/文字大圖）
    if (pool.length < 5) {
      for (const item of extractedDescriptionImages) {
        if (item?.src && isEligibleShowcaseImage(item.src) && !pool.includes(item.src)) {
          pool.push(item.src);
          if (pool.length >= 5) break;
        }
      }
    }

    // 3. 若仍不足 5 張，才放寬納入其他非空圖片
    if (pool.length < 5) {
      for (const url of images) {
        if (url && !pool.includes(url)) {
          pool.push(url);
          if (pool.length >= 5) break;
        }
      }
    }

    return pool;
  }, [images, extractedDescriptionImages]);

  // 生活情境圖文展示 (Props 優先，次為 fallback)
  const displaySections: ContentSection[] = (() => {
    if (contentSections && contentSections.length > 0) return contentSections;
    if (lifestyleShowcase && lifestyleShowcase.length > 0) {
      return lifestyleShowcase.map((item, idx) => ({
        badge: item.badge || `CARE 0${idx + 1}`,
        title: item.title,
        description: item.description,
        image: item.image || contentImagesPool[idx] || (idx === 0
          ? 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1200'
          : idx === 1
            ? 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=1200'
            : 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1200'),
      }));
    }
    return [
      {
        title: pickByCategory(
          '極致貼身・如同第二層肌膚般舒適',
          '嚴選材質・貼近日常使用需求',
          '專利益生菌生態平衡・溫和守護女性健康',
        ),
        description: pickByCategory(
          '嚴選超細纖維與天然純棉襠部，無痕貼合身型曲線，無論日常活動或睡眠皆能享受零拘束的親膚著感。',
          '精心挑選符合實際生活情境的材質與設計，兼顧實用性與耐用度，讓每一次使用都安心順手。',
          '為女性私密肌膚量身打造，富含高活性益生菌複合成分與天然植萃精華，深層維持微生態弱酸屏障。',
        ),
        image: contentImagesPool[0] || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1200',
        badge: pickByCategory('CARE 01', 'FEATURE 01', 'CARE 01'),
      },
      {
        title: pickByCategory(
          '透氣瞬吸・全天候乾爽自在',
          '細緻做工・操作簡單好上手',
          '極致親膚質地・一抹即化零負擔',
        ),
        description: pickByCategory(
          '高透氣立體織造工藝，能迅速排出濕氣與悶熱感，在潮濕悶熱的氣候中依然保持全天候透氣乾爽。',
          '注重細節與人性化設計，操作直覺、好收納好攜帶，輕鬆融入日常生活步驟。',
          '水感凝露質地，輕盈水潤好推開，能快速被肌膚吸收並形成透氣鎖水保護膜，告別悶熱黏膩。',
        ),
        image: contentImagesPool[1] || 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=1200',
        badge: pickByCategory('TEXTURE 02', 'DESIGN 02', 'TEXTURE 02'),
      },
      {
        title: pickByCategory(
          '嚴格耐穿測試・彈性持久不易鬆弛',
          '嚴格品質把關・安心信賴之選',
          '德國 Dermatest 權威檢驗・全成分透明公開',
        ),
        description: pickByCategory(
          '通過多次洗滌與回彈性拉力測試，耐磨耐穿不易變形，細緻無痕收邊技術讓穿著時完美隱形無勒痕。',
          '出廠前經過多重品質檢驗，確保每件商品皆符合品質標準，讓您安心選購、放心使用。',
          '無酒精、無色素、無paraben防腐劑，通過人體皮膚刺激測試，敏感時期與每日日常皆可放心使用。',
        ),
        image: contentImagesPool[2] || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1200',
        badge: pickByCategory('SAFETY 03', 'QUALITY 03', 'SAFETY 03'),
      },
    ];
  })();

  // 工藝細節展示 (Props 優先)
  const displayCrafts = (() => {
    if (craftDetails && craftDetails.length > 0) {
      return craftDetails.map((c, idx) => ({
        category: c.category,
        title: c.title,
        description: c.description,
        image: c.image || contentImagesPool[3 + idx] || (idx === 0
          ? 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800'
          : 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800'),
      }));
    }
    return [
      {
        category: pickByCategory('剪裁與觸感', '設計與工藝', '質地與吸收'),
        title: pickByCategory(
          '人體工學無痕剪裁・極致貼合舒適',
          '人性化設計・貼合日常使用習慣',
          '極致水感凝露・深層滋潤不黏膩',
        ),
        description: pickByCategory(
          '採用高精密熱壓貼合與平整車縫工藝，有效減少肌膚摩擦感，全天候自在無負擔。',
          '從外觀到細節皆經過反覆打磨測試，兼顧美觀與實用，提升每次使用的順手度。',
          '輕透水潤質地，觸膚即化，快速形成透氣保濕鎖水屏障，維持全天候清新舒適。',
        ),
        image: contentImagesPool[3] || 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800',
      },
      {
        category: pickByCategory('衛生防護工藝', '包裝與保固', '瓶器與包裝工藝'),
        title: pickByCategory(
          '天然純棉抗菌底襠・細心呵護私密',
          '完整包裝設計・妥善保護商品品質',
          '按壓式定量壓頭・隔絕空氣無菌保鮮',
        ),
        description: pickByCategory(
          '底襠嚴選透氣純棉面料，具備抑菌防潮特性，維持私密處全日清爽衛生。',
          '出貨前妥善包裝並降低運送過程碰撞耗損風險，隨附完整保固資訊與售後聯繫方式。',
          '特殊氣密式瓶器設計，防止外界水氣與空氣回流，確保每滴成分活性長效新鮮。',
        ),
        image: contentImagesPool[4] || 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
      },
    ];
  })();

  // 尺寸換算輔助函式
  const formatSizeValue = (val: string, unit: 'cm' | 'inch') => {
    if (!val || val === '-') return '-';
    if (unit === 'cm') return val;
    return val.replace(/\b(\d+(?:\.\d+)?)\b/g, (match) => {
      const num = parseFloat(match);
      if (isNaN(num)) return match;
      return (num * 0.3937).toFixed(1);
    });
  };

  // 尺碼表資料來源
  const defaultSizeChart: SizeChartItem[] = [
    { size: 'S (90)', waist: '60 - 66', hips: '82 - 88', crotch: '21.5', weight: '40 ~ 50 kg' },
    { size: 'M (95)', waist: '66 - 72', hips: '88 - 94', crotch: '22.5', weight: '50 ~ 58 kg' },
    { size: 'L (100)', waist: '72 - 78', hips: '94 - 100', crotch: '23.5', weight: '58 ~ 66 kg' },
    { size: 'XL (105)', waist: '78 - 84', hips: '100 - 106', crotch: '24.5', weight: '66 ~ 75 kg' },
  ];
  const activeSizeChart = sizeChart && sizeChart.length > 0 ? sizeChart : defaultSizeChart;

  // 版型亮燈數值
  const fitValue = fitGuide?.fit || '合身';
  const thicknessValue = fitGuide?.thickness || '適中';
  const elasticityValue = fitGuide?.elasticity || '高彈力';
  const breathabilityValue = fitGuide?.breathability || '極佳';

  // 萃取容量或包裝單位資訊
  const extractedUnit = (() => {
    const match = productName.match(/\(([^)]+)\)/);
    if (match) return match[1];
    if (isApparel) return '單件裝 / 多色選';
    if (isGenericAccessory) return '單件裝';
    return '150ml (單瓶裝)';
  })();

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* 方案 A 小編富文本引言內容 (已智慧分離圖片至下方) */}
      {hasLeadContent ? (
        <div
          ref={containerRef}
          className="bg-white p-6 sm:p-10 rounded-2xl border border-gray-200/70 shadow-2xs space-y-6 overflow-hidden [&_.editorial-preface]:p-6 [&_.editorial-preface]:sm:p-8 [&_.editorial-preface]:bg-[#F8F5F1] [&_.editorial-preface]:border-l-4 [&_.editorial-preface]:border-[#5B3D48] [&_.editorial-preface]:rounded-r-2xl [&_.editorial-preface]:shadow-2xs [&_.editorial-preface_p]:text-gray-700 [&_.editorial-preface_p]:text-base [&_.editorial-preface_p]:leading-relaxed [&_.editorial-preface_p]:mb-3.5 last:[&_.editorial-preface_p]:mb-0 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:border-l-4 [&_h2]:border-[#5B3D48] [&_h2]:pl-3.5 [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-gray-800 [&_h3]:mt-8 [&_h3]:mb-3 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-gray-800 [&_h4]:mt-6 [&_h4]:mb-2 [&_p]:text-base [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-5 [&_ul]:space-y-2.5 [&_li]:text-gray-700 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-5 [&_ol]:space-y-2.5 [&_li]:text-gray-700 [&_table]:w-full [&_table]:border-collapse [&_table]:my-8 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-gray-200 [&_table]:shadow-2xs [&_th]:bg-stone-100 [&_th]:text-[#5B3D48] [&_th]:p-3.5 [&_th]:font-bold [&_th]:text-left [&_th]:text-sm [&_td]:p-3.5 [&_td]:border-t [&_td]:border-gray-100 [&_td]:text-gray-700 [&_td]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-brand/60 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:bg-blush/40 [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:text-gray-700"
          dangerouslySetInnerHTML={{ __html: leadTextHtml }}
        />
      ) : (
        <div className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-200/70 shadow-2xs text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#5B3D48]/10 flex items-center justify-center text-[#5B3D48] text-2xl">
            <i className="ri-shield-check-line"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            SAENGAK 官方正品品質保證
          </h3>
          <p className="text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
            本商品為韓國原廠正式授權進口，所有成分與規格皆通過嚴格品質檢驗。詳細包裝與成分以實體商品標示為準。
          </p>
        </div>
      )}

      {/* 2. 品牌美學故事專區 */}
      <div className="rounded-2xl border border-gray-200/70 bg-gradient-to-br from-stone-50 via-white to-blush/20 p-6 sm:p-10 shadow-2xs space-y-4 text-left">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#5B3D48]">
          <i className="ri-leaf-line text-sm"></i>
          <span>Brand Philosophy</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-black text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
          從日常微小之處，重新感受肌膚的純淨自在
        </h3>
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-3xl">
          SAENGAK
          始終深信，最美好的生活品質來自對身體肌膚的細微呵護。回歸純淨自然、屏除無謂冗贅，我們堅持挑選最高規格原物料與嚴謹工藝，讓每一次穿戴與使用，都成為陪伴妳身心放鬆的溫柔儀式。
        </p>
      </div>

      {/* 3. 核心特色圖文專區 */}
      <div className="space-y-6">
        {displaySections.map((sec, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 bg-white p-6 sm:p-8 rounded-2xl border border-gray-200/70 shadow-2xs`}
          >
            <div className="w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden shadow-2xs relative group bg-gray-100">
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
              <span className="text-xs font-bold text-[#5B3D48] tracking-widest uppercase">
                Lifestyle & Feature
              </span>
              <h4 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                {sec.title}
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {sec.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 4. 工藝細節與特點解析 */}
      <div className="space-y-6">
        <div className="border-l-4 border-[#5B3D48] pl-3.5">
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            工藝細節與特點解析
          </h3>
          <p className="text-xs text-gray-500">解析每處微小細節，詮釋嚴謹的品質堅持</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayCrafts.map((craft, idx) => (
            <div key={idx} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs group">
              <div className="aspect-[4/3] sm:aspect-[16/11] overflow-hidden bg-stone-50">
                <img
                  src={craft.image}
                  alt={craft.title}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-5 space-y-1.5">
                <span className="text-xs font-bold text-[#5B3D48]">
                  {craft.category}
                </span>
                <h4 className="text-base font-bold text-gray-900">
                  {craft.title}
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {craft.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. 跨品類自適應卡 */}
      {isApparel ? (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <i className="ri-dashboard-line text-xl text-[#5B3D48]"></i>
                <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  版型與著感指標 (Fit & Feeling Guide)
                </h3>
              </div>
              <span className="text-xs text-gray-400 font-medium">Musinsa Standard Specs</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-10">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>版型 (Fit)</span>
                  <span className="text-[#5B3D48]">
                    {fitValue.includes('合身')
                      ? '合身 (Regular Fit)'
                      : fitValue.includes('緊身')
                        ? '緊身 (Slim Fit)'
                        : fitValue.includes('寬鬆')
                          ? '寬鬆 (Loose Fit)'
                          : fitValue}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className={`py-2 rounded-lg ${fitValue.includes('緊身') || fitValue.toLowerCase().includes('slim') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>緊身 (Slim)</div>
                  <div className={`py-2 rounded-lg ${fitValue.includes('合身') || (!fitValue.includes('緊身') && !fitValue.includes('寬鬆')) ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>合身 (Regular)</div>
                  <div className={`py-2 rounded-lg ${fitValue.includes('寬鬆') || fitValue.toLowerCase().includes('loose') || fitValue.toLowerCase().includes('oversized') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>寬鬆 (Oversized)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>厚薄度 (Thickness)</span>
                  <span className="text-[#5B3D48]">
                    {thicknessValue.includes('適中')
                      ? '適中 (Moderate)'
                      : thicknessValue.includes('輕薄') || thicknessValue.includes('薄')
                        ? '輕薄 (Light)'
                        : thicknessValue.includes('厚')
                          ? '厚實 (Heavy)'
                          : thicknessValue}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className={`py-2 rounded-lg ${thicknessValue.includes('薄') || thicknessValue.toLowerCase().includes('light') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>輕薄 (Light)</div>
                  <div className={`py-2 rounded-lg ${thicknessValue.includes('中') || (!thicknessValue.includes('薄') && !thicknessValue.includes('厚')) ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>適中 (Moderate)</div>
                  <div className={`py-2 rounded-lg ${thicknessValue.includes('厚') || thicknessValue.toLowerCase().includes('heavy') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>厚實 (Heavy)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>彈性 (Elasticity)</span>
                  <span className="text-[#5B3D48]">
                    {elasticityValue.includes('無')
                      ? '無彈 (None)'
                      : elasticityValue.includes('微')
                        ? '微彈 (Slight)'
                        : elasticityValue.includes('高') || elasticityValue.includes('彈')
                          ? '高彈力 (High)'
                          : elasticityValue}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className={`py-2 rounded-lg ${elasticityValue.includes('無') || elasticityValue.toLowerCase().includes('none') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>無彈 (None)</div>
                  <div className={`py-2 rounded-lg ${elasticityValue.includes('微') || elasticityValue.toLowerCase().includes('slight') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>微彈 (Slight)</div>
                  <div className={`py-2 rounded-lg ${elasticityValue.includes('高') || (!elasticityValue.includes('無') && !elasticityValue.includes('微')) ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>高彈力 (High)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>透氣度 (Breathability)</span>
                  <span className="text-[#5B3D48]">
                    {breathabilityValue.includes('極佳') || breathabilityValue.includes('佳')
                      ? '極佳 (Excellent)'
                      : breathabilityValue.includes('良好')
                        ? '良好 (Good)'
                        : breathabilityValue.includes('一般')
                          ? '一般 (Normal)'
                          : breathabilityValue}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className={`py-2 rounded-lg ${breathabilityValue.includes('一般') || breathabilityValue.toLowerCase().includes('normal') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>一般 (Normal)</div>
                  <div className={`py-2 rounded-lg ${breathabilityValue.includes('良好') || breathabilityValue.toLowerCase().includes('good') ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>良好 (Good)</div>
                  <div className={`py-2 rounded-lg ${breathabilityValue.includes('極佳') || (!breathabilityValue.includes('一般') && !breathabilityValue.includes('良好')) ? 'bg-[#5B3D48] text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-400'}`}>極佳 (Excellent)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  實測尺碼對照指南 (Size Guide)
                </h3>
                <p className="text-xs text-gray-500">所有尺碼皆為平放手工量測，誤差值 ±1~2cm 為正常範圍</p>
              </div>

              <div className="flex items-center bg-gray-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setSizeUnit('cm')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${sizeUnit === 'cm' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  公分 (cm)
                </button>
                <button
                  type="button"
                  onClick={() => setSizeUnit('inch')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${sizeUnit === 'inch' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  英吋 (inch)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-100/80 text-xs font-bold text-gray-700 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">尺碼 (Size)</th>
                    <th className="px-5 py-3.5">腰圍 ({sizeUnit})</th>
                    <th className="px-5 py-3.5">臀圍 ({sizeUnit})</th>
                    <th className="px-5 py-3.5">檔深 ({sizeUnit})</th>
                    <th className="px-5 py-3.5">建議體重 (Weight)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSizeChart.map((row, idx) => (
                    <tr
                      key={row.size || idx}
                      className={`hover:bg-blush/30 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                    >
                      <td className="px-5 py-4 font-bold text-[#5B3D48]">{row.size}</td>
                      <td className="px-5 py-4">{formatSizeValue(row.waist, sizeUnit)}</td>
                      <td className="px-5 py-4">{formatSizeValue(row.hips, sizeUnit)}</td>
                      <td className="px-5 py-4">{formatSizeValue(row.crotch, sizeUnit)}</td>
                      <td className="px-5 py-4 text-xs text-gray-600 font-medium">{row.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : isGenericAccessory ? (
        // 萬用通用商品規格卡：適用於「非服飾、非 SAENGAK 自有保養品」之第三方配件／工具
        // （除毛刀、護衣袋、洗衣袋等）。刻意不預設任何成分、劑型或產地——只呈現商家實際
        // 填寫的 careSpecs 資料，缺值時一律用不帶品類假設的中性文案，避免與商品實際屬性衝突。
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <i className="ri-price-tag-3-line text-xl text-[#5B3D48]"></i>
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                商品規格卡 (Product Specifications)
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-medium">詳見商品標示</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">規格／包裝 (Specification)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.volume || extractedUnit}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">材質／款式 (Material)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.texture || '請見商品圖文詳細說明'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">適用對象／用途 (Application)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.application || '請見商品圖文詳細說明'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">品牌／來源 (Brand)</span>
              <span className="font-semibold text-gray-900">{legitVendor || '精選生活選品'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">產地 (Origin)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.origin || '請見商品標示'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">保存／保固注意事項</span>
              <span className="font-semibold text-gray-900">{careSpecs?.shelf_life || '請依商品包裝標示或聯繫客服洽詢'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <i className="ri-flask-line text-xl text-[#5B3D48]"></i>
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                護理規格與成分參數卡 (Specifications)
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-medium">嚴格檢驗合格</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">規格容量／單位 (Volume)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.volume || extractedUnit}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">主要劑型 (Texture)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.texture || '水感凝露 (Gel) / 弱酸配方 (pH 4.5~5.5)'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">適用對象／部位 (Application)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.application || '女性私密外陰部位及一般全身肌膚'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">製造產地 (Origin)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.origin || '韓國 (Made in Korea) 原裝進口'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">主要成分 (Ingredients)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.ingredients || '專利益生菌發酵濾液、積雪草萃取、乳酸'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">保存期限 (Shelf Life)</span>
              <span className="font-semibold text-gray-900">{careSpecs?.shelf_life || '未開封 3 年，開封後建議 6~12 個月內用畢'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. 基本商品資訊 & 洗滌/使用保養說明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
          <h4 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            基本商品資訊 (Product Details)
          </h4>
          <dl className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-2.5">
              <dt className="text-gray-500">商品品名</dt>
              <dd className="font-semibold text-gray-900">{productName}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2.5">
              <dt className="text-gray-500">商品類別</dt>
              <dd className="font-semibold text-gray-900">{category || '護理與個人保健'}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2.5">
              <dt className="text-gray-500">品牌／進口商</dt>
              <dd className="font-semibold text-gray-900">
                {/* 品牌／進口商顯示一律以 isNonOwnBrand（brandOwnership 共用模組）為準，
                    嚴禁使用 isApparel：除毛刀、護衣袋等周邊配件亦屬非自有品牌但不會命中 isApparel。
                    legitVendor 已於元件頂層計算一次並共用，此處不再重複呼叫。 */}
                {isNonOwnBrand ? (legitVendor || '精選生活選品') : (legitVendor || 'SAENGAK')}
              </dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2.5">
              <dt className="text-gray-500">製造國別 (Origin)</dt>
              <dd className="font-semibold text-gray-900">
                {careSpecs?.origin || (isNonOwnBrand ? '嚴選優良工廠製造' : '韓國 (Made in Korea)')}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">品質檢驗</dt>
              <dd className="font-semibold text-[#5B3D48]">原廠合格出廠檢驗</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
          <h4 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            {isApparel ? '洗滌與保養說明 (Care Instructions)' : '使用方式與保存注意事項 (Usage & Storage)'}
          </h4>
          <div className="space-y-3 text-xs sm:text-sm text-gray-600">
            {careInstructions && careInstructions.length > 0 ? (
              careInstructions.map((instruction, idx) => {
                const iconClass = idx === 0
                  ? (isApparel ? 'ri-hand-sanitizer-line' : 'ri-drop-line')
                  : idx === 1
                    ? 'ri-sun-line'
                    : idx === 2
                      ? 'ri-shield-cross-line'
                      : 'ri-time-line';
                return (
                  <div key={idx} className="flex items-start gap-2.5">
                    <i className={`${iconClass} text-[#5B3D48] text-base mt-0.5`}></i>
                    <span>{instruction}</span>
                  </div>
                );
              })
            ) : isApparel ? (
              <>
                <div className="flex items-start gap-2.5">
                  <i className="ri-hand-sanitizer-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>建議使用 30°C 以下冷水手洗或放入洗衣袋慢速弱洗。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-sun-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>請置於陰涼通風處懸掛晾乾，避免長時間烈日曝曬。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-prohibited-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>請勿使用含漂白成分或螢光劑之強效洗劑，切勿高溫烘乾。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-t-shirt-air-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>深淺色衣物請分開洗滌，避免互染。</span>
                </div>
              </>
            ) : isGenericAccessory ? (
              // 萬用通用使用/保存說明：不預設商品是清潔凝露或任何特定劑型，
              // 適用於除毛刀、護衣袋等任何非服飾、非自有保養品類的第三方配件／工具。
              <>
                <div className="flex items-start gap-2.5">
                  <i className="ri-book-open-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>請詳閱商品包裝標示或圖文說明，並依指示正確使用。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-sun-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>請存放於陰涼乾燥處，避免高溫、潮濕與陽光直射。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-customer-service-2-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>使用上如有任何疑問，歡迎透過官方客服洽詢協助。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-time-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>請妥善保存商品保固卡或購買憑證，以利後續售後服務。</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <i className="ri-drop-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>按壓約 1~2 下凝膠於掌心起泡，輕柔清潔外陰部位後以溫水洗淨。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-sun-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>請存放於陰涼乾燥通風處，避免高溫及陽光直射。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-shield-cross-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>僅供外用清潔，如皮膚出現紅腫或異常不適，請停止使用並洽詢醫師。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-time-line text-[#5B3D48] text-base mt-0.5"></i>
                  <span>開封後為維持益生菌活性與配方新鮮度，建議於 6 至 12 個月內用畢。</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 6.5 描述圖片展示專區 (依規範精準置於「基本商品資訊與使用方式」區塊正下方) */}
      {extractedDescriptionImages.length > 0 && (
        <div className="space-y-6 animate-fadeIn" data-testid="product-description-images-section">
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
            <span className="w-1.5 h-5 rounded-full bg-[#5B3D48]"></span>
            <h4 className="text-lg sm:text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
              常見問答與詳細圖文說明 (Q&A & Details)
            </h4>
          </div>

          {/* 無縫拼接圖片容器：整組統一外層卡片邊框與圓角，內部圖片完全零間隙緊密相連 */}
          <div className="overflow-hidden rounded-2xl bg-white border border-gray-200/70 shadow-2xs flex flex-col gap-0 leading-none">
            {extractedDescriptionImages.map((img, idx) => (
              <div
                key={idx}
                className="w-full overflow-hidden text-center m-0 p-0 leading-none"
              >
                <img
                  src={img.src}
                  alt={img.alt || `${productName} 描述圖 ${idx + 1}`}
                  loading="lazy"
                  onClick={() => setZoomImageSrc(img.src)}
                  className="w-full h-auto block cursor-zoom-in transition-opacity hover:opacity-95 mx-auto m-0 p-0 align-bottom"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. 正品保證與安心守護承諾 */}
      <div className="rounded-2xl border border-[#5B3D48]/20 bg-[#5B3D48]/5 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5B3D48] text-white flex items-center justify-center text-xl shadow-xs">
            <i className="ri-award-line"></i>
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
              SAENGAK 原廠正品安心承諾
            </h4>
            <p className="text-xs text-gray-500">韓國直送正品保證・全站享有 7 天安心鑑賞與完整售後服務</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-[#5B3D48] text-base"></i>
            <span>100% 韓國總部授權進口原裝正品</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-[#5B3D48] text-base"></i>
            <span>通過國際權威機構安全檢驗標準</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-[#5B3D48] text-base"></i>
            <span>全站享有 7 天安心鑑賞售後保障</span>
          </div>
        </div>
      </div>

      {/* 燈箱放大 Modal */}
      {zoomImageSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 cursor-zoom-out"
          onClick={() => setZoomImageSrc(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 text-white text-3xl p-2 rounded-full bg-black/40 hover:bg-black/70 transition-colors"
            onClick={() => setZoomImageSrc(null)}
            aria-label="關閉放大預覽"
          >
            <i className="ri-close-line"></i>
          </button>
          <img
            src={zoomImageSrc}
            alt="放大預覽"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl transition-transform"
          />
        </div>
      )}
    </div>
  );
}
