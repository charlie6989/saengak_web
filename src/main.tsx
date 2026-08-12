import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TestAccessGate from './TestAccessGate.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TestAccessGate />
    </StrictMode>,
)
