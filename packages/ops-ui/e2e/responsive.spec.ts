import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { EndpointsPage } from './pages/endpoints.page'
import { TrafficPage } from './pages/traffic.page'
import { AuditPage } from './pages/audit.page'
import { LoginPage } from './pages/login.page'
import { ApiMocks } from './fixtures/api-mocks'

// Common viewport sizes for testing
const VIEWPORTS = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  mobileLarge: { width: 414, height: 896 }, // iPhone 11 Pro Max
  tablet: { width: 768, height: 1024 }, // iPad
  tabletLandscape: { width: 1024, height: 768 }, // iPad Landscape
  desktop: { width: 1280, height: 720 }, // Desktop
  desktopLarge: { width: 1920, height: 1080 } // Large Desktop
}

test.describe('Responsive Design - Mobile Devices', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile)
  })

  test('should display mobile-optimized login page', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Login form should be properly sized
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
    
    // Form should not overflow viewport
    const formWidth = await page.locator('form').evaluate(el => el.scrollWidth)
    expect(formWidth).toBeLessThanOrEqual(VIEWPORTS.mobile.width)
    
    // Touch targets should be large enough (minimum 44px)
    const buttonHeight = await loginPage.submitButton.evaluate(el => el.offsetHeight)
    expect(buttonHeight).toBeGreaterThanOrEqual(44)
  })

  test('should have mobile navigation menu', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Mobile navigation should be accessible
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]')
    await expect(mobileMenuButton).toBeVisible()
    
    // Open mobile menu
    await mobileMenuButton.click()
    
    // Navigation links should be visible in mobile menu
    await expect(dashboardPage.dashboardLink).toBeVisible()
    await expect(dashboardPage.endpointsLink).toBeVisible()
    await expect(dashboardPage.trafficLink).toBeVisible()
    await expect(dashboardPage.auditLink).toBeVisible()
    
    // Should be able to navigate
    await dashboardPage.endpointsLink.click()
    await expect(page).toHaveURL('/endpoints')
  })

  test('should stack dashboard metrics vertically on mobile', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.expectMetricsCards()
    
    // Metrics should stack vertically
    const cards = await dashboardPage.metricsCards.all()
    expect(cards.length).toBeGreaterThan(0)
    
    // Check that cards are stacked (each card should be full width)
    for (const card of cards) {
      const cardWidth = await card.evaluate(el => el.offsetWidth)
      expect(cardWidth).toBeGreaterThan(VIEWPORTS.mobile.width * 0.8) // At least 80% of viewport
    }
  })

  test('should display mobile-optimized endpoints table', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Table should be responsive or switched to card view
    const table = endpointsPage.endpointsTable
    await expect(table).toBeVisible()
    
    // Should have horizontal scroll if table is too wide
    const tableWrapper = page.locator('[data-testid="table-wrapper"]')
    const hasHorizontalScroll = await tableWrapper.evaluate(el => el.scrollWidth > el.clientWidth)
    
    // Either should have horizontal scroll or be converted to card layout
    if (!hasHorizontalScroll) {
      // Check for mobile card layout
      const cardLayout = page.locator('[data-testid="mobile-card-layout"]')
      await expect(cardLayout).toBeVisible()
    }
  })

  test('should handle mobile traffic monitoring', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Overview cards should stack on mobile
    await trafficPage.expectMetricsCards()
    
    // Session grid should be mobile-optimized
    const sessionGrid = trafficPage.sessionsGrid
    await expect(sessionGrid).toBeVisible()
    
    // Sessions should display as cards rather than table rows
    const sessionCards = page.locator('[data-testid="session-mobile-card"]')
    await expect(sessionCards.first()).toBeVisible()
    
    // Filter controls should be collapsible on mobile
    const filterToggle = page.locator('[data-testid="mobile-filter-toggle"]')
    await expect(filterToggle).toBeVisible()
    
    await filterToggle.click()
    await expect(trafficPage.filterControls).toBeVisible()
  })

  test('should handle mobile audit log viewing', async ({ page }) => {
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Audit table should be horizontally scrollable on mobile
    await auditPage.expectTableVisible()
    
    // Or should switch to mobile card view
    const tableContainer = page.locator('[data-testid="audit-table-container"]')
    const isScrollable = await tableContainer.evaluate(el => el.scrollWidth > el.clientWidth)
    
    if (!isScrollable) {
      // Check for mobile audit card layout
      const mobileCards = page.locator('[data-testid="audit-mobile-card"]')
      await expect(mobileCards.first()).toBeVisible()
    }
    
    // Filter controls should be accessible
    const mobileFilters = page.locator('[data-testid="mobile-audit-filters"]')
    await expect(mobileFilters).toBeVisible()
  })

  test('should handle touch interactions', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Touch targets should be properly sized
    const createButton = endpointsPage.createButton
    const buttonSize = await createButton.evaluate(el => ({
      width: el.offsetWidth,
      height: el.offsetHeight
    }))
    
    // Minimum touch target size should be 44x44px
    expect(buttonSize.width).toBeGreaterThanOrEqual(44)
    expect(buttonSize.height).toBeGreaterThanOrEqual(44)
    
    // Should handle touch gestures
    await createButton.tap()
    await expect(page).toHaveURL('/endpoints/new')
  })

  test('should handle mobile form inputs', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    
    // Form inputs should be properly sized for mobile
    const nameInput = page.getByLabel(/name/i)
    const urlInput = page.getByLabel(/target url/i)
    
    await expect(nameInput).toBeVisible()
    await expect(urlInput).toBeVisible()
    
    // Inputs should have proper mobile keyboard types
    await expect(urlInput).toHaveAttribute('type', 'url')
    
    // Form should not overflow viewport
    const formWidth = await page.locator('form').evaluate(el => el.scrollWidth)
    expect(formWidth).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 20) // Small tolerance
  })
})

