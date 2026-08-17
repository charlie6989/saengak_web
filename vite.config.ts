
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  appType: 'spa', // 👈 確保為單頁應用
  base: process.env.VITE_BASE || '/', // 👈 若未部署子路徑保持根目錄
  define: {
    // __BASE_PATH__ removed as it is no longer used
  },
  plugins: [
    react(),
    // 必須放在 plugins 陣列最後，確保處理的是其他 plugin 轉換完的最終產物。
    // 若未設定 SENTRY_AUTH_TOKEN，官方行為是印出警告並跳過上傳，不會讓 build 失敗。
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
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
    // 'hidden' 產生 sourcemap 供 Sentry 解析堆疊，但不在 bundle 中插入
    // //# sourceMappingURL= 標頭，避免洩漏原始碼位置給使用者。
    sourcemap: 'hidden'
  }
})
