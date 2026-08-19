import { useState } from 'react';
import { getShopifyProductsByTags } from '../lib/shopify';

interface Product {
  id: string;
  name: string;
  title: string;
  description: string;
  descriptionHtml: string;
  handle: string;
  price: number;
  originalPrice?: number;
  image: string;
  hoverImage: string;
  tags: string[];
  productType: string;
  vendor: string;
  createdAt: string;
  variants: any[];
}

interface UseProductsByTagResult {
  products: Product[];
  productsByTag: { [tag: string]: Product[] };
  loading: boolean;
  error: string | null;
  searchTags: string[];
  fetchProductsByTag: (tags: string[], options?: {
    first?: number;
    sortKey?: string;
    reverse?: boolean;
  }) => Promise<void>;
}

// Hook for fetching products by tags
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
      const items = await getShopifyProductsByTags(tags, {
        first: options.first || 20,
        sortKey: options.sortKey || 'CREATED_AT',
        reverse: options.reverse !== undefined ? options.reverse : true
      });

      const formatted: Product[] = items.map((p) => ({
        id: p.id,
        name: p.name || p.title,
        title: p.title || p.name,
        description: p.description,
        descriptionHtml: p.descriptionHtml,
        handle: p.handle,
        price: p.price,
        originalPrice: p.originalPrice,
        image: p.image,
        hoverImage: p.hoverImage,
        tags: p.tags,
        productType: p.productType,
        vendor: p.vendor,
        createdAt: p.createdAt,
        variants: p.variants,
      }));

      const byTagMap: { [tag: string]: Product[] } = {};
      tags.forEach(t => {
        byTagMap[t] = formatted.filter(p => p.tags.includes(t));
      });

      setProducts(formatted);
      setProductsByTag(byTagMap);
    } catch (err) {
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
    fetchProductsByTag
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
  SALE: '特價'
} as const;

// 預設標籤組合
export const TAG_COMBINATIONS = {
  FEMININE_PRODUCTS: [COMMON_TAGS.FEMININE_CARE, COMMON_TAGS.DAILY_CLEAN, COMMON_TAGS.DEEP_REPAIR],
  UNDERWEAR_PRODUCTS: [COMMON_TAGS.UNDERWEAR, COMMON_TAGS.SEAMLESS, COMMON_TAGS.ANTIBACTERIAL, COMMON_TAGS.COTTON],
  SPECIAL_CARE: [COMMON_TAGS.PERIOD_CARE, COMMON_TAGS.SENSITIVE_SKIN],
  PROMOTIONAL: [COMMON_TAGS.BESTSELLER, COMMON_TAGS.NEW_ARRIVAL, COMMON_TAGS.SALE]
} as const;
