import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { LoginPage } from './pages/login.page'
import { ApiMocks } from './fixtures/api-mocks'
import { ROUTE_PATHS } from './fixtures/test-data'

test.describe('Authentication - Authenticated User Actions', () => {
  let dashboardPage: DashboardPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
  })

  test('should successfully logout user', async ({ page }) => {
    // Verify we're logged in
    await dashboardPage.expectToBeVisible()
    
    // Perform logout
    await dashboardPage.logout()
    
    // Should redirect to login page
    await page.waitForURL(ROUTE_PATHS.LOGIN)
    
    // Verify login page is shown
    const loginPage = new LoginPage(page)
    await loginPage.expectToBeVisible()
  })

  test('should maintain session across page refreshes', async ({ page }) => {
    // Verify we're on dashboard
    await dashboardPage.expectToBeVisible()
    
    // Refresh the page
    await page.reload()
    
    // Should still be logged in and on dashboard
    await dashboardPage.expectToBeVisible()
  })

  test('should allow navigation between protected pages', async ({ page }) => {
    // Start on dashboard
    await dashboardPage.expectToBeVisible()
    
    // Navigate to endpoints
    await dashboardPage.navigateToEndpoints()
    await expect(page).toHaveURL(ROUTE_PATHS.ENDPOINTS)
    
    // Navigate to traffic
    await dashboardPage.navigateToTraffic()
    await expect(page).toHaveURL(ROUTE_PATHS.TRAFFIC)
    
    // Navigate to audit
    await dashboardPage.navigateToAudit()
    await expect(page).toHaveURL(ROUTE_PATHS.AUDIT)
    
    // Navigate back to dashboard
    await dashboardPage.goto()
    await expect(page).toHaveURL(ROUTE_PATHS.DASHBOARD)
  })

  test('should show user info in header', async ({ page }) => {
    await dashboardPage.expectToBeVisible()
    
    // Check user info is displayed
    await dashboardPage.expectUserInfo('admin@example.com')
  })

  test('should handle session expiry gracefully', async ({ page }) => {
    // Mock expired session response
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Session expired',
            code: 'SESSION_EXPIRED'
          }
        })
      })
    })
    
    // Try to make an API call by navigating to a page that fetches data
    await dashboardPage.navigateToEndpoints()
    
    // Should redirect to login due to expired session
    await page.waitForURL(ROUTE_PATHS.LOGIN)
  })

  test('should prevent access to login page when authenticated', async ({ page }) => {
    // Verify we're logged in
    await dashboardPage.expectToBeVisible()
    
    // Try to navigate to login page
    await page.goto(ROUTE_PATHS.LOGIN)
    
    // Should redirect back to dashboard
    await page.waitForURL(ROUTE_PATHS.DASHBOARD)
  })

  test('should handle browser back/forward buttons correctly', async ({ page }) => {
    // Navigate through several pages
    await dashboardPage.expectToBeVisible()
    
    await dashboardPage.navigateToEndpoints()
    await expect(page).toHaveURL(ROUTE_PATHS.ENDPOINTS)
    
    await dashboardPage.navigateToTraffic()
    await expect(page).toHaveURL(ROUTE_PATHS.TRAFFIC)
    
    // Use browser back button
    await page.goBack()
    await expect(page).toHaveURL(ROUTE_PATHS.ENDPOINTS)
    
    // Use browser forward button
    await page.goForward()
    await expect(page).toHaveURL(ROUTE_PATHS.TRAFFIC)
    
    // Go back to dashboard
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(ROUTE_PATHS.DASHBOARD)
  })
})

test.describe('Authentication - Error Handling', () => {
  test('should handle network errors during auth requests', async ({ page }) => {
    // Mock network error
    await page.route('**/api/auth/**', async (route) => {
      await route.abort('internetdisconnected')
    })
    
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Try to login
    await loginPage.login('admin@example.com', 'admin123')
    
    // Should show network error message
    await expect(page.getByText(/network error|connection failed/i)).toBeVisible()
  })

  test('should handle server errors during login', async ({ page }) => {
    // Mock server error
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
          }
        })
      })
    })
    
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Try to login
    await loginPage.login('admin@example.com', 'admin123')
    
    // Should show server error message
    await loginPage.expectErrorMessage('Internal server error')
  })

  test('should handle timeout during login', async ({ page }) => {
    // Mock slow response
    await page.route('**/api/auth/login', async (route) => {
      // Delay response to simulate timeout
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.continue()
    })
    
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Try to login
    await loginPage.login('admin@example.com', 'admin123')
    
    // Should show timeout error
    await expect(page.getByText(/timeout|took too long/i)).toBeVisible({ timeout: 40000 })
  })
})

test.describe('Authentication - Security', () => {
  test('should not expose sensitive data in client storage', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check that password is not stored in local storage
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {}
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          items[key] = window.localStorage.getItem(key) || ''
        }
      }
      return items
    })
    
    // Ensure no password is stored
    const storageString = JSON.stringify(localStorage).toLowerCase()
    expect(storageString).not.toContain('password')
    expect(storageString).not.toContain('admin123')
  })

  test('should clear sensitive data on logout', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Logout
    await dashboardPage.logout()
    
    // Check that auth data is cleared
    const localStorage = await page.evaluate(() => {
      return window.localStorage.getItem('auth-token')
    })
    
    expect(localStorage).toBeNull()
  })

  test('should handle multiple login attempts', async ({ page }) => {
    // Mock rate limiting after multiple failed attempts
    let attemptCount = 0
    await page.route('**/api/auth/login', async (route) => {
      attemptCount++
      
      if (attemptCount > 3) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Too many login attempts. Please try again later.',
              code: 'RATE_LIMITED'
            }
          })
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Invalid credentials',
              code: 'INVALID_CREDENTIALS'
            }
          })
        })
      }
    })
    
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Make multiple failed attempts
    for (let i = 0; i < 4; i++) {
      await loginPage.clearForm()
      await loginPage.login('admin@example.com', 'wrongpassword')
      
      if (i < 3) {
        await loginPage.expectErrorMessage('Invalid credentials')
      } else {
        await loginPage.expectErrorMessage('Too many login attempts')
      }
    }
  })
})