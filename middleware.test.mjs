import { describe, expect, it } from 'vitest'
import middleware, { PUBLIC_ENTRY_ASSET } from './middleware.js'

describe('test-site asset middleware', () => {
  it('recognizes all build assets as public', () => {
    expect(PUBLIC_ENTRY_ASSET.test('/assets/index-abc123.js')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/index-abc123.css')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/page-abc123.js')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/ProductCard-abc123.js')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/Footer-abc123.js')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/logo.png')).toBe(true)
    expect(PUBLIC_ENTRY_ASSET.test('/assets/font.woff2')).toBe(true)
  })

  it('rejects non-asset paths or non-matching extensions', () => {
    expect(PUBLIC_ENTRY_ASSET.test('/private/secret.txt')).toBe(false)
    expect(PUBLIC_ENTRY_ASSET.test('/api/secret')).toBe(false)
  })
})
