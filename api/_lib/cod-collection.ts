import { createHash } from 'node:crypto';
import { SHOPIFY_ADMIN_API_VERSION, SHOPIFY_STORE_DOMAIN } from './shopify-config.js';
import { getShopifyAdminAccessToken } from '../shopify/discounts.js';
import { invoiceContext } from '../../supabase/functions/shopify-orders-webhook/webhook.js';

export const CARE_STORE = 'gh2xgs-zf.myshopify.com';
type Money = { amount: string; currencyCode: string };
type Connection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean } };
export interface CollectionOrder {
  id: string; updatedAt: string; test: boolean; cancelledAt: string | null;
  paymentGatewayNames: string[]; displayFinancialStatus: string; displayFulfillmentStatus: string;
  currentTotalPriceSet: { shopMoney: Money }; totalOutstandingSet: { shopMoney: Money };
  currentTotalDiscountsSet: { shopMoney: Money }; totalShippingPriceSet: { shopMoney: Money };
  shippingLines: Connection<{ code: string; title: string }>;
  refunds: { id: string }[];
  lineItems: Connection<{ id: string; name: string; quantity: number; currentQuantity: number; requiresShipping: boolean; originalUnitPriceSet: { shopMoney: Money } }>;
  fulfillments: { id: string; status: string; displayStatus: string; deliveredAt: string | null;
    service: { id: string } | null; trackingInfo: { company: string; number: string }[];
    fulfillmentLineItems: Connection<{ quantity: number; lineItem: { id: string } }> }[];
}
export interface CollectionSnapshot {
  orderNumber: string; currencyCode: string; totalAmount: number | string;
  shippingAmount: number | string; discountAmount: number | string;
  lineItems: { shopifyLineItemGid: string; productName: string; quantity: number; price: string | number }[];
}
export interface CollectionPolicy {
  serviceId: string; trackingCompany: string; shippingCode: string; amountMappingVerified: boolean;
}
export interface CollectionEvidence {
  fulfillmentId: string; trackingNumber: string; deliveredAt: string;
  serviceId: string; shippingCode: string; trackingCompany: string;
  source: 'shopify_admin_shipany_delivered'; amountBasis: 'contract_inferred';
  contract: 'shipany-black-cat-cod-2026-10-22'; amount: number; currency: 'TWD'; fingerprint: string;
}
export function collectionPolicy(): CollectionPolicy {
  return { serviceId: process.env.COD_SHIPANY_SERVICE_ID ?? '',
    trackingCompany: process.env.COD_BLACK_CAT_TRACKING_COMPANY ?? '',
    shippingCode: process.env.COD_BLACK_CAT_AMBIENT_SHIPPING_CODE ?? '',
    amountMappingVerified: process.env.COD_SHIPANY_AMOUNT_MAPPING_VERIFIED === 'true' };
}
export function requireCollectionPolicy(policy = collectionPolicy()): void {
  // No guessed service IDs, carrier labels or inference from the generic title 標準.
  // Shopify does NOT expose ShipAny's actual COD amount. Activation additionally
  // requires owner-system validation of unchanged order -> shipment COD mapping.
  if (!/^gid:\/\/shopify\/FulfillmentService\/[1-9]\d*$/.test(policy.serviceId)
    || !policy.trackingCompany.trim() || !policy.shippingCode.trim() || !policy.amountMappingVerified) {
    throw new Error('COD_COLLECTION_MAPPING_UNVERIFIED');
  }
}
const fail = (code: string): never => { throw new Error(code); };
function money(value: Money): number {
  if (!value || value.currencyCode !== 'TWD' || !/^\d+(?:\.0+)?$/.test(value.amount)) return fail('COD_COLLECTION_AMOUNT_MISMATCH');
  const n = Number(value.amount);
  if (!Number.isSafeInteger(n)) return fail('COD_COLLECTION_AMOUNT_MISMATCH');
  return n;
}
export function validateCollectionOrder(order: CollectionOrder, snapshot: CollectionSnapshot,
  policy: CollectionPolicy, store = SHOPIFY_STORE_DOMAIN): CollectionEvidence {
  requireCollectionPolicy(policy);
  if (store !== CARE_STORE) return fail('COD_COLLECTION_WRONG_STORE');
  if (invoiceContext(order.paymentGatewayNames, order.test).paymentKind !== 'cod' || order.test !== false
    || order.cancelledAt || order.refunds.length || !['PENDING', 'PAID'].includes(order.displayFinancialStatus)) {
    return fail('COD_COLLECTION_ORDER_INELIGIBLE');
  }
  const total = money(order.currentTotalPriceSet.shopMoney);
  if (snapshot.currencyCode !== 'TWD' || total <= 0 || total !== Number(snapshot.totalAmount)
    || money(order.currentTotalDiscountsSet.shopMoney) !== Number(snapshot.discountAmount)
    || money(order.totalShippingPriceSet.shopMoney) !== Number(snapshot.shippingAmount)
    || money(order.totalOutstandingSet.shopMoney) !== (order.displayFinancialStatus === 'PAID' ? 0 : total)) {
    return fail('COD_COLLECTION_AMOUNT_MISMATCH');
  }
  const lines = order.lineItems;
  if (lines.pageInfo.hasNextPage || !lines.nodes.length || lines.nodes.length !== snapshot.lineItems.length
    || new Set(lines.nodes.map(l => l.id)).size !== lines.nodes.length) return fail('COD_COLLECTION_LINES_MISMATCH');
  for (const line of lines.nodes) {
    const expected = snapshot.lineItems.find(l => l.shopifyLineItemGid === line.id);
    if (!expected || !line.requiresShipping || !Number.isSafeInteger(line.quantity) || line.quantity < 1
      || line.currentQuantity !== line.quantity || line.quantity !== expected.quantity
      || money(line.originalUnitPriceSet.shopMoney) !== Number(expected.price) || line.name !== expected.productName) {
      return fail('COD_COLLECTION_LINES_MISMATCH');
    }
  }
  const reconciled = lines.nodes.reduce((sum, l) => sum + l.quantity * money(l.originalUnitPriceSet.shopMoney), 0)
    + Number(snapshot.shippingAmount) - Number(snapshot.discountAmount);
  if (!Number.isSafeInteger(reconciled) || reconciled !== total) return fail('COD_COLLECTION_AMOUNT_MISMATCH');
  if (order.shippingLines.pageInfo.hasNextPage || order.shippingLines.nodes.length !== 1
    || order.shippingLines.nodes[0].code !== policy.shippingCode) return fail('COD_COLLECTION_SERVICE_MISMATCH');
  // Initial rollout is one whole-order shipment. Never sum uncertain per-parcel COD amounts.
  const active = order.fulfillments.filter(f => f.status !== 'CANCELLED');
  if (order.displayFulfillmentStatus !== 'FULFILLED' || active.length !== 1 || order.fulfillments.length >= 250) return fail('COD_COLLECTION_WHOLE_ORDER_REQUIRED');
  const f = active[0];
  if (f.status !== 'SUCCESS' || f.displayStatus !== 'DELIVERED' || !f.deliveredAt
    || !Number.isFinite(Date.parse(f.deliveredAt)) || Date.parse(f.deliveredAt) > Date.now()) return fail('COD_COLLECTION_NOT_DELIVERED');
  if (!/^gid:\/\/shopify\/Fulfillment\/[1-9]\d*$/.test(f.id) || f.service?.id !== policy.serviceId
    || f.trackingInfo.length !== 1 || f.trackingInfo[0].company !== policy.trackingCompany
    || !/^[0-9]{10,20}$/.test(f.trackingInfo[0].number)) return fail('COD_COLLECTION_SERVICE_MISMATCH');
  const shipped = f.fulfillmentLineItems;
  if (shipped.pageInfo.hasNextPage || shipped.nodes.length !== lines.nodes.length
    || new Set(shipped.nodes.map(l => l.lineItem.id)).size !== shipped.nodes.length
    || lines.nodes.some(l => shipped.nodes.find(s => s.lineItem.id === l.id)?.quantity !== l.quantity)) {
    return fail('COD_COLLECTION_WHOLE_ORDER_REQUIRED');
  }
  const evidence = { fulfillmentId: f.id, trackingNumber: f.trackingInfo[0].number,
    deliveredAt: new Date(f.deliveredAt).toISOString(), serviceId: policy.serviceId,
    shippingCode: policy.shippingCode, trackingCompany: policy.trackingCompany,
    source: 'shopify_admin_shipany_delivered' as const, amountBasis: 'contract_inferred' as const,
    contract: 'shipany-black-cat-cod-2026-10-22' as const, amount: total, currency: 'TWD' as const };
  // Independent of paid and updatedAt: financial projection is not collection evidence.
  return { ...evidence, fingerprint: createHash('sha256').update(JSON.stringify({ order: order.id,
    evidence, lines: [...lines.nodes].sort((a,b) => a.id.localeCompare(b.id)),
    shipping: snapshot.shippingAmount, discount: snapshot.discountAmount })).digest('hex') };
}
export const COLLECTION_ORDER_QUERY = `query CodCollectionOrder($id: ID!) {
  order(id: $id) { id updatedAt test cancelledAt paymentGatewayNames displayFinancialStatus displayFulfillmentStatus
    currentTotalPriceSet { shopMoney { amount currencyCode } } totalOutstandingSet { shopMoney { amount currencyCode } }
    currentTotalDiscountsSet { shopMoney { amount currencyCode } } totalShippingPriceSet { shopMoney { amount currencyCode } }
    shippingLines(first: 2) { nodes { code title } pageInfo { hasNextPage } } refunds { id }
    lineItems(first: 250) { nodes { id name quantity currentQuantity requiresShipping originalUnitPriceSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage } }
    fulfillments(first: 250) { id status displayStatus deliveredAt service { id } trackingInfo { company number }
      fulfillmentLineItems(first: 250) { nodes { quantity lineItem { id } } pageInfo { hasNextPage } } }
  }
}`;
export async function collectionGraphql(query: string, variables: object): Promise<any> {
  if (SHOPIFY_STORE_DOMAIN !== CARE_STORE) throw new Error('COD_COLLECTION_WRONG_STORE');
  const id = process.env.SHOPIFY_APP_CLIENT_ID, secret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  if (!id || !secret) throw new Error('COD_COLLECTION_SOURCE_UNAVAILABLE');
  const token = await getShopifyAdminAccessToken(CARE_STORE, id, secret);
  if (!token) throw new Error('COD_COLLECTION_SOURCE_UNAVAILABLE');
  const r = await fetch(`https://${CARE_STORE}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const p = await r.json() as { errors?: unknown; data?: Record<string, any> };
  if (!r.ok || p.errors || !p.data) throw new Error('COD_COLLECTION_SOURCE_UNAVAILABLE');
  return p.data;
}
export async function readCollectionOrder(gid: string): Promise<CollectionOrder> {
  const data = await collectionGraphql(COLLECTION_ORDER_QUERY, { id: gid });
  if (!data.order || data.order.id !== gid) throw new Error('COD_COLLECTION_SOURCE_UNAVAILABLE');
  return data.order;
}
export async function verifyCollectionBeforeIssue(db: any, gid: string): Promise<void> {
  if (process.env.COD_COLLECTION_ENABLED !== 'true') throw new Error('COD_COLLECTION_DISABLED');
  const result = await db.rpc('get_cod_collection_work', { p_order_gid: gid });
  if (result.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
  if (!result.data?.enabled) throw new Error('COD_COLLECTION_DISABLED');
  if (!result.data.managed || !result.data.evidence) throw new Error('COD_COLLECTION_EVIDENCE_REQUIRED');
  if (result.data.reviewRequired) throw new Error('COD_COLLECTION_REVIEW_REQUIRED');
  const evidence = validateCollectionOrder(await readCollectionOrder(gid), result.data.snapshot, collectionPolicy());
  if (evidence.fingerprint !== result.data.evidence.fingerprint) throw new Error('COD_COLLECTION_EVIDENCE_CHANGED');
  // Refresh check time under the shared DB order lock; snapshot/evidence are immutable.
  const saved = await db.rpc('record_cod_collection', { p_order_gid: gid, p_snapshot: result.data.snapshot, p_evidence: evidence });
  if (saved.error) {
    const code = saved.error.message;
    throw new Error(typeof code === 'string' && /^COD_COLLECTION_[A-Z_]+$/.test(code)
      ? code : 'COD_COLLECTION_STORAGE_UNAVAILABLE');
  }
}
