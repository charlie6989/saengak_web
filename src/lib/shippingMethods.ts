import { useEffect, useState } from 'react';
import { resolveShippingMethods, type ShippingMethods } from '../domain/shippingMethods';
import { fetchShippingSettings } from './promotions';
import { fetchStorePickupSettings } from './pickupPoints';

/**
 * 頁面共用的配送方式與運費：免運門檻與黑貓宅配運費來自 /api/shopify/discounts 的 siteSettings，
 * 超商取貨開關、超商與順豐宅配運費來自公開 site_settings。讀取前先用程式預設值。
 *
 * @param assumePickupEnabled 讀取前是否先當作超商取貨已開放（說明頁用 true，避免先顯示少了超商的文字）
 */
export function useShippingMethods(assumePickupEnabled = false): ShippingMethods {
  const [methods, setMethods] = useState<ShippingMethods>(() => resolveShippingMethods({ pickupEnabled: assumePickupEnabled }));

  useEffect(() => {
    let active = true;
    void Promise.all([fetchShippingSettings(), fetchStorePickupSettings()]).then(([shipping, pickup]) => {
      if (!active) return;
      setMethods(resolveShippingMethods({
        freeShippingThreshold: shipping.freeShippingThreshold,
        defaultShippingFee: shipping.defaultShippingFee,
        sfHomeShippingFee: pickup.sfHomeShippingFee,
        pickupShippingFee: pickup.shippingFee,
        pickupEnabled: pickup.enabled,
      }));
    });
    return () => { active = false; };
  }, []);

  return methods;
}
