import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Served from the ROOT of domestos.toaletna.com (not a /blog-style sub-path),
// so base = '/'. During `npm run dev` the API calls are proxied to the local
// Express server (server.mjs, default :4000); in production server.mjs serves
// both the built frontend and /api from the same origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4001,
    proxy: {
      '/api': 'http://localhost:4000',
      '/healthz': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
