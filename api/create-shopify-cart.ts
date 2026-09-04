import {
  isOriginAllowed,
  jsonResponse,
  getClientIp,
} from './_lib/security.js';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient, getSiteSetting } from './_lib/supabase-admin.js';
import {
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
  SHOPIFY_API_VERSION,
} from './_lib/shopify-config.js';
import { isValidTaiwanTaxId, type InvoicePreference } from '../src/domain/invoice.js';
import { createClient } from '@supabase/supabase-js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileBarcodePattern = /^\/[0-9A-Z+\-.]{7}$/;
const donationCodePattern = /^\d{3,7}$/;

const text = (value: unknown, maximum: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : undefined;
};

function parseInvoicePreference(value: unknown): InvoicePreference | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const rawEmail = raw.notificationEmail !== undefined ? raw.notificationEmail : '';
  const notificationEmail = text(rawEmail, 254);
  if (notificationEmail === undefined || (notificationEmail && !emailPattern.test(notificationEmail))) {
    return undefined;
  }

  if (raw.kind === 'company') {
    const taxId = text(raw.taxId, 8);
    const buyerName = text(raw.buyerName, 60);
    if (!taxId || !buyerName || !isValidTaiwanTaxId(taxId)) return undefined;
    return { kind: 'company', notificationEmail, taxId, buyerName };
  }

  if (raw.kind !== 'personal') return undefined;
  const carrierValue = String(raw.carrier || 'none');
  if (!['none', 'mobile', 'amego-email', 'donation'].includes(carrierValue)) return undefined;
  const carrier = carrierValue as 'none' | 'mobile' | 'amego-email' | 'donation';
  const rawCarrierId = raw.carrierId !== undefined ? raw.carrierId : '';
  const carrierId = text(rawCarrierId, 254);
  if (carrierId === undefined) return undefined;
  if (carrier === 'mobile' && !mobileBarcodePattern.test(carrierId.toUpperCase())) return undefined;
  if (carrier === 'amego-email' && !emailPattern.test(carrierId)) return undefined;
  if (carrier === 'donation' && !donationCodePattern.test(carrierId)) return undefined;
  if (carrier === 'none' && carrierId) return undefined;
  return {
    kind: 'personal',
    notificationEmail,
    carrier,
    carrierId: carrier === 'mobile' ? carrierId.toUpperCase() : carrierId,
  };
}

interface CheckoutLine {
  merchandiseId: string;
  quantity: number;
}

interface CreateCartRequestBody {
  lines?: unknown;
  invoicePreference?: unknown;
  discountCodes?: unknown;
}

function parseDiscountCodes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const codes = value
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 50);
  return codes.length > 0 ? codes.slice(0, 5) : undefined;
}

export function findInapplicableDiscountCodes(
  requestedCodes: string[] | undefined,
  returnedDiscountCodes: Array<{ code?: string; applicable?: boolean }> | undefined,
): string[] {
  if (!requestedCodes || requestedCodes.length === 0) return [];
  const applicableCodes = new Set(
    (returnedDiscountCodes ?? [])
      .filter((entry) => entry?.applicable === true)
      .map((entry) => (entry.code ?? '').toUpperCase()),
  );
  return requestedCodes.filter((code) => !applicableCodes.has(code.toUpperCase()));
}

interface ShopifyCartCreateResponse {
  errors?: Array<{ message?: string }>;
  data?: {
    cartCreate?: {
      cart?: {
        id?: string;
        checkoutUrl?: string;
        totalQuantity?: number;
        discountCodes?: Array<{ code?: string; applicable?: boolean }>;
      };
      userErrors?: unknown[];
      warnings?: unknown[];
    };
  };
}

const isCheckoutLine = (value: unknown): value is CheckoutLine => {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<CheckoutLine>;
  return (
    typeof line.merchandiseId === 'string' &&
    line.merchandiseId.startsWith('gid://shopify/ProductVariant/') &&
    Number.isInteger(line.quantity) &&
    Number(line.quantity) >= 1 &&
    Number(line.quantity) <= 99
  );
};

