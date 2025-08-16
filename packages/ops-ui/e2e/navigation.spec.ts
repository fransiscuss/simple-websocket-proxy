import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { EndpointsPage } from './pages/endpoints.page'
import { ApiMocks } from './fixtures/api-mocks'
import { ROUTE_PATHS } from './fixtures/test-data'

test.describe('Navigation and Layout', () => {
  let dashboardPage: DashboardPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
  })

  test('should display main layout components', async ({ page }) => {
    await dashboardPage.expectToBeVisible()
    
    // Check main layout elements
    await expect(dashboardPage.header).toBeVisible()
    await expect(dashboardPage.sidebar).toBeVisible()
    await expect(dashboardPage.mainContent).toBeVisible()
    
    // Check navigation is visible
    await dashboardPage.expectNavigationVisible()
  })

  test('should highlight current page in navigation', async ({ page }) => {
    // Start on dashboard
    await dashboardPage.expectCurrentNavigation(ROUTE_PATHS.DASHBOARD)
    
    // Navigate to endpoints
    await dashboardPage.navigateToEndpoints()
    await dashboardPage.expectCurrentNavigation(ROUTE_PATHS.ENDPOINTS)
    
    // Navigate to traffic
    await dashboardPage.navigateToTraffic()
    await dashboardPage.expectCurrentNavigation(ROUTE_PATHS.TRAFFIC)
    
    // Navigate to audit
    await dashboardPage.navigateToAudit()
    await dashboardPage.expectCurrentNavigation(ROUTE_PATHS.AUDIT)
  })

  test('should maintain consistent header across pages', async ({ page }) => {
    // Check header on dashboard
    await expect(dashboardPage.header).toBeVisible()
    await expect(dashboardPage.userMenu).toBeVisible()
    
    // Navigate to other pages and verify header persists
    const pages = [ROUTE_PATHS.ENDPOINTS, ROUTE_PATHS.TRAFFIC, ROUTE_PATHS.AUDIT]
    
    for (const routePath of pages) {
      await page.goto(routePath)
      await expect(dashboardPage.header).toBeVisible()
      await expect(dashboardPage.userMenu).toBeVisible()
    }
  })

  test('should show breadcrumbs on nested pages', async ({ page }) => {
    // Navigate to endpoints list
    await dashboardPage.navigateToEndpoints()
    await dashboardPage.expectBreadcrumbs(['Dashboard', 'Endpoints'])
    
    // Navigate to create endpoint
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.clickCreateEndpoint()
    await dashboardPage.expectBreadcrumbs(['Dashboard', 'Endpoints', 'Create'])
  })

  test('should handle responsive layout on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await dashboardPage.goto()
    
    // On mobile, sidebar might be collapsed or in a drawer
    // Navigation should still be accessible
    await dashboardPage.expectNavigationVisible()
    
    // Test navigation works on mobile
    await dashboardPage.navigateToEndpoints()
    await expect(page).toHaveURL(ROUTE_PATHS.ENDPOINTS)
  })

  test('should provide keyboard navigation support', async ({ page }) => {
    await dashboardPage.expectKeyboardNavigation()
  })

  test('should handle page titles correctly', async ({ page }) => {
    // Dashboard
    await dashboardPage.goto()
    await expect(page).toHaveTitle(/dashboard/i)
    
    // Endpoints
    await page.goto(ROUTE_PATHS.ENDPOINTS)
    await expect(page).toHaveTitle(/endpoints/i)
    
    // Traffic
    await page.goto(ROUTE_PATHS.TRAFFIC)
    await expect(page).toHaveTitle(/traffic/i)
    
    // Audit
    await page.goto(ROUTE_PATHS.AUDIT)
    await expect(page).toHaveTitle(/audit/i)
  })

  test('should show correct page headings', async ({ page }) => {
    // Dashboard
    await dashboardPage.goto()
    await dashboardPage.expectTitle('Dashboard')
    
    // Endpoints
    await page.goto(ROUTE_PATHS.ENDPOINTS)
    await expect(page.getByRole('heading', { name: /endpoints/i, level: 1 })).toBeVisible()
    
    // Traffic
    await page.goto(ROUTE_PATHS.TRAFFIC)
    await expect(page.getByRole('heading', { name: /traffic/i, level: 1 })).toBeVisible()
    
    // Audit
    await page.goto(ROUTE_PATHS.AUDIT)
    await expect(page.getByRole('heading', { name: /audit/i, level: 1 })).toBeVisible()
  })

  test('should handle loading states during navigation', async ({ page }) => {
    // Mock slow API response to test loading states
    await page.route('**/api/endpoints', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })
    
    // Navigate to endpoints
    await dashboardPage.navigateToEndpoints()
    
    // Should show loading state
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectLoadingState()
    
    // Eventually should show content
    await endpointsPage.expectToBeVisible()
  })

  test('should maintain scroll position on navigation', async ({ page }) => {
    // Go to a page with scrollable content
    await dashboardPage.navigateToEndpoints()
    
    // Wait for content to load
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // Scroll down if there's content
    await page.evaluate(() => window.scrollTo(0, 500))
    
    // Navigate away and back
    await dashboardPage.navigateToTraffic()
    await dashboardPage.navigateToEndpoints()
    
    // Should start at top of page (expected behavior for new navigation)
    const scrollPosition = await page.evaluate(() => window.scrollY)
    expect(scrollPosition).toBe(0)
  })
})

