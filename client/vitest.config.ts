/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 🧪 Vitest Configuration for Testing
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // 🌐 Environment setup
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    
    // 📊 Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        }
      }
    },
    
    // 🎯 Include/exclude patterns
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.config.*',
    ],
    
    // ⚡ Performance settings
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    
    // 🔧 Mock settings
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // 📝 Reporter configuration
    reporter: ['verbose', 'html'],
    outputFile: {
      html: './coverage/test-results.html'
    },
    
    // 🌍 Global test variables
    define: {
      __TEST__: true,
    },
  },
  
  // 🎯 Optimize dependencies for testing
  optimizeDeps: {
    include: [
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
    ],
  },
})