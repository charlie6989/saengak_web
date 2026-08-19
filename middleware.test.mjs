import { describe, expect, it } from 'vitest'
import middleware from './middleware.js'

describe('public asset middleware', () => {
  it('allows all requests to pass through to assets', () => {
    const response = middleware(new Request('https://saengak.com.tw/assets/index.js'))
    expect(response).toBeDefined()
  })
})
