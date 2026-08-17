import * as Sentry from '@sentry/react'
import { sanitizeBreadcrumb, sanitizeEvent } from './lib/sentry'

// Sentry 初始化必須在其他 import 之前執行，確保盡早捕獲例外。
// 若未設定 VITE_PUBLIC_SENTRY_DSN，Sentry SDK 會自動以 no-op 模式運作，不影響應用程式。
Sentry.init({
  dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  beforeSend: (event) => sanitizeEvent(event),
  beforeBreadcrumb: (breadcrumb) => sanitizeBreadcrumb(breadcrumb),
})

// 讓 src/lib/sentry.ts 的 captureExceptionSafe 能偵測到全域 Sentry 已掛載。
;(window as any).Sentry = Sentry

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('STEP 2: Testing App.tsx import...');

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
