/**
 * Playwright MCP Server Manager
 * 
 * Manages the lifecycle of the Playwright MCP server for automated testing.
 * Provides singleton pattern to ensure only one server instance runs at a time.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const sleep = promisify(setTimeout);

class PlaywrightMCPServerManager {
  constructor() {
    this.server = null;
    this.port = 8900;
    this.isStarting = false;
    this.isRunning = false;
    this.startupTimeout = 30000; // 30 seconds
  }

  /**
   * Check if the MCP server is running on the specified port
   */
  async isServerRunning(port = this.port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Find an available port starting from the default port
   */
  async findAvailablePort(startPort = this.port) {
    for (let port = startPort; port < startPort + 10; port++) {
      if (!(await this.isServerRunning(port))) {
        return port;
      }
    }
    throw new Error(`No available port found between ${startPort} and ${startPort + 9}`);
  }

  /**
   * Start the Playwright MCP server
   */
  async startServer(options = {}) {
    if (this.isRunning) {
      return { port: this.port, url: `ws://127.0.0.1:${this.port}` };
    }
    
    if (this.isStarting) {
      // Wait for the current startup to complete
      while (this.isStarting) {
        await sleep(100);
      }
      return { port: this.port, url: `ws://127.0.0.1:${this.port}` };
    }

    this.isStarting = true;

    try {
      // Check if server is already running externally
      if (await this.isServerRunning(this.port)) {
        if (!options.silent) {
          console.log(`✅ Playwright MCP server already running on port ${this.port}`);
        }
        this.isRunning = true;
        this.isStarting = false;
        return { port: this.port, url: `ws://127.0.0.1:${this.port}` };
      }

      // Find available port
      this.port = await this.findAvailablePort();
      
      if (!options.silent) {
        console.log(`🚀 Starting Playwright MCP server on port ${this.port}...`);
      }

      // Start the server
      this.server = spawn('npx', ['@playwright/mcp@0.0.32', '--port', this.port.toString()], {
        stdio: options.silent ? ['ignore', 'ignore', 'pipe'] : ['ignore', 'pipe', 'pipe'],
        shell: true,
        detached: false
      });

      // Handle server output
      if (!options.silent && this.server.stdout) {
        this.server.stdout.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            console.log(`[MCP Server] ${output}`);
          }
        });
      }

      if (this.server.stderr) {
        this.server.stderr.on('data', (data) => {
          const error = data.toString().trim();
          if (error && !options.silent) {
            console.log(`[MCP Server Error] ${error}`);
          }
        });
      }

      // Handle server exit
      this.server.on('close', (code) => {
        if (!options.silent) {
          console.log(`[MCP Server] Process exited with code ${code}`);
        }
        this.isRunning = false;
        this.server = null;
      });

      this.server.on('error', (error) => {
        if (!options.silent) {
          console.error(`[MCP Server] Failed to start: ${error.message}`);
        }
        this.isRunning = false;
        this.server = null;
        this.isStarting = false;
        throw error;
      });

      // Wait for server to be ready
      const startTime = Date.now();
      while (!await this.isServerRunning(this.port)) {
        if (Date.now() - startTime > this.startupTimeout) {
          throw new Error(`Playwright MCP server failed to start within ${this.startupTimeout}ms`);
        }
        await sleep(500);
      }

      this.isRunning = true;
      this.isStarting = false;

      if (!options.silent) {
        console.log(`✅ Playwright MCP server running at ws://127.0.0.1:${this.port}`);
      }

      return { port: this.port, url: `ws://127.0.0.1:${this.port}` };

    } catch (error) {
      this.isStarting = false;
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stopServer(options = {}) {
    if (!this.server || !this.isRunning) {
      return;
    }

    if (!options.silent) {
      console.log('🛑 Stopping Playwright MCP server...');
    }

    try {
      // Send SIGTERM first for graceful shutdown
      this.server.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await sleep(2000);
      
      // Force kill if still running
      if (this.isRunning) {
        this.server.kill('SIGKILL');
        await sleep(1000);
      }
      
    } catch (error) {
      if (!options.silent) {
        console.error(`Error stopping MCP server: ${error.message}`);
      }
    } finally {
      this.isRunning = false;
      this.server = null;
    }
  }

  /**
   * Get server information
   */
  getServerInfo() {
    return {
      port: this.port,
      url: `ws://127.0.0.1:${this.port}`,
      isRunning: this.isRunning,
      isStarting: this.isStarting
    };
  }
}

// Singleton instance
let mcpServerManager = null;

/**
 * Get or create the singleton MCP server manager and ensure server is running
 */
export async function ensureMCPServer(options = {}) {
  if (!mcpServerManager) {
    mcpServerManager = new PlaywrightMCPServerManager();
  }
  
  await mcpServerManager.startServer(options);
  return mcpServerManager;
}

/**
 * Stop the MCP server (mainly for cleanup in tests)
 */
export async function stopMCPServer(options = {}) {
  if (mcpServerManager) {
    await mcpServerManager.stopServer(options);
  }
}

// Cleanup on process exit
process.on('exit', () => {
  if (mcpServerManager) {
    mcpServerManager.stopServer({ silent: true });
  }
});

process.on('SIGINT', async () => {
  if (mcpServerManager) {
    await mcpServerManager.stopServer({ silent: true });
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (mcpServerManager) {
    await mcpServerManager.stopServer({ silent: true });
  }
  process.exit(0);
});