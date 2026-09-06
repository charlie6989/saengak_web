
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string | number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  hoverImage?: string;
  description: string;
  reviews?: number;
  isBest?: boolean;
  isNew?: boolean;
  productType?: string;
  vendor?: string;
  availableForSale?: boolean;
  variants?: Array<{
    id?: string;
    availableForSale?: boolean;
    quantityAvailable?: number;
  }>;
}

interface ProductCardProps {
  product: Product;
}

const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800';

/**
 * 清洗商品標題：
 * 1. 剃除 SAENGAK｜、LUCISSI｜ 等重複性品牌前綴與表情符號
 * 2. 嚴格遵守標題 12 字以內規範
 */
export function sanitizeProductTitle(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/^(\s*✨|\s*🌸|\s*🌹|\s*🎀|\s*💫|\s*🌬️)+/g, '')
    .trim();

  cleaned = cleaned
    .replace(/^(\s*SAENGAK\s*[｜|_\-–—]\s*)+/gi, '')
    .replace(/^(\s*LUCISSI\s*[｜|_\-–—]\s*)+/gi, '')
    .replace(/^(?:SAENGAK|LUCISSI)[｜|_\-–—\s]+/gi, '')
    .replace(/\s*(現貨|現貨\s*\d*|_images|_URL|\.jpg|\.png).*$/gi, '')
    .trim();

  // 4 大核心產品保留 Saengak 原品牌名稱
  if (cleaned.includes('慕斯') || cleaned.includes('潔淨慕斯')) return 'Saengak 平衡調理私密潔淨慕斯';
  if (cleaned.includes('養膚濕巾') || cleaned.includes('私密濕巾') || (cleaned.includes('益生菌') && cleaned.includes('濕巾'))) return 'Saengak 益生菌私密養膚濕巾';
  if (cleaned.includes('精華噴霧') || cleaned.includes('修護噴霧') || cleaned.includes('雙層修護')) return 'Saengak 私密雙層修護精華噴霧';
  if (cleaned.includes('清潔露') || cleaned.includes('深層修護')) return 'Saengak 深層修護私密清潔露';

  // 核心產品若以 SAENGAK 開頭則標準化
  if (/^saengak\s*/i.test(rawName)) {
    return 'Saengak ' + cleaned.slice(0, 12);
  }

  // 若仍超過 12 字，精簡至 12 字
  if (cleaned.length > 12) {
    const parts = cleaned.split(/[\s_]+/);
    if (parts[0] && parts[0].length <= 12 && parts[0].length >= 4) {
      return parts[0];
    }
    return cleaned.slice(0, 12);
  }
  return cleaned;
}

/**
 * 抽取商品單句核心描述（規則：短語一句話、無標點符號、無省略號 ...）
 */
