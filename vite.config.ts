import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sentryVitePlugin } from '@sentry/vite-plugin'

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-server',
    configureServer(server) {
      server.middlewares.use('/api/create-shopify-cart', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const lines = parsed.lines || [];
            const invoicePreference = parsed.invoicePreference || {};

            const attributes: { key: string; value: string }[] = [];
            if (invoicePreference.kind) attributes.push({ key: '_invoice_kind', value: invoicePreference.kind });
            if (invoicePreference.notificationEmail) attributes.push({ key: '_invoice_notification_email', value: invoicePreference.notificationEmail });
            if (invoicePreference.carrier) attributes.push({ key: '_invoice_carrier', value: invoicePreference.carrier });
            if (invoicePreference.carrierId) attributes.push({ key: '_invoice_carrier_id', value: invoicePreference.carrierId });
            if (invoicePreference.taxId) attributes.push({ key: '_invoice_tax_id', value: invoicePreference.taxId });
            if (invoicePreference.buyerName) attributes.push({ key: '_invoice_buyer_name', value: invoicePreference.buyerName });

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

            const domain = process.env.VITE_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_DOMAIN || 'gh2xgs-zf.myshopify.com';
            const token = process.env.VITE_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '9862bdf1a7178bd589dd83a130a3e24b';
            const version = process.env.VITE_PUBLIC_SHOPIFY_API_VERSION || '2026-07';

            const shopifyResponse = await fetch(`https://${domain}/api/${version}/graphql.json`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': token,
              },
              body: JSON.stringify({
                query,
                variables: { input: { lines, attributes } },
              }),
            });

            const shopifyData = await shopifyResponse.json();
            if (shopifyData.errors && shopifyData.errors.length > 0) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Shopify GraphQL request failed',
                details: shopifyData.errors.map((e: any) => e.message),
              }));
              return;
            }

            const payload = shopifyData.data?.cartCreate;
            if (payload?.userErrors && payload.userErrors.length > 0) {
              res.writeHead(422, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Shopify rejected the cart',
                details: payload.userErrors,
              }));
              return;
            }

            if (!payload?.cart?.checkoutUrl) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Shopify did not return checkoutUrl' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              checkoutUrl: payload.cart.checkoutUrl,
              cartId: payload.cart.id,
              totalQuantity: payload.cart.totalQuantity,
              warnings: payload.warnings ?? [],
              orderTrackingLinked: false,
            }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Unable to create checkout' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  appType: 'spa',
  base: process.env.VITE_BASE || '/',
  test: {
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
  },
  plugins: [
    react(),
    devApiPlugin(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          telemetry: false,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })]
      : []),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false
  }
})
