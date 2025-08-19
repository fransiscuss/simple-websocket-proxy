import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
    globals: true,
    exclude: [
      'node_modules/**',
      'e2e/**',
      '**/*.config.*',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'e2e/',
        '**/*.config.*',
        '**/*.d.ts',
        '.next/',
        'coverage/',
        'playwright-report/',
        'test-results/',
      ],
      include: [
        'app/**/*',
        'components/**/*',
        'lib/**/*',
        'hooks/**/*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})