export function extractSingleSentenceDescription(product: Product): string {
  const name = (product.name || '').toLowerCase();
  if (name.includes('慕斯') || name.includes('潔淨慕斯')) {
    return '微米綿密弱酸泡泡 溫和淨化異味';
  }
  if (name.includes('濕巾') || name.includes('養膚濕巾')) {
    return '如水般親膚溫和植萃 隨身潔淨清新';
  }
  if (name.includes('噴霧') || name.includes('雙層')) {
    return '雙層水油黃金配比 隨手安撫舒緩';
  }
  if (name.includes('清潔露') || name.includes('深層修護')) {
    return '專利植萃溫和淨膚 深層舒緩修護';
  }

  const rawDesc = (product.description || '').trim();
  if (!rawDesc) return '溫和植萃成分 柔嫩呵護私密肌膚';

  // 移除所有標點符號與省略號
  let cleaned = rawDesc
    .replace(/<[^>]+>/g, '')
    .replace(/[，。！？!?；;：:、\-_—–~～()（）「」『』\n\r\t]+/g, ' ')
    .replace(/\.{2,}/g, '')
    .replace(/…/g, '')
    .trim();

  // 限制長度在 16 字以內，不產生截斷 ...
  if (cleaned.length > 16) {
    cleaned = cleaned.slice(0, 16).trim();
  }
  return cleaned || '溫和植萃成分 柔嫩呵護私密肌膚';
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [imageSrc, setImageSrc] = useState(product.image || FALLBACK_PRODUCT_IMAGE);
  const [hoverSrc, setHoverSrc] = useState(product.hoverImage || product.image || FALLBACK_PRODUCT_IMAGE);
  const isSoldOut =
    product.availableForSale === false ||
    (Array.isArray(product.variants) &&
      product.variants.length > 0 &&
      product.variants.every((v) => v.availableForSale === false));
  const discountPercentage = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const displayTitle = sanitizeProductTitle(product.name);
  const singleSentenceDesc = extractSingleSentenceDescription(product);

  // 韓元轉新台幣匯率 (1 KRW = 0.024 TWD)
  const convertToTWD = (krwPrice: number) => {
    return Math.round(krwPrice * 0.024);
  };

  const formatTWDPrice = (twdPrice: number) => {
    return `$${twdPrice.toLocaleString()}`;
  };

  const handleCardClick = () => {
    // Extract the numeric ID from Shopify GID format
    const numericId = typeof product.id === 'string' && product.id.includes('gid://shopify/Product/')
      ? product.id.split('/').pop()
      : product.id;
    navigate(`/product/${numericId}`);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  const handleViewProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCardClick();
  };

  return (
    <div className="group cursor-pointer flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-2xs border border-gray-100/80 hover:shadow-md transition-shadow" onClick={handleCardClick}>
      {/* Product Image - Standardized square (1:1) ratio */}
      <div className="aspect-square bg-gray-50 overflow-hidden mb-3 relative flex items-center justify-center">
        <img
          src={imageSrc}
          alt={product.name}
          onError={() => setImageSrc(FALLBACK_PRODUCT_IMAGE)}
          className={`w-full h-full object-cover object-center group-hover:opacity-0 transition-opacity duration-300 ${isSoldOut ? 'opacity-75 grayscale-[30%]' : ''}`}
        />
        {hoverSrc && (
          <img
            src={hoverSrc}
            alt={product.name}
            onError={() => setHoverSrc(FALLBACK_PRODUCT_IMAGE)}
            className={`w-full h-full object-cover object-center absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isSoldOut ? 'grayscale-[30%]' : ''}`}
          />
        )}

        {/* Product Labels */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.isBest && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>BEST</span>
          )}
          {product.isNew && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>NEW</span>
          )}
        </div>

        {/* 已售完 圖層 (第 1 層) */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20 pointer-events-none">
            <span
              className="bg-black/80 text-white text-xs md:text-sm px-3.5 py-1.5 rounded-full font-medium tracking-wider shadow-md border border-white/20"
              style={{ fontFamily: "Noto Sans TC, sans-serif" }}
            >
              已售完
            </span>
          </div>
        )}
      </div>

      {/* 產品資訊 - 使用 flex-1 讓內容區域自動填充 */}
      <div className="p-4 flex flex-col flex-1">
        {/* Content Block with Wishlist - 減少上下留白 0.15cm */}
        <div className="flex justify-between items-start gap-2 flex-1" style={{ paddingTop: 'calc(0.5cm - 0.15cm)', paddingBottom: 'calc(0.5cm - 0.15cm)' }}>
          <div className="flex-1 space-y-1.5">
            {/* Product Category - 比產品尺寸小 10% */}
            <p className="text-sm text-gray-500" style={{ fontFamily: "Noto Sans TC, sans-serif", fontSize: "0.81rem" }}>
              {product.productType || '精選商品'}
            </p>

            {/* Product Title - 完整展示 Saengak 品牌與品名，不以省略號截斷 */}
            <h3 className="text-sm md:text-base font-semibold leading-snug line-clamp-2 min-h-[2.5rem]" title={displayTitle} style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>
              {displayTitle}
            </h3>

            {/* Subtitle/Specs - 僅在有合法品牌時呈現，嚴禁內著類商品誤植 SAENGAK */}
            {(() => {
              const isUnderwear = (product.productType === '舒適穿著') || /(?:內褲|內著|生理褲|安全褲|三角褲|平口褲|丁字褲)/i.test(product.name || '');
              const displayVendor = (product.vendor && product.vendor !== 'My Store 7') ? product.vendor : '';
              if (isUnderwear && displayVendor.toUpperCase() === 'SAENGAK') return null;
              if (!displayVendor) return null;
              return (
                <p className="text-xs sm:text-sm mb-1 text-[#225B4F]/80 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  {displayVendor}
                </p>
              );
            })()}


            {/* Description - 搜尋頁／列表頁須為一句話 */}
            <p className="text-xs sm:text-sm line-clamp-1 leading-relaxed text-gray-500" title={singleSentenceDesc} style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              {singleSentenceDesc}
            </p>

            {/* Price Block - 移到內容區塊內，享受留白效果 */}
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between">
                {/* Left side - Old price */}
                <div className="flex flex-col gap-1">
                  {product.originalPrice && product.originalPrice > product.price ? (
                    <span className="text-sm text-gray-400 line-through" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                      ${product.originalPrice.toLocaleString()}
                    </span>
                  ) : (
                    <div className="h-5"></div>
                  )}
                  {/* 折扣比率移到折扣後價格前面，字體大小和顏色與折扣後價格一致，顏色改為 #225B4F */}
                  <div className="flex items-center gap-2">
                    {discountPercentage > 0 ? (
                      <span className="text-lg font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>-{discountPercentage}%</span>
                    ) : null}
                    <span className="text-lg font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>
                      ${product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Wishlist Icon - Moved to right side of content */}
          <button
            onClick={handleWishlistClick}
            aria-label={isWishlisted ? `從收藏移除 ${product.name}` : `收藏 ${product.name}`}
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
          >
            <i className={`${isWishlisted ? 'ri-heart-fill text-red-500' : 'ri-heart-line text-gray-400'} text-sm`}></i>
          </button>
        </div>

        {/* 查看商品按鈕 - 固定在底部 */}
        <button
          onClick={handleViewProduct}
          aria-label={`查看 ${product.name} 商品詳情`}
          className="add-to-cart-btn mt-auto"
          style={{
            backgroundColor: isSoldOut ? '#F3F4F6' : '#E9F1EC',
            color: isSoldOut ? '#888888' : '#222222',
            fontFamily: "Noto Sans TC, sans-serif"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isSoldOut ? '#E5E7EB' : '#245B50';
            e.currentTarget.style.color = isSoldOut ? '#444444' : '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSoldOut ? '#F3F4F6' : '#E9F1EC';
            e.currentTarget.style.color = isSoldOut ? '#888888' : '#222222';
          }}
        >
          {isSoldOut ? '已售完・查看詳情' : '查看商品'}
        </button>
      </div>
    </div>
  );
}
