import { useState, useEffect } from 'react';
import { getFunctionUrl } from '../lib/supabase';

interface Collection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string | null;
  productsCount: number;
}

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

// Hook for fetching all collections
export function useShopifyCollections(): UseCollectionsResult {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getFunctionUrl('get-collections'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          first: 50
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setCollections(data.collections || []);
      } else {
        throw new Error(data.error || 'Failed to fetch collections');
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
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
    fetchCollections
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
      const response = await fetch(getFunctionUrl('get-collections'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          collectionHandle: handle,
          first: 50
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setCollection(data.collection || null);
        setProducts(data.products || []);
      } else {
        throw new Error(data.error || 'Failed to fetch collection products');
      }
    } catch (err) {
      console.error('Error fetching collection products:', err);
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
    fetchCollectionProducts
  };
}