test.describe('Navigation - Error Handling', () => {
  test('should handle 404 errors gracefully', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/non-existent-page')
    
    // Should show 404 page or redirect to dashboard
    const url = page.url()
    expect(url).toMatch(/(404|not-found|dashboard)/)
  })

  test('should handle API errors in navigation', async ({ page }) => {
    // Mock API error
    await page.route('**/api/**', async (route) => {
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
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Should handle error gracefully
    await expect(page.getByText(/error|something went wrong/i)).toBeVisible()
  })

  test('should recover from network errors', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    
    // Start with working API
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.expectToBeVisible()
    
    // Simulate network failure
    await page.route('**/api/**', async (route) => {
      await route.abort('internetdisconnected')
    })
    
    // Try navigation
    await dashboardPage.navigateToEndpoints()
    
    // Should show error state
    await expect(page.getByText(/network|connection/i)).toBeVisible()
    
    // Restore network
    await apiMocks.setupAllMocks()
    
    // Should be able to navigate again
    await page.reload()
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
  })
})

test.describe('Navigation - Accessibility', () => {
  test('should provide proper ARIA navigation landmarks', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.expectAccessibilityFeatures()
  })

  test('should support screen reader navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check main landmarks
    await expect(page.locator('header[role="banner"]')).toBeVisible()
    await expect(page.locator('nav[role="navigation"]')).toBeVisible()
    await expect(page.locator('main[role="main"]')).toBeVisible()
    
    // Check navigation has proper labeling
    const nav = page.locator('nav[role="navigation"]')
    await expect(nav).toHaveAttribute('aria-label', /main navigation|primary navigation/i)
  })

  test('should support high contrast mode', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Should still be visible and usable
    await dashboardPage.expectToBeVisible()
    await dashboardPage.expectNavigationVisible()
  })

  test('should handle reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Navigation should still work without animations
    await dashboardPage.navigateToEndpoints()
    await expect(page).toHaveURL(ROUTE_PATHS.ENDPOINTS)
    
    await dashboardPage.navigateToTraffic()
    await expect(page).toHaveURL(ROUTE_PATHS.TRAFFIC)
  })
})

test.describe('Navigation - Performance', () => {
  test('should preload navigation targets', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check that navigation links have proper preload hints
    const endpointsLink = dashboardPage.endpointsLink
    
    // Navigation should be fast (no additional loading required)
    const startTime = Date.now()
    await endpointsLink.click()
    await page.waitForURL(ROUTE_PATHS.ENDPOINTS)
    const endTime = Date.now()
    
    const navigationTime = endTime - startTime
    expect(navigationTime).toBeLessThan(2000) // Should be fast client-side navigation
  })

  test('should handle navigation during slow network conditions', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Navigation should still work, just with loading states
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectLoadingState()
    await endpointsPage.expectToBeVisible()
  })
})