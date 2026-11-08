import { next, rewrite } from '@vercel/functions'

const PUBLIC_ASSET = /^\/assets\//

// 社群連結預覽爬蟲（LINE 用 facebookexternalhit;line-poker）。只列預覽用的爬蟲，不含搜尋引擎，
// 也不比對 LINE／Facebook 內建瀏覽器的一般訪客 UA（Line/、FBAN）。
const SHARE_PREVIEW_BOT = /facebookexternalhit|facebot|line-poker|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|skypeuripreview|redditbot|embedly/i

const PRODUCT_PATH = /^\/product\/(\d{1,20})\/?$/
const ARTICLE_PATH = /^\/blog\/([a-z0-9][a-z0-9-]{0,99})\/?$/

export default function middleware(request) {
  const url = new URL(request.url)
  if (!SHARE_PREVIEW_BOT.test(request.headers.get('user-agent') || '')) return next()
  const product = url.pathname.match(PRODUCT_PATH)
  if (product) return rewrite(new URL(`/api/share/product?id=${product[1]}`, request.url))
  const article = url.pathname.match(ARTICLE_PATH)
  if (article) return rewrite(new URL(`/api/share/product?article=${article[1]}`, request.url))
  return next()
}

export const config = {
  matcher: ['/assets/:path*', '/product/:path*', '/blog/:path*'],
  runtime: 'nodejs',
}

export { PUBLIC_ASSET, SHARE_PREVIEW_BOT }
