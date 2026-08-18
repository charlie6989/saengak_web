import type { ReactNode } from 'react'
import './style.css'

type ComingSoonPageProps = {
  children?: ReactNode
}

function ComingSoonPage({ children }: ComingSoonPageProps) {
  return (
    <main className="coming-soon" aria-labelledby="coming-soon-title">
      <div className="coming-soon__content">
        <p className="coming-soon__brand">SAENGAK</p>
        <h1 id="coming-soon-title" className="coming-soon__title">
          Coming Soon
        </h1>
        {children}
      </div>
    </main>
  )
}

export default ComingSoonPage
