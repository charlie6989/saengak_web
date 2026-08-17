import { describe, it, expect } from 'vitest';
import { COMMON_TAGS, TAG_COMBINATIONS } from '../src/hooks/useShopifyTags';

describe('Shopify Hooks & Tag Configurations', () => {
  it('should define essential common tags and categories', () => {
    expect(COMMON_TAGS.FEMININE_CARE).toBe('女性護理');
    expect(COMMON_TAGS.DAILY_CLEAN).toBe('每日清潔');
    expect(COMMON_TAGS.DEEP_REPAIR).toBe('深層修護');
    expect(COMMON_TAGS.UNDERWEAR).toBe('內褲');
    expect(COMMON_TAGS.PERIOD_CARE).toBe('生理期護理');
    expect(COMMON_TAGS.ANTIBACTERIAL).toBe('抗菌');
    expect(COMMON_TAGS.SEAMLESS).toBe('無痕');
    expect(COMMON_TAGS.BESTSELLER).toBe('熱銷');
  });

  it('should define tag combinations for navigation and discovery', () => {
    expect(TAG_COMBINATIONS.FEMININE_PRODUCTS).toContain(COMMON_TAGS.FEMININE_CARE);
    expect(TAG_COMBINATIONS.UNDERWEAR_PRODUCTS).toContain(COMMON_TAGS.SEAMLESS);
    expect(TAG_COMBINATIONS.SPECIAL_CARE).toContain(COMMON_TAGS.PERIOD_CARE);
  });
});
