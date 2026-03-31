#!/usr/bin/env node
/**
 * Cross-platform test server manager
 * Works on Windows, macOS, and Linux
 *
 * Features:
 *   - Preferred port (default 8111) with deterministic ownership by default
 *   - In CI mode: fails if port is in use (clean state required)
 *   - Optional local reuse mode via TEST_SERVER_REUSE=true
 *
 * Usage:
 *   node test/server-manager.js start   - Start the test server
 *   node test/server-manager.js stop    - Stop the test server (if we started it)
 *   node test/server-manager.js status  - Check server status
 */

import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'net';
import { getEffectiveTestPort, getServerStatePaths } from './local-test-config.js';

const ROOT_DIR = process.cwd();
const TEST_PORT = getEffectiveTestPort(ROOT_DIR);
const { pidFile: PID_FILE, stateFile: STATE_FILE } = getServerStatePaths(ROOT_DIR);
const POWERSHELL_EXE = process.env.SystemRoot
  ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  : 'powershell';
const NETSTAT_EXE = process.env.SystemRoot
  ? `${process.env.SystemRoot}\\System32\\netstat.exe`
  : 'netstat';

// Check if running in CI environment
const isCI = process.env.CI === 'true' || process.env.CI === '1' || !!process.env.GITHUB_ACTIONS;
const allowReuse = process.env.TEST_SERVER_REUSE === 'true' || process.env.TEST_SERVER_REUSE === '1';

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

function runPowershell(script, timeout = 15000) {
  const exe = POWERSHELL_EXE.includes(' ') ? `"${POWERSHELL_EXE}"` : POWERSHELL_EXE;
  return execSync(`${exe} -NoProfile -Command "${script}"`, { stdio: 'ignore', timeout });
}

function killPidWindows(pid) {
  // Prefer PowerShell Stop-Process; taskkill can hang in some environments.
  try {
    runPowershell(`Stop-Process -Id ${pid} -Force -ErrorAction Stop`);
    return;
  } catch (e) {
    // Fallback
  }

  try {
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 15000 });
  } catch (e) {
    // Best effort
  }
}

function killListenersOnPortWindows(port) {
  try {
    const exe = NETSTAT_EXE.includes(' ') ? `"${NETSTAT_EXE}"` : NETSTAT_EXE;
    const output = execSync(`${exe} -ano -p tcp`, { encoding: 'utf-8', timeout: 15000 });
    const lines = output.split(/\r?\n/);
    const pids = new Set();

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.includes(`:${port}`) || !line.includes('LISTENING')) continue;
      const parts = line.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) {
        pids.add(Number(pid));
      }
    }

    for (const pid of pids) {
      killPidWindows(pid);
    }
  } catch (e) {
    // Best effort
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
    if (isCI || !allowReuse) {
      const modeText = isCI ? 'CI mode requires clean state' : 'deterministic mode requires an owned server';
      console.error(`Error: Port ${TEST_PORT} is already in use (${modeText})`);
      process.exit(1);
    }

    console.log(`Reusing existing server on port ${TEST_PORT} (TEST_SERVER_REUSE=true)`);
    saveState({ port: TEST_PORT, pid: null, ownedByUs: false, reused: true });
    return true;
  }

  console.log(`Starting Vite server on port ${TEST_PORT}...`);

  // Spawn vite directly via node - works cross-platform without opening terminal windows
  let serverProcess;
  // Use node directly to spawn vite - avoids shell/cmd window issues on Windows
  const viteScript = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  serverProcess = spawn(process.execPath, [viteScript, '--port', String(TEST_PORT), '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
    windowsHide: true
  });

  // Save state - we own this server (PID may not be accurate on Windows with start /b)
  saveState({ port: TEST_PORT, pid: serverProcess.pid, ownedByUs: true, reused: false });

  // Also write legacy PID file for compatibility
  writeFileSync(PID_FILE, String(serverProcess.pid));

  // Detach from parent process
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
        killPidWindows(pid);
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
        killListenersOnPortWindows(TEST_PORT);
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

async function cleanupPort() {
  const portInUse = await isPortInUse(TEST_PORT);
  if (!portInUse) {
    clearState();
    console.log(`Port ${TEST_PORT} is already clean`);
    return;
  }

  console.log(`Cleaning listeners on port ${TEST_PORT}...`);
  try {
    if (process.platform === 'win32') {
      killListenersOnPortWindows(TEST_PORT);
    } else {
      execSync(`fuser -k ${TEST_PORT}/tcp 2>/dev/null || lsof -ti:${TEST_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Best effort
  }

  clearState();

  // Give the OS a short window to release sockets after termination.
  let stillInUse = false;
  for (let i = 0; i < 6; i++) {
    stillInUse = await isPortInUse(TEST_PORT);
    if (!stillInUse) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (stillInUse) {
    console.error(`Port ${TEST_PORT} is still in use after cleanup`);
    process.exit(1);
  }

  console.log(`Port ${TEST_PORT} cleanup complete`);
}

// Main
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await startServer();
      break;
    case 'stop':
      await stopServer();
      break;
    case 'status':
      await serverStatus();
      break;
    case 'cleanup-port':
      await cleanupPort();
      break;
    default:
      console.log('Usage: node test/server-manager.js [start|stop|status|cleanup-port]');
      console.log('');
      console.log('Environment:');
      console.log('  CI=true                 Force CI mode (fail if port in use)');
      console.log('  TEST_SERVER_REUSE=true  Allow local reuse of existing server on 8111');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`server-manager error: ${error?.message || error}`);
  process.exit(1);
});
