import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateCollectionOrder, requireCollectionPolicy } from '../api/_lib/cod-collection.js';
import type { CollectionOrder, CollectionPolicy, CollectionSnapshot } from '../api/_lib/cod-collection.js';
const cash=(amount: string)=>({shopMoney:{amount,currencyCode:'TWD'}});
const conn=<T>(nodes:T[])=>({nodes,pageInfo:{hasNextPage:false}});
export const policy:CollectionPolicy={serviceId:'gid://shopify/FulfillmentService/123',trackingCompany:'Black Cat Fixture',shippingCode:'fixture-cod-ambient',amountMappingVerified:true};
export const snapshot:CollectionSnapshot={orderNumber:'#1',currencyCode:'TWD',totalAmount:826,shippingAmount:146,discountAmount:0,lineItems:[{shopifyLineItemGid:'gid://shopify/LineItem/1',productName:'Fixture',quantity:1,price:'680'}]};
export function order():CollectionOrder { return { id:'gid://shopify/Order/1', updatedAt:'2026-10-22T00:00:00Z',test:false,cancelledAt:null,paymentGatewayNames:['Cash on Delivery (COD)'],displayFinancialStatus:'PENDING',displayFulfillmentStatus:'FULFILLED',currentTotalPriceSet:cash('826.00'),totalOutstandingSet:cash('826'),currentTotalDiscountsSet:cash('0'),totalShippingPriceSet:cash('146'),shippingLines:conn([{code:policy.shippingCode,title:'標準'}]),refunds:[],lineItems:conn([{id:'gid://shopify/LineItem/1',name:'Fixture',quantity:1,currentQuantity:1,requiresShipping:true,originalUnitPriceSet:cash('680')}]),fulfillments:[{id:'gid://shopify/Fulfillment/1',status:'SUCCESS',displayStatus:'DELIVERED',deliveredAt:'2026-10-21T00:00:00Z',service:{id:policy.serviceId},trackingInfo:[{company:policy.trackingCompany,number:'123456789012'}],fulfillmentLineItems:conn([{quantity:1,lineItem:{id:'gid://shopify/LineItem/1'}}])}] }; }
const validate=(o:CollectionOrder)=>validateCollectionOrder(o,snapshot,policy,'gh2xgs-zf.myshopify.com');
afterEach(()=>vi.useRealTimers());
describe('ShipAny whole-order COD collection evidence',()=>{
  it('records explicit contract inference and a stable identity across paid projection',()=>{const a=order(),e=validate(a);expect(e).toMatchObject({amountBasis:'contract_inferred',amount:826,trackingNumber:'123456789012'});a.displayFinancialStatus='PAID';a.totalOutstandingSet=cash('0');a.updatedAt='2026-10-22T05:00:00Z';expect(validate(a)).toEqual(e);});
  it.each([
    ['test order',(o:CollectionOrder)=>o.test=true],['cancelled',(o:CollectionOrder)=>o.cancelledAt='2026-10-21'],
    ['refunded',(o:CollectionOrder)=>o.refunds=[{id:'r'}]],['partial paid',(o:CollectionOrder)=>o.displayFinancialStatus='PARTIALLY_PAID'],
    ['mixed gateway',(o:CollectionOrder)=>o.paymentGatewayNames.push('Visa')],['unknown gateway',(o:CollectionOrder)=>o.paymentGatewayNames=[]],
    ['partial outstanding',(o:CollectionOrder)=>o.totalOutstandingSet=cash('800')],['wrong total',(o:CollectionOrder)=>o.currentTotalPriceSet=cash('827')],
    ['fractional amount',(o:CollectionOrder)=>o.totalShippingPriceSet=cash('146.2')],['wrong currency',(o:CollectionOrder)=>o.currentTotalPriceSet.shopMoney.currencyCode='USD'],
    ['unknown service',(o:CollectionOrder)=>o.fulfillments[0].service=null],['wrong service',(o:CollectionOrder)=>o.fulfillments[0].service={id:'gid://shopify/FulfillmentService/999'}],
    ['wrong carrier',(o:CollectionOrder)=>o.fulfillments[0].trackingInfo[0].company='Other'],['missing tracking',(o:CollectionOrder)=>o.fulfillments[0].trackingInfo=[]],
    ['wrong shipping code',(o:CollectionOrder)=>o.shippingLines.nodes[0].code='標準'],['partial shipping lines',(o:CollectionOrder)=>o.shippingLines.pageInfo.hasNextPage=true],
    ['not delivered',(o:CollectionOrder)=>o.fulfillments[0].displayStatus='IN_TRANSIT'],['missing deliveredAt',(o:CollectionOrder)=>o.fulfillments[0].deliveredAt=null],
    ['future delivery',(o:CollectionOrder)=>o.fulfillments[0].deliveredAt='2099-01-01'],['split parcels',(o:CollectionOrder)=>o.fulfillments.push(structuredClone(o.fulfillments[0]))],
    ['truncated fulfillments',(o:CollectionOrder)=>o.fulfillments.push(...Array.from({length:249},()=>({...structuredClone(o.fulfillments[0]),status:'CANCELLED'})))],
    ['partial fulfillment',(o:CollectionOrder)=>o.fulfillments[0].fulfillmentLineItems.nodes[0].quantity=0],['paginated items',(o:CollectionOrder)=>o.lineItems.pageInfo.hasNextPage=true],
    ['paginated shipped items',(o:CollectionOrder)=>o.fulfillments[0].fulfillmentLineItems.pageInfo.hasNextPage=true],
    ['edited quantity',(o:CollectionOrder)=>o.lineItems.nodes[0].currentQuantity=0],['edited name',(o:CollectionOrder)=>o.lineItems.nodes[0].name='Other'],
    ['nonshipping item',(o:CollectionOrder)=>o.lineItems.nodes[0].requiresShipping=false],['duplicate line',(o:CollectionOrder)=>o.lineItems.nodes.push(o.lineItems.nodes[0])],
  ])('blocks %s',(_name,change)=>{const o=order();(change as (o:CollectionOrder)=>unknown)(o);expect(()=>validate(o)).toThrow(/COD_COLLECTION_/);});
  it('requires actual amount mapping acceptance, not just configured labels',()=>{expect(()=>requireCollectionPolicy({...policy,amountMappingVerified:false})).toThrow('COD_COLLECTION_MAPPING_UNVERIFIED');});
  it('does not infer service from the generic shipping title',()=>{expect(()=>requireCollectionPolicy({...policy,serviceId:''})).toThrow('COD_COLLECTION_MAPPING_UNVERIFIED');});
  it('blocks another Shopify shop',()=>{expect(()=>validateCollectionOrder(order(),snapshot,policy,'other.myshopify.com')).toThrow('COD_COLLECTION_WRONG_STORE');});
});
