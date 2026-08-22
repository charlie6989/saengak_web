import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  REQUIRED_CSP_DIRECTIVES,
  REQUIRED_PRODUCTION_ROUTES,
  PRODUCTION_BASE_URL,
  SUPABASE_FUNCTIONS_BASE_URL,
  verifyProductionSurface,
} from './production-surface-lib.mjs';

const secureHeaders = {
  'content-security-policy': "default-src 'self'; base-uri 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://gh2xgs-zf.myshopify.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://sand-pay.tappaysdk.com https://pay.tappaysdk.com https://challenges.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; form-action 'self'; frame-ancestors 'none'; frame-src 'self' https://js.tappaysdk.com https://sand-pay.tappaysdk.com https://pay.tappaysdk.com https://challenges.cloudflare.com; img-src 'self' data: blob: https:; object-src 'none'; script-src 'self' https://js.tappaysdk.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; upgrade-insecure-requests",
  'content-type': 'text/html; charset=utf-8',
  'cross-origin-opener-policy': 'same-origin-allow-popups',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(self)',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function mockResponse(url, { status = 200, headers = {}, body = '' } = {}) {
  return {
    status,
    url: String(url),
    headers: new Headers(headers),
    text: async () => body,
  };
}

function makeFetch({ omitHeader, edgeStatus = 401, routeRedirects = {} } = {}) {
  return async (input) => {
    const url = new URL(input);
    if (url.href.startsWith(SUPABASE_FUNCTIONS_BASE_URL)) {
      return mockResponse(url, { status: edgeStatus, headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname.endsWith('.js')) {
      return mockResponse(url, { headers: { 'content-type': 'text/javascript' } });
    }
    if (url.pathname.endsWith('.css')) {
      return mockResponse(url, { headers: { 'content-type': 'text/css' } });
    }
    const headers = { ...secureHeaders };
    if (omitHeader) delete headers[omitHeader];
    const responseUrl = routeRedirects[url.pathname]
      ? new URL(routeRedirects[url.pathname], url)
      : url;
    return mockResponse(responseUrl, {
      headers,
      body: '<div id="root"></div><script src="/assets/index.js"></script><link href="/assets/index.css" rel="stylesheet">',
    });
  };
}

describe('production surface verifier', () => {
  it('keeps the required production headers in vercel.json', async () => {
    const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    const globalHeaders = config.headers.find((entry) => entry.source === '/(.*)')?.headers ?? [];
    const headers = new Map(globalHeaders.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      expect(headers.get('content-security-policy')).toContain(directive);
    }
  });

  it('accepts all formal routes, assets, headers and protected functions', async () => {
    const report = await verifyProductionSurface({ fetchImpl: makeFetch() });
    expect(report.ok).toBe(true);
    expect(report.counts.fail).toBe(0);
    for (const route of REQUIRED_PRODUCTION_ROUTES) {
      expect(report.checks).toContainEqual(expect.objectContaining({ id: `route:${route}`, passed: true }));
    }
  });

  it('registers /admin behind AdminGuard, but keeps it out of the smoke-tested production route list', async () => {
    // /admin is gated by Supabase auth + app_metadata.role === 'admin' (src/router/AdminGuard.tsx),
    // so it must never be treated as an always-200 anonymous route by the production smoke test.
    expect(REQUIRED_PRODUCTION_ROUTES).not.toContain('/admin');

    // The route itself must exist in the router (see tests/admin-router.test.tsx for the
    // behavioral proof that AdminGuard actually blocks unauthenticated/non-admin visitors).
    const routerSource = await readFile(new URL('../src/router/config.tsx', import.meta.url), 'utf8');
    expect(routerSource).toMatch(/path:\s*['"]\/admin['"]/);
    expect(routerSource).toMatch(/element:\s*<AdminGuard/);
  });

  it('fails when a required route redirects to another pathname', async () => {
    const report = await verifyProductionSurface({
      fetchImpl: makeFetch({ routeRedirects: { '/profile': '/login' } }),
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: 'route:/profile',
      passed: false,
      responseUrl: `${PRODUCTION_BASE_URL}/login`,
    }));
  });

  it('fails closed when a required security header is absent', async () => {
    const report = await verifyProductionSurface({ fetchImpl: makeFetch({ omitHeader: 'x-frame-options' }) });
    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: 'header:x-frame-options',
      passed: false,
    }));
  });

  it('fails when an Edge Function accepts a request without credentials', async () => {
    const report = await verifyProductionSurface({ fetchImpl: makeFetch({ edgeStatus: 200 }) });
    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: 'edge-auth:create-shopify-cart',
      passed: false,
    }));
  });
});
