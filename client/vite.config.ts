import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// 🚀 Production-Ready Vite Configuration for toaletna.com
export default defineConfig({
  plugins: [
    react({
      // Standard React configuration
      include: "**/*.{jsx,tsx}",
    }),
    
    // PWA Plugin for production
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/toaletna\.com\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|webp|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'icon-*.png', 'og-image.jpg'],
      manifest: false // We have our own manifest.json
    }),
    
    // Bundle analyzer for production builds
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    // Safe minification for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
        // Removed unsafe optimizations that could break React
      },
      mangle: {
        // Safer mangling to avoid React hooks issues
        reserved: ['React', 'useState', 'useEffect', 'useLayoutEffect', 'useCallback', 'useMemo', 'useRef', 'useContext']
      },
      format: {
        comments: false
      }
    },
    // Target modern browsers for better optimization
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
    // Optimize chunk sizes
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 📦 Optimized chunk splitting for aggressive caching
        manualChunks: (id) => {
          // Vendor chunk for React core
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor'
          }
          
          // UI components in separate chunk
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'ui-vendor'
          }
          
          // Map libraries (likely large)
          if (id.includes('leaflet')) {
            return 'map-vendor'
          }
          
          // Database and API libraries
          if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
            return 'data-vendor'
          }
          
          // Firebase (authentication)
          if (id.includes('firebase')) {
            return 'auth-vendor'
          }
          
          // Utility libraries
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('zod')) {
            return 'utils-vendor'
          }
          
          // Node modules (catch-all for other dependencies)
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
        // Optimize file naming for CDN caching
        chunkFileNames: (chunkInfo) => {
          // Use shorter hashes for better CDN performance
          return `js/[name]-[hash:8].js`
        },
        entryFileNames: `js/[name]-[hash:8].js`,
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop()
          // Organize assets by type
          if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico'].includes(extType)) {
            return `img/[name]-[hash:8].[ext]`
          }
          if (['css'].includes(extType)) {
            return `css/[name]-[hash:8].[ext]`
          }
          if (['woff', 'woff2', 'ttf', 'eot'].includes(extType)) {
            return `fonts/[name]-[hash:8].[ext]`
          }
          return `assets/[name]-[hash:8].[ext]`
        },
      },
      // Input configuration - only main for production
      ...(process.env.NODE_ENV === 'production' ? {} : {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          debug: path.resolve(__dirname, 'debug.html')
        }
      })
    },
    // Advanced dependency optimization
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    // Optimize asset handling
    assetsInclude: ['**/*.md'],
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize CSS
    cssMinify: true,
    // Tree shaking
    treeshake: {
      preset: 'recommended',
      moduleSideEffects: false
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
  // 🎯 Advanced dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'leaflet',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'firebase/auth',
      'clsx',
      'tailwind-merge'
    ],
    exclude: ['@vite/client', '@vite/env'],
    // Force optimization of specific dependencies
    force: process.env.NODE_ENV === 'production',
  },
  
  // Removed experimental CDN configuration to avoid deployment issues
  // Global definitions and environment variables
  define: {
    global: 'globalThis',
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __DOMAIN__: JSON.stringify('https://toaletna.com'),
    __GA_ID__: JSON.stringify('G-FPF6DRB75R')
  },
  // Preview server configuration
  preview: {
    port: 4173,
    strictPort: true,
  },
}) 