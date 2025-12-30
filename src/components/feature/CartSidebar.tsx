import { useCart } from '../../contexts/CartContext';

export default function CartSidebar() {
  const { 
    items, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getTotalPrice, 
    isCartOpen, 
    setIsCartOpen 
  } = useCart();

  // 韓元轉新台幣匯率 (1 KRW = 0.024 TWD)
  const convertToTWD = (krwPrice: number) => {
    return Math.round(krwPrice * 0.024);
  };

  const formatTWDPrice = (twdPrice: number) => {
    return `$${twdPrice.toLocaleString()}`;
  };

  const handleCheckout = () => {
    console.log('Proceeding to checkout with items:', items);
    // Add checkout logic here
  };

  const handleProductClick = (item: any) => {
    const numericId = item.id.includes('gid://shopify/Product/')
      ? item.id.split('/').pop()
      : item.id;
    window.location.href = `/product/${numericId}`;
  };

  if (!isCartOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      
      {/* Cart Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            購物車 <span className="text-teal-600">({items.length})</span>
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="關閉購物車"
          >
            <i className="ri-close-line text-2xl text-gray-700"></i>
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <i className="ri-shopping-cart-line text-5xl text-gray-400"></i>
              </div>
              <p className="text-lg text-gray-600 font-medium" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                購物車是空的
              </p>
              <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                快去挑選喜歡的商品吧！
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  {/* Product Image */}
                  <div 
                    className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 cursor-pointer shadow-sm"
                    onClick={() => handleProductClick(item)}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="text-sm font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-teal-600 transition-colors mb-2"
                      style={{ fontFamily: "Noto Sans TC, sans-serif" }}
                      onClick={() => handleProductClick(item)}
                    >
                      {item.name}
                    </h3>
                    
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-base font-bold text-teal-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                        {formatTWDPrice(convertToTWD(item.price))}
                      </span>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <span className="text-xs text-gray-400 line-through" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {formatTWDPrice(convertToTWD(item.originalPrice))}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                          aria-label="減少數量"
                        >
                          <i className="ri-subtract-line text-base"></i>
                        </button>
                        <span className="text-sm font-semibold text-gray-900 min-w-[24px] text-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                          aria-label="增加數量"
                        >
                          <i className="ri-add-line text-base"></i>
                        </button>
                      </div>
                      
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        aria-label="移除商品"
                      >
                        <i className="ri-delete-bin-line text-lg"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-5 bg-gray-50 space-y-4">
            {/* Total */}
            <div className="flex items-center justify-between py-3 px-4 bg-white rounded-xl shadow-sm">
              <span className="text-base font-semibold text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                總金額
              </span>
              <span className="text-2xl font-bold text-teal-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                {formatTWDPrice(convertToTWD(getTotalPrice()))}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                className="w-full bg-teal-600 text-white py-4 rounded-xl font-semibold hover:bg-teal-700 active:bg-teal-800 transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-teal-600/30"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                前往結帳
              </button>
              <button
                onClick={clearCart}
                className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                清空購物車
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