export async function OPTIONS(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': requestOrigin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, request)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
  };

  try {
    // 檢查全站維護模式 (對齊 00_DECISION_LOG §3.3)
    const maintenanceMode = await getSiteSetting<boolean>('maintenance_mode');
    if (maintenanceMode === true || process.env.MAINTENANCE_MODE === 'true') {
      return jsonResponse({
        error: '全站維護中，暫停受理購物車結帳',
        code: 'MAINTENANCE_MODE_ACTIVE',
      }, { status: 503, headers: corsHeaders });
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return jsonResponse({
        error: 'Sign in before checkout',
        code: 'MEMBER_LOGIN_REQUIRED',
      }, { status: 401, headers: corsHeaders });
    }

    const bearerMatch = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!bearerMatch) {
      return jsonResponse({
        error: 'Invalid Authorization header',
        code: 'MEMBER_SESSION_INVALID',
      }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !publicKey) {
      return jsonResponse({
        error: 'Membership authentication is unavailable',
        code: 'MEMBERSHIP_AUTH_UNAVAILABLE',
      }, { status: 503, headers: corsHeaders });
    }

    const authClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getUser(bearerMatch[1]);
    if (error || !data.user) {
      return jsonResponse({
        error: 'Invalid or expired member session',
        code: 'MEMBER_SESSION_INVALID',
      }, { status: 401, headers: corsHeaders });
    }
    const checkoutUserId = data.user.id;

    const body = await request.json().catch(() => null) as CreateCartRequestBody | null;
    const invoicePreference = parseInvoicePreference(body?.invoicePreference ?? {
      kind: 'personal',
      notificationEmail: '',
      carrier: 'none',
      carrierId: '',
    });
    const discountCodes = parseDiscountCodes(body?.discountCodes);

    if (
      !body ||
      !Array.isArray(body.lines) ||
      body.lines.length === 0 ||
      body.lines.length > 50 ||
      !body.lines.every(isCheckoutLine) ||
      !invoicePreference
    ) {
      return jsonResponse({
        error: 'Invalid checkout input',
        details: 'Provide valid cart lines and invoice preferences',
      }, { status: 400, headers: corsHeaders });
    }

    const hasSensitiveInvoicePreference = invoicePreference.kind === 'company' ||
      Boolean(invoicePreference.notificationEmail) ||
      (invoicePreference.kind === 'personal' && invoicePreference.carrier !== 'none');

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return jsonResponse({
        error: 'Member order tracking is unavailable',
        code: 'MEMBER_ORDER_LINK_UNAVAILABLE',
      }, { status: 503, headers: corsHeaders });
    }

    const query = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            totalQuantity
            discountCodes {
              code
              applicable
            }
          }
          userErrors {
            field
            message
            code
          }
          warnings {
            code
            message
            target
          }
        }
      }
    `;

    const checkoutLinkToken = randomUUID();
    const attributes: Array<{ key: string; value: string }> = [
      { key: '_saengak_member_link_token', value: checkoutLinkToken },
    ];
    if (invoicePreference.kind) {
      attributes.push({ key: '_invoice_kind', value: invoicePreference.kind });
    }
    if (invoicePreference.notificationEmail) {
      attributes.push({ key: '_invoice_notification_email', value: invoicePreference.notificationEmail });
    }
    if (invoicePreference.kind === 'personal') {
      if (invoicePreference.carrier) {
        attributes.push({ key: '_invoice_carrier', value: invoicePreference.carrier });
      }
      if (invoicePreference.carrierId) {
        attributes.push({ key: '_invoice_carrier_id', value: invoicePreference.carrierId });
      }
    } else {
      attributes.push({ key: '_invoice_tax_id', value: invoicePreference.taxId });
      attributes.push({ key: '_invoice_buyer_name', value: invoicePreference.buyerName });
    }

    if (hasSensitiveInvoicePreference) {
      const { error: preferenceError } = await adminClient.rpc(
        'save_checkout_invoice_preference',
        {
          p_shopify_store_domain: SHOPIFY_STORE_DOMAIN,
          p_shopify_cart_token: checkoutLinkToken,
          p_preference: invoicePreference,
        },
      );
      if (preferenceError) {
        console.error('Unable to persist invoice preference', {
          code: preferenceError.code,
        });
        return jsonResponse({
          error: 'Unable to secure invoice preference',
          code: 'INVOICE_PREFERENCE_PERSISTENCE_FAILED',
        }, { status: 502, headers: corsHeaders });
      }
    }

    const { error: linkError } = await adminClient
      .from('shopify_checkout_links')
      .upsert({
        shopify_store_domain: SHOPIFY_STORE_DOMAIN,
        shopify_cart_token: checkoutLinkToken,
        user_id: checkoutUserId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'shopify_store_domain,shopify_cart_token' });

    if (linkError) {
      console.error('Unable to persist checkout link', {
        code: linkError.code,
      });
      return jsonResponse({
        error: 'Unable to link checkout to member order history',
        code: 'MEMBER_ORDER_LINK_FAILED',
      }, { status: 502, headers: corsHeaders });
    }

    const cartInput: Record<string, unknown> = {
      lines: body.lines,
      attributes,
    };
    if (discountCodes && discountCodes.length > 0) {
      cartInput.discountCodes = discountCodes;
    }

    const shopifyResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
          'Shopify-Storefront-Buyer-IP': getClientIp(request),
        },
        body: JSON.stringify({
          query,
          variables: { input: cartInput },
        }),
      },
    );

    const shopifyData = await shopifyResponse.json().catch(() => null) as ShopifyCartCreateResponse | null;
    if (!shopifyData) {
      return jsonResponse({
        error: 'Shopify Storefront API request failed',
        status: shopifyResponse.status,
      }, { status: 502, headers: corsHeaders });
    }

    if (Array.isArray(shopifyData.errors) && shopifyData.errors.length > 0) {
      const details = shopifyData.errors
        .map((error: { message?: string }) => error.message)
        .filter((message): message is string => Boolean(message));
      const storefrontLocked = details.some((message: string) =>
        /online store channel is locked/i.test(message)
      );
      return jsonResponse({
        error: storefrontLocked
          ? 'Shopify storefront is locked'
          : 'Shopify GraphQL request failed',
        code: storefrontLocked
          ? 'SHOPIFY_STOREFRONT_LOCKED'
          : 'SHOPIFY_GRAPHQL_ERROR',
        status: shopifyResponse.status,
        details,
      }, { status: storefrontLocked ? 503 : 502, headers: corsHeaders });
    }

    if (!shopifyResponse.ok) {
      return jsonResponse({
        error: 'Shopify Storefront API request failed',
        status: shopifyResponse.status,
      }, { status: 502, headers: corsHeaders });
    }

    const payload = shopifyData.data?.cartCreate;
    if (Array.isArray(payload?.userErrors) && payload.userErrors.length > 0) {
      return jsonResponse({
        error: 'Shopify rejected the cart',
        details: payload.userErrors,
      }, { status: 422, headers: corsHeaders });
    }

    if (!payload?.cart?.checkoutUrl || !payload?.cart?.id) {
      return jsonResponse({ error: 'Shopify did not return checkoutUrl' }, { status: 502, headers: corsHeaders });
    }

    const cartId = String(payload.cart.id);
    const cartToken = /^gid:\/\/shopify\/Cart\/([^?/#]{8,})(?:\?.*)?$/.exec(cartId)?.[1];
    if (!cartToken) {
      return jsonResponse({
        error: 'Shopify returned an invalid cart identifier',
        code: 'INVALID_SHOPIFY_CART_ID',
      }, { status: 502, headers: corsHeaders });
    }

    const invalidDiscountCodes = findInapplicableDiscountCodes(discountCodes, payload.cart.discountCodes);

    return jsonResponse({
      checkoutUrl: payload.cart.checkoutUrl,
      cartId: payload.cart.id,
      totalQuantity: payload.cart.totalQuantity,
      warnings: payload.warnings ?? [],
      orderTrackingLinked: true,
      invalidDiscountCodes,
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('create-shopify-cart failed', error);
    return jsonResponse({ error: 'Unable to create checkout' }, { status: 500, headers: corsHeaders });
  }
}

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return OPTIONS(request);
  if (request.method === 'POST') return POST(request);
  return jsonResponse(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'POST, OPTIONS' } },
  );
}

export default { fetch: handler };
