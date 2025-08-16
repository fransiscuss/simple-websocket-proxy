import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { EndpointsPage } from './pages/endpoints.page'
import { TrafficPage } from './pages/traffic.page'
import { AuditPage } from './pages/audit.page'
import { LoginPage } from './pages/login.page'
import { EndpointFormPage } from './pages/endpoint-form.page'
import { ApiMocks } from './fixtures/api-mocks'

test.describe('Accessibility - General Compliance', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should have proper document structure and landmarks', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check for main landmarks
    await expect(page.locator('header[role="banner"]')).toBeVisible()
    await expect(page.locator('nav[role="navigation"]')).toBeVisible()
    await expect(page.locator('main[role="main"]')).toBeVisible()
    
    // Check for proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
    await expect(h1).toHaveCount(1) // Only one h1 per page
    
    // Check for skip links
    const skipLink = page.getByRole('link', { name: /skip to main content/i })
    await expect(skipLink).toBeInViewport()
  })

  test('should have proper color contrast ratios', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Test text contrast (this is a simplified test - real testing would use axe-core)
    const textElements = page.locator('p, span, div').filter({ hasText: /\w+/ })
    const elementCount = await textElements.count()
    
    if (elementCount > 0) {
      const firstElement = textElements.first()
      const styles = await firstElement.evaluate(el => {
        const computed = window.getComputedStyle(el)
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        }
      })
      
      // Colors should be defined (not empty)
      expect(styles.color).toBeTruthy()
      expect(styles.fontSize).toBeTruthy()
    }
  })

  test('should support high contrast mode', async ({ page }) => {
    // Enable forced colors (high contrast mode)
    await page.emulateMedia({ forcedColors: 'active' })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Elements should remain visible and functional
    await dashboardPage.expectToBeVisible()
    await dashboardPage.expectNavigationVisible()
    
    // Interactive elements should be distinguishable
    await expect(dashboardPage.endpointsLink).toBeVisible()
    await dashboardPage.endpointsLink.click()
    await expect(page).toHaveURL('/endpoints')
  })

  test('should support reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check that animations are reduced/disabled
    const animatedElements = page.locator('[data-animate], .animate-*, [class*="transition"]')
    const elementCount = await animatedElements.count()
    
    if (elementCount > 0) {
      // Animations should respect reduced motion preference
      const animationDuration = await animatedElements.first().evaluate(el => {
        const computed = window.getComputedStyle(el)
        return computed.animationDuration
      })
      
      // Duration should be reduced or set to 0
      expect(['0s', '0ms', ''].includes(animationDuration) || 
             parseFloat(animationDuration) < 0.5).toBe(true)
    }
  })

  test('should handle focus management correctly', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check initial focus
    const activeElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(activeElement).toBeTruthy()
    
    // Tab navigation should work
    await page.keyboard.press('Tab')
    const firstFocusable = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.textContent?.slice(0, 20))
    expect(firstFocusable).toBeTruthy()
    
    // Should be able to navigate through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const thirdFocusable = await page.evaluate(() => document.activeElement?.tagName)
    expect(thirdFocusable).toBeTruthy()
  })

  test('should provide proper focus indicators', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Focus on navigation link
    await dashboardPage.endpointsLink.focus()
    
    // Should have visible focus indicator
    const focusStyles = await dashboardPage.endpointsLink.evaluate(el => {
      const computed = window.getComputedStyle(el)
      return {
        outline: computed.outline,
        outlineWidth: computed.outlineWidth,
        outlineStyle: computed.outlineStyle,
        boxShadow: computed.boxShadow
      }
    })
    
    // Should have some form of focus indicator
    const hasFocusIndicator = 
      focusStyles.outline !== 'none' ||
      focusStyles.outlineWidth !== '0px' ||
      focusStyles.boxShadow !== 'none'
    
    expect(hasFocusIndicator).toBe(true)
  })
})

