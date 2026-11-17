import { DEFAULT_FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from './shipping.js';

/**
 * 結構化資料（Product JSON-LD 的 shippingDetails）標示的單件宅配運費，伺服器 head 與商品頁共用。
 * 達免運門檻為 0，否則為最便宜的宅配運費；超商取貨不是送到地址，不列入。
 * 目前用程式預設值；正式運費或門檻改變時只改這一個函式。
 */
export function structuredDataShippingRate(price: number): number {
  return price >= DEFAULT_FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
}
