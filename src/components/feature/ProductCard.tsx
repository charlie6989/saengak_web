
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveDisplayVendor } from '../../lib/brandOwnership';
import { isProductSoldOut } from '../../domain/algorithms';
import { shopifyImageUrl } from '../../lib/shopifyImage';

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

/**
 * 清洗商品標題：只移除表情符號、商店名前綴與「現貨」等拍賣字樣。
 * 品名以 Shopify 為準，不改寫、不截字；過長時由卡片 line-clamp-2 換行省略。
 * （2026-10-18 起移除依關鍵字改寫品名與 12 字截斷：「MEDION 私密淨化凝膠」曾被切成「MEDION」。）
 */
export function sanitizeProductTitle(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/️/g, '')
    .replace(/^\s*SAENGAK\s*[｜|_\-–—]\s*/i, 'Saengak ')
    .replace(/^\s*LUCISSI\s*[｜|_\-–—]\s*/i, '')
    .replace(/\s*(現貨|_images|_URL|\.jpg|\.png).*$/gi, '')
    .trim();
}

/**
 * 卡片上的一句描述：取 Shopify 商品描述的第一句，移除標點。
 * 只使用 Shopify 實際填寫的文字，不依品名套用預設標語；沒有描述時回傳空字串、卡片不顯示這一行。
 */
export function extractSingleSentenceDescription(product: Product): string {
  const rawDesc = (product.description || '').replace(/<[^>]+>/g, '').trim();
  if (!rawDesc) return '';

  const firstSentence = rawDesc.split(/[。！？!?\n\r]/)[0] ?? '';
  return firstSentence
    .replace(/[，；;：:、\-_—–~～()（）「」『』\t]+/g, ' ')
    .replace(/\.{2,}|…/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);
  // 圖片載入失敗時不再換成圖庫照片，改為隱藏圖片、只留底色
  const [imageSrc, setImageSrc] = useState(shopifyImageUrl(product.image, 600));
  const [hoverSrc, setHoverSrc] = useState(shopifyImageUrl(product.hoverImage || product.image, 600));
  const isSoldOut = isProductSoldOut(product);
  const discountPercentage = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const displayTitle = sanitizeProductTitle(product.name);
  const singleSentenceDesc = extractSingleSentenceDescription(product);

  const formatTWDPrice = (twdPrice: number) => {
    return `NT$${twdPrice.toLocaleString()}`;
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
    <div className="group cursor-pointer flex flex-col h-full bg-white rounded-xl overflow-hidden border border-gray-100/80 hover:shadow-md transition-shadow" onClick={handleCardClick}>
      {/* Product Image - Standardized square (1:1) ratio */}
      <div className="aspect-square bg-gray-50 overflow-hidden mb-3 relative flex items-center justify-center">
        {imageSrc && (
          <img
            src={imageSrc}
            alt={product.name}
            onError={() => setImageSrc('')}
            className={`w-full h-full object-cover object-center group-hover:opacity-0 transition-opacity duration-300 ${isSoldOut ? 'opacity-75 grayscale-30' : ''}`}
          />
        )}
        {hoverSrc && (
          <img
            src={hoverSrc}
            alt={product.name}
            onError={() => setHoverSrc('')}
            className={`w-full h-full object-cover object-center absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isSoldOut ? 'grayscale-30' : ''}`}
          />
        )}

        {/* Product Labels */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.isBest && (
            <span className="bg-brand text-white text-xs px-2 py-1 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>BEST</span>
          )}
          {product.isNew && (
            <span className="bg-brand text-white text-xs px-2 py-1 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>NEW</span>
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
            <h3 className="text-sm md:text-base md:leading-6 font-semibold leading-snug line-clamp-2 min-h-10" title={displayTitle} style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>
              {displayTitle}
            </h3>

            {/* Subtitle/Specs - 僅在有合法品牌時呈現，嚴禁內著類商品誤植 SAENGAK */}
            {(() => {
              // 安全解析顯示用品牌名稱：內著／周邊商品絕不可能得到 'SAENGAK'（見 src/lib/brandOwnership.ts）
              const displayVendor = resolveDisplayVendor(
                { productType: product.productType, name: product.name, vendor: product.vendor },
                { allowSaengakFallbackForOwnBrand: false }
              );
              if (!displayVendor) return null;
              return (
                <p className="text-xs sm:text-sm mb-1 text-brand/80 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  {displayVendor}
                </p>
              );
            })()}


            {/* Description - 搜尋頁／列表頁須為一句話 */}
            {singleSentenceDesc && (
              <p className="text-xs sm:text-sm sm:leading-5 line-clamp-1 leading-relaxed text-gray-500" title={singleSentenceDesc} style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {singleSentenceDesc}
              </p>
            )}

            {/* Price Block - 移到內容區塊內，享受留白效果 */}
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between">
                {/* Left side - Old price */}
                <div className="flex flex-col gap-1">
                  {product.originalPrice && product.originalPrice > product.price ? (
                    <span className="text-sm text-gray-500 line-through" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                      {formatTWDPrice(product.originalPrice)}
                    </span>
                  ) : (
                    <div className="h-5"></div>
                  )}
                  {/* 折扣比率移到折扣後價格前面，字體大小和顏色與折扣後價格一致，顏色改為 #5B3D48 */}
                  <div className="flex items-center gap-2">
                    {discountPercentage > 0 ? (
                      <span className="text-base sm:text-lg font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>-{discountPercentage}%</span>
                    ) : null}
                    <span className="text-base sm:text-lg font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#5B3D48" }}>
                      {formatTWDPrice(product.price)}
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
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded-sm transition-colors cursor-pointer shrink-0"
          >
            <i className={`${isWishlisted ? 'ri-heart-fill text-red-500' : 'ri-heart-line text-gray-500'} text-sm`}></i>
          </button>
        </div>

        {/* 查看商品按鈕 - 固定在底部 */}
        <button
          onClick={handleViewProduct}
          aria-label={`查看 ${product.name} 商品詳情`}
          className="add-to-cart-btn mt-auto"
          style={{
            backgroundColor: isSoldOut ? '#F7F6F3' : '#FFFFFF',
            color: isSoldOut ? '#5C5552' : '#5B3D48',
            border: `1px solid ${isSoldOut ? '#D6D0C8' : '#8A827D'}`,
            fontWeight: 600,
            fontFamily: "Noto Sans TC, sans-serif"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isSoldOut ? '#D6D0C8' : '#5B3D48';
            e.currentTarget.style.color = isSoldOut ? '#5C5552' : '#FFFFFF';
            e.currentTarget.style.borderColor = isSoldOut ? '#D6D0C8' : '#5B3D48';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSoldOut ? '#F7F6F3' : '#FFFFFF';
            e.currentTarget.style.color = isSoldOut ? '#5C5552' : '#5B3D48';
            e.currentTarget.style.borderColor = isSoldOut ? '#D6D0C8' : '#8A827D';
          }}
        >
          {isSoldOut ? '已售完・查看詳情' : '查看商品'}
        </button>
      </div>
    </div>
  );
}
