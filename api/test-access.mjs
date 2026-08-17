import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'saengak_test_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7

function getConfig() {
  return {
    username: process.env.SAENGAK_TEST_USERNAME ?? '',
    password: process.env.SAENGAK_TEST_PASSWORD ?? '',
    sessionSecret: process.env.SAENGAK_TEST_SESSION_SECRET ?? '',
  }
}

function safeEqual(left, right) {
  const leftHash = createHash('sha256').update(String(left)).digest()
  const rightHash = createHash('sha256').update(String(right)).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function sign(expiresAt, secret) {
  return createHmac('sha256', secret).update(String(expiresAt)).digest('base64url')
}

function createSession(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  return `${expiresAt}.${sign(expiresAt, secret)}`
}

function readCookie(request) {
  const cookies = request.headers.get('cookie') ?? ''
  const cookie = cookies
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE_NAME}=`))

  return cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : ''
}

function isAuthorized(request, secret) {
  if (!secret) return false

  const [expiresAtText, signature] = readCookie(request).split('.')
  const expiresAt = Number(expiresAtText)

  if (!expiresAtText || !signature || !Number.isSafeInteger(expiresAt)) return false
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false

  return safeEqual(signature, sign(expiresAt, secret))
}

function json(body, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(JSON.stringify(body), { ...init, headers })
}

function sessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAge}`
}

export default {
  async fetch(request) {
    const config = getConfig()
    const configured = Boolean(config.username && config.password && config.sessionSecret)

    if (request.method === 'GET') {
      return json({
        authorized: configured && isAuthorized(request, config.sessionSecret),
        configured,
      })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.' }, {
        status: 405,
        headers: { Allow: 'GET, POST' },
      })
    }

    const requestOrigin = request.headers.get('origin')
    if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
      return json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (body?.action === 'logout') {
      return json({ ok: true }, {
        headers: { 'Set-Cookie': sessionCookie(request, '', 0) },
      })
    }

    if (!configured) {
      return json({ error: '測試登入尚未設定完成。' }, { status: 503 })
    }

    const usernameMatches = safeEqual(body?.username ?? '', config.username)
    const passwordMatches = safeEqual(body?.password ?? '', config.password)

    if (!usernameMatches || !passwordMatches) {
      await new Promise((resolve) => setTimeout(resolve, 450))
      return json({ error: '帳號或密碼不正確。' }, { status: 401 })
    }

    const session = createSession(config.sessionSecret)
    return json({ ok: true }, {
      headers: {
        'Set-Cookie': sessionCookie(request, session, SESSION_SECONDS),
      },
    })
  },
}

export { COOKIE_NAME, SESSION_SECONDS, isAuthorized }
