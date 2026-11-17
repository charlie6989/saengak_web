import { cheapestHomeFee, resolveShippingMethods } from './shippingMethods.js';

/**
 * 結構化資料（Product JSON-LD 的 shippingDetails）標示的單件宅配運費，伺服器 head 與商品頁共用。
 * 達免運門檻為 0，否則為最便宜的宅配運費（比照 LUCISSI：順豐宅配 NT$130）；超商取貨不是送到地址，不列入。
 * 用程式預設值（src/domain/shippingMethods.ts）；正式運費或門檻改變時改那裡。
 */
export function structuredDataShippingRate(price: number): number {
  const methods = resolveShippingMethods();
  return price >= methods.freeShippingThreshold ? 0 : cheapestHomeFee(methods);
}
