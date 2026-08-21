import { describe, it, expect } from 'vitest';
import {
  formatShopifyProduct,
  getShopifyProduct,
  getShopifyProductByHandle,
  getShopifyProducts,
  getShopifyProductsByIds,
  getShopifyProductsByTags,
  getShopifyCollections,
  getShopifyCollectionByHandle,
  getShopifyArticles,
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_API_VERSION,
} from '../src/lib/shopify';

describe('Shopify Storefront SDK Client', () => {
  it('should have proper baseline store configuration', () => {
    expect(SHOPIFY_STORE_DOMAIN).toBe('gh2xgs-zf.myshopify.com');
    expect(SHOPIFY_API_VERSION).toBe('2026-07');
  });

  describe('formatShopifyProduct', () => {
    it('should correctly format a full GraphQL product node', () => {
      const mockNode = {
        id: 'gid://shopify/Product/123456789',
        title: '深層修護私密清潔露',
        description: '溫和清潔配方',
        descriptionHtml: '<p>溫和清潔配方</p>',
        handle: 'deep-repair-wash',
        priceRange: {
          minVariantPrice: {
            amount: '680.0',
            currencyCode: 'TWD',
          },
        },
        compareAtPriceRange: {
          minVariantPrice: {
            amount: '880.0',
            currencyCode: 'TWD',
          },
        },
        images: {
          edges: [
            { node: { url: 'https://example.com/img1.jpg', altText: '主圖' } },
            { node: { url: 'https://example.com/img2.jpg', altText: '副圖' } },
          ],
        },
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/987654',
                title: '標準版 200ml',
                price: { amount: '680.0', currencyCode: 'TWD' },
                compareAtPrice: { amount: '880.0', currencyCode: 'TWD' },
                availableForSale: true,
                sku: 'SAENGAK-WASH-200',
                selectedOptions: [{ name: '容量', value: '200ml' }],
              },
            },
          ],
        },
        tags: ['清潔', '女性護理', '熱銷'],
        productType: '清潔露',
        vendor: 'SAENGAK',
        createdAt: '2026-08-01T10:00:00Z',
        availableForSale: true,
      };

      const product = formatShopifyProduct(mockNode);

      expect(product.id).toBe('gid://shopify/Product/123456789');
      expect(product.name).toBe('深層修護私密清潔露');
      expect(product.title).toBe('深層修護私密清潔露');
      expect(product.handle).toBe('deep-repair-wash');
      expect(product.price).toBe(680);
      expect(product.originalPrice).toBe(880);
      expect(product.image).toBe('https://example.com/img1.jpg');
      expect(product.hoverImage).toBe('https://example.com/img2.jpg');
      expect(product.images).toHaveLength(2);
      expect(product.tags).toEqual(['清潔', '女性護理', '熱銷']);
      expect(product.variants).toHaveLength(1);
      expect(product.variants[0].sku).toBe('SAENGAK-WASH-200');
      expect(product.availableForSale).toBe(true);
    });

    it('should handle minimal or missing fields gracefully', () => {
      const minimalNode = {
        id: 'gid://shopify/Product/111',
        title: '基本商品',
        handle: 'basic-item',
      };

      const product = formatShopifyProduct(minimalNode);

      expect(product.id).toBe('gid://shopify/Product/111');
      expect(product.name).toBe('基本商品');
      expect(product.price).toBe(0);
      expect(product.originalPrice).toBeUndefined();
      expect(product.images).toEqual([]);
      expect(product.tags).toEqual([]);
      expect(product.variants).toEqual([]);
      expect(product.image).toContain('images.unsplash.com');
    });

    it('should throw when passed null or undefined', () => {
      expect(() => formatShopifyProduct(null)).toThrow('Cannot format null product node');
    });
  });

  describe('Live Shopify Storefront API Integration', () => {
    it('getShopifyProducts should query store products successfully', async () => {
      const products = await getShopifyProducts({ first: 5 });

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(products[0].id).toContain('gid://shopify/Product/');
      expect(products[0].name).toBeDefined();
      expect(products[0].price).toBeGreaterThan(0);
    });

    it('getShopifyProduct should fetch by numeric ID', async () => {
      const product = await getShopifyProduct('7786993614915');

      expect(product).toBeDefined();
      expect(product?.name).toBe('深層修護私密清潔露');
      expect(product?.price).toBe(680);
    });

    it('getShopifyProduct should fetch by GID', async () => {
      const product = await getShopifyProduct('gid://shopify/Product/7786993614915');

      expect(product).toBeDefined();
      expect(product?.name).toBe('深層修護私密清潔露');
    });

    it('getShopifyProduct should fetch by handle', async () => {
      const product = await getShopifyProduct('深層修護私密清潔露');

      expect(product).toBeDefined();
      expect(product?.title).toBe('深層修護私密清潔露');
    });

    it('getShopifyProductsByIds should batch fetch products', async () => {
      const allProducts = await getShopifyProducts({ first: 2 });
      if (allProducts.length >= 2) {
        const products = await getShopifyProductsByIds([
          allProducts[0].id,
          allProducts[1].id,
        ]);
        expect(products.length).toBe(2);
        expect(products[0].id).toBe(allProducts[0].id);
        expect(products[1].id).toBe(allProducts[1].id);
      } else if (allProducts.length === 1) {
        const products = await getShopifyProductsByIds([allProducts[0].id]);
        expect(products.length).toBe(1);
        expect(products[0].id).toBe(allProducts[0].id);
      }
    });

    it('getShopifyProductsByTags should query products by tag or return empty array', async () => {
      const products = await getShopifyProductsByTags(['女性護理', '清潔'], { first: 5 });

      expect(Array.isArray(products)).toBe(true);
    });

    it('getShopifyCollections should fetch store collections', async () => {
      const collections = await getShopifyCollections(5);

      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
      expect(collections[0].title).toBeDefined();
    });

    it('getShopifyCollectionByHandle should fetch collection and its products', async () => {
      const result = await getShopifyCollectionByHandle('frontpage');

      expect(result.collection).toBeDefined();
      expect(result.collection?.handle).toBe('frontpage');
      expect(Array.isArray(result.products)).toBe(true);
    });

    it('getShopifyArticles should return articles or curated fallback', async () => {
      const articles = await getShopifyArticles(5);

      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBeGreaterThan(0);
      expect(articles[0].title).toBeDefined();
    });
  });
});
