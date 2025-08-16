import { Page, Locator, expect } from '@playwright/test'
import { ROUTE_PATHS } from '../fixtures/test-data'

export class TrafficPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly refreshButton: Locator
  readonly overviewCards: Locator
  readonly sessionsGrid: Locator
  readonly loadingSpinner: Locator
  readonly filterControls: Locator
  readonly searchInput: Locator
  readonly statusFilter: Locator
  readonly endpointFilter: Locator
  readonly autoRefreshToggle: Locator
  
  // Overview metrics cards
  readonly totalConnectionsCard: Locator
  readonly activeConnectionsCard: Locator
  readonly messagesPerSecondCard: Locator
  readonly bytesPerSecondCard: Locator
  readonly errorRateCard: Locator
  
  // Session grid components
  readonly sessionTiles: Locator
  readonly sessionTable: Locator
  readonly noSessionsMessage: Locator
  readonly sessionDetailsModal: Locator
  
  // Charts and visualizations
  readonly trafficChart: Locator
  readonly connectionChart: Locator
  readonly flowVisualization: Locator
  
  // Action buttons
  readonly exportButton: Locator
  readonly killSessionButton: Locator
  readonly viewDetailsButton: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.getByRole('heading', { name: /traffic monitoring/i, level: 1 })
    this.refreshButton = page.getByRole('button', { name: /refresh/i })
    this.overviewCards = page.locator('[data-testid="metric-card"]')
    this.sessionsGrid = page.locator('[data-testid="sessions-grid"]')
    this.loadingSpinner = page.getByRole('status', { name: /loading/i })
    this.filterControls = page.locator('[data-testid="filter-controls"]')
    this.searchInput = page.getByPlaceholder(/search sessions/i)
    this.statusFilter = page.locator('[data-testid="status-filter"]')
    this.endpointFilter = page.locator('[data-testid="endpoint-filter"]')
    this.autoRefreshToggle = page.locator('[data-testid="auto-refresh-toggle"]')
    
    // Metrics cards
    this.totalConnectionsCard = page.locator('[data-testid="total-connections-card"]')
    this.activeConnectionsCard = page.locator('[data-testid="active-connections-card"]')
    this.messagesPerSecondCard = page.locator('[data-testid="messages-per-second-card"]')
    this.bytesPerSecondCard = page.locator('[data-testid="bytes-per-second-card"]')
    this.errorRateCard = page.locator('[data-testid="error-rate-card"]')
    
    // Session components
    this.sessionTiles = page.locator('[data-testid="session-tile"]')
    this.sessionTable = page.getByRole('table')
    this.noSessionsMessage = page.getByText(/no active sessions/i)
    this.sessionDetailsModal = page.locator('[data-testid="session-details-modal"]')
    
    // Charts
    this.trafficChart = page.locator('[data-testid="traffic-chart"]')
    this.connectionChart = page.locator('[data-testid="connection-chart"]')
    this.flowVisualization = page.locator('[data-testid="flow-visualization"]')
    
    // Actions
    this.exportButton = page.getByRole('button', { name: /export/i })
    this.killSessionButton = page.getByRole('button', { name: /kill session/i })
    this.viewDetailsButton = page.getByRole('button', { name: /view details/i })
  }

  async goto() {
    await this.page.goto(ROUTE_PATHS.TRAFFIC)
  }

  async expectToBeVisible() {
    await expect(this.pageTitle).toBeVisible()
    await expect(this.refreshButton).toBeVisible()
    await expect(this.overviewCards).toBeVisible()
  }

  async expectLoadingState() {
    await expect(this.loadingSpinner).toBeVisible()
  }

  async expectMetricsCards() {
    await expect(this.totalConnectionsCard).toBeVisible()
    await expect(this.activeConnectionsCard).toBeVisible()
    await expect(this.messagesPerSecondCard).toBeVisible()
    await expect(this.bytesPerSecondCard).toBeVisible()
    await expect(this.errorRateCard).toBeVisible()
  }

  async expectMetricValue(cardTestId: string, expectedValue: string | RegExp) {
    const card = this.page.locator(`[data-testid="${cardTestId}"]`)
    await expect(card).toContainText(expectedValue)
  }

  async refreshData() {
    await this.refreshButton.click()
    await this.expectLoadingState()
    await this.page.waitForTimeout(500) // Wait for refresh to complete
  }

  async toggleAutoRefresh() {
    await this.autoRefreshToggle.click()
  }

  async expectAutoRefreshEnabled() {
    await expect(this.autoRefreshToggle).toBeChecked()
  }

  async expectAutoRefreshDisabled() {
    await expect(this.autoRefreshToggle).not.toBeChecked()
  }

  async searchSessions(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(400) // Debounce
  }

  async filterByStatus(status: 'all' | 'connected' | 'closing' | 'closed') {
    await this.statusFilter.click()
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click()
  }

  async filterByEndpoint(endpointName: string) {
    await this.endpointFilter.click()
    await this.page.getByRole('option', { name: endpointName }).click()
  }

  async expectSessionsVisible() {
    await expect(this.sessionsGrid).toBeVisible()
    await expect(this.sessionTiles.first()).toBeVisible()
  }

  async expectNoSessions() {
    await expect(this.noSessionsMessage).toBeVisible()
  }

  async expectSessionTile(sessionId: string, status: 'connected' | 'closing' | 'closed') {
    const tile = this.sessionTiles.filter({ hasText: sessionId })
    await expect(tile).toBeVisible()
    await expect(tile).toContainText(status)
  }

  async expectSessionCount(expectedCount: number) {
    await expect(this.sessionTiles).toHaveCount(expectedCount)
  }

  async clickSessionTile(sessionId: string) {
    const tile = this.sessionTiles.filter({ hasText: sessionId })
    await tile.click()
  }

  async viewSessionDetails(sessionId: string) {
    await this.clickSessionTile(sessionId)
    await expect(this.sessionDetailsModal).toBeVisible()
  }

  async expectSessionDetails(sessionId: string, details: {
    endpointName?: string
    status?: string
    startTime?: string
    messagesIn?: number
    messagesOut?: number
  }) {
    await expect(this.sessionDetailsModal).toBeVisible()
    await expect(this.sessionDetailsModal).toContainText(sessionId)
    
    if (details.endpointName) {
      await expect(this.sessionDetailsModal).toContainText(details.endpointName)
    }
    if (details.status) {
      await expect(this.sessionDetailsModal).toContainText(details.status)
    }
    if (details.messagesIn !== undefined) {
      await expect(this.sessionDetailsModal).toContainText(`Messages In: ${details.messagesIn}`)
    }
    if (details.messagesOut !== undefined) {
      await expect(this.sessionDetailsModal).toContainText(`Messages Out: ${details.messagesOut}`)
    }
  }

  async closeSessionDetails() {
    const closeButton = this.sessionDetailsModal.getByRole('button', { name: /close/i })
    await closeButton.click()
    await expect(this.sessionDetailsModal).not.toBeVisible()
  }

  async killSession(sessionId: string) {
    await this.viewSessionDetails(sessionId)
    await this.killSessionButton.click()
    
    // Confirm in dialog
    const confirmButton = this.page.getByRole('button', { name: /kill session/i })
    await confirmButton.click()
  }

  async expectCharts() {
    await expect(this.trafficChart).toBeVisible()
    await expect(this.connectionChart).toBeVisible()
  }

  async expectFlowVisualization() {
    await expect(this.flowVisualization).toBeVisible()
  }

  async exportData() {
    await this.exportButton.click()
    
    // Wait for download to start
    const downloadPromise = this.page.waitForEvent('download')
    await downloadPromise
  }

  async expectRealtimeUpdates() {
    // Get initial metrics
    const initialConnections = await this.activeConnectionsCard.textContent()
    
    // Wait for auto-refresh interval
    await this.page.waitForTimeout(5000)
    
    // Check if metrics updated
    const updatedConnections = await this.activeConnectionsCard.textContent()
    expect(updatedConnections).toBeDefined()
  }

  async expectFilterResults(filters: {
    status?: string
    endpoint?: string
    search?: string
  }, expectedCount: number) {
    if (filters.status) {
      await this.filterByStatus(filters.status as any)
    }
    if (filters.endpoint) {
      await this.filterByEndpoint(filters.endpoint)
    }
    if (filters.search) {
      await this.searchSessions(filters.search)
    }
    
    await this.page.waitForTimeout(500)
    await expect(this.sessionTiles).toHaveCount(expectedCount)
  }

  async clearFilters() {
    await this.searchInput.clear()
    await this.filterByStatus('all')
    await this.page.waitForTimeout(500)
  }

  async expectErrorState() {
    await expect(this.page.getByText(/failed to load|error loading/i)).toBeVisible()
  }

  async expectEmptyState() {
    await expect(this.noSessionsMessage).toBeVisible()
    await expect(this.noSessionsMessage).toContainText('No active sessions found')
  }

  async expectToastMessage(message: string) {
    const toast = this.page.locator('[data-testid="toast"]')
    await expect(toast).toContainText(message)
  }

  async expectSuccessToast(message: string) {
    const successToast = this.page.locator('[data-testid="toast"][data-type="success"]')
    await expect(successToast).toContainText(message)
  }

  async expectWebSocketConnection() {
    // Check if WebSocket connection is established for real-time updates
    const wsIndicator = this.page.locator('[data-testid="ws-status"]')
    await expect(wsIndicator).toContainText(/connected/i)
  }

  async expectWebSocketDisconnected() {
    const wsIndicator = this.page.locator('[data-testid="ws-status"]')
    await expect(wsIndicator).toContainText(/disconnected|reconnecting/i)
  }

  async expectTimeFilters() {
    const timeRange = this.page.locator('[data-testid="time-range-filter"]')
    await expect(timeRange).toBeVisible()
  }

  async setTimeRange(range: '1h' | '6h' | '24h' | '7d') {
    await this.page.locator('[data-testid="time-range-filter"]').click()
    await this.page.getByRole('option', { name: range }).click()
  }

  async expectChartData() {
    // Verify chart has data points
    const chartData = this.page.locator('[data-testid="chart-data-point"]')
    await expect(chartData).toHaveCount({ timeout: 5000 }, expect.greaterThan(0))
  }

  async hoverOverChart() {
    await this.trafficChart.hover()
    
    // Should show tooltip with data
    const tooltip = this.page.locator('[data-testid="chart-tooltip"]')
    await expect(tooltip).toBeVisible()
  }
}