test.describe('Responsive Design - Tablet Devices', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    // Set tablet viewport
    await page.setViewportSize(VIEWPORTS.tablet)
  })

  test('should display tablet-optimized layout', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Sidebar should be visible on tablet
    await expect(dashboardPage.sidebar).toBeVisible()
    
    // Metrics should be in 2-column layout
    await dashboardPage.expectMetricsCards()
    
    // Check metrics layout
    const metricsContainer = page.locator('[data-testid="metrics-container"]')
    const containerWidth = await metricsContainer.evaluate(el => el.offsetWidth)
    expect(containerWidth).toBeGreaterThan(VIEWPORTS.tablet.width * 0.8)
  })

  test('should handle tablet landscape orientation', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tabletLandscape)
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Layout should adapt to landscape
    await expect(dashboardPage.sidebar).toBeVisible()
    await expect(dashboardPage.mainContent).toBeVisible()
    
    // Metrics should be in horizontal layout
    await dashboardPage.expectMetricsCards()
    
    // Navigation should remain accessible
    await dashboardPage.navigateToEndpoints()
    await expect(page).toHaveURL('/endpoints')
  })

  test('should display tablet-optimized tables', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Table should fit without horizontal scroll
    await endpointsPage.expectTableVisible()
    
    const table = endpointsPage.endpointsTable
    const tableWidth = await table.evaluate(el => el.scrollWidth)
    const viewportWidth = VIEWPORTS.tablet.width
    
    // Table should fit within viewport or have managed overflow
    expect(tableWidth).toBeLessThanOrEqual(viewportWidth * 1.1) // Small tolerance
  })

  test('should handle tablet touch interactions', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Touch interactions should work smoothly
    await trafficPage.expectSessionsVisible()
    
    const firstSession = trafficPage.sessionTiles.first()
    await firstSession.tap()
    
    // Session details modal should open
    await expect(trafficPage.sessionDetailsModal).toBeVisible()
  })
})

test.describe('Responsive Design - Desktop Variations', () => {
  test('should handle standard desktop layout', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Full desktop layout should be visible
    await expect(dashboardPage.sidebar).toBeVisible()
    await expect(dashboardPage.header).toBeVisible()
    await expect(dashboardPage.mainContent).toBeVisible()
    
    // Metrics should be in horizontal layout
    await dashboardPage.expectMetricsCards()
  })

  test('should handle large desktop screens', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktopLarge)
    
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Layout should not stretch excessively
    const mainContent = dashboardPage.mainContent
    const contentWidth = await mainContent.evaluate(el => el.offsetWidth)
    
    // Content should have reasonable max-width
    expect(contentWidth).toBeLessThanOrEqual(1400) // Reasonable max-width
    
    // Content should be centered or properly aligned
    const containerMargin = await mainContent.evaluate(el => {
      const style = window.getComputedStyle(el)
      return {
        marginLeft: style.marginLeft,
        marginRight: style.marginRight
      }
    })
    
    // Should have proper margins or max-width constraints
    expect(containerMargin.marginLeft).toBeDefined()
  })

  test('should handle window resizing gracefully', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Start with desktop
    await page.setViewportSize(VIEWPORTS.desktop)
    await expect(dashboardPage.sidebar).toBeVisible()
    
    // Resize to tablet
    await page.setViewportSize(VIEWPORTS.tablet)
    await page.waitForTimeout(500) // Allow for responsive transitions
    await expect(dashboardPage.sidebar).toBeVisible()
    
    // Resize to mobile
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.waitForTimeout(500)
    
    // Mobile menu should be available
    const mobileMenu = page.locator('[data-testid="mobile-menu-button"]')
    await expect(mobileMenu).toBeVisible()
    
    // Resize back to desktop
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.waitForTimeout(500)
    await expect(dashboardPage.sidebar).toBeVisible()
  })
})

