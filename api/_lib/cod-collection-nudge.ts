import { collectCodOrder } from './cod-collection-runner.js';
import invoiceWorker from '../invoice/guangmao.js';

/** The webhook is acknowledged only after durable receipt; this is a best-effort
 * fast path. The authenticated collector and its schedule recover interruptions. */
export async function nudgeCodCollection(db: any, gid: string): Promise<void> {
  if (process.env.COD_COLLECTION_ENABLED !== 'true') return;
  try {
    const result = await collectCodOrder(db, gid);
    const token = process.env.AmegoDispatchToken || process.env.CRON_SECRET;
    if (result.invoiceReady && token && process.env.AmegoInvoiceReleaseEnabled === 'true') {
      await invoiceWorker.fetch(new Request('https://lucissicare.com/api/invoice/guangmao', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ shopifyOrderGid: gid }),
      }));
    }
  } catch { console.error('COD_COLLECTION_BACKGROUND_RETRY_REQUIRED'); }
}
