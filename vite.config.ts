
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  appType: 'spa', // 👈 確保為單頁應用
  base: process.env.VITE_BASE || '/', // 👈 若未部署子路徑保持根目錄
  test: {
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
  },
  define: {
    // __BASE_PATH__ removed as it is no longer used
  },
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          telemetry: false,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })]
      : []),
  ],
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
    outDir: 'dist',
    // 只有具備 Sentry 上傳權限時才產生隱藏 source map。
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false
  }
})
