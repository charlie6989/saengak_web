import { describe, expect, it } from 'vitest';
import { isSealedCareProduct } from '../src/domain/returnPolicy';

describe('sealed care products', () => {
  it.each([
    'Saengak 益生菌私密養膚濕巾',
    'MEDION 乳酸菌私密保濕凝膠',
    'Saengak 平衡調理私密潔淨慕斯',
    'Saengak 私密雙層修護精華噴霧',
    'Saengak 全效微生態修護組',
    'Saengak 潔淨調理舒緩組',
    'Saengak 益生菌舒緩養膚組',
  ])('%s shows the sealed notice', (name) => {
    expect(isSealedCareProduct(name)).toBe(true);
  });

  it.each(['冰絲無痕平口安全褲', '乾爽透氣運動內衣', '親膚安全私密除毛刀', '精緻內著專用清洗護衣袋', '絨面收納包', null])(
    '%s does not',
    (name) => {
      expect(isSealedCareProduct(name)).toBe(false);
    },
  );
});
