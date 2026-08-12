import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  getBearerToken,
  getPreferredPublicKey,
  getPreferredSecretKey,
  hasAcceptedPublicKey,
  isCheckoutReleaseEnabled,
} from './auth.ts';
import {
  buildStorefrontHeaders,
  extractShopifyCartToken,
  getBuyerIp,
  isValidShopifyDomain,
  resolveShopifyDomain,
  resolveStorefrontApiVersion,
} from './shopify.ts';
import { buildStorefrontUrl } from '../_shared/shopify-storefront.ts';

const defaultAllowedOrigins = [
  'https://saengak.com.tw',
  'https://saengak-web-d2ux.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const jsonHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
});

const responseJson = (
  body: Record<string, unknown>,
  status: number,
  origin: string,
) => new Response(JSON.stringify(body), {
  status,
  headers: jsonHeaders(origin),
});

const getAllowedOrigin = (requestOrigin: string | null) => {
  const configuredOrigins = (Deno.env.get('CheckoutAllowedOrigins') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

  if (!requestOrigin) return defaultAllowedOrigins[0];
  return allowedOrigins.has(requestOrigin) ? requestOrigin : null;
};

interface CheckoutLine {
  merchandiseId: string;
  quantity: number;
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

Deno.serve(async (req: Request) => {
  const origin = getAllowedOrigin(req.headers.get('Origin'));
  if (!origin) {
    return new Response('Origin not allowed', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return responseJson({ error: 'Method not allowed' }, 405, origin);
  }

  if (!isCheckoutReleaseEnabled(Deno.env.get('CheckoutReleaseEnabled'))) {
    return responseJson({
      error: 'Checkout is not released',
      code: 'CHECKOUT_NOT_RELEASED',
    }, 503, origin);
  }

  if (!hasAcceptedPublicKey(
    req.headers.get('apikey'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
  )) {
    return responseJson({ error: 'Invalid API key' }, 401, origin);
  }

  try {
    const shopifyDomain = resolveShopifyDomain(Deno.env.get('ShopifyDomain'));
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken');
    const apiVersion = resolveStorefrontApiVersion(Deno.env.get('ShopifyStorefrontApiVersion'));

    if (!isValidShopifyDomain(shopifyDomain)) {
      return responseJson({ error: 'Invalid ShopifyDomain configuration' }, 503, origin);
    }

    const authorization = req.headers.get('Authorization');
    const bearerToken = getBearerToken(authorization);
    let checkoutUserId: string | undefined;

    if (authorization && !bearerToken) {
      return responseJson({ error: 'Invalid Authorization header' }, 401, origin);
    }

    if (bearerToken) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const publicKey = getPreferredPublicKey(
        Deno.env.get('SUPABASE_ANON_KEY'),
        Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
      );
      if (!supabaseUrl || !publicKey) {
        return responseJson({ error: 'Membership authentication is unavailable' }, 503, origin);
      }

      const authClient = createClient(supabaseUrl, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await authClient.auth.getUser(bearerToken);
      if (error || !data.user) {
        return responseJson({ error: 'Invalid or expired member session' }, 401, origin);
      }
      checkoutUserId = data.user.id;
    }

    const body = await req.json().catch(() => null) as { lines?: unknown } | null;
    if (
      !body ||
      !Array.isArray(body.lines) ||
      body.lines.length === 0 ||
      body.lines.length > 50 ||
      !body.lines.every(isCheckoutLine)
    ) {
      return responseJson({
        error: 'Invalid cart lines',
        details: 'Provide 1-50 Shopify ProductVariant lines with quantities from 1-99',
      }, 400, origin);
    }

    const query = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            totalQuantity
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

    const shopifyResponse = await fetch(
      buildStorefrontUrl(shopifyDomain, apiVersion),
      {
        method: 'POST',
        headers: buildStorefrontHeaders(storefrontAccessToken, getBuyerIp(req.headers)),
        body: JSON.stringify({
          query,
          variables: { input: { lines: body.lines } },
        }),
      },
    );

    const shopifyData = await shopifyResponse.json().catch(() => null);
    if (!shopifyData) {
      return responseJson({
        error: 'Shopify Storefront API request failed',
        status: shopifyResponse.status,
      }, 502, origin);
    }

    if (Array.isArray(shopifyData.errors) && shopifyData.errors.length > 0) {
      const details = shopifyData.errors
        .map((error: { message?: string }) => error.message)
        .filter(Boolean);
      const storefrontLocked = details.some((message: string) =>
        /online store channel is locked/i.test(message)
      );
      return responseJson({
        error: storefrontLocked
          ? 'Shopify storefront is locked'
          : 'Shopify GraphQL request failed',
        code: storefrontLocked
          ? 'SHOPIFY_STOREFRONT_LOCKED'
          : 'SHOPIFY_GRAPHQL_ERROR',
        status: shopifyResponse.status,
        details,
      }, storefrontLocked ? 503 : 502, origin);
    }

    if (!shopifyResponse.ok) {
      return responseJson({
        error: 'Shopify Storefront API request failed',
        status: shopifyResponse.status,
      }, 502, origin);
    }

    const payload = shopifyData.data?.cartCreate;
    if (Array.isArray(payload?.userErrors) && payload.userErrors.length > 0) {
      return responseJson({
        error: 'Shopify rejected the cart',
        details: payload.userErrors,
      }, 422, origin);
    }

    if (!payload?.cart?.checkoutUrl || !payload?.cart?.id) {
      return responseJson({ error: 'Shopify did not return checkoutUrl' }, 502, origin);
    }

    let orderTrackingLinked = false;
    if (checkoutUserId) {
      const cartToken = extractShopifyCartToken(payload.cart.id);
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const secretKey = getPreferredSecretKey(
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        Deno.env.get('SUPABASE_SECRET_KEYS'),
      );

      if (!cartToken || !supabaseUrl || !secretKey) {
        return responseJson({
          error: 'Unable to link checkout to member order history',
        }, 503, origin);
      }

      const adminClient = createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: linkError } = await adminClient
        .from('shopify_checkout_links')
        .upsert({
          shopify_store_domain: shopifyDomain,
          shopify_cart_token: cartToken,
          user_id: checkoutUserId,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'shopify_store_domain,shopify_cart_token' });

      if (linkError) {
        console.error('Unable to persist checkout link', {
          code: linkError.code,
        });
        return responseJson({
          error: 'Unable to link checkout to member order history',
        }, 502, origin);
      }
      orderTrackingLinked = true;
    }

    return responseJson({
      checkoutUrl: payload.cart.checkoutUrl,
      cartId: payload.cart.id,
      totalQuantity: payload.cart.totalQuantity,
      warnings: payload.warnings ?? [],
      orderTrackingLinked,
    }, 200, origin);
  } catch (error) {
    console.error('create-shopify-cart failed', error);
    return responseJson({ error: 'Unable to create checkout' }, 500, origin);
  }
});
