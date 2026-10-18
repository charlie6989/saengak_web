import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_SHIPPING_THRESHOLD, computeFreeShippingGap } from './shipping';
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

describe('computeFreeShippingGap', () => {
  it('reports the remaining amount after adding the item', () => {
    expect(computeFreeShippingGap(300, 109, 1500)).toEqual({ status: 'short', remaining: 1091 });
  });

  it('reports free shipping once the added item reaches the threshold', () => {
    expect(computeFreeShippingGap(1400, 109, 1500)).toEqual({ status: 'free-after-add', remaining: 0 });
    expect(computeFreeShippingGap(1391, 109, 1500)).toEqual({ status: 'free-after-add', remaining: 0 });
  });

  it('reports an already free cart regardless of the item', () => {
    expect(computeFreeShippingGap(1500, 0, 1500)).toEqual({ status: 'already-free', remaining: 0 });
  });
});
