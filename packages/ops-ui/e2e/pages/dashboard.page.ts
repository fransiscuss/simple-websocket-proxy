import { Page, Locator, expect } from '@playwright/test'
import { ROUTE_PATHS } from '../fixtures/test-data'

export class DashboardPage {
  readonly page: Page
  readonly header: Locator
  readonly sidebar: Locator
  readonly mainContent: Locator
  readonly pageTitle: Locator
  readonly userMenu: Locator
  readonly logoutButton: Locator
  readonly navigationLinks: Locator
  readonly metricsCards: Locator
  readonly refreshButton: Locator

  // Navigation links
  readonly dashboardLink: Locator
  readonly endpointsLink: Locator
  readonly trafficLink: Locator
  readonly auditLink: Locator

  // Metrics cards
  readonly totalEndpointsCard: Locator
  readonly activeConnectionsCard: Locator
  readonly messagesPerSecondCard: Locator
  readonly errorRateCard: Locator

  constructor(page: Page) {
    this.page = page
    this.header = page.locator('header')
    this.sidebar = page.locator('nav[role="navigation"]')
    this.mainContent = page.locator('main')
    this.pageTitle = page.getByRole('heading', { level: 1 })
    this.userMenu = page.getByRole('button', { name: /user menu/i })
    this.logoutButton = page.getByRole('menuitem', { name: /logout/i })
    this.navigationLinks = page.locator('nav a')
    this.metricsCards = page.locator('[data-testid="metric-card"]')
    this.refreshButton = page.getByRole('button', { name: /refresh/i })

    // Navigation
    this.dashboardLink = page.getByRole('link', { name: /dashboard/i })
    this.endpointsLink = page.getByRole('link', { name: /endpoints/i })
    this.trafficLink = page.getByRole('link', { name: /traffic/i })
    this.auditLink = page.getByRole('link', { name: /audit/i })

    // Metrics
    this.totalEndpointsCard = page.locator('[data-testid="total-endpoints-card"]')
    this.activeConnectionsCard = page.locator('[data-testid="active-connections-card"]')
    this.messagesPerSecondCard = page.locator('[data-testid="messages-per-second-card"]')
    this.errorRateCard = page.locator('[data-testid="error-rate-card"]')
  }

  async goto() {
    await this.page.goto(ROUTE_PATHS.DASHBOARD)
  }

  async expectToBeVisible() {
    await expect(this.pageTitle).toBeVisible()
    await expect(this.header).toBeVisible()
    await expect(this.sidebar).toBeVisible()
    await expect(this.mainContent).toBeVisible()
  }

  async expectNavigationVisible() {
    await expect(this.dashboardLink).toBeVisible()
    await expect(this.endpointsLink).toBeVisible()
    await expect(this.trafficLink).toBeVisible()
    await expect(this.auditLink).toBeVisible()
  }

  async navigateToEndpoints() {
    await this.endpointsLink.click()
    await this.page.waitForURL(ROUTE_PATHS.ENDPOINTS)
  }

  async navigateToTraffic() {
    await this.trafficLink.click()
    await this.page.waitForURL(ROUTE_PATHS.TRAFFIC)
  }

  async navigateToAudit() {
    await this.auditLink.click()
    await this.page.waitForURL(ROUTE_PATHS.AUDIT)
  }

  async logout() {
    await this.userMenu.click()
    await this.logoutButton.click()
    await this.page.waitForURL(ROUTE_PATHS.LOGIN)
  }

  async expectMetricsCards() {
    await expect(this.totalEndpointsCard).toBeVisible()
    await expect(this.activeConnectionsCard).toBeVisible()
    await expect(this.messagesPerSecondCard).toBeVisible()
    await expect(this.errorRateCard).toBeVisible()
  }

  async expectMetricValue(cardTestId: string, expectedValue: string | RegExp) {
    const card = this.page.locator(`[data-testid="${cardTestId}"]`)
    await expect(card).toContainText(expectedValue)
  }

  async refreshDashboard() {
    await this.refreshButton.click()
    
    // Wait for refresh animation/loading to complete
    await this.page.waitForTimeout(500)
  }

  async expectCurrentNavigation(expectedPath: string) {
    const currentLink = this.page.locator(`nav a[href="${expectedPath}"][aria-current="page"]`)
    await expect(currentLink).toBeVisible()
  }

  async expectUserInfo(email: string) {
    await this.userMenu.click()
    await expect(this.page.getByText(email)).toBeVisible()
    
    // Click somewhere else to close menu
    await this.mainContent.click()
  }

  async expectBreadcrumbs(expectedBreadcrumbs: string[]) {
    const breadcrumbNav = this.page.locator('[aria-label="Breadcrumb"]')
    await expect(breadcrumbNav).toBeVisible()
    
    for (const breadcrumb of expectedBreadcrumbs) {
      await expect(breadcrumbNav.getByText(breadcrumb)).toBeVisible()
    }
  }

  async expectTitle(title: string) {
    await expect(this.pageTitle).toHaveText(title)
  }

  async expectSubtitle(subtitle: string) {
    const subtitleElement = this.page.locator('p.text-muted-foreground').first()
    await expect(subtitleElement).toContainText(subtitle)
  }

  async expectAccessibilityFeatures() {
    // Check for proper ARIA labels and roles
    await expect(this.header).toHaveAttribute('role', 'banner')
    await expect(this.sidebar).toHaveAttribute('role', 'navigation')
    await expect(this.mainContent).toHaveAttribute('role', 'main')
    
    // Check for skip links
    const skipLink = this.page.getByRole('link', { name: /skip to main content/i })
    await expect(skipLink).toBeInViewport()
  }

  async expectKeyboardNavigation() {
    // Test keyboard navigation through main nav items
    await this.dashboardLink.focus()
    await expect(this.dashboardLink).toBeFocused()
    
    await this.page.keyboard.press('Tab')
    await expect(this.endpointsLink).toBeFocused()
    
    await this.page.keyboard.press('Tab')
    await expect(this.trafficLink).toBeFocused()
    
    await this.page.keyboard.press('Tab')
    await expect(this.auditLink).toBeFocused()
  }
}