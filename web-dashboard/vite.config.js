import { defineConfig } from 'vite'

export default defineConfig({
  // web-dashboard/ adalah root project Vite
  root: '.',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    // Proxy semua request ke Express saat development
    // Termasuk /socket.io dan /api
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,          // ← wajib untuk WebSocket / Socket.IO
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})