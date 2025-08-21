import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,  // Default timeout for each test: 60 seconds
    hookTimeout: 30000,  // Timeout for hooks (beforeAll, afterAll): 30 seconds
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
  }
});