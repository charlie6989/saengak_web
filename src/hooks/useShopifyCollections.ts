import { useState, useEffect } from 'react';
import {
  getShopifyCollections,
  getShopifyCollectionByHandle
} from '../lib/shopify';

interface Collection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string | null;
  productsCount?: number;
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
      const items = await getShopifyCollections(50);
      setCollections(items);
    } catch (err) {
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
      const data = await getShopifyCollectionByHandle(handle, { first: 50 });
      setCollection(data.collection);
      setProducts(data.products.map((p) => ({
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
      })));
    } catch (err) {
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
