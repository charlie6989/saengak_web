import { useState, useEffect } from 'react';
import {
  getShopifyCollections,
  getShopifyCollectionByHandle,
  getShopifyProducts,
  type ShopifyCollection,
  type ShopifyProduct,
} from '../lib/shopify';

export type Collection = ShopifyCollection;
export type Product = ShopifyProduct;

interface UseCollectionsResult {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  fetchCollections: () => Promise<void>;
}

interface UseCollectionProductsResult {
  collection: Collection | null;
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchCollectionProducts: (handle: string) => Promise<void>;
}

// Hook for fetching all collections directly via Shopify Storefront GraphQL
export function useShopifyCollections(): UseCollectionsResult {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getShopifyCollections(50);
      setCollections(data);
    } catch (err) {
      console.error('Error fetching collections from Shopify:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return {
    collections,
    loading,
    error,
    fetchCollections,
  };
}

// Hook for fetching products from a specific collection
export function useShopifyCollectionProducts(): UseCollectionProductsResult {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollectionProducts = async (handle: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await getShopifyCollectionByHandle(handle, { first: 50 });
      if (res.collection) {
        setCollection(res.collection);
        setProducts(res.products);
      } else {
        // Fallback: 嘗試以 collection handle query 取得商品
        const fallbackProducts = await getShopifyProducts({
          first: 50,
          query: `collection:${handle}`,
        });
        setProducts(fallbackProducts);
      }
    } catch (err) {
      console.error('Error fetching collection products from Shopify:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCollection(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    collection,
    products,
    loading,
    error,
    fetchCollectionProducts,
  };
}