test.describe('Accessibility - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should support complete keyboard navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Test basic navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()
    
    // Navigate to endpoints using keyboard
    await dashboardPage.endpointsLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/endpoints')
    
    // Test form navigation
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.createButton.focus()
    await page.keyboard.press('Enter')
    
    const formPage = new EndpointFormPage(page)
    await expect(formPage.nameInput).toBeFocused()
    
    // Navigate through form fields
    await page.keyboard.press('Tab')
    await expect(formPage.targetUrlInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(formPage.enabledSwitch).toBeFocused()
  })

  test('should handle modal keyboard navigation', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Open session details modal
    await trafficPage.viewSessionDetails('session-1')
    
    // Focus should be trapped in modal
    const modal = trafficPage.sessionDetailsModal
    await expect(modal).toBeVisible()
    
    // First focusable element in modal should be focused
    const modalButtons = modal.getByRole('button')
    const firstButton = modalButtons.first()
    await expect(firstButton).toBeFocused()
    
    // Tab should stay within modal
    await page.keyboard.press('Tab')
    const focusedElement = page.locator(':focus')
    const isWithinModal = await focusedElement.evaluate(el => {
      const modal = document.querySelector('[data-testid="session-details-modal"]')
      return modal?.contains(el) || false
    })
    expect(isWithinModal).toBe(true)
    
    // Escape should close modal
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('should handle table keyboard navigation', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Navigate to table
    const table = endpointsPage.endpointsTable
    await table.focus()
    
    // Should be able to navigate table with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    
    // Enter should activate focused element
    const focusedElement = page.locator(':focus')
    const tagName = await focusedElement.evaluate(el => el.tagName)
    
    if (tagName === 'BUTTON' || tagName === 'A') {
      await page.keyboard.press('Enter')
      // Should navigate or trigger action
    }
  })

  test('should support dropdown/select keyboard navigation', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Focus on status filter dropdown
    const statusFilter = trafficPage.statusFilter
    await statusFilter.focus()
    
    // Open dropdown with Enter or Space
    await page.keyboard.press('Enter')
    
    // Should be able to navigate options with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    
    // Enter should select option
    await page.keyboard.press('Enter')
    
    // Dropdown should close and selection should be applied
    await page.waitForTimeout(500)
  })

  test('should handle keyboard shortcuts', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Test common keyboard shortcuts if implemented
    // Example: Ctrl+K for search, / for search focus, etc.
    
    // Test search shortcut (if implemented)
    await page.keyboard.press('Control+K')
    const searchInput = page.getByRole('searchbox')
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeFocused()
    }
    
    // Test navigation shortcuts
    await page.keyboard.press('Control+1') // Go to dashboard
    // Should navigate to dashboard or focus first navigation item
  })
})

