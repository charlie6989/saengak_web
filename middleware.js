import { next } from '@vercel/functions'

const PUBLIC_ASSET = /^\/assets\//

export default function middleware() {
  return next()
}

export const config = {
  matcher: '/assets/:path*',
  runtime: 'nodejs',
}

export { PUBLIC_ASSET }
