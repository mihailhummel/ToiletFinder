import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 🔧 MINIMAL Vite Configuration to fix the script injection issue
export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist'
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}) 