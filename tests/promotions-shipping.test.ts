import { describe, it, expect } from 'vitest';

import { computePostDiscountShippingWarning } from '../src/lib/promotions';

describe('SAENGAK 折扣後免運門檻警示純函式測試 (src/lib/promotions.ts computePostDiscountShippingWarning)', () => {
  it('折扣前後皆達免運門檻時，willLoseFreeShipping 為 false', () => {
    const result = computePostDiscountShippingWarning(2000, 100, 1500);
    expect(result.willLoseFreeShipping).toBe(false);
    expect(result.amountStillNeeded).toBe(0);
  });

  it('折扣前達門檻、折扣後跌破門檻時，willLoseFreeShipping 為 true 且正確計算還差金額', () => {
    const result = computePostDiscountShippingWarning(1600, 200, 1500);
    expect(result.willLoseFreeShipping).toBe(true);
    expect(result.amountStillNeeded).toBe(100); // 1500 - (1600 - 200) = 100
  });

  it('折扣前本來就沒有達到免運門檻時，willLoseFreeShipping 為 false（本來就沒有免運可失去）', () => {
    const result = computePostDiscountShippingWarning(1000, 50, 1500);
    expect(result.willLoseFreeShipping).toBe(false);
    expect(result.amountStillNeeded).toBe(550); // 1500 - (1000 - 50) = 550
  });

  it('未套用折扣碼 (discountAmount 為 0) 時，willLoseFreeShipping 為 false', () => {
    const result = computePostDiscountShippingWarning(2000, 0, 1500);
    expect(result.willLoseFreeShipping).toBe(false);
    expect(result.amountStillNeeded).toBe(0);
  });

  it('折扣後金額恰好等於門檻時，仍視為符合免運 (willLoseFreeShipping 為 false)', () => {
    const result = computePostDiscountShippingWarning(1600, 100, 1500);
    expect(result.willLoseFreeShipping).toBe(false);
    expect(result.amountStillNeeded).toBe(0);
  });
});
