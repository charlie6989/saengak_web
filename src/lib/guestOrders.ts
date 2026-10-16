import { isSupabaseConfigured, supabase } from './supabase';
import { captureExceptionSafe } from './sentry';

// 預期內、不需回報 Sentry 的錯誤：函式尚未部署（PGRST202）、未登入（42501）。
const expectedClaimErrorCodes = new Set(['PGRST202', '42501']);

/**
 * 把同一個已驗證 Email 的訪客訂單併入目前登入的會員（public.claim_guest_orders）。
 * 冪等、可重複呼叫；任何錯誤都只記錄，不阻擋登入或訂單載入。
 * 回傳認領筆數，失敗時回傳 null。
 */
export async function claimGuestOrders(): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('claim_guest_orders');
    if (error) {
      if (!expectedClaimErrorCodes.has(error.code ?? '')) {
        captureExceptionSafe(error, { source: 'claimGuestOrders' });
      }
      return null;
    }
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    captureExceptionSafe(err, { source: 'claimGuestOrders.catch' });
    return null;
  }
}
