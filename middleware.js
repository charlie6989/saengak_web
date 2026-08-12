import { next } from '@vercel/functions'
import { isAuthorized } from './api/test-access.mjs'

const PUBLIC_ENTRY_ASSET = /^\/assets\/index-[A-Za-z0-9_-]+\.(?:css|js)$/

export default function middleware(request) {
  const pathname = new URL(request.url).pathname

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
