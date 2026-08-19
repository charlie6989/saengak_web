import { next } from '@vercel/functions'

export default function middleware() {
  return next()
}

export const config = {
  matcher: '/:path*',
  runtime: 'nodejs',
}
