import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TestAccessGate from './TestAccessGate.tsx'
import { sanitizeBreadcrumb, sanitizeEvent } from './lib/sentry'

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

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TestAccessGate />
    </StrictMode>,
)
