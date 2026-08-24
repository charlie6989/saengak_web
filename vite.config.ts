import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sentryVitePlugin } from '@sentry/vite-plugin'

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-server',
    configureServer(server) {
      server.middlewares.use('/api/create-shopify-cart', async (req, res) => {
        try {
          const method = req.method || 'GET';
          const headers = new Headers();
          Object.entries(req.headers).forEach(([name, value]) => {
            if (Array.isArray(value)) {
              value.forEach((item) => headers.append(name, item));
            } else if (value) {
              headers.set(name, value);
            }
          });

          const body = method === 'POST'
            ? await new Promise<string>((resolve, reject) => {
                let value = '';
                req.on('data', (chunk) => { value += chunk; });
                req.on('end', () => resolve(value));
                req.on('error', reject);
              })
            : undefined;

          const host = req.headers.host || 'localhost:3000';
          const webRequest = new Request(`http://${host}/api/create-shopify-cart`, {
            method,
            headers,
            body,
          });
          const api = await import('./api/create-shopify-cart.js');
          const response = method === 'OPTIONS'
            ? await api.OPTIONS(webRequest)
            : method === 'POST'
              ? await api.POST(webRequest)
              : new Response(JSON.stringify({ error: 'Method not allowed' }), {
                  status: 405,
                  headers: { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' },
                });

          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(await response.text());
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to create checkout';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
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
