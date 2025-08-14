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
  publicDir: 'public',
  
  // Server configuration
  server: {
    port: 8000,
    host: '127.0.0.1', // Use IPv4 only
    open: false, // Don't auto-open browser (useful for tests)
    cors: true,
    // Remove problematic CORS headers that prevent page loading
    fs: {
      // Allow serving files from the entire project
      allow: ['..']
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
  ]
});