
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  appType: 'spa', // 👈 確保為單頁應用
  base: process.env.VITE_BASE || '/', // 👈 若未部署子路徑保持根目錄
  define: {
    __BASE_PATH__: JSON.stringify(process.env.VITE_BASE || '/')
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'out',
    sourcemap: true
  }
})
