import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_SHIPPING_THRESHOLD } from './shipping';
import { DEFAULT_PROMOTIONS } from '../lib/promotions';

describe('free shipping threshold', () => {
  it('matches the LUCISSI parent site threshold of NT$1,500', () => {
    expect(DEFAULT_FREE_SHIPPING_THRESHOLD).toBe(1500);
  });

  it('keeps the FREESHIP fallback promotion on the same threshold', () => {
    const freeShip = DEFAULT_PROMOTIONS.find((promotion) => promotion.code === 'FREESHIP');
    expect(freeShip?.min_spend).toBe(DEFAULT_FREE_SHIPPING_THRESHOLD);
    expect(freeShip?.title).not.toMatch(/春|夏|秋|冬/);
    expect(freeShip?.description).toContain('NT$ 1,500');
  });
});
