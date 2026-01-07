// import App from './App.tsx'
// import { supabase } from './lib/supabase'

console.log('SANITY CHECK: Main.tsx is running');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ padding: 20, fontSize: 24 }}>
      <h1>System Status: ONLINE</h1>
      <p>If you see this, React is working. The crash is in App.tsx.</p>
    </div>
  </StrictMode>,
)
