
import { useState, useEffect } from 'react';
import { getFunctionUrl } from '../../../lib/supabase';
import ProductCard from '../../../components/feature/ProductCard';

interface Product {
  id: string;
  name: string;
  image: string;
  hoverImage: string;
  price: number;
  originalPrice?: number;
  description: string;
  model?: string;
  discountRate?: number;
  reviews?: number;
  isBest?: boolean;
  isNew?: boolean;
}

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  shopifyProductIds?: string[];
}

export default function ProductSection({ title, subtitle, shopifyProductIds }: ProductSectionProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shopifyProductIds && shopifyProductIds.length > 0) {
      fetchShopifyProducts();
    }
  }, [shopifyProductIds]);

  const fetchShopifyProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('開始獲取 Shopify 產品...');
      const timestamp = new Date().getTime();
      const response = await fetch(getFunctionUrl('get-products') + `?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          productIds: shopifyProductIds
        }),
      });

      console.log('API 響應狀態:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 錯誤響應:', errorText);
        throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('收到的數據:', data);

      if (data.success && data.products && Array.isArray(data.products)) {
        console.log(`成功獲取 ${data.products.length} 個產品`);
        setAllProducts(data.products);
        setError(null);
      } else if (data.products && Array.isArray(data.products)) {
        console.log(`獲取 ${data.products.length} 個產品（無 success 標記）`);
        setAllProducts(data.products);
        setError(null);
      } else {
        console.error('數據格式錯誤:', data);
        setError('數據格式錯誤');
        setAllProducts([]);
      }
    } catch (error) {
      console.error('獲取 Shopify 產品時發生錯誤:', error);
      setError(error instanceof Error ? error.message : '未知錯誤');
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (shopifyProductIds && shopifyProductIds.length > 0) {
      fetchShopifyProducts();
    }
  };

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* 標題區域 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              {title}
            </h2>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="重新載入產品"
            >
              <i className="ri-refresh-line text-xl"></i>
            </button>
          </div>
          {subtitle && (
            <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* 載入狀態 */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">載入產品中...</p>
          </div>
        )}

        {/* 錯誤狀態 */}
        {error && !loading && (
          <div className="text-center py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
              <i className="ri-error-warning-line text-red-500 text-2xl mb-2"></i>
              <p className="text-red-700 mb-2">載入產品時發生錯誤</p>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                重新載入
              </button>
            </div>
          </div>
        )}

        {/* 產品網格 - 確保能顯示所有產品 */}
        {!loading && !error && allProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-product-shop>
            {allProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* 如果沒有產品顯示提示 */}
        {!loading && !error && allProducts.length === 0 && (
          <div className="text-center py-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
              <i className="ri-shopping-bag-line text-gray-400 text-4xl mb-4"></i>
              <p className="text-gray-500 mb-4">暫無產品資料</p>
              <p className="text-gray-400 text-sm mb-4">請檢查網絡連接或稍後再試</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
              >
                重新載入
              </button>
            </div>
          </div>
        )}


      </div>
    </section>
  );
}
