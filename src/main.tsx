import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import App from './App.tsx'
// import { supabase } from './lib/supabase'

console.log('STEP 1: React imports loaded successfully');

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <div style={{ padding: 20, fontSize: 24 }}>
            <h1>✅ React is Working!</h1>
            <p>If you see this, React itself is fine. Next we'll test App.tsx.</p>
        </div>
    </StrictMode>,
)
