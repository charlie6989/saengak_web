import { describe, expect, it } from 'vitest';
import { applyPromotionCopy, buildPromotionSubtitle, isPublicPromotionCode } from './promotionPresentation';

describe('buildPromotionSubtitle', () => {
  it('describes each discount type in Traditional Chinese', () => {
    expect(buildPromotionSubtitle({ discount_type: 'fixed_amount', discount_value: 100, min_spend: 1500 })).toBe('滿 NT$ 1,500 現折 NT$ 100');
    expect(buildPromotionSubtitle({ discount_type: 'percentage', discount_value: 15, min_spend: 3000 })).toBe('滿 NT$ 3,000 享 85 折');
    expect(buildPromotionSubtitle({ discount_type: 'percentage', discount_value: 30, min_spend: 0 })).toBe('全館享 7 折');
    expect(buildPromotionSubtitle({ discount_type: 'free_shipping', discount_value: 0, min_spend: 1500 })).toBe('黑貓宅配滿 NT$ 1,500 免運費');
    expect(buildPromotionSubtitle({ discount_type: 'fixed_amount', discount_value: 50, min_spend: 0, min_quantity: 2 })).toBe('滿 2 件現折 NT$ 50');
  });
});

describe('promotion visibility', () => {
  it('hides the unapproved seed codes regardless of letter case', () => {
    expect(isPublicPromotionCode('SAVE15')).toBe(false);
    expect(isPublicPromotionCode(' special30 ')).toBe(false);
    expect(isPublicPromotionCode('WELCOME100')).toBe(true);
    expect(isPublicPromotionCode('FREESHIP')).toBe(true);
  });
});

describe('applyPromotionCopy', () => {
  const stale = {
    code: 'FREESHIP',
    title: '過時的季節活動標題',
    subtitle: '滿 NT$ 1,499 享宅配與超商免運',
    discount_type: 'free_shipping' as const,
    discount_value: 0,
    min_spend: 1500,
  };

  it('replaces stale FREESHIP copy with text derived from the live threshold', () => {
    const result = applyPromotionCopy(stale);
    expect(result.title).toBe('滿額免運');
    expect(result.subtitle).toBe('黑貓宅配滿 NT$ 1,500 免運費');
    expect(result.subtitle).not.toContain('超商');
    expect(applyPromotionCopy({ ...stale, badge_text: '全館免運' }).badge_text).toBe('滿額免運');
  });

  it('rewrites an English subtitle left in stored data, whatever the code', () => {
    const result = applyPromotionCopy({
      ...stale,
      code: 'WELCOME100',
      title: '新會員見面禮',
      subtitle: '$100.00 off entire order • Minimum purchase of $1,500.00 • One use per customer',
      discount_type: 'fixed_amount' as const,
      discount_value: 100,
    });
    expect(result.subtitle).toBe('滿 NT$ 1,500 現折 NT$ 100');
    expect(result.title).toBe('新會員見面禮');
  });

  it('removes the internal prefix from stored descriptions', () => {
    const result = applyPromotionCopy({ ...stale, code: 'WELCOME100', subtitle: '自訂副標', description: 'Shopify 官方活動，結帳時直接折抵。' });
    expect(result.description).toBe('結帳時直接折抵。');
    expect(result.subtitle).toBe('自訂副標');
  });

  it('leaves codes without an override untouched', () => {
    const promotion = { ...stale, code: 'WELCOME100', title: '新會員見面禮', subtitle: '自訂副標' };
    expect(applyPromotionCopy(promotion)).toBe(promotion);
  });
});
