import { Page, Locator, expect } from '@playwright/test'
import { ROUTE_PATHS } from '../fixtures/test-data'

export class EndpointsPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly createButton: Locator
  readonly searchInput: Locator
  readonly endpointsTable: Locator
  readonly tableRows: Locator
  readonly noDataMessage: Locator
  readonly loadingSpinner: Locator
  readonly paginationControls: Locator
  readonly statsCards: Locator

  // Table columns
  readonly nameColumn: Locator
  readonly targetUrlColumn: Locator
  readonly statusColumn: Locator
  readonly connectionsColumn: Locator
  readonly actionsColumn: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.getByRole('heading', { name: /endpoints/i, level: 1 })
    this.createButton = page.getByRole('link', { name: /create endpoint/i })
    this.searchInput = page.getByPlaceholder(/search endpoints/i)
    this.endpointsTable = page.getByRole('table')
    this.tableRows = page.getByRole('row')
    this.noDataMessage = page.getByText(/no endpoints found/i)
    this.loadingSpinner = page.getByRole('status', { name: /loading/i })
    this.paginationControls = page.locator('[data-testid="pagination"]')
    this.statsCards = page.locator('[data-testid="stats-card"]')

    // Table columns
    this.nameColumn = page.getByRole('columnheader', { name: /name/i })
    this.targetUrlColumn = page.getByRole('columnheader', { name: /target url/i })
    this.statusColumn = page.getByRole('columnheader', { name: /status/i })
    this.connectionsColumn = page.getByRole('columnheader', { name: /connections/i })
    this.actionsColumn = page.getByRole('columnheader', { name: /actions/i })
  }

  async goto() {
    await this.page.goto(ROUTE_PATHS.ENDPOINTS)
  }

  async expectToBeVisible() {
    await expect(this.pageTitle).toBeVisible()
    await expect(this.createButton).toBeVisible()
    await expect(this.searchInput).toBeVisible()
  }

  async clickCreateEndpoint() {
    await this.createButton.click()
    await this.page.waitForURL(ROUTE_PATHS.ENDPOINTS_NEW)
  }

  async searchEndpoints(query: string) {
    await this.searchInput.fill(query)
    
    // Wait for debounced search
    await this.page.waitForTimeout(400)
  }

  async clearSearch() {
    await this.searchInput.clear()
    await this.page.waitForTimeout(400)
  }

  async expectTableVisible() {
    await expect(this.endpointsTable).toBeVisible()
    await expect(this.nameColumn).toBeVisible()
    await expect(this.targetUrlColumn).toBeVisible()
    await expect(this.statusColumn).toBeVisible()
  }

  async expectEndpointInTable(name: string, targetUrl: string, status: 'Online' | 'Offline' | 'Disabled') {
    const row = this.tableRows.filter({ hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toContainText(targetUrl)
    await expect(row).toContainText(status)
  }

  async expectNoEndpoints() {
    await expect(this.noDataMessage).toBeVisible()
  }

  async expectLoadingState() {
    await expect(this.loadingSpinner).toBeVisible()
  }

  async clickEndpointActions(endpointName: string) {
    const row = this.tableRows.filter({ hasText: endpointName })
    const actionsButton = row.getByRole('button', { name: /open menu/i })
    await actionsButton.click()
  }

  async viewEndpointDetails(endpointName: string) {
    await this.clickEndpointActions(endpointName)
    const viewAction = this.page.getByRole('menuitem', { name: /view details/i })
    await viewAction.click()
  }

  async editEndpoint(endpointName: string) {
    await this.clickEndpointActions(endpointName)
    const editAction = this.page.getByRole('menuitem', { name: /edit/i })
    await editAction.click()
  }

  async deleteEndpoint(endpointName: string) {
    await this.clickEndpointActions(endpointName)
    const deleteAction = this.page.getByRole('menuitem', { name: /delete/i })
    await deleteAction.click()
    
    // Confirm deletion in dialog
    const confirmButton = this.page.getByRole('button', { name: /delete/i })
    await confirmButton.click()
  }

  async enableEndpoint(endpointName: string) {
    await this.clickEndpointActions(endpointName)
    const enableAction = this.page.getByRole('menuitem', { name: /enable/i })
    await enableAction.click()
  }

  async disableEndpoint(endpointName: string) {
    await this.clickEndpointActions(endpointName)
    const disableAction = this.page.getByRole('menuitem', { name: /disable/i })
    await disableAction.click()
  }

  async cloneEndpoint(endpointName: string) {
    await this.clickEndpointActions(endpointName)
    const cloneAction = this.page.getByRole('menuitem', { name: /clone/i })
    await cloneAction.click()
  }

  async sortByColumn(columnName: string) {
    const columnHeader = this.page.getByRole('columnheader', { name: new RegExp(columnName, 'i') })
    const sortButton = columnHeader.getByRole('button')
    await sortButton.click()
  }

  async expectSortedBy(columnName: string, order: 'asc' | 'desc') {
    const columnHeader = this.page.getByRole('columnheader', { name: new RegExp(columnName, 'i') })
    const sortButton = columnHeader.getByRole('button')
    
    // Check aria-sort attribute or visual indicator
    if (order === 'asc') {
      await expect(sortButton).toHaveAttribute('aria-sort', 'ascending')
    } else {
      await expect(sortButton).toHaveAttribute('aria-sort', 'descending')
    }
  }

  async goToPage(pageNumber: number) {
    const pageButton = this.paginationControls.getByRole('button', { name: pageNumber.toString() })
    await pageButton.click()
  }

  async goToNextPage() {
    const nextButton = this.paginationControls.getByRole('button', { name: /next/i })
    await nextButton.click()
  }

  async goToPreviousPage() {
    const prevButton = this.paginationControls.getByRole('button', { name: /previous/i })
    await prevButton.click()
  }

  async expectPaginationInfo(currentPage: number, totalPages: number) {
    const info = this.paginationControls.getByText(`Page ${currentPage} of ${totalPages}`)
    await expect(info).toBeVisible()
  }

  async expectStatsCards() {
    const totalCard = this.page.getByText('Total Endpoints')
    const activeCard = this.page.getByText('Active Endpoints')
    const connectionsCard = this.page.getByText('Total Connections')
    const successCard = this.page.getByText('Success Rate')
    
    await expect(totalCard).toBeVisible()
    await expect(activeCard).toBeVisible()
    await expect(connectionsCard).toBeVisible()
    await expect(successCard).toBeVisible()
  }

  async expectToastMessage(message: string) {
    const toast = this.page.locator('[data-testid="toast"]')
    await expect(toast).toContainText(message)
    
    // Wait for toast to disappear
    await expect(toast).not.toBeVisible({ timeout: 5000 })
  }

  async expectSuccessToast(message: string) {
    const successToast = this.page.locator('[data-testid="toast"][data-type="success"]')
    await expect(successToast).toContainText(message)
  }

  async expectErrorToast(message: string) {
    const errorToast = this.page.locator('[data-testid="toast"][data-type="error"]')
    await expect(errorToast).toContainText(message)
  }

  async expectTableEmpty() {
    await expect(this.noDataMessage).toBeVisible()
    await expect(this.noDataMessage).toContainText('No endpoints found')
  }

  async expectSearchResults(query: string, expectedCount: number) {
    await this.searchEndpoints(query)
    
    const visibleRows = this.tableRows.filter({ hasNotText: 'Name' }) // Exclude header
    await expect(visibleRows).toHaveCount(expectedCount)
  }

  async expectEndpointStatus(endpointName: string, status: 'Online' | 'Offline' | 'Disabled') {
    const row = this.tableRows.filter({ hasText: endpointName })
    const statusBadge = row.locator('[data-testid="status-badge"]')
    await expect(statusBadge).toContainText(status)
  }

  async expectConnectionCount(endpointName: string, count: number) {
    const row = this.tableRows.filter({ hasText: endpointName })
    const connectionCell = row.locator('[data-testid="connection-count"]')
    await expect(connectionCell).toContainText(count.toString())
  }
}