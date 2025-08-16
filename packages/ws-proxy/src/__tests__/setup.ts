import { beforeEach, afterEach, vi } from 'vitest';
import { setupTestEnvironment } from './helpers/test-setup';

// Global test setup that runs before each test
beforeEach(() => {
  setupTestEnvironment();
});

// Global error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up global state after tests
afterEach(() => {
  // Clear any global state, timers, etc.
  vi.clearAllTimers();
  vi.clearAllMocks();
});