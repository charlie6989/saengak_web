import { createHmac } from 'node:crypto';
import { beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({db:vi.fn(),nudge:vi.fn(),wait:vi.fn()}));
vi.mock('../api/_lib/supabase-admin.js',()=>({getSupabaseAdminClient:m.db}));
vi.mock('../api/_lib/cod-collection-nudge.js',()=>({nudgeCodCollection:m.nudge}));
vi.mock('@vercel/functions',()=>({waitUntil:m.wait}));
import webhook from '../api/webhooks/shopify.js';
const payload={id:321,order_id:123,fulfillment_id:456,status:'delivered'};
function request(value:unknown=payload,headers:Record<string,string>={}) {
  const raw=JSON.stringify(value);
  return new Request('https://lucissicare.com/api/webhooks/shopify',{method:'POST',body:raw,headers:{
    'x-shopify-topic':'fulfillment_events/create','x-shopify-shop-domain':'gh2xgs-zf.myshopify.com','x-shopify-webhook-id':'fixture-event-1',
    'x-shopify-hmac-sha256':createHmac('sha256','test-secret').update(raw).digest('base64'),...headers}});
}
let rpc:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('SHOPIFY_WEBHOOK_SECRET','test-secret');vi.stubEnv('COD_COLLECTION_ENABLED','true');vi.stubEnv('SHOPIFY_STORE_DOMAIN','gh2xgs-zf.myshopify.com');rpc=vi.fn().mockResolvedValue({data:'recorded'});m.db.mockReturnValue({rpc});m.nudge.mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
describe('signed durable fulfillment events',()=>{
  it('persists before starting background readback',async()=>{expect((await webhook.fetch(request())).status).toBe(200);expect(rpc).toHaveBeenCalledExactlyOnceWith('receive_cod_fulfillment_event',{p_order_gid:'gid://shopify/Order/123',p_fulfillment_gid:'gid://shopify/Fulfillment/456',p_event_id:'321',p_status:'delivered',p_deleted:false,p_webhook_id:'fixture-event-1'});expect(m.wait).toHaveBeenCalledTimes(1);expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(m.nudge.mock.invocationCallOrder[0]);});
  it('does not acknowledge storage failure or begin mutations',async()=>{rpc.mockResolvedValue({error:{message:'private error'}});expect((await webhook.fetch(request())).status).toBe(503);expect(m.nudge).not.toHaveBeenCalled();});
  it('accepts withdrawal as a tombstone',async()=>{expect((await webhook.fetch(request(payload,{'x-shopify-topic':'fulfillment_events/delete'}))).status).toBe(200);expect(rpc).toHaveBeenCalledWith('receive_cod_fulfillment_event',expect.objectContaining({p_deleted:true}));});
  it('checks HMAC before DB',async()=>{expect((await webhook.fetch(request(payload,{'x-shopify-hmac-sha256':'invalid'}))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
  it('rejects another shop',async()=>{expect((await webhook.fetch(request(payload,{'x-shopify-shop-domain':'other.myshopify.com'}))).status).toBe(403);expect(rpc).not.toHaveBeenCalled();});
  it.each([null,{}, {...payload,order_id:9007199254740992},{...payload,status:'DELIVERED'},{...payload,fulfillment_id:-1}])('rejects malformed event %j',async value=>{expect((await webhook.fetch(request(value))).status).toBe(422);expect(rpc).not.toHaveBeenCalled();});
  it('limits body size before processing',async()=>{expect((await webhook.fetch(request(payload,{'content-length':'2000000'}))).status).toBe(413);expect(rpc).not.toHaveBeenCalled();});
  it('retains events while collection is disabled',async()=>{vi.stubEnv('COD_COLLECTION_ENABLED','false');expect((await webhook.fetch(request())).status).toBe(200);expect(rpc).toHaveBeenCalledTimes(1);expect(m.nudge).not.toHaveBeenCalled();});
});
