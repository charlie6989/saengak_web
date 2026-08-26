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
