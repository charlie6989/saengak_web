import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'saengak_test_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map()

function getConfig() {
  return {
    username: process.env.SAENGAK_TEST_USERNAME ?? process.env.TEST_ACCOUNT_USERNAME ?? '',
    password: process.env.SAENGAK_TEST_PASSWORD ?? process.env.TEST_ACCOUNT_PASSWORD ?? '',
    sessionSecret: process.env.SAENGAK_TEST_SESSION_SECRET ?? '',
  }
}

function getEffectiveOrigin(request) {
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  return new URL(request.url).origin
}

function isOriginAllowed(requestOrigin, request) {
  if (!requestOrigin) return true
  const effectiveOrigin = getEffectiveOrigin(request)
  if (requestOrigin === effectiveOrigin) return true
  if (requestOrigin === new URL(request.url).origin) return true

  const allowedOrigins = (process.env.CheckoutAllowedOrigins ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (allowedOrigins.length > 0 && allowedOrigins.includes(requestOrigin)) {
    return true
  }

  return false
}

function isStrongConfig({ username, password, sessionSecret }) {
  return username.length >= 6 && password.length >= 24 && sessionSecret.length >= 32
}

function getClientKey(request, secret) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown-client'
  return createHmac('sha256', secret || 'unconfigured').update(forwarded).digest('base64url')
}

function getAttemptState(key, now = Date.now()) {
  const current = attempts.get(key)
  if (!current || now - current.startedAt >= ATTEMPT_WINDOW_MS) {
    const fresh = { count: 0, startedAt: now }
    attempts.set(key, fresh)
    return fresh
  }
  return current
}

function retryAfterSeconds(state, now = Date.now()) {
  return Math.max(1, Math.ceil((state.startedAt + ATTEMPT_WINDOW_MS - now) / 1000))
}

function resetAttemptState() {
  attempts.clear()
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
    const configured = isStrongConfig(config)

    const isLocal =
      new URL(request.url).hostname === 'localhost' ||
      new URL(request.url).hostname === '127.0.0.1' ||
      new URL(request.url).hostname === '::1'

    if (request.method === 'GET') {
      return json({
        authorized: isLocal || (configured && isAuthorized(request, config.sessionSecret)),
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
    if (requestOrigin && !isOriginAllowed(requestOrigin, request)) {
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
      return json({ error: '測試登入尚未安全設定完成。' }, { status: 503 })
    }

    const clientKey = getClientKey(request, config.sessionSecret)
    const attemptState = getAttemptState(clientKey)
    if (attemptState.count >= MAX_ATTEMPTS) {
      const retryAfter = retryAfterSeconds(attemptState)
      return json({ error: '嘗試次數過多，請稍後再試。' }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      })
    }

    const usernameMatches = safeEqual(body?.username ?? '', config.username)
    const passwordMatches = safeEqual(body?.password ?? '', config.password)

    if (!usernameMatches || !passwordMatches) {
      attemptState.count += 1
      await new Promise((resolve) => setTimeout(resolve, 450))
      if (attemptState.count >= MAX_ATTEMPTS) {
        return json({ error: '嘗試次數過多，請稍後再試。' }, {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds(attemptState)) },
        })
      }
      return json({ error: '帳號或密碼不正確。' }, { status: 401 })
    }

    attempts.delete(clientKey)
    const session = createSession(config.sessionSecret)
    return json({ ok: true }, {
      headers: {
        'Set-Cookie': sessionCookie(request, session, SESSION_SECONDS),
      },
    })
  },
}

export { COOKIE_NAME, SESSION_SECONDS, isAuthorized, isStrongConfig, resetAttemptState }
