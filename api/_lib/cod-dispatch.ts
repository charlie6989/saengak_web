import { SHOPIFY_ADMIN_API_VERSION, SHOPIFY_STORE_DOMAIN } from './shopify-config.js';
import { getShopifyAdminAccessToken } from '../shopify/discounts.js';
import { invoiceContext } from '../../supabase/functions/shopify-orders-webhook/webhook.js';

export async function verifyLiveCodOrder(gid: string, updatedAt: string, total: number): Promise<void> {
  if (SHOPIFY_STORE_DOMAIN !== 'gh2xgs-zf.myshopify.com') throw new Error('COD_WRONG_STORE');
  const id = process.env.SHOPIFY_APP_CLIENT_ID;
  const secret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  if (!id || !secret) throw new Error('COD_SHOPIFY_UNAVAILABLE');
  const token = await getShopifyAdminAccessToken(SHOPIFY_STORE_DOMAIN, id, secret);
  if (!token) throw new Error('COD_SHOPIFY_UNAVAILABLE');
  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query: `query CodDispatchOrder($id: ID!) {
      order(id: $id) { id updatedAt test cancelledAt paymentGatewayNames displayFinancialStatus
        displayFulfillmentStatus currentTotalPriceSet { shopMoney { amount currencyCode } }
        shippingLine { title } }
    }`, variables: { id: gid } }),
  });
  const payload = await response.json() as { errors?: unknown; data?: { order?: {
    id: string; updatedAt: string; test: boolean; cancelledAt: string | null;
    paymentGatewayNames: string[]; displayFinancialStatus: string; displayFulfillmentStatus: string;
    currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    shippingLine?: { title: string };
  } } };
  const o = payload?.data?.order;
  if (!response.ok || payload.errors || !o || o.id !== gid) throw new Error('COD_SHOPIFY_UNAVAILABLE');
  if (o.displayFulfillmentStatus !== 'UNFULFILLED') throw new Error('COD_FULFILLMENT_REVIEW_REQUIRED');
  const context = invoiceContext(o.paymentGatewayNames, o.test);
  if (context.paymentKind !== 'cod' || context.test !== false || o.cancelledAt
    || o.displayFinancialStatus !== 'PENDING' || o.displayFulfillmentStatus !== 'UNFULFILLED'
    || o.shippingLine?.title !== '標準' || o.currentTotalPriceSet?.shopMoney?.currencyCode !== 'TWD'
    || Number(o.currentTotalPriceSet?.shopMoney?.amount) !== total
    || Date.parse(o.updatedAt) !== Date.parse(updatedAt)) throw new Error('COD_LIVE_ORDER_CHANGED');
}
