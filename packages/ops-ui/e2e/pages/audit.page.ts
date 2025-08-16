import { Page, Locator, expect } from '@playwright/test'
import { ROUTE_PATHS } from '../fixtures/test-data'

export class AuditPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly refreshButton: Locator
  readonly auditTable: Locator
  readonly loadingSpinner: Locator
  readonly filterControls: Locator
  readonly searchInput: Locator
  readonly actionFilter: Locator
  readonly resourceFilter: Locator
  readonly userFilter: Locator
  readonly dateRangeFilter: Locator
  readonly paginationControls: Locator
  
  // Table elements
  readonly tableRows: Locator
  readonly tableHeaders: Locator
  readonly noLogsMessage: Locator
  readonly timestampColumn: Locator
  readonly actionColumn: Locator
  readonly resourceColumn: Locator
  readonly userColumn: Locator
  readonly detailsColumn: Locator
  
  // Log details modal
  readonly logDetailsModal: Locator
  readonly modalCloseButton: Locator
  readonly logDetailsContent: Locator
  readonly logMetadata: Locator
  readonly logChanges: Locator
  
  // Export functionality
  readonly exportButton: Locator
  readonly exportFormatSelect: Locator
  readonly exportDateRange: Locator
  readonly downloadProgress: Locator
  
  // Sorting and pagination
  readonly sortTimestamp: Locator
  readonly sortAction: Locator
  readonly sortUser: Locator
  readonly itemsPerPageSelect: Locator
  readonly pageNavigation: Locator
  readonly totalItemsCount: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.getByRole('heading', { name: /audit logs/i, level: 1 })
    this.refreshButton = page.getByRole('button', { name: /refresh/i })
    this.auditTable = page.getByRole('table')
    this.loadingSpinner = page.getByRole('status', { name: /loading/i })
    this.filterControls = page.locator('[data-testid="filter-controls"]')
    this.searchInput = page.getByPlaceholder(/search audit logs/i)
    this.actionFilter = page.locator('[data-testid="action-filter"]')
    this.resourceFilter = page.locator('[data-testid="resource-filter"]')
    this.userFilter = page.locator('[data-testid="user-filter"]')
    this.dateRangeFilter = page.locator('[data-testid="date-range-filter"]')
    this.paginationControls = page.locator('[data-testid="pagination"]')
    
    // Table elements
    this.tableRows = page.getByRole('row')
    this.tableHeaders = page.getByRole('columnheader')
    this.noLogsMessage = page.getByText(/no audit logs found/i)
    this.timestampColumn = page.getByRole('columnheader', { name: /timestamp/i })
    this.actionColumn = page.getByRole('columnheader', { name: /action/i })
    this.resourceColumn = page.getByRole('columnheader', { name: /resource/i })
    this.userColumn = page.getByRole('columnheader', { name: /user/i })
    this.detailsColumn = page.getByRole('columnheader', { name: /details/i })
    
    // Modal
    this.logDetailsModal = page.locator('[data-testid="log-details-modal"]')
    this.modalCloseButton = page.getByRole('button', { name: /close/i })
    this.logDetailsContent = page.locator('[data-testid="log-details-content"]')
    this.logMetadata = page.locator('[data-testid="log-metadata"]')
    this.logChanges = page.locator('[data-testid="log-changes"]')
    
    // Export
    this.exportButton = page.getByRole('button', { name: /export/i })
    this.exportFormatSelect = page.locator('[data-testid="export-format"]')
    this.exportDateRange = page.locator('[data-testid="export-date-range"]')
    this.downloadProgress = page.locator('[data-testid="download-progress"]')
    
    // Sorting and pagination
    this.sortTimestamp = this.timestampColumn.getByRole('button')
    this.sortAction = this.actionColumn.getByRole('button')
    this.sortUser = this.userColumn.getByRole('button')
    this.itemsPerPageSelect = page.locator('[data-testid="items-per-page"]')
    this.pageNavigation = page.locator('[data-testid="page-navigation"]')
    this.totalItemsCount = page.locator('[data-testid="total-items"]')
  }

  async goto() {
    await this.page.goto(ROUTE_PATHS.AUDIT)
  }

  async expectToBeVisible() {
    await expect(this.pageTitle).toBeVisible()
    await expect(this.refreshButton).toBeVisible()
    await expect(this.filterControls).toBeVisible()
  }

  async expectLoadingState() {
    await expect(this.loadingSpinner).toBeVisible()
  }

  async expectTableVisible() {
    await expect(this.auditTable).toBeVisible()
    await expect(this.timestampColumn).toBeVisible()
    await expect(this.actionColumn).toBeVisible()
    await expect(this.resourceColumn).toBeVisible()
    await expect(this.userColumn).toBeVisible()
    await expect(this.detailsColumn).toBeVisible()
  }

  async expectLogEntry(logId: string, action: string, resourceType: string, user: string) {
    const row = this.tableRows.filter({ hasText: logId })
    await expect(row).toBeVisible()
    await expect(row).toContainText(action)
    await expect(row).toContainText(resourceType)
    await expect(row).toContainText(user)
  }

  async expectNoLogs() {
    await expect(this.noLogsMessage).toBeVisible()
  }

  async refreshData() {
    await this.refreshButton.click()
    await this.expectLoadingState()
    await this.page.waitForTimeout(500)
  }

  async searchLogs(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(400) // Debounce
  }

  async clearSearch() {
    await this.searchInput.clear()
    await this.page.waitForTimeout(400)
  }

  async filterByAction(action: string) {
    await this.actionFilter.click()
    await this.page.getByRole('option', { name: action }).click()
  }

  async filterByResource(resourceType: string) {
    await this.resourceFilter.click()
    await this.page.getByRole('option', { name: resourceType }).click()
  }

  async filterByUser(user: string) {
    await this.userFilter.click()
    await this.page.getByRole('option', { name: user }).click()
  }

  async setDateRange(range: '1h' | '24h' | '7d' | '30d' | 'custom') {
    await this.dateRangeFilter.click()
    await this.page.getByRole('option', { name: range }).click()
  }

  async setCustomDateRange(startDate: string, endDate: string) {
    await this.setDateRange('custom')
    
    // Fill date inputs
    const startInput = this.page.locator('[data-testid="start-date"]')
    const endInput = this.page.locator('[data-testid="end-date"]')
    
    await startInput.fill(startDate)
    await endInput.fill(endDate)
    
    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /apply/i })
    await applyButton.click()
  }

  async clearFilters() {
    await this.searchInput.clear()
    
    // Reset all filter dropdowns to "All"
    await this.actionFilter.click()
    await this.page.getByRole('option', { name: /all/i }).click()
    
    await this.resourceFilter.click()
    await this.page.getByRole('option', { name: /all/i }).click()
    
    await this.userFilter.click()
    await this.page.getByRole('option', { name: /all/i }).click()
    
    await this.setDateRange('7d') // Default range
  }

  async sortByColumn(column: 'timestamp' | 'action' | 'user') {
    switch (column) {
      case 'timestamp':
        await this.sortTimestamp.click()
        break
      case 'action':
        await this.sortAction.click()
        break
      case 'user':
        await this.sortUser.click()
        break
    }
  }

  async expectSortedBy(column: string, order: 'asc' | 'desc') {
    const columnHeader = this.page.getByRole('columnheader', { name: new RegExp(column, 'i') })
    const sortButton = columnHeader.getByRole('button')
    
    if (order === 'asc') {
      await expect(sortButton).toHaveAttribute('aria-sort', 'ascending')
    } else {
      await expect(sortButton).toHaveAttribute('aria-sort', 'descending')
    }
  }

  async viewLogDetails(logId: string) {
    const row = this.tableRows.filter({ hasText: logId })
    const detailsButton = row.getByRole('button', { name: /view details/i })
    await detailsButton.click()
    
    await expect(this.logDetailsModal).toBeVisible()
  }

  async expectLogDetailsModal(logId: string, expectedDetails: {
    action?: string
    resource?: string
    user?: string
    timestamp?: string
    ipAddress?: string
    userAgent?: string
    changes?: Record<string, any>
  }) {
    await expect(this.logDetailsModal).toBeVisible()
    await expect(this.logDetailsContent).toContainText(logId)
    
    if (expectedDetails.action) {
      await expect(this.logDetailsContent).toContainText(expectedDetails.action)
    }
    
    if (expectedDetails.resource) {
      await expect(this.logDetailsContent).toContainText(expectedDetails.resource)
    }
    
    if (expectedDetails.user) {
      await expect(this.logDetailsContent).toContainText(expectedDetails.user)
    }
    
    if (expectedDetails.ipAddress) {
      await expect(this.logMetadata).toContainText(expectedDetails.ipAddress)
    }
    
    if (expectedDetails.userAgent) {
      await expect(this.logMetadata).toContainText(expectedDetails.userAgent)
    }
    
    if (expectedDetails.changes) {
      await expect(this.logChanges).toBeVisible()
      for (const [key, value] of Object.entries(expectedDetails.changes)) {
        await expect(this.logChanges).toContainText(key)
        await expect(this.logChanges).toContainText(JSON.stringify(value))
      }
    }
  }

  async closeLogDetails() {
    await this.modalCloseButton.click()
    await expect(this.logDetailsModal).not.toBeVisible()
  }

  async exportLogs(format: 'csv' | 'json' = 'csv') {
    await this.exportButton.click()
    
    // Select format if needed
    if (format !== 'csv') {
      await this.exportFormatSelect.click()
      await this.page.getByRole('option', { name: format }).click()
    }
    
    // Start download
    const downloadPromise = this.page.waitForEvent('download')
    await this.page.getByRole('button', { name: /download/i }).click()
    
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(new RegExp(`audit-logs\\.(${format})`))
    
    return download
  }

  async expectExportProgress() {
    await expect(this.downloadProgress).toBeVisible()
    await expect(this.downloadProgress).toContainText(/preparing|downloading/i)
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

  async expectPaginationInfo(currentPage: number, totalPages: number, totalItems: number) {
    const info = this.paginationControls.getByText(`Page ${currentPage} of ${totalPages}`)
    await expect(info).toBeVisible()
    
    await expect(this.totalItemsCount).toContainText(`${totalItems} total`)
  }

  async setItemsPerPage(count: 25 | 50 | 100) {
    await this.itemsPerPageSelect.click()
    await this.page.getByRole('option', { name: count.toString() }).click()
  }

  async expectFilterResults(filters: {
    action?: string
    resource?: string
    user?: string
    search?: string
    dateRange?: string
  }, expectedCount: number) {
    if (filters.action) {
      await this.filterByAction(filters.action)
    }
    if (filters.resource) {
      await this.filterByResource(filters.resource)
    }
    if (filters.user) {
      await this.filterByUser(filters.user)
    }
    if (filters.search) {
      await this.searchLogs(filters.search)
    }
    if (filters.dateRange) {
      await this.setDateRange(filters.dateRange as any)
    }
    
    await this.page.waitForTimeout(500)
    
    if (expectedCount === 0) {
      await this.expectNoLogs()
    } else {
      const dataRows = this.tableRows.filter({ hasNotText: 'Timestamp' }) // Exclude header
      await expect(dataRows).toHaveCount(expectedCount)
    }
  }

  async expectActionTypes() {
    // Check that common action types are available in filter
    await this.actionFilter.click()
    
    const expectedActions = [
      'endpoint.created',
      'endpoint.updated',
      'endpoint.deleted',
      'endpoint.enabled',
      'endpoint.disabled',
      'user.login',
      'user.logout'
    ]
    
    for (const action of expectedActions) {
      await expect(this.page.getByRole('option', { name: action })).toBeVisible()
    }
    
    // Close dropdown
    await this.actionFilter.click()
  }

  async expectResourceTypes() {
    await this.resourceFilter.click()
    
    const expectedResources = ['endpoint', 'user', 'session', 'audit']
    
    for (const resource of expectedResources) {
      await expect(this.page.getByRole('option', { name: resource })).toBeVisible()
    }
    
    await this.resourceFilter.click()
  }

  async expectToastMessage(message: string) {
    const toast = this.page.locator('[data-testid="toast"]')
    await expect(toast).toContainText(message)
  }

  async expectErrorState() {
    await expect(this.page.getByText(/failed to load|error loading/i)).toBeVisible()
  }

  async expectEmptyState() {
    await expect(this.noLogsMessage).toBeVisible()
    await expect(this.noLogsMessage).toContainText('No audit logs found')
  }

  async expectLogFormatting() {
    // Check that timestamps are properly formatted
    const firstRow = this.tableRows.nth(1) // Skip header
    const timestamp = firstRow.locator('[data-testid="timestamp"]')
    await expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    
    // Check that actions are properly categorized
    const action = firstRow.locator('[data-testid="action"]')
    await expect(action).toBeVisible()
    
    // Check that user info is displayed
    const user = firstRow.locator('[data-testid="user"]')
    await expect(user).toBeVisible()
  }

  async expectAccessibilityFeatures() {
    // Check ARIA labels and roles
    await expect(this.auditTable).toHaveAttribute('role', 'table')
    await expect(this.tableHeaders.first()).toHaveAttribute('role', 'columnheader')
    
    // Check for screen reader friendly content
    const skipLink = this.page.getByRole('link', { name: /skip to content/i })
    await expect(skipLink).toBeInViewport()
  }

  async expectKeyboardNavigation() {
    // Test keyboard navigation through table
    await this.auditTable.focus()
    
    // Navigate with arrow keys
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.press('ArrowRight')
    
    // Should be able to activate details with Enter
    await this.page.keyboard.press('Enter')
  }
}