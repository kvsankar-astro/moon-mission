/**
 * Vite Configuration for Chandrayaan-3 Animation Project
 * 
 * Optimized for:
 * - ES6 modules (import/export)
 * - Static asset serving
 * - Development with HMR
 * - Test server automation
 * - CORS handling for fetch operations
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory for the project
  root: '.',
  
  // Public directory for static assets
  publicDir: '.',
  
  // Server configuration
  server: {
    port: 7274,
    host: '127.0.0.1', // Use IPv4 only
    open: false, // Don't auto-open browser (useful for tests)
    cors: true,
    fs: {
      allow: [
        '.',
        'assets',
        'third-party',
        'test'
      ]
    }
  },
  
  // Build configuration (for future use)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'chandrayaan3.html')
      }
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@assets': resolve(__dirname, 'assets'),
      '@third-party': resolve(__dirname, 'third-party')
    }
  },
  
  // Optimized dependencies
  optimizeDeps: {
    exclude: [
      // Exclude large libraries that are already bundled
      'three'
    ],
    include: [
      // Pre-bundle commonly used dependencies
    ]
  },
  
  // Development specific settings
  define: {
    // Define environment variables if needed
    __DEV__: true
  },
  
  // Plugin configuration (can be extended)
  plugins: [
    // Add plugins as needed for future enhancements
  ],
  
  // Test configuration for Vitest
  test: {
    // Global test configuration
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 180000, // 3 minutes for setup/teardown hooks
    teardownTimeout: 180000, // 3 minutes for cleanup
    
    // Browser testing specific
    browser: {
      enabled: false, // We use Playwright directly
    },
    
    // Environment settings
    environment: 'node',
    
    // Reporter configuration
    reporter: ['verbose'],
    
    // Coverage configuration (if needed in future)
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        'third-party/**'
      ]
    }
  }
});
