import { useState, useRef, useEffect } from 'react';
import type {
  MusinsaFitGuide,
  SizeChartItem,
  CareSpecs,
  LifestyleShowcaseItem,
  CraftDetailItem,
} from '../../lib/shopify';

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
}

export default function ShopifyDescriptionViewer({
  html,
  category = '',
  tags = [],
  productName = 'SAENGAK 商品',
  subtitle,
  highlights = [],
  images = [],
  vendor = '',
  contentSections,
  fitGuide,
  sizeChart,
  careSpecs,
  careInstructions,
  lifestyleShowcase,
  craftDetails,
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

  const hasHtmlContent = Boolean(html && html.trim().length > 10);

  // 生活情境圖文展示 (Props 優先，次為 fallback)
  const displaySections: ContentSection[] = (() => {
    if (contentSections && contentSections.length > 0) return contentSections;
    if (lifestyleShowcase && lifestyleShowcase.length > 0) {
      return lifestyleShowcase.map((item, idx) => ({
        badge: item.badge || `CARE 0${idx + 1}`,
        title: item.title,
        description: item.description,
        image: item.image || images[idx + 1] || (idx === 0
          ? 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1200'
          : idx === 1
            ? 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=1200'
            : 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1200'),
      }));
    }
    return [
      {
        title: isApparel
          ? '極致貼身・如同第二層肌膚般舒適'
          : '專利益生菌生態平衡・溫和守護女性健康',
        description: isApparel
          ? '嚴選超細纖維與天然純棉襠部，無痕貼合身型曲線，無論日常活動或睡眠皆能享受零拘束的親膚著感。'
          : '為女性私密肌膚量身打造，富含高活性益生菌複合成分與天然植萃精華，深層維持微生態弱酸屏障。',
        image: images[1] || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1200',
        badge: 'CARE 01',
      },
      {
        title: isApparel
          ? '透氣瞬吸・全天候乾爽自在'
          : '極致親膚質地・一抹即化零負擔',
        description: isApparel
          ? '高透氣立體織造工藝，能迅速排出濕氣與悶熱感，在潮濕悶熱的氣候中依然保持全天候透氣乾爽。'
          : '水感凝露質地，輕盈水潤好推開，能快速被肌膚吸收並形成透氣鎖水保護膜，告別悶熱黏膩。',
        image: images[2] || 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=1200',
        badge: 'TEXTURE 02',
      },
      {
        title: isApparel
          ? '嚴格耐穿測試・彈性持久不易鬆弛'
          : '德國 Dermatest 權威檢驗・全成分透明公開',
        description: isApparel
          ? '通過多次洗滌與回彈性拉力測試，耐磨耐穿不易變形，細緻無痕收邊技術讓穿著時完美隱形無勒痕。'
          : '無酒精、無色素、無paraben防腐劑，通過人體皮膚刺激測試，敏感時期與每日日常皆可放心使用。',
        image: images[3] || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1200',
        badge: 'SAFETY 03',
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
        image: c.image || images[idx + 4] || (idx === 0
          ? 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800'
          : 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800'),
      }));
    }
    return [
      {
        category: isApparel ? '剪裁與觸感' : '質地與吸收',
        title: isApparel ? '人體工學無痕剪裁・極致貼合舒適' : '極致水感凝露・深層滋潤不黏膩',
        description: isApparel
          ? '採用高精密熱壓貼合與平整車縫工藝，有效減少肌膚摩擦感，全天候自在無負擔。'
          : '輕透水潤質地，觸膚即化，快速形成透氣保濕鎖水屏障，維持全天候清新舒適。',
        image: images[4] || 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800',
      },
      {
        category: isApparel ? '衛生防護工藝' : '瓶器與包裝工藝',
        title: isApparel ? '天然純棉抗菌底襠・細心呵護私密' : '按壓式定量壓頭・隔絕空氣無菌保鮮',
        description: isApparel
          ? '底襠嚴選透氣純棉面料，具備抑菌防潮特性，維持私密處全日清爽衛生。'
          : '特殊氣密式瓶器設計，防止外界水氣與空氣回流，確保每滴成分活性長效新鮮。',
        image: images[5] || 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
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
    return match ? match[1] : (isApparel ? '單件裝 / 多色選' : '150ml (單瓶裝)');
  })();

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* 方案 A 小編富文本內容 */}
      {hasHtmlContent ? (
        <div
          ref={containerRef}
          className="bg-white p-6 sm:p-10 rounded-2xl border border-gray-200/70 shadow-2xs space-y-6 overflow-hidden [&_.editorial-preface]:p-6 [&_.editorial-preface]:sm:p-8 [&_.editorial-preface]:bg-[#FAF9F5] [&_.editorial-preface]:border-l-4 [&_.editorial-preface]:border-[#245B50] [&_.editorial-preface]:rounded-r-2xl [&_.editorial-preface]:shadow-2xs [&_.editorial-preface_p]:text-gray-700 [&_.editorial-preface_p]:text-base [&_.editorial-preface_p]:leading-relaxed [&_.editorial-preface_p]:mb-3.5 last:[&_.editorial-preface_p]:mb-0 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:border-l-4 [&_h2]:border-[#245B50] [&_h2]:pl-3.5 [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-gray-800 [&_h3]:mt-8 [&_h3]:mb-3 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-gray-800 [&_h4]:mt-6 [&_h4]:mb-2 [&_p]:text-base [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-5 [&_ul]:space-y-2.5 [&_li]:text-gray-700 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-5 [&_ol]:space-y-2.5 [&_li]:text-gray-700 [&_img]:rounded-2xl [&_img]:shadow-xs [&_img]:mx-auto [&_img]:my-8 [&_img]:max-w-full [&_img]:h-auto [&_img]:object-cover hover:[&_img]:shadow-md hover:[&_img]:scale-[1.01] [&_img]:transition-all [&_img]:duration-500 [&_table]:w-full [&_table]:border-collapse [&_table]:my-8 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-gray-200 [&_table]:shadow-2xs [&_th]:bg-stone-100 [&_th]:text-[#245B50] [&_th]:p-3.5 [&_th]:font-bold [&_th]:text-left [&_th]:text-sm [&_td]:p-3.5 [&_td]:border-t [&_td]:border-gray-100 [&_td]:text-gray-700 [&_td]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-600/60 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:bg-emerald-50/40 [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:text-gray-700"
          dangerouslySetInnerHTML={{ __html: html || '' }}
        />
      ) : (
        <div className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-200/70 shadow-2xs text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#245B50]/10 flex items-center justify-center text-[#245B50] text-2xl">
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
      <div className="rounded-2xl border border-gray-200/70 bg-gradient-to-br from-stone-50 via-white to-emerald-50/20 p-6 sm:p-10 shadow-2xs space-y-4 text-left">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#245B50]">
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
              <span className="text-xs font-bold text-[#245B50] tracking-widest uppercase">
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
        <div className="border-l-4 border-[#245B50] pl-3.5">
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            工藝細節與特點解析
          </h3>
          <p className="text-xs text-gray-500">解析每處微小細節，詮釋嚴謹的品質堅持</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayCrafts.map((craft, idx) => (
            <div key={idx} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs group">
              <div className="aspect-[16/10] overflow-hidden bg-gray-100">
                <img
                  src={craft.image}
                  alt={craft.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-5 space-y-1.5">
                <span className="text-xs font-bold text-[#245B50]">
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
                <i className="ri-dashboard-line text-xl text-[#245B50]"></i>
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
                  <span className="text-[#245B50]">合身 (Regular Fit)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">緊身 (Slim)</div>
                  <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">合身 (Regular)</div>
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">寬鬆 (Oversized)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>厚薄度 (Thickness)</span>
                  <span className="text-[#245B50]">適中 (Moderate)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">輕薄 (Light)</div>
                  <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">適中 (Moderate)</div>
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">厚實 (Heavy)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>彈性 (Elasticity)</span>
                  <span className="text-[#245B50]">高彈力 (High)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">無彈 (None)</div>
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">微彈 (Slight)</div>
                  <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">高彈力 (High)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>透氣度 (Breathability)</span>
                  <span className="text-[#245B50]">極佳 (Excellent)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">一般 (Normal)</div>
                  <div className="py-2 rounded-lg bg-gray-100 text-gray-400">良好 (Good)</div>
                  <div className="py-2 rounded-lg bg-[#245B50] text-white font-bold shadow-xs">極佳 (Excellent)</div>
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
                  <tr className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-[#245B50]">S (90)</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '60 - 66' : '23.6 - 26.0'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '82 - 88' : '32.3 - 34.6'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '21.5' : '8.5'}</td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-medium">40 ~ 50 kg</td>
                  </tr>
                  <tr className="hover:bg-emerald-50/30 transition-colors bg-gray-50/40">
                    <td className="px-5 py-4 font-bold text-[#245B50]">M (95)</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '66 - 72' : '26.0 - 28.3'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '88 - 94' : '34.6 - 37.0'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '22.5' : '8.9'}</td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-medium">50 ~ 58 kg</td>
                  </tr>
                  <tr className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-[#245B50]">L (100)</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '72 - 78' : '28.3 - 30.7'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '94 - 100' : '37.0 - 39.4'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '23.5' : '9.3'}</td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-medium">58 ~ 66 kg</td>
                  </tr>
                  <tr className="hover:bg-emerald-50/30 transition-colors bg-gray-50/40">
                    <td className="px-5 py-4 font-bold text-[#245B50]">XL (105)</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '78 - 84' : '30.7 - 33.1'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '100 - 106' : '39.4 - 41.7'}</td>
                    <td className="px-5 py-4">{sizeUnit === 'cm' ? '24.5' : '9.6'}</td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-medium">66 ~ 75 kg</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <i className="ri-flask-line text-xl text-[#245B50]"></i>
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
                {(() => {
                  if (isApparel) {
                    return (vendor && vendor.toUpperCase() !== 'SAENGAK' && vendor !== 'My Store 7')
                      ? vendor
                      : '精選生活選品';
                  }
                  return vendor || 'SAENGAK';
                })()}
              </dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2.5">
              <dt className="text-gray-500">製造國別 (Origin)</dt>
              <dd className="font-semibold text-gray-900">
                {careSpecs?.origin || (isApparel ? '嚴選優良工廠製造' : '韓國 (Made in Korea)')}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">品質檢驗</dt>
              <dd className="font-semibold text-[#245B50]">原廠合格出廠檢驗</dd>
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
                    <i className={`${iconClass} text-[#245B50] text-base mt-0.5`}></i>
                    <span>{instruction}</span>
                  </div>
                );
              })
            ) : isApparel ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <i className="ri-drop-line text-[#245B50] text-base mt-0.5"></i>
                  <span>按壓約 1~2 下凝膠於掌心起泡，輕柔清潔外陰部位後以溫水洗淨。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-sun-line text-[#245B50] text-base mt-0.5"></i>
                  <span>請存放於陰涼乾燥通風處，避免高溫及陽光直射。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-shield-cross-line text-[#245B50] text-base mt-0.5"></i>
                  <span>僅供外用清潔，如皮膚出現紅腫或異常不適，請停止使用並洽詢醫師。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-time-line text-[#245B50] text-base mt-0.5"></i>
                  <span>開封後為維持益生菌活性與配方新鮮度，建議於 6 至 12 個月內用畢。</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 7. 正品保證與安心守護承諾 */}
      <div className="rounded-2xl border border-[#245B50]/20 bg-[#245B50]/5 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#245B50] text-white flex items-center justify-center text-xl shadow-xs">
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
            <i className="ri-checkbox-circle-fill text-[#245B50] text-base"></i>
            <span>100% 韓國總部授權進口原裝正品</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-[#245B50] text-base"></i>
            <span>通過國際權威機構安全檢驗標準</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-[#245B50] text-base"></i>
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
