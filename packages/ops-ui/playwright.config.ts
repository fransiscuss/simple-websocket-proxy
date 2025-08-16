import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  
  /* Maximum failures before stopping test run */
  maxFailures: process.env.CI ? 10 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [
    ['github'],
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['blob', { outputDir: 'test-results/blob-report' }]
  ] : [
    ['html', { outputFolder: 'test-results/html-report', open: 'on-failure' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['json', { outputFile: 'test-results/test-results.json' }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording */
    video: 'retain-on-failure',
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Timeout for each action */
    actionTimeout: 30000,
    
    /* Timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Configure global setup and teardown */
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),

  /* Configure projects for major browsers */
  projects: [
    // Authentication setup
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup after tests
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: [
        /.*\.unauthenticated\.spec\.ts/,
        /.*responsive\.spec\.ts/ // Run responsive tests on mobile only
      ],
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: [
        /.*\.unauthenticated\.spec\.ts/,
        /.*responsive\.spec\.ts/,
        /.*performance\.spec\.ts/ // Run performance tests on Chrome only
      ],
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: [
        /.*\.unauthenticated\.spec\.ts/,
        /.*responsive\.spec\.ts/,
        /.*performance\.spec\.ts/,
        /.*websocket\.spec\.ts/ // WebSocket tests may have issues on WebKit
      ],
    },
    
    // Tablet testing
    {
      name: 'tablet',
      use: { 
        ...devices['iPad'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: [
        /.*responsive\.spec\.ts/,
        /.*accessibility\.spec\.ts/
      ],
    },
    
    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: [
        /.*responsive\.spec\.ts/,
        /.*accessibility\.spec\.ts/,
        /.*integration\.workflows\.spec\.ts/
      ],
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: [
        /.*responsive\.spec\.ts/,
        /.*accessibility\.spec\.ts/
      ],
    },

    // Unauthenticated tests (run on Chrome only)
    {
      name: 'unauthenticated',
      testMatch: /.*\.unauthenticated\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] }, // Clear storage state
      },
    },
    
    // Performance tests (Chrome only with specific settings)
    {
      name: 'performance',
      testMatch: /.*performance\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
        // Performance-specific settings
        launchOptions: {
          args: [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'cd ../ws-proxy && pnpm dev',
      url: 'http://localhost:8080/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],

  /* Test timeout */
  timeout: 60000,
  
  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/',
})