import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import handler, { COOKIE_NAME } from '../api/test-access.mjs'

const originalEnv = {
  username: process.env.SAENGAK_TEST_USERNAME,
  password: process.env.SAENGAK_TEST_PASSWORD,
  sessionSecret: process.env.SAENGAK_TEST_SESSION_SECRET,
}

beforeEach(() => {
  process.env.SAENGAK_TEST_USERNAME = 'preview-tester'
  process.env.SAENGAK_TEST_PASSWORD = 'correct-horse-battery-staple'
  process.env.SAENGAK_TEST_SESSION_SECRET = 'test-session-secret-that-is-not-used-in-production'
})

afterEach(() => {
  for (const [key, value] of Object.entries({
    SAENGAK_TEST_USERNAME: originalEnv.username,
    SAENGAK_TEST_PASSWORD: originalEnv.password,
    SAENGAK_TEST_SESSION_SECRET: originalEnv.sessionSecret,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('test access function', () => {
  it('rejects an incorrect password without setting a session', async () => {
    const response = await handler.fetch(new Request('https://saengak.com.tw/api/test-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        username: 'preview-tester',
        password: 'incorrect',
      }),
    }))

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('creates a secure HttpOnly session and recognizes it', async () => {
    const loginResponse = await handler.fetch(new Request('https://saengak.com.tw/api/test-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        username: 'preview-tester',
        password: 'correct-horse-battery-staple',
      }),
    }))

    const setCookie = loginResponse.headers.get('set-cookie') ?? ''
    expect(loginResponse.status).toBe(200)
    expect(setCookie).toContain(`${COOKIE_NAME}=`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')

    const cookie = setCookie.split(';')[0]
    const sessionResponse = await handler.fetch(new Request('https://saengak.com.tw/api/test-access', {
      headers: { Cookie: cookie },
    }))

    await expect(sessionResponse.json()).resolves.toMatchObject({ authorized: true, configured: true })
  })

  it('clears the session on logout', async () => {
    const response = await handler.fetch(new Request('https://saengak.com.tw/api/test-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects cross-origin login requests', async () => {
    const response = await handler.fetch(new Request('https://saengak.com.tw/api/test-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://example.com',
      },
      body: JSON.stringify({
        action: 'login',
        username: 'preview-tester',
        password: 'correct-horse-battery-staple',
      }),
    }))

    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
