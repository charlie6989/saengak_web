import { useState, useRef, useEffect, useMemo } from 'react';
import type {
  MusinsaFitGuide,
  CareSpecs,
  LifestyleShowcaseItem,
  CraftDetailItem,
} from '../../lib/shopify';
import { isNonSaengakOwnBrandProduct, resolveDisplayVendor } from '../../lib/brandOwnership';
import { shopifyImageUrl } from '../../lib/shopifyImage';
import SizeChartTable from './SizeChartTable';
import type { SizeChart } from '../../domain/sizeChart';

export interface ContentSection {
  title: string;
  description: string;
  image: string;
  badge: string;
  kind?: 'feature' | 'usage';
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
  sizeChart?: SizeChart;
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
  // 載入失敗的圖片網址（例如 metafield 指向已刪除的 Shopify 檔案），改用相簿圖遞補
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const markImageFailed = (url: string) => {
    setFailedImages((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

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

  // SAENGAK 品牌故事只放在品牌確實是 SAENGAK（或未填 vendor）的保養品；
  // 同為保養品類但來自其他品牌的商品（例如 MEDION）不掛 SAENGAK 品牌敘事
  const showSaengakStory = !isNonOwnBrand && (!legitVendor || legitVendor.toUpperCase() === 'SAENGAK');

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

  // 生活情境圖文與工藝細節只呈現 Shopify 實際填寫的內容；沒有資料時整區不顯示，
  // 不再依品類補上檢驗、認證等無法查證的預設宣稱或圖庫照片。
  const sectionDrafts: ContentSection[] = (() => {
    if (contentSections && contentSections.length > 0) return contentSections;
    if (lifestyleShowcase && lifestyleShowcase.length > 0) {
      return lifestyleShowcase.map((item, idx) => ({
        badge: item.badge || `0${idx + 1}`,
        kind: item.kind,
        title: item.title,
        description: item.description,
        image: item.image || contentImagesPool[idx] || '',
      }));
    }
    return [];
  })();

  const craftDrafts = (craftDetails ?? []).map((c, idx) => ({
    category: c.category,
    title: c.title,
    description: c.description,
    image: c.image || contentImagesPool[3 + idx] || '',
  }));

  // 指定圖片載入失敗時，依序改用相簿圖池中尚未失敗、也尚未被其他區塊使用的圖片；都沒有時隱藏圖片欄
  const { displaySections, displayCrafts } = (() => {
    const used = new Set<string>();
    const resolve = (preferred: string, poolIndex: number) => {
      const candidates = [preferred, contentImagesPool[poolIndex], ...contentImagesPool];
      const pick = candidates.find((url) => url && !failedImages.has(url) && !used.has(url)) ?? '';
      if (pick) used.add(pick);
      return pick;
    };
    return {
      displaySections: sectionDrafts.map((sec, idx) => ({ ...sec, image: resolve(sec.image, idx) })),
      displayCrafts: craftDrafts.map((craft, idx) => ({ ...craft, image: resolve(craft.image, 3 + idx) })),
    };
  })();

  const visibleDescriptionImages = extractedDescriptionImages.filter((img) => !failedImages.has(img.src));

  // 尺碼表資料來源
  // 尺碼表與版型指標只在 Shopify 有實際資料時顯示，不再套用預設數值
  const hasSizeChart = (sizeChart?.rows.length ?? 0) > 0;
  const hasFitGuide = Boolean(fitGuide?.fit || fitGuide?.thickness || fitGuide?.elasticity || fitGuide?.breathability);

  // 版型亮燈數值
  const fitValue = fitGuide?.fit || '合身';
  const thicknessValue = fitGuide?.thickness || '適中';
  const elasticityValue = fitGuide?.elasticity || '高彈力';
  const breathabilityValue = fitGuide?.breathability || '極佳';

  // 容量或包裝單位：只採用品名括號內標示（例如「(150ml)」），不再依品類猜測
  const unitFromName = productName.match(/\(([^)]+)\)/)?.[1] ?? '';

  // 規格卡只列出有實際資料的欄位；一欄都沒有時整張卡不顯示
  const specRows = (isGenericAccessory
    ? [
      { label: '規格／包裝 (Specification)', value: careSpecs?.volume || unitFromName },
      { label: '材質／款式 (Material)', value: careSpecs?.texture },
      { label: '適用對象／用途 (Application)', value: careSpecs?.application },
      { label: '品牌／來源 (Brand)', value: legitVendor },
      { label: '產地 (Origin)', value: careSpecs?.origin },
      { label: '保存／保固注意事項', value: careSpecs?.shelf_life },
    ]
    : [
      { label: '規格容量／單位 (Volume)', value: careSpecs?.volume || unitFromName },
      { label: '主要劑型 (Texture)', value: careSpecs?.texture },
      { label: '適用對象／部位 (Application)', value: careSpecs?.application },
      { label: '製造產地 (Origin)', value: careSpecs?.origin },
      { label: '主要成分 (Ingredients)', value: careSpecs?.ingredients },
      { label: '保存期限 (Shelf Life)', value: careSpecs?.shelf_life },
    ]
  ).filter((row): row is { label: string; value: string } => Boolean(row.value));

  // 品牌欄：SAENGAK 商品顯示 SAENGAK；其他商品只在有合法 vendor 時顯示
  const brandLabel = isNonOwnBrand ? legitVendor : (legitVendor || 'SAENGAK');

  const renderSections = (sections: ContentSection[], kind: 'feature' | 'usage') => sections.length > 0 ? (
      <section className="space-y-6" data-testid={kind === 'feature' ? 'product-features' : 'product-usage'}>
        <h3 className="text-xl font-bold text-gray-900 border-l-4 border-brand pl-3.5">{kind === 'feature' ? '產品特色' : '使用情境'}</h3>
        {sections.map((sec, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 bg-white p-6 sm:p-8 rounded-2xl border border-gray-200/70`}
          >
            {sec.image && (
            <div className="w-full md:w-1/2 aspect-4/3 rounded-xl overflow-hidden relative group bg-gray-100">
              <img
                src={shopifyImageUrl(sec.image, 900)}
                alt={sec.title}
                onError={() => markImageFailed(sec.image)}
                className={`w-full h-full ${kind === 'feature' ? 'object-contain' : 'object-cover'} transition-transform duration-700 group-hover:scale-105`}
                loading="lazy"
              />
              <span className="absolute top-3 left-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {sec.badge}
              </span>
            </div>
            )}
            <div className={`w-full ${sec.image ? 'md:w-1/2' : ''} space-y-3 text-left`}>
              <span className="text-xs font-bold text-brand tracking-widest uppercase">
                {kind === 'feature' ? '產品特色' : '使用情境'}
              </span>
              <h4 className="text-xl sm:text-2xl sm:leading-8 font-bold text-gray-900 leading-snug" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                {sec.title}
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {sec.description}
              </p>
            </div>
          </div>
        ))}
      </section>
  ) : null;

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* 方案 A 小編富文本引言內容 (已智慧分離圖片至下方) */}
      {hasLeadContent ? (
        <div
          ref={containerRef}
          className="bg-white p-6 sm:p-10 rounded-2xl border border-gray-200/70 space-y-6 overflow-hidden [&_.editorial-preface]:p-6 sm:[&_.editorial-preface]:p-8 [&_.editorial-preface]:bg-[#F7F6F3] [&_.editorial-preface]:border-l-4 [&_.editorial-preface]:border-brand [&_.editorial-preface]:rounded-r-2xl [&_.editorial-preface_p]:text-gray-700 [&_.editorial-preface_p]:text-base [&_.editorial-preface_p]:leading-relaxed [&_.editorial-preface_p]:mb-3.5 [&_.editorial-preface_p]:last:mb-0 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:border-l-4 [&_h2]:border-brand [&_h2]:pl-3.5 [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-gray-800 [&_h3]:mt-8 [&_h3]:mb-3 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-gray-800 [&_h4]:mt-6 [&_h4]:mb-2 [&_p]:text-base [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-5 [&_ul]:space-y-2.5 [&_li]:text-gray-700 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-5 [&_ol]:space-y-2.5 [&_li]:text-gray-700 [&_table]:w-full [&_table]:border-collapse [&_table]:my-8 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-gray-200 [&_th]:bg-stone-100 [&_th]:text-brand [&_th]:p-3.5 [&_th]:font-bold [&_th]:text-left [&_th]:text-sm [&_td]:p-3.5 [&_td]:border-t [&_td]:border-gray-100 [&_td]:text-gray-700 [&_td]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-brand/60 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:bg-blush/40 [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:text-gray-700"
          dangerouslySetInnerHTML={{ __html: leadTextHtml }}
        />
      ) : null}

      {renderSections(displaySections.filter((section) => section.kind === 'feature'), 'feature')}

      {/* 4. 工藝細節與特點解析 */}
      {displayCrafts.length > 0 && (
      <div className="space-y-6">
        <div className="border-l-4 border-brand pl-3.5">
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            {isApparel ? '版型與穿著細節' : isGenericAccessory ? '設計與操作細節' : '質地與使用細節'}
          </h3>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayCrafts.map((craft, idx) => (
            <div key={idx} className="rounded-2xl border border-gray-200 bg-white overflow-hidden group">
              {craft.image && (
              <div className="aspect-4/3 sm:aspect-16/11 overflow-hidden bg-stone-50">
                <img
                  src={shopifyImageUrl(craft.image, 900)}
                  alt={craft.title}
                  onError={() => markImageFailed(craft.image)}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              )}
              <div className="p-5 space-y-1.5">
                <span className="text-xs font-bold text-brand">
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
      )}

      {renderSections(displaySections.filter((section) => section.kind !== 'feature'), 'usage')}

      {/* 5. 跨品類自適應卡 */}
      {isApparel ? (
        <>
          {hasFitGuide && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <i className="ri-dashboard-line text-xl text-brand"></i>
                <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  版型與著感指標 (Fit & Feeling Guide)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-10">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>版型 (Fit)</span>
                  <span className="text-brand">
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
                  <div className={`py-2 rounded-lg ${fitValue.includes('緊身') || fitValue.toLowerCase().includes('slim') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>緊身 (Slim)</div>
                  <div className={`py-2 rounded-lg ${fitValue.includes('合身') || (!fitValue.includes('緊身') && !fitValue.includes('寬鬆')) ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>合身 (Regular)</div>
                  <div className={`py-2 rounded-lg ${fitValue.includes('寬鬆') || fitValue.toLowerCase().includes('loose') || fitValue.toLowerCase().includes('oversized') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>寬鬆 (Oversized)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>厚薄度 (Thickness)</span>
                  <span className="text-brand">
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
                  <div className={`py-2 rounded-lg ${thicknessValue.includes('薄') || thicknessValue.toLowerCase().includes('light') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>輕薄 (Light)</div>
                  <div className={`py-2 rounded-lg ${thicknessValue.includes('中') || (!thicknessValue.includes('薄') && !thicknessValue.includes('厚')) ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>適中 (Moderate)</div>
                  <div className={`py-2 rounded-lg ${thicknessValue.includes('厚') || thicknessValue.toLowerCase().includes('heavy') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>厚實 (Heavy)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>彈性 (Elasticity)</span>
                  <span className="text-brand">
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
                  <div className={`py-2 rounded-lg ${elasticityValue.includes('無') || elasticityValue.toLowerCase().includes('none') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>無彈 (None)</div>
                  <div className={`py-2 rounded-lg ${elasticityValue.includes('微') || elasticityValue.toLowerCase().includes('slight') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>微彈 (Slight)</div>
                  <div className={`py-2 rounded-lg ${elasticityValue.includes('高') || (!elasticityValue.includes('無') && !elasticityValue.includes('微')) ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>高彈力 (High)</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>透氣度 (Breathability)</span>
                  <span className="text-brand">
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
                  <div className={`py-2 rounded-lg ${breathabilityValue.includes('一般') || breathabilityValue.toLowerCase().includes('normal') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>一般 (Normal)</div>
                  <div className={`py-2 rounded-lg ${breathabilityValue.includes('良好') || breathabilityValue.toLowerCase().includes('good') ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>良好 (Good)</div>
                  <div className={`py-2 rounded-lg ${breathabilityValue.includes('極佳') || (!breathabilityValue.includes('一般') && !breathabilityValue.includes('良好')) ? 'bg-brand text-white font-bold' : 'bg-gray-100 text-gray-500'}`}>極佳 (Excellent)</div>
                </div>
              </div>
            </div>
          </div>
          )}

          {hasSizeChart && sizeChart && (
          <div id="size-guide" className="scroll-mt-32 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                尺寸指南
              </h3>
            </div>
            <SizeChartTable chart={sizeChart} />
          </div>
          )}
        </>
      ) : specRows.length > 0 ? (
        // 規格卡：服飾以外的商品（SAENGAK 保養品或第三方配件），只列出 Shopify 實際填寫的欄位
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
            <i className={`${isGenericAccessory ? 'ri-price-tag-3-line' : 'ri-flask-line'} text-xl text-brand`}></i>
            <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
              {isGenericAccessory ? '商品規格卡 (Product Specifications)' : '護理規格與成分參數卡 (Specifications)'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            {specRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-semibold text-gray-900 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 6. 基本商品資訊 & 洗滌/使用保養說明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-4">
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
              <dd className="font-semibold text-gray-900">{category || '-'}</dd>
            </div>
            {brandLabel && (
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">品牌</dt>
                <dd className="font-semibold text-gray-900">{brandLabel}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">製造國別 (Origin)</dt>
              {/* 產地只採用 Shopify 填寫的資料；未填寫時請顧客以包裝標示為準，不自行推定 */}
              <dd className="font-semibold text-gray-900">{careSpecs?.origin || '請見商品包裝標示'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-4">
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
                    <i className={`${iconClass} text-brand text-base mt-0.5`}></i>
                    <span>{instruction}</span>
                  </div>
                );
              })
            ) : isApparel ? (
              <>
                <div className="flex items-start gap-2.5">
                  <i className="ri-hand-sanitizer-line text-brand text-base mt-0.5"></i>
                  <span>建議使用 30°C 以下冷水手洗或放入洗衣袋慢速弱洗。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-sun-line text-brand text-base mt-0.5"></i>
                  <span>請置於陰涼通風處懸掛晾乾，避免長時間烈日曝曬。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-prohibited-line text-brand text-base mt-0.5"></i>
                  <span>請勿使用含漂白成分或螢光劑之強效洗劑，切勿高溫烘乾。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-t-shirt-air-line text-brand text-base mt-0.5"></i>
                  <span>深淺色衣物請分開洗滌，避免互染。</span>
                </div>
              </>
            ) : (
              // 沒有填寫使用說明時只顯示中性的通用提醒，不預設劑型、用法或開封期限
              <>
                <div className="flex items-start gap-2.5">
                  <i className="ri-book-open-line text-brand text-base mt-0.5"></i>
                  <span>使用前請詳閱商品包裝標示，並依指示正確使用。</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <i className="ri-sun-line text-brand text-base mt-0.5"></i>
                  <span>請存放於陰涼乾燥處，避免高溫、潮濕與陽光直射。</span>
                </div>
                {!isGenericAccessory && (
                  <div className="flex items-start gap-2.5">
                    <i className="ri-shield-cross-line text-brand text-base mt-0.5"></i>
                    <span>如使用後出現紅腫或不適，請立即停止使用並諮詢醫師。</span>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <i className="ri-customer-service-2-line text-brand text-base mt-0.5"></i>
                  <span>使用上如有任何疑問，歡迎來信客服洽詢。</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 6.5 描述圖片展示專區 (依規範精準置於「基本商品資訊與使用方式」區塊正下方) */}
      {visibleDescriptionImages.length > 0 && (
        <div className="space-y-6 animate-fadeIn" data-testid="product-description-images-section">
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
            <span className="w-1.5 h-5 rounded-full bg-brand"></span>
            <h4 className="text-lg sm:text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
              商品詳細圖文
            </h4>
          </div>

          {/* 無縫拼接圖片容器：整組統一外層卡片邊框與圓角，內部圖片完全零間隙緊密相連 */}
          <div className="overflow-hidden rounded-2xl bg-white border border-gray-200/70 flex flex-col gap-0 leading-none">
            {visibleDescriptionImages.map((img, idx) => (
              <div
                key={idx}
                className="w-full overflow-hidden text-center m-0 p-0 leading-none"
              >
                <img
                  src={shopifyImageUrl(img.src, 1200)}
                  alt={img.alt || `${productName} 描述圖 ${idx + 1}`}
                  loading="lazy"
                  onError={() => markImageFailed(img.src)}
                  onClick={() => setZoomImageSrc(img.src)}
                  className="w-full h-auto block cursor-zoom-in transition-opacity hover:opacity-95 mx-auto m-0 p-0 align-bottom"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 品牌美學故事專區：只放在 SAENGAK 商品，避免其他品牌商品掛上 SAENGAK 品牌敘事 */}
      {showSaengakStory && (
      <div className="rounded-2xl border border-gray-200/70 bg-linear-to-br/srgb from-stone-50 via-white to-blush/20 p-6 sm:p-10 space-y-4 text-left">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand">
          <i className="ri-leaf-line text-sm"></i>
          <span>Brand Philosophy</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-black text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
          從日常微小之處，重新感受肌膚的純淨自在
        </h3>
        <p className="text-sm sm:text-base sm:leading-6 text-gray-600 leading-relaxed max-w-3xl">
          SAENGAK
          始終深信，最美好的生活品質來自對身體肌膚的細微呵護。回歸純淨自然、屏除無謂冗贅，我們堅持挑選最高規格原物料與嚴謹工藝，讓每一次穿戴與使用，都成為陪伴妳身心放鬆的溫柔儀式。
        </p>
      </div>
      )}

      {/* 7. 購物保障：只列出對所有商品都成立的商店層級事實，不放品牌授權或檢驗宣稱 */}
      <div className="rounded-2xl border border-brand/20 bg-brand/5 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center text-xl">
            <i className="ri-shield-check-line" aria-hidden="true"></i>
          </div>
          <h4 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
            LUCISSI CARE 購物保障
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-brand text-base" aria-hidden="true"></i>
            <span>LUCISSI CARE 官方網站販售</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-brand text-base" aria-hidden="true"></i>
            <span>結帳由 Shopify 安全處理</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-circle-fill text-brand text-base" aria-hidden="true"></i>
            <span>退換貨依消費者保護法規定辦理</span>
          </div>
        </div>
      </div>

      {/* 燈箱放大 Modal */}
      {zoomImageSrc && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4 cursor-zoom-out"
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
            src={shopifyImageUrl(zoomImageSrc, 2000)}
            alt="放大預覽"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl transition-transform"
          />
        </div>
      )}
    </div>
  );
}
