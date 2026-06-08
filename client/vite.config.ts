import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// 🔧 MINIMAL Vite Configuration to fix the script injection issue
export default defineConfig({
  plugins: [
    react(),
    // 🛡️ Workbox-based service worker. Precaches every hashed build asset with a
    // content revision and auto-updates on deploy — this is what stops the
    // "styling sometimes doesn't load" failures the old hand-written sw.js caused.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,           // we register once, manually, in main.tsx
      devOptions: { enabled: false }, // never run a SW in `npm run dev`
      manifest: false,                // keep the existing public/manifest.json
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        // Let these paths hit the network instead of being served the cached map
        // shell: /api/* (backend), /blog* (proxied to the separate blog service —
        // otherwise the SW renders the map at /blog), and the SEO files.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/blog(\/|$)/,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Toilet list + reviews: prefer fresh, fall back to a short-lived cache offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/toilets'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-toilets',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google profile avatars — cache after first success so repeated
            // auth re-renders don't hammer lh3.googleusercontent.com (429s).
            urlPattern: ({ url }) => url.hostname === 'lh3.googleusercontent.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-avatars',
              expiration: { maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  envDir: path.resolve(__dirname, '..'),
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