import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 🚀 Optimized Vite Configuration for Performance
export default defineConfig({
  plugins: [
    react({
      // Optimize React Fast Refresh
      fastRefresh: true,
      // Remove dev annotations in production
      jsxImportSource: undefined,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production', // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // Remove specific console methods
      },
      mangle: {
        safari10: true, // Fix Safari 10 compatibility
      },
    },
    // Optimize chunk sizes
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 📦 Optimized chunk splitting for better caching
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom'],
          
          // UI components library
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select'
          ],
          
          // Map-related libraries
          'map-vendor': ['leaflet'],
          
          // Database and API libraries
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],
          
          // Firebase auth
          'auth-vendor': ['firebase'],
          
          // Utility libraries
          'utils-vendor': ['clsx', 'tailwind-merge', 'zod', 'lucide-react'],
        },
        // Optimize file naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/[name]-[hash].js`;
        },
        entryFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
      // Input configuration
      input: {
        main: path.resolve(__dirname, 'index.html'),
        debug: path.resolve(__dirname, 'debug.html')
      }
    },
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  // 🔧 Development server optimization
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    },
    // Improve HMR performance
    hmr: {
      overlay: true,
    },
    // Faster file serving
    fs: {
      strict: false,
    },
  },
  // 🎯 Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'leaflet',
      '@supabase/supabase-js',
      '@tanstack/react-query',
    ],
    exclude: ['@vite/client', '@vite/env'],
  },
  // Global definitions
  define: {
    global: 'globalThis',
    // Enable performance monitoring in development
    __DEV__: process.env.NODE_ENV === 'development',
  },
  // Preview server configuration
  preview: {
    port: 4173,
    strictPort: true,
  },
}) 