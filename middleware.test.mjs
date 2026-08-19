import { describe, expect, it } from 'vitest'
import middleware, { PUBLIC_ENTRY_ASSET } from './middleware.js'

describe('test-site asset middleware', () => {
  it('recognizes only the public Coming Soon entry assets', () => {
    expect(PUBLIC_ENTRY_ASSET.test('/assets/index-abc123.js')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/index-abc123.css')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/TestSite-abc123.js')).toBe(false)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/page-abc123.js')).toBe(false)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/index-abc123.js.map')).toBe(false)
  })

  it('returns a non-cacheable 404 for protected assets without a session', () => {
    const response = middleware(new Request('https://saengak.com.tw/assets/TestSite-abc123.js'))

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
