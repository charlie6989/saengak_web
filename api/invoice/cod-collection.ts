import { getSupabaseAdminClient } from '../_lib/supabase-admin.js';
import { jsonResponse, timingSafeStringEqual } from '../_lib/security.js';
import { collectCodOrder } from '../_lib/cod-collection-runner.js';
import { requireCollectionPolicy } from '../_lib/cod-collection.js';
import invoiceWorker from './guangmao.js';

export const maxDuration = 60;
export const GET = handler;
export const POST = handler;
export default { fetch: handler };
async function handler(request: Request): Promise<Response> {
  if (!['GET','POST'].includes(request.method)) return jsonResponse({ error:'METHOD_NOT_ALLOWED' },{status:405});
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i,'') ?? '';
  if (!token || ![process.env.CRON_SECRET,process.env.AmegoDispatchToken].filter(Boolean)
    .some(secret => timingSafeStringEqual(token,secret!))) return jsonResponse({error:'UNAUTHORIZED'},{status:401});
  if (process.env.COD_COLLECTION_ENABLED !== 'true') return jsonResponse({error:'COD_COLLECTION_DISABLED'},{status:503});
  try { requireCollectionPolicy(); } catch { return jsonResponse({error:'COD_COLLECTION_MAPPING_UNVERIFIED'},{status:503}); }
  const db = getSupabaseAdminClient();
  if (!db) return jsonResponse({error:'STORAGE_UNAVAILABLE'},{status:503});
  const results = [];
  const start = Date.now();
  try {
    for (let n=0; n<10 && Date.now()-start<20000; n++) {
      const claimed = await db.rpc('claim_cod_collection_check');
      if (claimed.error) throw new Error('STORAGE_UNAVAILABLE');
      if (!claimed.data) break;
      const result = await collectCodOrder(db,claimed.data);
      let invoiceDispatched = false;
      if (result.invoiceReady && process.env.AmegoInvoiceReleaseEnabled === 'true') {
        const dispatched = await invoiceWorker.fetch(new Request('https://lucissicare.com/api/invoice/guangmao', {
          method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
          body:JSON.stringify({shopifyOrderGid:claimed.data}),
        }));
        invoiceDispatched = dispatched.ok;
      }
      results.push({orderGid:claimed.data,...result,invoiceDispatched});
    }
    return jsonResponse({ok:true,results});
  } catch { return jsonResponse({error:'COD_COLLECTION_STORAGE_UNAVAILABLE'},{status:503}); }
}
