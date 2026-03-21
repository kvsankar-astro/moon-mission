import { defineConfig } from 'vitest/config';

// CI environments need longer timeouts due to software WebGL rendering
const isCI = process.env.CI === 'true';

export default defineConfig({
  test: {
    testTimeout: isCI ? 180000 : 60000,  // 3 min in CI, 1 min locally
    hookTimeout: isCI ? 180000 : 30000,  // 3 min in CI, 30s locally
    teardownTimeout: 10000,  // Timeout for teardown: 10 seconds
    pool: 'forks',  // Use forks for better isolation
    poolOptions: {
      forks: {
        singleFork: true  // Run tests in a single fork to maintain browser state
      }
    },
    reporters: ['default'],
    logHeapUsage: true,  // Log memory usage to detect leaks
    // Global test timeout for the entire suite
    globalSetup: undefined,
    // Maximum time for the entire test suite (10 minutes)
    bail: 0,  // Don't bail on first failure
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage/unit',
      all: false,
      exclude: [
        'test/**',
        'scripts/**',
        'node_modules/**',
        'dist/**'
      ],
      thresholds: {
        lines: 87,
        branches: 82,
        functions: 50,
        statements: 87
      }
    }
  }
});
