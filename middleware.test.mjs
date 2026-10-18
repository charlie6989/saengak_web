import { describe, expect, it } from 'vitest'
import middleware, { PUBLIC_ASSET } from './middleware.js'

describe('public storefront asset middleware', () => {
  it('recognizes entry and lazy-loaded production assets', () => {
    expect(PUBLIC_ASSET.test('/assets/index-abc123.js')).toBe(true)
    expect(PUBLIC_ASSET.test('/assets/index-abc123.css')).toBe(true)
    expect(PUBLIC_ASSET.test('/assets/ProductPage-abc123.js')).toBe(true)
    expect(PUBLIC_ASSET.test('/assets/page-abc123.js')).toBe(true)
    expect(PUBLIC_ASSET.test('/api/create-shopify-cart')).toBe(false)
  })

  it('passes storefront assets through without a test-session cookie', () => {
    const response = middleware(new Request('https://saengak.com.tw/assets/TestSite-abc123.js'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('share preview middleware', () => {
  const LINE_BOT = 'facebookexternalhit/1.1;line-poker/1.0'
  const LINE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0'

  it('sends link-preview crawlers on product pages to the share function', () => {
    const response = middleware(new Request('https://lucissicare.com/product/7819900551235', { headers: { 'user-agent': LINE_BOT } }))

    expect(response.headers.get('x-middleware-rewrite')).toBe('https://lucissicare.com/api/share/product?id=7819900551235')
  })

  it('leaves real visitors, including in-app browsers, on the storefront', () => {
    for (const ua of [LINE_APP, 'Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36', 'Googlebot/2.1']) {
      const response = middleware(new Request('https://lucissicare.com/product/7819900551235', { headers: { 'user-agent': ua } }))
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(response.headers.get('x-middleware-next')).toBe('1')
    }
  })

  it('only rewrites numeric product ids', () => {
    const response = middleware(new Request('https://lucissicare.com/product/gid:/shopify/Product/1', { headers: { 'user-agent': LINE_BOT } }))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
