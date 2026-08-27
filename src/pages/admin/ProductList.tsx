import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getShopifyProducts, type ShopifyProduct } from '../../lib/shopify';
import { captureExceptionSafe } from '../../lib/sentry';

export const ProductList: React.FC = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getShopifyProducts(100);
      setProducts(data);
    } catch (err: any) {
      captureExceptionSafe(err, { source: 'AdminProductList.fetchProducts' });
      setError(err?.message || '讀取 Shopify Storefront 商品失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 所有可用標籤萃取
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    products.forEach((p) => {
      p.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [products]);

  // 篩選商品
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        searchTerm === '' ||
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.variants.some((v) => v.sku?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTag = selectedTag === 'ALL' || product.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [products, searchTerm, selectedTag]);

  return (
    <div className="space-y-6">
      {/* 標題與架構聲明 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopify Storefront 商品與庫存唯讀看板</h1>
          <p className="mt-1 text-sm text-gray-500">
            即時查詢 Shopify Storefront GraphQL 數據；為防止與 SiteGiant ERP 寫入衝突，本介面採唯讀設計。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={fetchProducts}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '同步中...' : '🔄 重新載入商品'}
          </button>
        </div>
      </div>

      {/* 權威源防護宣告 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        <div className="flex items-start space-x-3">
          <span className="text-lg">🔒</span>
          <div className="space-y-1 text-xs leading-5 text-blue-800">
            <p className="font-semibold text-sm text-blue-950">庫存與定價權威性規範 (Authority Alignment)：</p>
            <p>
              • <strong>實體庫存與售價權威源</strong>：由 <strong>SiteGiant ERP</strong> 作為主檔，透過 SiteGiant Shopify App 進行雙向同步。<br />
              • <strong>寫入衝突防護</strong>：後台管理介面嚴禁提供直接修改商品或覆寫庫存之操作，避免破壞 ERP ↔ Shopify 之同步一致性。
            </p>
          </div>
        </div>
      </div>

      {/* 搜尋與過濾條件工具列 */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 items-center space-x-3">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="搜尋品名、Handle 或 SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs focus:border-[#225B4F] focus:outline-none"
            />
          </div>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-[#225B4F] focus:outline-none"
          >
            <option value="ALL">全部標籤 ({products.length})</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500">
          顯示 <strong>{filteredProducts.length}</strong> / {products.length} 項商品
        </div>
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* 商品列表表格 */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#225B4F] border-t-transparent"></div>
            <p className="mt-2">正在查詢 Shopify Storefront 即時商品清單...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            查無相符的 Shopify 商品。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">商品資訊</th>
                  <th className="px-4 py-3">Handle</th>
                  <th className="px-4 py-3">價格 (TWD)</th>
                  <th className="px-4 py-3">即時庫存與狀態</th>
                  <th className="px-4 py-3">規格 (Variants)</th>
                  <th className="px-4 py-3">標籤 (Tags)</th>
                  <th className="px-4 py-3 text-right">詳情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-3">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="h-10 w-10 rounded-md object-cover border border-gray-200 bg-gray-100"
                        />
                        <div>
                          <div className="font-semibold text-gray-900 line-clamp-1">
                            {product.title}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {product.vendor || 'SAENGAK'} | {product.productType || '護理保養'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
                      {product.handle}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-gray-900">
                      NT$ {product.price.toLocaleString()}
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="ml-1.5 text-[11px] text-gray-400 line-through">
                          NT$ {product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          {product.availableForSale ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              ● 正常供貨中
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                              ● 已缺貨
                            </span>
                          )}
                        </div>
                        {typeof product.totalInventory === 'number' && (
                          <div className="text-[11px] font-medium text-gray-600">
                            總庫存：
                            <strong className={product.totalInventory > 0 ? 'text-emerald-700 font-semibold' : 'text-amber-600 font-semibold'}>
                              {product.totalInventory}
                            </strong> 件
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                        {product.variants.length} 款規格
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {product.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                        {product.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">
                            +{product.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#225B4F] cursor-pointer"
                      >
                        檢視規格
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 規格詳情彈窗 */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedProduct.title}</h2>
                <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                  <span>Handle: <code className="font-mono text-gray-700">{selectedProduct.handle}</code></span>
                  {typeof selectedProduct.totalInventory === 'number' && (
                    <span className="rounded bg-teal-50 px-2 py-0.5 font-semibold text-teal-800 border border-teal-200">
                      全品項總庫存: {selectedProduct.totalInventory} 件
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  規格清單與即時件數 ({selectedProduct.variants.length} 個 Variant)
                </h3>
                <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {selectedProduct.variants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <div className="font-semibold text-gray-800">{v.title}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          SKU: {v.sku || '無 SKU'} | GID: {v.id.split('/').pop()}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-bold text-gray-900">NT$ {v.price.toLocaleString()}</div>
                        <div className="flex items-center justify-end space-x-1.5">
                          {typeof v.quantityAvailable === 'number' && (
                            <span
                              className={`font-mono text-[11px] font-semibold rounded px-1.5 py-0.5 border ${
                                v.quantityAvailable > 0
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              庫存: {v.quantityAvailable} 件
                            </span>
                          )}
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              v.availableForSale
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {v.availableForSale ? '可販售' : '無庫存'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  全域標籤 Tags
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedProduct.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 border border-teal-100"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
