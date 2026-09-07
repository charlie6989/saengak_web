import { describe, it, expect } from 'vitest';
import {
  isNonSaengakOwnBrandProduct,
  resolveDisplayVendor,
  SHOPIFY_PLACEHOLDER_VENDOR,
} from '../src/lib/brandOwnership';

describe('brandOwnership - SAENGAK 品牌歸屬判斷共用模組', () => {
  describe('isNonSaengakOwnBrandProduct 分類判斷', () => {
    it('productType 精確等於「舒適穿著」應判定為非自有品牌', () => {
      expect(isNonSaengakOwnBrandProduct({ productType: '舒適穿著', title: '任意品名' })).toBe(true);
    });

    it('品名命中內褲／生理褲／安全褲等關鍵字應判定為非自有品牌', () => {
      expect(isNonSaengakOwnBrandProduct({ title: '雲朵純棉透氣抗菌女款中腰三角內褲' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '無痕生理褲 M/L' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '女用安全褲 3 件組' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '蕾絲平口褲' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '無鋼圈丁字褲' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ name: '親膚內著套組' })).toBe(true);
    });

    it('品名命中除毛刀／護衣袋／洗衣袋等周邊配件關鍵字應判定為非自有品牌', () => {
      expect(isNonSaengakOwnBrandProduct({ title: '女性私密美體修整除毛刀' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '隨身攜帶型刮毛刀' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '貼身衣物專用護衣袋' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '內衣褲加厚洗衣袋' })).toBe(true);
      expect(isNonSaengakOwnBrandProduct({ title: '旅行用清洗袋' })).toBe(true);
    });

    it('僅標籤命中關鍵字（title/name/productType 皆未命中）在有提供 tags 時也應判定為非自有品牌', () => {
      expect(
        isNonSaengakOwnBrandProduct({ title: '日常好物', tags: ['內褲', '熱銷'] })
      ).toBe(true);
    });

    it('未提供 tags 時，分類判斷僅依據品項名稱／productType，不因缺少 tags 而誤判', () => {
      expect(isNonSaengakOwnBrandProduct({ title: '深層修護私密清潔露' })).toBe(false);
    });

    it('SAENGAK 自有保養品類（清潔露、噴霧、慕斯、濕巾等）應判定為自有品牌', () => {
      expect(isNonSaengakOwnBrandProduct({ title: '深層修護私密清潔露', productType: '清潔露' })).toBe(false);
      expect(isNonSaengakOwnBrandProduct({ title: '私密雙層修護精華噴霧' })).toBe(false);
      expect(isNonSaengakOwnBrandProduct({ title: '平衡調理私密潔淨慕斯' })).toBe(false);
      expect(isNonSaengakOwnBrandProduct({ title: '益生菌私密養膚濕巾' })).toBe(false);
      expect(isNonSaengakOwnBrandProduct({})).toBe(false);
    });
  });

  describe('resolveDisplayVendor 安全解析顯示用品牌名稱', () => {
    describe('內褲／生理褲類商品（非 SAENGAK 自有品牌）', () => {
      it('無 vendor 時絕不可產生 SAENGAK，應回傳空字串', () => {
        const result = resolveDisplayVendor({ title: '純棉女款內褲', vendor: undefined });
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });

      it('vendor 為 Shopify 佔位店名 My Store 7 時絕不可產生 SAENGAK，應回傳空字串', () => {
        const result = resolveDisplayVendor({ title: '無痕生理褲', vendor: SHOPIFY_PLACEHOLDER_VENDOR });
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });

      it('productType 為舒適穿著且 vendor 誤植為 SAENGAK 時，仍絕不可顯示 SAENGAK', () => {
        const result = resolveDisplayVendor({ productType: '舒適穿著', title: '女用安全褲', vendor: 'SAENGAK' });
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });
    });

    describe('除毛刀／護衣袋／洗衣袋類商品（本次新增之關鍵回歸測試）', () => {
      it('除毛刀無 vendor 時絕不可產生 SAENGAK 或韓國等自有品牌歸屬字樣', () => {
        const result = resolveDisplayVendor({ title: '女性私密美體修整除毛刀', vendor: undefined });
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });

      it('護衣袋無 vendor 時絕不可產生 SAENGAK', () => {
        const result = resolveDisplayVendor({ title: '貼身衣物專用護衣袋', vendor: '' });
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });

      it('洗衣袋僅有 Shopify 佔位店名 vendor 時絕不可產生 SAENGAK', () => {
        const result = resolveDisplayVendor({ title: '內衣褲加厚洗衣袋', vendor: SHOPIFY_PLACEHOLDER_VENDOR });
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });

      it('allowSaengakFallbackForOwnBrand 選項對非自有品類無效，仍不得回傳 SAENGAK', () => {
        const result = resolveDisplayVendor(
          { title: '旅行用清洗袋', vendor: undefined },
          { allowSaengakFallbackForOwnBrand: true }
        );
        expect(result).not.toBe('SAENGAK');
        expect(result).toBe('');
      });
    });

    describe('有合法第三方 vendor 的內著／周邊商品', () => {
      it('內褲商品具備合法第三方 vendor 時應正確顯示該 vendor', () => {
        expect(resolveDisplayVendor({ title: '蕾絲三角內褲', vendor: 'LUCISSI' })).toBe('LUCISSI');
      });

      it('除毛刀具備合法第三方 vendor 時應正確顯示該 vendor', () => {
        expect(resolveDisplayVendor({ title: '女性私密美體修整除毛刀', vendor: 'Panasonic' })).toBe('Panasonic');
      });

      it('vendor 前後有多餘空白時應正確裁剪後顯示', () => {
        expect(resolveDisplayVendor({ title: '無痕生理褲', vendor: '  LUCISSI  ' })).toBe('LUCISSI');
      });
    });

    describe('SAENGAK 自有保養品類商品', () => {
      it('無 vendor 時預設允許顯示為 SAENGAK', () => {
        expect(resolveDisplayVendor({ title: '深層修護私密清潔露', vendor: undefined })).toBe('SAENGAK');
      });

      it('vendor 為 Shopify 佔位店名時，預設仍允許 fallback 顯示為 SAENGAK', () => {
        expect(resolveDisplayVendor({ title: '私密雙層修護精華噴霧', vendor: SHOPIFY_PLACEHOLDER_VENDOR })).toBe('SAENGAK');
      });

      it('allowSaengakFallbackForOwnBrand: false 時，無 vendor 應回傳空字串而非 SAENGAK', () => {
        const result = resolveDisplayVendor(
          { title: '益生菌私密養膚濕巾', vendor: undefined },
          { allowSaengakFallbackForOwnBrand: false }
        );
        expect(result).toBe('');
      });

      it('具備真實 vendor（即使就是 SAENGAK 本身）時應原樣顯示，不受 fallback 選項影響', () => {
        expect(resolveDisplayVendor({ title: '平衡調理私密潔淨慕斯', vendor: 'SAENGAK' })).toBe('SAENGAK');
        expect(
          resolveDisplayVendor({ title: '平衡調理私密潔淨慕斯', vendor: 'SAENGAK' }, { allowSaengakFallbackForOwnBrand: false })
        ).toBe('SAENGAK');
      });

      it('具備其他合法 vendor 時應顯示該 vendor 而非強制覆蓋為 SAENGAK', () => {
        expect(resolveDisplayVendor({ title: '深層修護私密清潔露', vendor: 'SAENGAK Korea Inc.' })).toBe('SAENGAK Korea Inc.');
      });
    });
  });
});
