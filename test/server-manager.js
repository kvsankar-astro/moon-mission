#!/usr/bin/env node
/**
 * Cross-platform test server manager
 * Works on Windows, macOS, and Linux
 *
 * Features:
 *   - Preferred port (8111) with automatic reuse of existing servers
 *   - In CI mode: fails if port is in use (clean state required)
 *   - In local mode: reuses existing server on the port (reuseExistingServer pattern)
 *
 * Usage:
 *   node test/server-manager.js start   - Start the test server (or reuse existing)
 *   node test/server-manager.js stop    - Stop the test server (if we started it)
 *   node test/server-manager.js status  - Check server status
 */

import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'net';

const TEST_PORT = 8111;
const PID_FILE = join(process.cwd(), '.test-server.pid');
const STATE_FILE = join(process.cwd(), '.test-server.json');

// Check if running in CI environment
const isCI = process.env.CI === 'true' || process.env.CI === '1' || !!process.env.GITHUB_ACTIONS;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const client = createConnection({ port, host: '127.0.0.1' }, () => {
      client.end();
      resolve(true);
    });
    client.on('error', () => resolve(false));
  });
}

async function waitForServer(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isPortInUse(port)) {
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function getState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState() {
  try {
    if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  } catch (e) {}
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function startServer() {
  const state = getState();

  // Check if we already started a server in this session
  if (state?.pid && state?.ownedByUs && isProcessRunning(state.pid)) {
    console.log(`Server already running (PID: ${state.pid}, owned by us)`);
    return true;
  }

  // Check if port is in use
  const portInUse = await isPortInUse(TEST_PORT);

  if (portInUse) {
    if (isCI) {
      // In CI, we need a clean state - fail if port is in use
      console.error(`Error: Port ${TEST_PORT} is already in use (CI mode requires clean state)`);
      process.exit(1);
    } else {
      // In local mode, reuse the existing server (reuseExistingServer pattern)
      console.log(`Reusing existing server on port ${TEST_PORT} (reuseExistingServer mode)`);
      saveState({ port: TEST_PORT, pid: null, ownedByUs: false, reused: true });
      return true;
    }
  }

  console.log(`Starting Vite server on port ${TEST_PORT}...`);

  // Start vite - use shell on Windows for proper npx handling
  const isWindows = process.platform === 'win32';
  const serverProcess = spawn('npx', ['vite', '--port', String(TEST_PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    detached: !isWindows  // detached doesn't work well on Windows
  });

  // Save state - we own this server
  saveState({ port: TEST_PORT, pid: serverProcess.pid, ownedByUs: true, reused: false });

  // Also write legacy PID file for compatibility
  writeFileSync(PID_FILE, String(serverProcess.pid));

  // Don't wait for output, just let it run
  serverProcess.unref();

  // Wait for server to be ready
  const ready = await waitForServer(TEST_PORT);
  if (ready) {
    console.log(`Server ready at http://localhost:${TEST_PORT} (PID: ${serverProcess.pid})`);
    return true;
  } else {
    console.error('Server failed to start within timeout');
    clearState();
    process.exit(1);
  }
}

async function stopServer() {
  const state = getState();

  // If we didn't start the server (reused existing), don't stop it
  if (state?.reused && !state?.ownedByUs) {
    console.log('Server was reused (not started by us) - leaving it running');
    clearState();
    return;
  }

  const pid = state?.pid;

  if (pid && isProcessRunning(pid)) {
    console.log(`Stopping server (PID: ${pid})...`);
    try {
      // On Windows, we need to kill the process tree
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } else {
        process.kill(-pid, 'SIGTERM');  // Kill process group
        await new Promise(r => setTimeout(r, 1000));
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (e) {
          // Already dead
        }
      }
    } catch (e) {
      // Process might already be dead
    }
    console.log('Server stopped');
  } else if (pid) {
    console.log('Server process not found (may have already stopped)');
  } else {
    console.log('No server to stop');
  }

  clearState();

  // Also try to clean up orphaned processes on our port (only if we owned the server)
  if (state?.ownedByUs && await isPortInUse(TEST_PORT)) {
    console.log(`Port ${TEST_PORT} still in use, attempting cleanup...`);
    try {
      if (process.platform === 'win32') {
        // Find and kill process on port (Windows)
        const result = execSync(`netstat -ano | findstr :${TEST_PORT} | findstr LISTENING`, { encoding: 'utf-8' });
        const lines = result.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const portPid = parts[parts.length - 1];
          if (portPid && !isNaN(parseInt(portPid))) {
            execSync(`taskkill /F /PID ${portPid}`, { stdio: 'ignore' });
          }
        }
      } else {
        // Unix - use fuser or lsof
        execSync(`fuser -k ${TEST_PORT}/tcp 2>/dev/null || lsof -ti:${TEST_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
      }
    } catch (e) {
      // Best effort
    }
  }
}

async function serverStatus() {
  const state = getState();
  const portInUse = await isPortInUse(TEST_PORT);

  console.log(`Port ${TEST_PORT}: ${portInUse ? 'in use' : 'available'}`);

  if (state) {
    console.log(`State: ${state.ownedByUs ? 'started by us' : 'reused existing'}`);
    if (state.pid) {
      const running = isProcessRunning(state.pid);
      console.log(`PID ${state.pid}: ${running ? 'running' : 'not running'}`);
    }
  } else {
    console.log('State: no state file');
  }

  return portInUse;
}

// Main
const command = process.argv[2];

switch (command) {
  case 'start':
    startServer();
    break;
  case 'stop':
    stopServer();
    break;
  case 'status':
    serverStatus();
    break;
  default:
    console.log('Usage: node test/server-manager.js [start|stop|status]');
    console.log('');
    console.log('Environment:');
    console.log('  CI=true    Force CI mode (fail if port in use)');
    console.log('  CI not set Local mode (reuse existing server)');
    process.exit(1);
}
