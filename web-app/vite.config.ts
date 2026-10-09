import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    // 5173 belongs to the `web` container (the Expo export, served by nginx and
    // proxying /admin here). Asking for it again made Vite fall back to the next
    // free port, so `npm run dev` landed on a different number each run and the
    // UI appeared to change with the port. Own a port nothing else claims, and
    // fail loudly rather than drift if it is ever taken.
    port: 5181,
    strictPort: true,
    hmr: {
      // Browser access goes through scripts/dev-gateway.mjs. Keep Vite's HMR
      // websocket on that same visible origin and let the gateway route it.
      clientPort: 5180,
      path: '/admin-hmr'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
