import { useEffect } from 'react'
import App from './App.tsx'
import './index.css'
import './test-site.css'

function TestSite() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'SAENGAK | 測試網站'

    return () => {
      document.title = previousTitle
    }
  }, [])

  async function handleLogout() {
    await fetch('/api/test-access', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => undefined)

    window.location.assign('/')
  }

  return (
    <>
      <App />
      <button className="test-site-logout" type="button" onClick={handleLogout}>
        結束測試
      </button>
    </>
  )
}

export default TestSite
