/**
 * Vite Server Manager for Tests
 * 
 * Provides reliable server management using Vite for all test scenarios.
 * Advantages over Python HTTP server:
 * - Lightning fast startup
 * - Reliable programmatic control
 * - Better CORS handling
 * - ES6 module support
 * - HMR for development
 */

import { createServer } from 'vite';
import { resolve } from 'path';

export class ViteServerManager {
  constructor(options = {}) {
    this.options = {
      port: options.port || 8000,
      host: options.host || '127.0.0.1', // Use IPv4 only
      silent: options.silent || false,
      ...options
    };
    
    this.server = null;
    this.startupPromise = null;
  }
  
  /**
   * Start the Vite development server
   * @returns {Promise<{url: string, port: number}>}
   */
  async start() {
    if (this.server) {
      if (!this.options.silent) console.log('✅ Vite server already running');
      return this.getServerInfo();
    }
    
    if (this.startupPromise) {
      return this.startupPromise;
    }
    
    this.startupPromise = this._startServer();
    return this.startupPromise;
  }
  
  async _startServer() {
    try {
      if (!this.options.silent) console.log('🚀 Starting Vite development server...');
      
      // Create Vite server instance
      this.server = await createServer({
        root: resolve(process.cwd()),
        server: {
          port: this.options.port,
          host: this.options.host,
          open: false,
          cors: true,
          strictPort: false, // Allow port increment if occupied
        },
        logLevel: this.options.silent ? 'error' : 'info',
        clearScreen: false
      });
      
      // Start the server
      await this.server.listen();
      
      const info = this.getServerInfo();
      if (!this.options.silent) {
        console.log(`✅ Vite server running at ${info.url}`);
      }
      
      return info;
      
    } catch (error) {
      if (!this.options.silent) {
        console.error('❌ Failed to start Vite server:', error.message);
      }
      this.server = null;
      this.startupPromise = null;
      throw error;
    }
  }
  
  /**
   * Stop the server
   */
  async stop() {
    if (this.server) {
      try {
        await this.server.close();
        if (!this.options.silent) console.log('🛑 Vite server stopped');
      } catch (error) {
        if (!this.options.silent) {
          console.warn('⚠️  Warning while stopping server:', error.message);
        }
      }
      this.server = null;
      this.startupPromise = null;
    }
  }
  
  /**
   * Check if server is running and healthy
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    if (!this.server) return false;
    
    try {
      const info = this.getServerInfo();
      const response = await fetch(info.url);
      return response.ok || response.status === 404; // 404 is fine for directory listing
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Wait for server to be ready and responsive
   * @param {number} maxAttempts - Maximum number of health checks
   * @param {number} delayMs - Delay between attempts
   * @returns {Promise<boolean>}
   */
  async waitForReady(maxAttempts = 10, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isHealthy()) {
        return true;
      }
      
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return false;
  }
  
  /**
   * Get server information
   * @returns {{url: string, port: number, host: string}}
   */
  getServerInfo() {
    if (!this.server) {
      throw new Error('Server is not running');
    }
    
    const address = this.server.httpServer.address();
    const port = typeof address === 'string' ? this.options.port : address.port;
    const host = typeof address === 'string' ? this.options.host : address.address;
    
    return {
      url: `http://${host === '::' ? 'localhost' : host}:${port}`,
      port,
      host
    };
  }
  
  /**
   * Restart the server
   */
  async restart() {
    await this.stop();
    return this.start();
  }
  
  /**
   * Get the URL for a specific path
   * @param {string} path - Path to append to base URL
   * @returns {string}
   */
  getUrl(path = '') {
    const info = this.getServerInfo();
    return `${info.url}/${path.replace(/^\//, '')}`;
  }
}

/**
 * Singleton instance for shared use across tests
 */
let sharedInstance = null;

export function getSharedViteServer(options = {}) {
  if (!sharedInstance) {
    sharedInstance = new ViteServerManager({
      silent: true, // Shared instance runs silently
      ...options
    });
  }
  return sharedInstance;
}

export async function ensureViteServer(options = {}) {
  const server = getSharedViteServer(options);
  await server.start();
  return server;
}

// Cleanup on process exit
process.on('exit', () => {
  if (sharedInstance) {
    sharedInstance.stop().catch(() => {}); // Ignore errors during cleanup
  }
});

process.on('SIGINT', async () => {
  if (sharedInstance) {
    await sharedInstance.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (sharedInstance) {
    await sharedInstance.stop();
  }
  process.exit(0);
});