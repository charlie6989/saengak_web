import { useState } from 'react';
import { getShopifyProductsByTags, type ShopifyProduct } from '../lib/shopify';

export type Product = ShopifyProduct;

interface UseProductsByTagResult {
  products: Product[];
  productsByTag: { [tag: string]: Product[] };
  loading: boolean;
  error: string | null;
  searchTags: string[];
  fetchProductsByTag: (
    tags: string[],
    options?: {
      first?: number;
      sortKey?: string;
      reverse?: boolean;
    }
  ) => Promise<void>;
}

// Hook for fetching products by tags directly via Shopify Storefront SDK
export function useShopifyProductsByTag(): UseProductsByTagResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsByTag, setProductsByTag] = useState<{ [tag: string]: Product[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTags, setSearchTags] = useState<string[]>([]);

  const fetchProductsByTag = async (
    tags: string[],
    options: {
      first?: number;
      sortKey?: string;
      reverse?: boolean;
    } = {}
  ) => {
    if (!tags || tags.length === 0) {
      setError('Tags are required');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchTags(tags);

    try {
      const fetchedProducts = await getShopifyProductsByTags(tags, {
        first: options.first || 20,
        sortKey: options.sortKey || 'BEST_SELLING',
        reverse: options.reverse ?? false,
      });

      const grouped: { [tag: string]: Product[] } = {};
      for (const t of tags) {
        grouped[t] = fetchedProducts.filter((p) =>
          (p.tags || []).some((itemTag) => itemTag.toLowerCase().includes(t.toLowerCase()))
        );
      }

      setProducts(fetchedProducts);
      setProductsByTag(grouped);
    } catch (err) {
      console.error('Error fetching products by tag from Shopify:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProducts([]);
      setProductsByTag({});
    } finally {
      setLoading(false);
    }
  };

  return {
    products,
    productsByTag,
    loading,
    error,
    searchTags,
    fetchProductsByTag,
  };
}

// 常用標籤常數
export const COMMON_TAGS = {
  FEMININE_CARE: '女性護理',
  DAILY_CLEAN: '每日清潔',
  DEEP_REPAIR: '深層修護',
  UNDERWEAR: '內褲',
  PERIOD_CARE: '生理期護理',
  SENSITIVE_SKIN: '敏感肌',
  ANTIBACTERIAL: '抗菌',
  SEAMLESS: '無痕',
  COTTON: '純棉',
  TRAVEL_SIZE: '旅行裝',
  BESTSELLER: '熱銷',
  NEW_ARRIVAL: '新品',
  SALE: '特價',
} as const;

// 預設標籤組合
export const TAG_COMBINATIONS = {
  FEMININE_PRODUCTS: [COMMON_TAGS.FEMININE_CARE, COMMON_TAGS.DAILY_CLEAN, COMMON_TAGS.DEEP_REPAIR],
  UNDERWEAR_PRODUCTS: [COMMON_TAGS.UNDERWEAR, COMMON_TAGS.SEAMLESS, COMMON_TAGS.ANTIBACTERIAL, COMMON_TAGS.COTTON],
  SPECIAL_CARE: [COMMON_TAGS.PERIOD_CARE, COMMON_TAGS.SENSITIVE_SKIN],
  PROMOTIONAL: [COMMON_TAGS.BESTSELLER, COMMON_TAGS.NEW_ARRIVAL, COMMON_TAGS.SALE],
} as const;