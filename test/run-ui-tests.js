#!/usr/bin/env node

import { spawn } from 'child_process';

const MODE = process.argv[2] || 'test';
const TEST_URL = process.env.VITE_TEST_BASE_URL || 'http://localhost:8111';

function runNode(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function getVitestArgs(mode) {
  const args = ['node_modules/vitest/vitest.mjs', 'test/ui.test.js', '--run'];
  if (mode === 'test-fast') {
    args.push('--bail=1');
  }
  return args;
}

function buildVitestEnv(mode) {
  const env = {
    ...process.env,
    HEADLESS: mode === 'test-headed' ? 'false' : 'true',
    VITE_TEST_BASE_URL: TEST_URL,
    UPDATE_SSIM_COMMITTED: 'false',
  };

  // Keep strict SSIM for normal test workflows.
  if (mode !== 'baseline') {
    env.SSIM_REGRESSION_STRICT = 'true';
  }

  return env;
}

async function main() {
  if (!['test', 'test-fast', 'test-headed', 'baseline'].includes(MODE)) {
    console.error(`Unknown mode: ${MODE}`);
    console.error('Usage: node test/run-ui-tests.js [test|test-fast|test-headed|baseline]');
    process.exit(1);
  }

  const serverEnv = {
    ...process.env,
    TEST_SERVER_REUSE: 'false',
  };

  const cleanupCode = await runNode(['test/server-manager.js', 'cleanup-port'], serverEnv);
  if (cleanupCode !== 0) {
    process.exit(cleanupCode);
  }

  const startCode = await runNode(['test/server-manager.js', 'start'], serverEnv);
  if (startCode !== 0) {
    process.exit(startCode);
  }

  let testCode = 1;
  try {
    testCode = await runNode(getVitestArgs(MODE), buildVitestEnv(MODE));
  } finally {
    await runNode(['test/server-manager.js', 'stop'], serverEnv);
  }

  process.exit(testCode);
}

main().catch((error) => {
  console.error(`run-ui-tests failed: ${error?.message || error}`);
  process.exit(1);
});
