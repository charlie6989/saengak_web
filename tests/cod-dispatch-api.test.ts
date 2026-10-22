import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('../api/_lib/supabase-admin.js', () => ({ getSupabaseAdminClient: mocks.db }));
import handler from '../api/invoice/cod-dispatch.js';
let rpc: ReturnType<typeof vi.fn>, getUser: ReturnType<typeof vi.fn>;
function request(method='POST', token='fixture', origin='https://lucissicare.com', order='gid://shopify/Order/123') {
  return new Request(`https://lucissicare.com/api/invoice/cod-dispatch?order=${encodeURIComponent(order)}`, {
    method, headers: { authorization:token ? `Bearer ${token}` : '', origin },
  });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('No network')));
  getUser=vi.fn().mockResolvedValue({data:{user:{app_metadata:{role:'admin'}}}});
  rpc=vi.fn().mockResolvedValue({data:{enabled:false,status:'issued',paymentStatus:'pending'}});
  mocks.db.mockReturnValue({auth:{getUser},rpc});
});
afterEach(()=>{ expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
describe('COD read-only admin status',()=>{
  it('requires a token before storage',async()=>{expect((await handler.fetch(request('GET',''))).status).toBe(401);expect(mocks.db).not.toHaveBeenCalled();});
  it('rejects cross-origin access',async()=>{expect((await handler.fetch(request('GET','x','https://evil.test'))).status).toBe(403);expect(rpc).not.toHaveBeenCalled();});
  it('requires server-verified admin',async()=>{getUser.mockResolvedValue({data:{user:{app_metadata:{role:'member'}}}});expect((await handler.fetch(request('GET'))).status).toBe(403);expect(rpc).not.toHaveBeenCalled();});
  it('retires every manual approval or retry POST',async()=>{expect((await handler.fetch(request())).status).toBe(410);expect(rpc).not.toHaveBeenCalled();});
  it('reads progress even when automation is paused',async()=>{expect(await (await handler.fetch(request('GET'))).json()).toEqual({enabled:false,status:'issued',paymentStatus:'pending'});expect(rpc).toHaveBeenCalledExactlyOnceWith('get_cod_dispatch_status',{p_order_gid:'gid://shopify/Order/123'});});
  it('rejects malformed IDs',async()=>{expect((await handler.fetch(request('GET','x','https://lucissicare.com','bad'))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
  it('does not leak storage errors',async()=>{rpc.mockResolvedValue({error:{message:'private details'}});expect(await (await handler.fetch(request('GET'))).json()).toEqual({error:'COD_STORAGE_ERROR'});});
});