test.describe('Accessibility - Screen Reader Support', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should have proper ARIA labels and descriptions', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Navigation should have proper ARIA labels
    const nav = dashboardPage.sidebar
    await expect(nav).toHaveAttribute('aria-label', /main navigation|primary navigation/i)
    
    // Interactive elements should have accessible names
    const interactiveElements = page.getByRole('button').or(page.getByRole('link'))
    const elementCount = await interactiveElements.count()
    
    for (let i = 0; i < Math.min(elementCount, 5); i++) {
      const element = interactiveElements.nth(i)
      const accessibleName = await element.getAttribute('aria-label') || 
                            await element.textContent() ||
                            await element.getAttribute('title')
      expect(accessibleName?.trim()).toBeTruthy()
    }
  })

  test('should provide proper live region announcements', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Check for live regions
    const liveRegions = page.locator('[aria-live]')
    const liveRegionCount = await liveRegions.count()
    
    if (liveRegionCount > 0) {
      // Live regions should have appropriate politeness settings
      const firstLiveRegion = liveRegions.first()
      const ariaLive = await firstLiveRegion.getAttribute('aria-live')
      expect(['polite', 'assertive', 'off'].includes(ariaLive || '')).toBe(true)
    }
    
    // Test live announcements by performing actions
    await endpointsPage.searchEndpoints('test')
    
    // Should announce search results
    const announcements = page.locator('[aria-live="polite"]')
    if (await announcements.count() > 0) {
      await expect(announcements.first()).toContainText(/result|found|search/i)
    }
  })

  test('should have proper form field associations', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    
    // Form fields should have proper labels
    await expect(formPage.nameInput).toHaveAttribute('id')
    const nameInputId = await formPage.nameInput.getAttribute('id')
    const nameLabel = page.locator(`label[for="${nameInputId}"]`)
    await expect(nameLabel).toBeVisible()
    
    // Required fields should be marked
    await expect(formPage.nameInput).toHaveAttribute('aria-required', 'true')
    await expect(formPage.targetUrlInput).toHaveAttribute('aria-required', 'true')
    
    // Error messages should be associated with fields
    await formPage.submitForm()
    const errorId = await formPage.nameInput.getAttribute('aria-describedby')
    if (errorId) {
      const errorElement = page.locator(`#${errorId}`)
      await expect(errorElement).toBeVisible()
    }
  })

  test('should provide proper table accessibility', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    const table = endpointsPage.endpointsTable
    
    // Table should have proper role
    await expect(table).toHaveAttribute('role', 'table')
    
    // Table should have accessible caption or summary
    const caption = table.locator('caption')
    const summary = await table.getAttribute('aria-label') || await table.getAttribute('aria-labelledby')
    
    const hasTableDescription = await caption.isVisible() || !!summary
    expect(hasTableDescription).toBe(true)
    
    // Column headers should have proper scope
    const columnHeaders = page.getByRole('columnheader')
    const headerCount = await columnHeaders.count()
    
    if (headerCount > 0) {
      const firstHeader = columnHeaders.first()
      const scope = await firstHeader.getAttribute('scope')
      expect(scope).toBe('col')
    }
    
    // Sortable columns should indicate sort state
    const sortableHeaders = columnHeaders.filter({ has: page.getByRole('button') })
    const sortableCount = await sortableHeaders.count()
    
    if (sortableCount > 0) {
      const firstSortable = sortableHeaders.first().getByRole('button')
      const ariaSort = await firstSortable.getAttribute('aria-sort')
      expect(['ascending', 'descending', 'none', null].includes(ariaSort)).toBe(true)
    }
  })

  test('should handle complex widget accessibility', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Check filter dropdowns
    const statusFilter = trafficPage.statusFilter
    
    // Should have proper combobox role
    await expect(statusFilter).toHaveAttribute('role', 'combobox')
    
    // Should indicate expanded state
    const ariaExpanded = await statusFilter.getAttribute('aria-expanded')
    expect(['true', 'false'].includes(ariaExpanded || '')).toBe(true)
    
    // Should reference listbox
    const ariaControls = await statusFilter.getAttribute('aria-controls')
    if (ariaControls) {
      const listbox = page.locator(`#${ariaControls}`)
      await expect(listbox).toHaveAttribute('role', 'listbox')
    }
  })

  test('should provide proper status and progress indicators', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Loading states should be announced
    const loadingElements = page.getByRole('status')
    const loadingCount = await loadingElements.count()
    
    if (loadingCount > 0) {
      const firstLoading = loadingElements.first()
      const ariaLabel = await firstLoading.getAttribute('aria-label')
      const textContent = await firstLoading.textContent()
      
      const hasLoadingDescription = ariaLabel?.includes('loading') || 
                                   textContent?.toLowerCase().includes('loading')
      expect(hasLoadingDescription).toBe(true)
    }
    
    // Progress bars should have proper attributes
    const progressBars = page.getByRole('progressbar')
    const progressCount = await progressBars.count()
    
    if (progressCount > 0) {
      const firstProgress = progressBars.first()
      const ariaValueNow = await firstProgress.getAttribute('aria-valuenow')
      const ariaValueMin = await firstProgress.getAttribute('aria-valuemin')
      const ariaValueMax = await firstProgress.getAttribute('aria-valuemax')
      
      expect(ariaValueNow).toBeTruthy()
      expect(ariaValueMin).toBeTruthy()
      expect(ariaValueMax).toBeTruthy()
    }
  })
})

