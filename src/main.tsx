import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import TestAccessGate from './TestAccessGate.tsx'
import { sanitizeBreadcrumb, sanitizeEvent } from './lib/sentry'
import './index.css'

const sentryDsn = import.meta.env.VITE_PUBLIC_SENTRY_DSN

if (sentryDsn) {
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        sendDefaultPii: false,
        beforeSend: (event) => sanitizeEvent(event),
        beforeBreadcrumb: (breadcrumb) => sanitizeBreadcrumb(breadcrumb),
      })
      ;(window as typeof window & { Sentry?: typeof Sentry }).Sentry = Sentry
    })
    .catch(() => {
      // 錯誤回報服務不可用時，網站與結帳流程仍須正常運作。
    })
}

// 判斷是否為本地端環境（localhost / 127.0.0.1 / ::1 / 0.0.0.0 或 Vite dev 模式）
// 本地測試端直接進入主站 (App)，完全不需密碼閘門；僅雲端發佈環境才需測試者帳密閘門 (TestAccessGate)
const isLocalEnvironment =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname === '::1' ||
    window.location.hostname === '0.0.0.0' ||
    Boolean(import.meta.env.DEV))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isLocalEnvironment ? <App /> : <TestAccessGate />}
  </StrictMode>,
)
