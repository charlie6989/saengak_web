import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { sanitizeBreadcrumb, sanitizeEvent } from './lib/sentry'
import { reloadForStaleChunk } from './lib/staleChunk'
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

// Vite 載入新頁面需要的分塊失敗（多半是部署後的舊分頁）：重新載入一次拿到新版。
// 不攔下錯誤，讓頁面的 Error Boundary 顯示「正在重新載入」。
window.addEventListener('vite:preloadError', (event) => {
  reloadForStaleChunk((event as Event & { payload?: unknown }).payload)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
