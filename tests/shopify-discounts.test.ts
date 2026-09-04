import { describe, it, expect } from 'vitest';

import { mapDiscountNodeToPromotion } from '../api/shopify/discounts.js';

describe('SAENGAK Shopify 折扣轉換純函式測試 (api/shopify/discounts.ts mapDiscountNodeToPromotion)', () => {
  describe('1. 折扣類型判斷 (percentage / fixed_amount / free_shipping) 與分類 (category)', () => {
    it('DiscountCodeBasic 固定金額折扣且代碼以 WELCOME 開頭時，判定為 fixed_amount 與 welcome 分類', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/1',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'WELCOME100' }] },
          customerGets: {
            value: {
              amount: { amount: '100', currencyCode: 'TWD' },
            },
          },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.discount_type).toBe('fixed_amount');
      expect(result!.discount_value).toBe(100);
      expect(result!.category).toBe('welcome');
    });

    it('DiscountCodeBasic 百分比折扣且代碼不含特殊關鍵字時，判定為 percentage 與 discount 分類', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/2',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'SUMMER10' }] },
          customerGets: {
            value: { percentage: 0.15 },
          },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.discount_type).toBe('percentage');
      expect(result!.discount_value).toBe(15);
      expect(result!.category).toBe('discount');
    });

    it('DiscountCodeFreeShipping (無 customerGets 欄位) 時，判定為 free_shipping、全館免運徽章與 shipping 分類', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/3',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'ALLFREE' }] },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.discount_type).toBe('free_shipping');
      expect(result!.badge_text).toBe('全館免運');
      expect(result!.category).toBe('shipping');
    });
  });

  describe('2. 使用量限制文案與欄位 (appliesOncePerCustomer / usageLimit)', () => {
    it('appliesOncePerCustomer 為 true 時，輸出 applies_once_per_customer: true 且說明含「每位顧客限用一次」', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/4',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'ONCEONLY' }] },
          customerGets: { value: { percentage: 0.1 } },
          appliesOncePerCustomer: true,
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.applies_once_per_customer).toBe(true);
      expect(result!.description).toContain('每位顧客限用一次');
    });

    it('appliesOncePerCustomer 為 false 時，輸出 applies_once_per_customer: false 且說明含「不限每人使用次數」', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/5',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'UNLIMITEDUSE' }] },
          customerGets: { value: { percentage: 0.1 } },
          appliesOncePerCustomer: false,
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.applies_once_per_customer).toBe(false);
      expect(result!.description).toContain('不限每人使用次數');
    });

    it('usageLimit 為 100 時，輸出 usage_limit: 100 且說明含「全店總限量 100 組」', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/6',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'LIMITED100' }] },
          customerGets: { value: { percentage: 0.1 } },
          usageLimit: 100,
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.usage_limit).toBe(100);
      expect(result!.description).toContain('全店總限量 100 組');
    });

    it('usageLimit 為 null 時，輸出 usage_limit: null 且說明不含「全店總限量」字樣', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/7',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'NOLIMIT' }] },
          customerGets: { value: { percentage: 0.1 } },
          usageLimit: null,
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.usage_limit).toBeNull();
      expect(result!.description).not.toContain('全店總限量');
    });
  });

  describe('3. 併用規則 (combinesWith) 文案與欄位', () => {
    it('combinesWith 全為 false 時，說明含「不可與其他折扣併用」且 combines_with 三欄位皆為 false', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/8',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'SOLO10' }] },
          customerGets: { value: { percentage: 0.1 } },
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: false,
          },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.description).toContain('不可與其他折扣併用');
      expect(result!.combines_with).toEqual({
        order_discounts: false,
        product_discounts: false,
        shipping_discounts: false,
      });
    });

    it('combinesWith.shippingDiscounts 為 true 時，說明含「運費優惠」且 combines_with.shipping_discounts 為 true', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/9',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'COMBOSHIP' }] },
          customerGets: { value: { percentage: 0.1 } },
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: true,
          },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.description).toContain('運費優惠');
      expect(result!.combines_with.shipping_discounts).toBe(true);
    });
  });

  describe('4. 後台自訂元欄位覆蓋 (metafieldTag / metafieldImage)', () => {
    it('設定 metafieldTag.value 時，badge_text 改用自訂標籤覆蓋自動推導值', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/10',
        metafieldTag: { value: '自訂標籤' },
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'TAGGED10' }] },
          customerGets: { value: { percentage: 0.1 } },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.badge_text).toBe('自訂標籤');
    });

    it('設定 metafieldImage.reference.image.url 時，image_url 改用後台上傳圖片網址', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/11',
        metafieldImage: {
          reference: {
            image: { url: 'https://example.test/custom.jpg' },
          },
        },
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'IMAGED10' }] },
          customerGets: { value: { percentage: 0.1 } },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.image_url).toBe('https://example.test/custom.jpg');
    });
  });

  describe('5. 邊界情況：查無代碼與購買門檻型態', () => {
    it('codes.nodes 為空陣列 (查無代碼) 時，函式回傳 undefined', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/12',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [] },
          customerGets: { value: { percentage: 0.1 } },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeUndefined();
    });

    it('minimumRequirement 為 greaterThanOrEqualToQuantity 而非 subtotal 時，輸出對應的 min_quantity 與 min_spend: 0', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/13',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'QTY5PLUS' }] },
          customerGets: { value: { percentage: 0.1 } },
          minimumRequirement: {
            greaterThanOrEqualToQuantity: 5,
          },
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.min_quantity).toBe(5);
      expect(result!.min_spend).toBe(0);
      expect(result!.description).toContain('滿 5 件');
    });
  });
});