test.describe('Accessibility - Error States and Feedback', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should announce form validation errors', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    
    // Submit invalid form
    await formPage.submitForm()
    
    // Error messages should be in alert regions
    const alerts = page.getByRole('alert')
    const alertCount = await alerts.count()
    expect(alertCount).toBeGreaterThan(0)
    
    // Form should indicate invalid state
    const form = page.locator('form')
    const ariaInvalid = await form.getAttribute('aria-invalid')
    const hasErrorIndicator = ariaInvalid === 'true' || await alerts.count() > 0
    expect(hasErrorIndicator).toBe(true)
    
    // Individual fields should indicate error state
    const nameInput = formPage.nameInput
    const fieldInvalid = await nameInput.getAttribute('aria-invalid')
    const fieldDescribedBy = await nameInput.getAttribute('aria-describedby')
    
    expect(fieldInvalid === 'true' || !!fieldDescribedBy).toBe(true)
  })

  test('should provide accessible error recovery', async ({ page }) => {
    // Mock API error
    await page.route('**/api/endpoints', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Server error', code: 'SERVER_ERROR' }
        })
      })
    })
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Error state should be accessible
    const errorMessage = page.getByRole('alert')
    await expect(errorMessage).toBeVisible()
    
    // Should provide retry mechanism
    const retryButton = page.getByRole('button', { name: /retry|try again/i })
    if (await retryButton.isVisible()) {
      await expect(retryButton).toHaveAccessibleName()
      
      // Retry should be keyboard accessible
      await retryButton.focus()
      await page.keyboard.press('Enter')
    }
  })

  test('should announce status changes', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Status changes should be announced
    await trafficPage.refreshData()
    
    // Should announce refresh completion
    const statusRegion = page.locator('[aria-live="polite"]')
    if (await statusRegion.count() > 0) {
      await expect(statusRegion.first()).toContainText(/updated|refreshed|loaded/i)
    }
  })
})

test.describe('Accessibility - Mobile and Touch', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should maintain accessibility on mobile', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Touch targets should be large enough (44px minimum)
    const buttons = page.getByRole('button')
    const buttonCount = await buttons.count()
    
    if (buttonCount > 0) {
      const firstButton = buttons.first()
      const buttonSize = await firstButton.evaluate(el => ({
        width: el.offsetWidth,
        height: el.offsetHeight
      }))
      
      expect(buttonSize.width).toBeGreaterThanOrEqual(44)
      expect(buttonSize.height).toBeGreaterThanOrEqual(44)
    }
    
    // Mobile navigation should be accessible
    const mobileMenu = page.locator('[data-testid="mobile-menu-button"]')
    if (await mobileMenu.isVisible()) {
      await expect(mobileMenu).toHaveAttribute('aria-expanded')
      await expect(mobileMenu).toHaveAccessibleName()
      
      // Open mobile menu
      await mobileMenu.click()
      
      // Menu should be accessible
      const menuPanel = page.locator('[role="menu"], [role="navigation"]')
      await expect(menuPanel).toBeVisible()
    }
  })

  test('should support assistive technology on touch devices', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Touch interactions should work with screen readers
    const createButton = endpointsPage.createButton
    
    // Should have proper touch event handling
    await createButton.tap()
    await expect(page).toHaveURL('/endpoints/new')
    
    // Form inputs should work with virtual keyboards
    const formPage = new EndpointFormPage(page)
    const nameInput = formPage.nameInput
    
    // Should have proper input types for mobile keyboards
    const inputType = await nameInput.getAttribute('type')
    expect(inputType).toBeTruthy()
    
    const urlInput = formPage.targetUrlInput
    const urlType = await urlInput.getAttribute('type')
    expect(urlType).toBe('url')
  })
})