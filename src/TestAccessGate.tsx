import { FormEvent, lazy, Suspense, useEffect, useState } from 'react'
import ComingSoonPage from './pages/coming-soon/page.tsx'

const TestSite = lazy(() => import('./TestSite.tsx'))

type AccessState = 'checking' | 'locked' | 'authorized'

function isLocalHost() {
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname === '::1' ||
      window.location.hostname === '0.0.0.0' ||
      Boolean(import.meta.env.DEV))
  )
}

function TestAccessGate() {
  const [accessState, setAccessState] = useState<AccessState>(() =>
    isLocalHost() ? 'authorized' : 'checking',
  )
  const [showLogin, setShowLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // 本地環境直接通行
    if (isLocalHost()) {
      setAccessState('authorized')
      return
    }

    const controller = new AbortController()

    fetch('/api/test-access', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return { authorized: false }
        return response.json() as Promise<{ authorized?: boolean }>
      })
      .then(({ authorized }) => {
        setAccessState(authorized ? 'authorized' : 'locked')
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setAccessState('locked')
      })

    return () => controller.abort()
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/test-access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setError(body?.error ?? '目前無法登入，請稍後再試。')
        return
      }

      setAccessState('authorized')
      setShowLogin(false)
    } catch {
      setError('目前無法登入，請稍後再試。')
    } finally {
      setSubmitting(false)
    }
  }

  if (accessState === 'authorized') {
    return (
      <Suspense fallback={<ComingSoonPage />}>
        <TestSite />
      </Suspense>
    )
  }

  return (
    <ComingSoonPage>
      {accessState === 'locked' && (
        <button
          className="coming-soon__login-trigger"
          type="button"
          onClick={() => {
            setError('')
            setShowLogin(true)
          }}
        >
          測試登入
        </button>
      )}

      {showLogin && (
        <div className="test-login" role="dialog" aria-modal="true" aria-labelledby="test-login-title">
          <button
            className="test-login__close"
            type="button"
            aria-label="關閉測試登入"
            onClick={() => setShowLogin(false)}
          >
            ×
          </button>
          <h2 id="test-login-title" className="test-login__title">測試登入</h2>
          <form className="test-login__form" onSubmit={handleLogin}>
            <label className="test-login__field">
              <span>帳號</span>
              <input name="username" type="text" autoComplete="username" required autoFocus />
            </label>
            <label className="test-login__field">
              <span>密碼</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <p className="test-login__error" role="alert">{error}</p>}
            <button className="test-login__submit" type="submit" disabled={submitting}>
              {submitting ? '登入中…' : '登入'}
            </button>
          </form>
        </div>
      )}
    </ComingSoonPage>
  )
}

export default TestAccessGate
