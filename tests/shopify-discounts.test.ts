import { describe, it, expect, vi } from 'vitest';

import { mapDiscountNodeToPromotion } from '../api/shopify/discounts.js';

describe('LUCISSI CARE Shopify 折扣轉換純函式測試 (api/shopify/discounts.ts mapDiscountNodeToPromotion)', () => {
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
      expect(result!.is_exhausted).toBe(false);
      expect(result!.description).not.toContain('全店總限量');
    });

    it('asyncUsageCount 大於等於 usageLimit 時，is_exhausted 為 true 且說明含「已全數兌換完畢」', () => {
      const node = {
        id: 'gid://shopify/DiscountCodeNode/7-exhausted',
        codeDiscount: {
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'EXHAUSTED100' }] },
          customerGets: { value: { percentage: 0.1 } },
          usageLimit: 100,
          asyncUsageCount: 100,
        },
      };

      const result = mapDiscountNodeToPromotion(node as any);

      expect(result).toBeDefined();
      expect(result!.is_exhausted).toBe(true);
      expect(result!.description).toContain('已全數兌換完畢');
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

  describe('公開呈現：不顯示 Shopify 英文摘要與過時文案', () => {
    const fixedAmountNode = {
      id: 'gid://shopify/DiscountCodeNode/10',
      codeDiscount: {
        title: '新會員見面禮',
        status: 'ACTIVE',
        summary: '$100.00 off entire order • Minimum purchase of $1,500.00 • One use per customer',
        codes: { nodes: [{ code: 'WELCOME100' }] },
        customerGets: { value: { amount: { amount: '100.0', currencyCode: 'TWD' } } },
        minimumRequirement: { greaterThanOrEqualToSubtotal: { amount: '1500.0' } },
      },
    };

    it('以中文條件取代英文 summary', () => {
      const result = mapDiscountNodeToPromotion(fixedAmountNode as any);
      expect(result!.subtitle).toBe('滿 NT$ 1,500 現折 NT$ 100');
      expect(JSON.stringify(result)).not.toContain('off entire order');
    });

    it('後台自訂的 subtitle metafield 仍優先', () => {
      const result = mapDiscountNodeToPromotion({ ...fixedAmountNode, metafieldSubtitle: { value: '自訂副標' } } as any);
      expect(result!.subtitle).toBe('自訂副標');
    });

    it('FREESHIP 以實際門檻覆寫過時的標題與 metafield', () => {
      const result = mapDiscountNodeToPromotion({
        id: 'gid://shopify/DiscountCodeNode/11',
        metafieldSubtitle: { value: '滿 NT$ 1,499 享宅配與超商免運送到家' },
        codeDiscount: {
          title: '初夏免運專案 - 滿額免運費',
          status: 'ACTIVE',
          codes: { nodes: [{ code: 'FREESHIP' }] },
          minimumRequirement: { greaterThanOrEqualToSubtotal: { amount: '1500.0' } },
        },
      } as any);
      expect(result!.title).toBe('滿額免運');
      expect(result!.subtitle).toBe('黑貓宅配滿 NT$ 1,500 免運費');
      expect(result!.badge_text).toBe('滿額免運');
      expect(JSON.stringify(result)).not.toMatch(/超商|1,499|初夏/);
    });

    it('未核准公開的折扣不能經網站領取', async () => {
      const { fetchShopifyPromotionByCode } = await import('../api/shopify/discounts.js');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(fetchShopifyPromotionByCode('SPECIAL30')).resolves.toBeUndefined();
      await expect(fetchShopifyPromotionByCode('save15')).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('前台備援清單同樣過濾隱藏折扣與已過期活動', async () => {
      const { DEFAULT_PROMOTIONS, toPublicPromotions } = await import('../src/lib/promotions');
      expect(DEFAULT_PROMOTIONS.map((p) => p.code)).toEqual(['WELCOME100', 'FREESHIP']);
      const base = DEFAULT_PROMOTIONS[0];
      const visible = toPublicPromotions([
        { ...base, code: 'SAVE15' },
        { ...base, code: 'EXPIRED', ends_at: '2026-01-01T00:00:00Z' },
        { ...base, code: 'CURRENT', ends_at: '2026-12-31T00:00:00Z' },
      ], new Date('2026-11-07T00:00:00Z'));
      expect(visible.map((p) => p.code)).toEqual(['CURRENT']);
    });
  });

  describe('6. isOriginAllowed 安全檢驗 (同源 GET 放行與跨域惡意阻擋)', () => {
    it('正式與預覽環境不接受本機開發來源', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('https://lucissicare.com/api/shopify/discounts', { method: 'POST' });
      for (const environment of ['production', 'preview']) {
        vi.stubEnv('VERCEL_ENV', environment);
        expect(isOriginAllowed('http://localhost:3000', req)).toBe(false);
        expect(isOriginAllowed('http://127.0.0.1:3000', req)).toBe(false);
        expect(isOriginAllowed('https://lucissicare.com', req)).toBe(true);
      }
      vi.unstubAllEnvs();
    });

    it('本機開發仍可使用本機來源', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('https://lucissicare.com/api/shopify/discounts', { method: 'POST' });
      vi.stubEnv('VERCEL_ENV', 'development');
      expect(isOriginAllowed('http://localhost:3000', req)).toBe(true);
      vi.unstubAllEnvs();
    });

    it('同源 GET 請求缺少 Origin 標頭但 Host 為本機或合法網域時，應放行 (true)', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('http://localhost:3000/api/shopify/discounts', {
        method: 'GET',
        headers: { host: 'localhost:3000' },
      });
      expect(isOriginAllowed(null, req)).toBe(true);
    });

    it('同源請求帶有 Sec-Fetch-Site: same-origin 時，應放行 (true)', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('https://saengak.com.tw/api/shopify/discounts', {
        method: 'GET',
        headers: {
          'sec-fetch-site': 'same-origin',
        },
      });
      expect(isOriginAllowed(null, req)).toBe(true);
    });

    it('合法白名單 Origin 跨域請求應放行 (true)', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('https://saengak.com.tw/api/shopify/discounts', {
        method: 'GET',
        headers: {
          Origin: 'https://saengak.com.tw',
        },
      });
      expect(isOriginAllowed('https://saengak.com.tw', req)).toBe(true);
    });

    it('非授權惡意跨域 Origin 請求必須嚴格拒絕 (false)', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('https://saengak.com.tw/api/shopify/discounts', {
        method: 'GET',
        headers: {
          Origin: 'https://malicious-phishing.com',
        },
      });
      expect(isOriginAllowed('https://malicious-phishing.com', req)).toBe(false);
    });

    it('非授權外站 Referer 請求必須嚴格拒絕 (false)', async () => {
      const { isOriginAllowed } = await import('../api/_lib/security.js');
      const req = new Request('https://saengak.com.tw/api/shopify/discounts', {
        method: 'GET',
        headers: {
          referer: 'https://malicious-phishing.com/attack',
        },
      });
      expect(isOriginAllowed(null, req)).toBe(false);
    });
  });
});
