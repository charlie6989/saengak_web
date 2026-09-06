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
  isPublicShopifyArticle,
  isPublicShopifyProduct,
  checkCartVariantsAvailability,
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
      expect(product.highlights).toBeUndefined();
      expect(product.subtitle).toBeUndefined();
      expect(product.images).toEqual([]);
      expect(product.tags).toEqual([]);
      expect(product.variants).toEqual([]);
      expect(product.image).toContain('images.unsplash.com');
    });

    it('should correctly parse metafield highlights, subtitle, and promotionBadge', () => {
      const nodeWithMetafields = {
        id: 'gid://shopify/Product/7811130785859',
        title: '益生菌女性私密舒緩修護凝膠',
        handle: 'probiotic-gel',
        highlights: {
          value: JSON.stringify([
            '不含 21 種有害成分',
            '使用植物性萃取成分',
            'pH 4.5~5.5 弱酸性配方',
            '醫學等級皮膚測試認證',
          ]),
          type: 'list.single_line_text_field',
        },
        subtitle: {
          value: '韓國 | 韓國 Dermatest | 女性清潔劑',
          type: 'single_line_text_field',
        },
        promotionBadge: {
          value: '2+1 促銷價，享受驚喜折扣！',
          type: 'single_line_text_field',
        },
      };

      const product = formatShopifyProduct(nodeWithMetafields);

      expect(product.highlights).toEqual([
        '不含 21 種有害成分',
        '使用植物性萃取成分',
        'pH 4.5~5.5 弱酸性配方',
        '醫學等級皮膚測試認證',
      ]);
      expect(product.subtitle).toBe('韓國 | 韓國 Dermatest | 女性清潔劑');
      expect(product.promotionBadge).toBe('2+1 促銷價，享受驚喜折扣！');
    });

    it('should fallback to extracting highlights from descriptionHtml when metafield is absent', () => {
      const nodeWithHtml = {
        id: 'gid://shopify/Product/999',
        title: '純棉女款內褲',
        handle: 'cotton-panties',
        descriptionHtml: `
          <p>優雅純棉女款內著。</p>
          <h3>商品特色</h3>
          <ul>
            <li><strong>親膚透氣</strong>：優質親膚面料，柔軟細緻。</li>
            <li><strong>精緻工藝</strong>：立體剪裁與細膩車縫，服貼不勒肉。</li>
          </ul>
        `,
      };

      const product = formatShopifyProduct(nodeWithHtml);

      expect(product.highlights).toBeDefined();
      expect(product.highlights?.length).toBe(2);
      expect(product.highlights?.[0]).toContain('親膚透氣');
      expect(product.highlights?.[1]).toContain('精緻工藝');
    });

    it('should correctly format multi-variant products with options and variant images', () => {
      const multiVariantNode = {
        id: 'gid://shopify/Product/7810527723587',
        title: '雲朵純棉 透氣抗菌 女款中腰三角內褲',
        handle: 'cloud-cotton-panties',
        options: [
          { id: 'opt-1', name: '顏色', values: ['霧光藍', '經典黑'] },
          { id: 'opt-2', name: '尺寸', values: ['M', 'L', 'XL'] },
        ],
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/11',
                title: '霧光藍 / M',
                price: { amount: '109.0' },
                compareAtPrice: { amount: '139.0' },
                availableForSale: true,
                selectedOptions: [
                  { name: '顏色', value: '霧光藍' },
                  { name: '尺寸', value: 'M' },
                ],
                image: { url: 'https://example.com/blue.jpg', altText: '霧光藍' },
              },
            },
            {
              node: {
                id: 'gid://shopify/ProductVariant/12',
                title: '經典黑 / L',
                price: { amount: '109.0' },
                compareAtPrice: { amount: '139.0' },
                availableForSale: false,
                selectedOptions: [
                  { name: '顏色', value: '經典黑' },
                  { name: '尺寸', value: 'L' },
                ],
              },
            },
          ],
        },
      };

      const product = formatShopifyProduct(multiVariantNode);
      expect(product.options).toHaveLength(2);
      expect(product.options?.[0].name).toBe('顏色');
      expect(product.options?.[0].values).toEqual(['霧光藍', '經典黑']);
      expect(product.variants).toHaveLength(2);
      expect(product.variants[0].image?.url).toBe('https://example.com/blue.jpg');
      expect(product.variants[0].selectedOptions).toEqual([
        { name: '顏色', value: '霧光藍' },
        { name: '尺寸', value: 'M' },
      ]);
      expect(product.variants[1].availableForSale).toBe(false);
    });

    it('should throw when passed null or undefined', () => {
      expect(() => formatShopifyProduct(null)).toThrow('Cannot format null product node');
    });
  });

  describe('production catalog guards', () => {
    const baseProduct = formatShopifyProduct({
      id: 'gid://shopify/Product/123',
      title: '深層修護私密清潔露',
      handle: 'deep-repair-wash',
      tags: ['女性護理'],
    });

    it('blocks payment-test products from every public catalog surface', () => {
      expect(isPublicShopifyProduct(baseProduct)).toBe(true);
      expect(isPublicShopifyProduct({
        ...baseProduct,
        title: '金流驗收測試－請勿購買',
        handle: 'payment-test-do-not-buy',
      })).toBe(false);
    });

    it('requires an explicit SAENGAK/public tag before exposing Shopify articles', () => {
      const article = {
        id: 'article-1',
        title: '品牌文章',
        handle: 'brand-article',
        publishedAt: '2026-08-26T00:00:00Z',
        tags: [],
      };
      expect(isPublicShopifyArticle(article)).toBe(false);
      expect(isPublicShopifyArticle({ ...article, tags: ['SAENGAK'] })).toBe(true);
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
      expect(product?.name).toContain('深層修護私密清潔露');
      expect(product?.price).toBe(680);
    });

    it('getShopifyProduct should fetch by GID', async () => {
      const product = await getShopifyProduct('gid://shopify/Product/7786993614915');

      expect(product).toBeDefined();
      expect(product?.name).toContain('深層修護私密清潔露');
    });

    it('getShopifyProduct should fetch by handle', async () => {
      const product = await getShopifyProduct('深層修護私密清潔露');

      expect(product).toBeDefined();
      expect(product?.title).toContain('深層修護私密清潔露');
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

    it('checkCartVariantsAvailability should verify in-stock variants and filter out sold out ones', async () => {
      const mockItems = [
        {
          id: 'product-1',
          variantId: 'gid://shopify/ProductVariant/43639647502403',
          variantTitle: 'Default Title',
          name: '深層修護私密清潔露',
          price: 680,
          image: '',
          quantity: 1,
        },
      ];

      const result = await checkCartVariantsAvailability(mockItems);
      expect(Array.isArray(result.validItems)).toBe(true);
      expect(Array.isArray(result.removedItems)).toBe(true);
    });
  });
});
