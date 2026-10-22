import { beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),validate:vi.fn(),verify:vi.fn(),graphql:vi.fn(),policy:vi.fn()}));
vi.mock('../api/_lib/cod-collection.js',()=>({readCollectionOrder:m.read,validateCollectionOrder:m.validate,
  verifyCollectionBeforeIssue:m.verify,collectionGraphql:m.graphql,collectionPolicy:()=>({}),requireCollectionPolicy:m.policy}));
import { collectCodOrder } from '../api/_lib/cod-collection-runner.js';
let rpc:ReturnType<typeof vi.fn>;
const gid='gid://shopify/Order/123';
beforeEach(()=>{
  vi.resetAllMocks(); vi.stubEnv('COD_COLLECTION_ENABLED','true');vi.stubEnv('COD_COLLECTION_PAYMENT_ENABLED','true');
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Network disabled')));
  m.read.mockResolvedValue({displayFinancialStatus:'PENDING'});m.validate.mockReturnValue({fingerprint:'fixed'});
  m.verify.mockResolvedValue(undefined);
  m.graphql.mockResolvedValue({orderMarkAsPaid:{order:{id:gid,displayFinancialStatus:'PAID'},userErrors:[]}});
  rpc=vi.fn(async(name:string)=>({error:null,data:name==='get_cod_collection_work'?{enabled:true,managed:true,snapshot:{}}:name==='claim_cod_payment_projection'?'lease':null}));
});
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('collection invoice and payment stages',()=>{
  it('default off touches no storage or network',async()=>{vi.stubEnv('COD_COLLECTION_ENABLED','false');expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:false});expect(rpc).not.toHaveBeenCalled();});
  it('disabled DB policy cannot enqueue',async()=>{rpc.mockResolvedValue({data:{enabled:false,managed:true}});expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:false});expect(m.read).not.toHaveBeenCalled();});
  it('unverified mapping blocks every mutation',async()=>{m.policy.mockImplementation(()=>{throw new Error('COD_COLLECTION_MAPPING_UNVERIFIED');});expect(await collectCodOrder({rpc},gid)).toMatchObject({invoiceReady:false,error:'COD_COLLECTION_MAPPING_UNVERIFIED'});expect(m.graphql).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledWith('finish_cod_collection_check',expect.objectContaining({p_revoke:false}));});
  it('source outage schedules retry without revoking prior valid evidence',async()=>{m.read.mockRejectedValue(new Error('network private error'));expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:false,error:'COD_COLLECTION_SOURCE_UNAVAILABLE'});expect(rpc).toHaveBeenCalledWith('finish_cod_collection_check',expect.objectContaining({p_revoke:false}));});
  it('not delivered cannot enqueue or mark paid',async()=>{m.validate.mockImplementation(()=>{throw new Error('COD_COLLECTION_NOT_DELIVERED');});expect(await collectCodOrder({rpc},gid)).toMatchObject({invoiceReady:false});expect(rpc.mock.calls.some(c=>c[0]==='record_cod_collection')).toBe(false);expect(m.graphql).not.toHaveBeenCalled();});
  it('keeps durable invoice work when payment times out',async()=>{m.graphql.mockRejectedValue(new Error('timeout'));expect(await collectCodOrder({rpc},gid)).toMatchObject({invoiceReady:true,error:'COD_COLLECTION_SOURCE_UNAVAILABLE'});expect(rpc).toHaveBeenCalledWith('complete_cod_payment_projection',{p_order_gid:gid,p_lease:'lease',p_success:false,p_error:'COD_COLLECTION_SOURCE_UNAVAILABLE'});});
  it('paid readback after timeout avoids repeating orderMarkAsPaid',async()=>{m.read.mockResolvedValue({displayFinancialStatus:'PAID'});expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:true});expect(m.graphql).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledWith('complete_cod_payment_projection',expect.objectContaining({p_success:true}));});
  it('successful mutation must be confirmed with fresh paid readback',async()=>{m.read.mockResolvedValueOnce({displayFinancialStatus:'PENDING'}).mockResolvedValueOnce({displayFinancialStatus:'PENDING'}).mockResolvedValueOnce({displayFinancialStatus:'PAID'});expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:true});expect(m.graphql).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('authorize_cod_payment_projection',{p_order_gid:gid,p_lease:'lease'});});
  it('mutation response alone cannot claim payment synchronized',async()=>{expect(await collectCodOrder({rpc},gid)).toMatchObject({invoiceReady:true,error:'COD_COLLECTION_PAYMENT_UNCONFIRMED'});expect(rpc).toHaveBeenCalledWith('complete_cod_payment_projection',expect.objectContaining({p_success:false}));});
  it('lease contention leaves independent invoice available',async()=>{const fn=rpc.getMockImplementation() as (n:string)=>Promise<unknown>;rpc.mockImplementation(async n=>n==='claim_cod_payment_projection'?{data:null,error:null}:fn(n));expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:true});expect(m.graphql).not.toHaveBeenCalled();});
  it('a local correction after remote read blocks payment mutation',async()=>{const fn=rpc.getMockImplementation() as (n:string)=>Promise<unknown>;rpc.mockImplementation(async n=>n==='authorize_cod_payment_projection'?{error:{message:'correction'}}:fn(n));expect(await collectCodOrder({rpc},gid)).toMatchObject({error:'COD_COLLECTION_REVIEW_REQUIRED'});expect(m.graphql).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledWith('finish_cod_collection_check',expect.objectContaining({p_revoke:true}));});
  it('does not lose evidence when payment automation is separately off',async()=>{vi.stubEnv('COD_COLLECTION_PAYMENT_ENABLED','false');expect(await collectCodOrder({rpc},gid)).toEqual({invoiceReady:true});expect(m.graphql).not.toHaveBeenCalled();expect(rpc.mock.calls.some(c=>c[0]==='claim_cod_payment_projection')).toBe(false);});
});
