import { describe, expect, it } from 'vitest';
import {
  CARE_PILLARS,
  SUBCATEGORY_DESCRIPTIONS,
  belongsToCarePillar,
  classifyCarePillar,
  findCarePillarByName,
  isPeriodCareProduct,
  matchesCareSubcategory,
  resolveCategoryLink,
  resolveCategoryName,
} from '../src/content/carePillars';

describe('LUCISSI CARE 照護入口', () => {
  it('導覽收斂為私密保養、舒適內搭與生理期照護', () => {
    expect(CARE_PILLARS.map((pillar) => pillar.name)).toEqual(['私密保養', '舒適內搭', '生理期照護']);
  });

  it('舊分類網址仍可使用，並預選對應子分類', () => {
    expect(resolveCategoryName('私密護理')).toBe('私密保養');
    expect(resolveCategoryName('貼身穿著')).toBe('舒適內搭');
    expect(resolveCategoryName('舒適穿著')).toBe('舒適內搭');
    expect(resolveCategoryLink('身體保養')).toEqual({ category: '私密保養', subcategory: '除毛與修整' });
    expect(resolveCategoryLink('輕盈運動')).toEqual({ category: '舒適內搭', subcategory: '運動時穿著' });
    expect(resolveCategoryLink('肌膚保養')).toEqual({ category: '', subcategory: '' });
    expect(resolveCategoryName('每日清潔')).toBe('每日清潔');
    expect(findCarePillarByName('身體保養')?.id).toBe('intimate');
    expect(findCarePillarByName('肌膚保養')).toBeUndefined();
    expect(findCarePillarByName('')).toBeUndefined();
  });

  it('依現有商品名稱與 productType 歸到正確核心面向', () => {
    expect(classifyCarePillar({ name: 'Saengak 平衡調理私密潔淨慕斯', productType: '每日清潔' })).toBe('intimate');
    expect(classifyCarePillar({ name: 'Saengak 益生菌私密舒緩凝膠', productType: '女性護理' })).toBe('intimate');
    expect(classifyCarePillar({ name: '親膚安全私密除毛刀', productType: '每日清潔' })).toBe('intimate');
    expect(classifyCarePillar({ name: '精緻內著專用清洗護衣袋', productType: '每日清潔' })).toBe('comfort');
    expect(classifyCarePillar({ name: '涼感冰絲無痕內褲', productType: '舒適穿著' })).toBe('comfort');
    expect(classifyCarePillar({ name: '乾爽透氣運動內衣', productType: '舒適穿著' })).toBe('comfort');
    expect(classifyCarePillar({ name: '涼感冰絲無痕內褲', productType: '舒適穿著', tags: ['運動時穿著'] })).toBe('comfort');
    expect(classifyCarePillar({ name: '保濕面膜', productType: '' })).toBeUndefined();
    expect(classifyCarePillar({ name: '未分類商品' })).toBeUndefined();
  });

  it('一般凝膠不歸私密保養，面向名稱的 productType 直接採用', () => {
    expect(classifyCarePillar({ name: '蘆薈保濕凝膠', productType: '' })).toBeUndefined();
    expect(classifyCarePillar({ name: '蘆薈保濕凝膠', tags: ['私密護理'] })).toBe('intimate');
    expect(classifyCarePillar({ name: '日常保濕精華', productType: '身體保養' })).toBe('intimate');
    expect(classifyCarePillar({ name: '日常保濕精華', productType: '私密保養' })).toBe('intimate');
    expect(classifyCarePillar({ name: '日常伸展帶', productType: '輕盈運動' })).toBe('comfort');
  });

  it('生理期照護跨分類收錄生理褲、私密濕巾與凝膠、清洗配件', () => {
    expect(isPeriodCareProduct({ name: '純棉高腰防漏生理褲', productType: '舒適穿著' })).toBe(true);
    expect(isPeriodCareProduct({ name: 'Saengak 益生菌私密養膚濕巾', productType: '每日清潔' })).toBe(true);
    expect(isPeriodCareProduct({ name: 'Saengak 益生菌私密舒緩凝膠', productType: '女性護理' })).toBe(true);
    expect(isPeriodCareProduct({ name: '精緻內著專用清洗護衣袋', productType: '每日清潔' })).toBe(true);
    expect(isPeriodCareProduct({ name: '日常好物', tags: ['生理期'] })).toBe(true);
    expect(isPeriodCareProduct({ name: '涼感冰絲無痕內褲', productType: '舒適穿著' })).toBe(false);
    expect(isPeriodCareProduct({ name: 'Saengak 平衡調理私密潔淨慕斯', productType: '每日清潔' })).toBe(false);
    expect(isPeriodCareProduct({ name: '親膚安全私密除毛刀', productType: '每日清潔' })).toBe(false);
    expect(belongsToCarePillar({ name: '純棉高腰防漏生理褲', productType: '舒適穿著' }, 'comfort')).toBe(true);
    expect(belongsToCarePillar({ name: '純棉高腰防漏生理褲', productType: '舒適穿著' }, 'period')).toBe(true);
  });

  it('子分類只挑出對應商品', () => {
    expect(matchesCareSubcategory({ name: '涼感冰絲無痕內褲' }, '無痕內褲')).toBe(true);
    expect(matchesCareSubcategory({ name: '純棉高腰防漏生理褲' }, '純棉內褲')).toBe(false);
    expect(matchesCareSubcategory({ name: '純棉高腰防漏生理褲' }, '生理褲')).toBe(true);
    expect(matchesCareSubcategory({ name: '精緻內著專用清洗護衣袋' }, '內搭配件')).toBe(true);
    expect(matchesCareSubcategory({ name: '乾爽透氣運動內衣' }, '運動時穿著')).toBe(true);
    expect(matchesCareSubcategory({ name: '親膚安全私密除毛刀' }, '除毛與修整')).toBe(true);
  });

  it('入口與子分類文案不含未佐證宣稱', () => {
    const copy = [
      ...CARE_PILLARS.flatMap((pillar) => [pillar.title, pillar.description, pillar.teaser]),
      ...Object.values(SUBCATEGORY_DESCRIPTIONS),
    ].join('\n');
    for (const claim of ['專利', '沙龍級', '頂級', '權威', '長效', '最受歡迎', '治療', '改善']) {
      expect(copy).not.toContain(claim);
    }
  });
});