test.describe('Responsive Design - Content Adaptation', () => {
  test('should adapt text and spacing for different screen sizes', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    
    // Test mobile text sizing
    await page.setViewportSize(VIEWPORTS.mobile)
    await dashboardPage.goto()
    
    const mobileHeading = dashboardPage.pageTitle
    const mobileHeadingSize = await mobileHeading.evaluate(el => 
      window.getComputedStyle(el).fontSize
    )
    
    // Test desktop text sizing
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.reload()
    
    const desktopHeadingSize = await mobileHeading.evaluate(el => 
      window.getComputedStyle(el).fontSize
    )
    
    // Desktop text should generally be larger or same size
    const mobileSize = parseFloat(mobileHeadingSize)
    const desktopSize = parseFloat(desktopHeadingSize)
    expect(desktopSize).toBeGreaterThanOrEqual(mobileSize)
  })

  test('should handle responsive images and icons', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    
    // Test mobile
    await page.setViewportSize(VIEWPORTS.mobile)
    await dashboardPage.goto()
    
    // Icons should be appropriately sized
    const icons = page.locator('[data-testid="icon"]')
    if (await icons.count() > 0) {
      const iconSize = await icons.first().evaluate(el => ({
        width: el.offsetWidth,
        height: el.offsetHeight
      }))
      
      // Icons should be visible but not too large
      expect(iconSize.width).toBeGreaterThan(0)
      expect(iconSize.width).toBeLessThan(50)
    }
  })

  test('should handle responsive spacing and padding', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    
    // Test mobile spacing
    await page.setViewportSize(VIEWPORTS.mobile)
    await dashboardPage.goto()
    
    const mobileSpacing = await dashboardPage.mainContent.evaluate(el => {
      const style = window.getComputedStyle(el)
      return {
        padding: style.padding,
        margin: style.margin
      }
    })
    
    // Test desktop spacing
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.reload()
    
    const desktopSpacing = await dashboardPage.mainContent.evaluate(el => {
      const style = window.getComputedStyle(el)
      return {
        padding: style.padding,
        margin: style.margin
      }
    })
    
    // Spacing should be defined (not empty)
    expect(mobileSpacing.padding).toBeTruthy()
    expect(desktopSpacing.padding).toBeTruthy()
  })
})

test.describe('Responsive Design - Performance', () => {
  test('should load quickly on mobile devices', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    
    // Simulate slower mobile connection
    await page.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100)) // Add 100ms delay
      await route.continue()
    })
    
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    const startTime = Date.now()
    await dashboardPage.goto()
    const endTime = Date.now()
    
    // Should load within reasonable time even with simulated delay
    const loadTime = endTime - startTime
    expect(loadTime).toBeLessThan(5000)
    
    await dashboardPage.expectToBeVisible()
  })

  test('should handle responsive image loading', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check for responsive images or lazy loading
    const images = page.locator('img')
    const imageCount = await images.count()
    
    if (imageCount > 0) {
      // Images should have proper responsive attributes
      const firstImage = images.first()
      const hasSrcset = await firstImage.getAttribute('srcset')
      const hasLazyLoading = await firstImage.getAttribute('loading')
      
      // At least one responsive feature should be present
      expect(hasSrcset || hasLazyLoading).toBeTruthy()
    }
  })
})

test.describe('Responsive Design - Cross-Device Consistency', () => {
  test('should maintain feature parity across devices', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    // Test desktop features
    await page.setViewportSize(VIEWPORTS.desktop)
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Navigate to endpoints
    await dashboardPage.navigateToEndpoints()
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // Test mobile has same core functionality
    await page.setViewportSize(VIEWPORTS.mobile)
    await dashboardPage.goto()
    
    // Should be able to navigate to endpoints on mobile
    const mobileMenu = page.locator('[data-testid="mobile-menu-button"]')
    await mobileMenu.click()
    await dashboardPage.navigateToEndpoints()
    await endpointsPage.expectToBeVisible()
    
    // Core functionality should be available
    await expect(endpointsPage.createButton).toBeVisible()
  })

  test('should handle form interactions consistently', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const endpointsPage = new EndpointsPage(page)
    
    // Test desktop form
    await page.setViewportSize(VIEWPORTS.desktop)
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    
    const nameInput = page.getByLabel(/name/i)
    await nameInput.fill('Desktop Test')
    await expect(nameInput).toHaveValue('Desktop Test')
    
    // Test mobile form
    await page.setViewportSize(VIEWPORTS.mobile)
    await nameInput.clear()
    await nameInput.fill('Mobile Test')
    await expect(nameInput).toHaveValue('Mobile Test')
    
    // Form validation should work the same
    await nameInput.clear()
    const submitButton = page.getByRole('button', { name: /create|save/i })
    await submitButton.click()
    
    // Should show validation error
    await expect(page.getByText(/name is required/i)).toBeVisible()
  })
})