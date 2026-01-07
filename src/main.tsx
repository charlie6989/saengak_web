import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './lib/supabase'

console.log('App starting...', {
  env: import.meta.env,
  supabaseUrl: import.meta.env.VITE_PUBLIC_SUPABASE_URL ? 'Set' : 'Unset'
});


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
