
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

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
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addToCart } = useCart();
  const discountPercentage = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <div className="group cursor-pointer flex flex-col h-full" onClick={handleCardClick}>
      {/* Product Image - Standardized 3:2 portrait ratio */}
      <div className="aspect-[2/3] bg-gray-50 overflow-hidden mb-3 relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover object-top group-hover:opacity-0 transition-opacity duration-300"
        />
        {product.hoverImage && (
          <img
            src={product.hoverImage}
            alt={product.name}
            className="w-full h-full object-cover object-top absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}

        {/* Product Labels */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isBest && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>BEST</span>
          )}
          {product.isNew && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>NEW</span>
          )}
        </div>
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

            {/* Product Title - 降低粗度，顏色改為 #225B4F */}
            <h3 className="text-lg font-semibold line-clamp-2 leading-tight" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#225B4F" }}>
              {product.name}
            </h3>

            {/* Subtitle/Specs - 比產品敘述大一些，小於產品標題，顏色改為 #225B4F */}
            {product.vendor && (
              <p className="text-sm mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif", marginBottom: "0.675rem", color: "#225B4F" }}>
                {product.vendor}
              </p>
            )}

            {/* Description - 字體大小改為和產品尺寸一樣，顏色改為 #BBBBBB */}
            <p className="text-sm line-clamp-3 leading-relaxed" style={{ fontFamily: "Noto Sans TC, sans-serif", color: "#BBBBBB" }}>
              {product.description}
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
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
          >
            <i className={`${isWishlisted ? 'ri-heart-fill text-red-500' : 'ri-heart-line text-gray-400'} text-sm`}></i>
          </button>
        </div>

        {/* 加入購物車按鈕 - 固定在底部 */}
        <button
          onClick={handleAddToCart}
          className="add-to-cart-btn mt-auto"
          style={{
            backgroundColor: '#E9F1EC',
            color: '#222222',
            fontFamily: "Noto Sans TC, sans-serif"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#245B50';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#E9F1EC';
            e.currentTarget.style.color = '#222222';
          }}
        >
          加入購物車
        </button>
      </div>
    </div>
  );
}
