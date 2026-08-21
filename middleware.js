import { next } from '@vercel/functions'
import { isAuthorized } from './api/test-access.mjs'

const PUBLIC_ENTRY_ASSET = /^\/assets\/index-[A-Za-z0-9_-]+\.(?:css|js)$/

export default function middleware(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  const hostname = url.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return next()
  }

  if (PUBLIC_ENTRY_ASSET.test(pathname)) {
    return next()
  }

  const sessionSecret = process.env.SAENGAK_TEST_SESSION_SECRET ?? ''
  if (isAuthorized(request, sessionSecret)) {
    return next()
  }

  return new Response('Not found.', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'Vercel-CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const config = {
  matcher: '/assets/:path*',
  runtime: 'nodejs',
}

export { PUBLIC_ENTRY_ASSET }
