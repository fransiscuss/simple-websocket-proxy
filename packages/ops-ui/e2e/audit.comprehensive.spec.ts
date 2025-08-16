import { test, expect } from '@playwright/test'
import { AuditPage } from './pages/audit.page'
import { ApiMocks } from './fixtures/api-mocks'
import { MOCK_AUDIT_LOGS } from './fixtures/test-data'

test.describe('Audit Logs - Comprehensive Functionality', () => {
  let auditPage: AuditPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    auditPage = new AuditPage(page)
    await auditPage.goto()
  })

  test('should display audit logs table with all columns', async ({ page }) => {
    await auditPage.expectToBeVisible()
    await auditPage.expectTableVisible()
    
    // Check all expected columns are present
    await expect(auditPage.timestampColumn).toBeVisible()
    await expect(auditPage.actionColumn).toBeVisible()
    await expect(auditPage.resourceColumn).toBeVisible()
    await expect(auditPage.userColumn).toBeVisible()
    await expect(auditPage.detailsColumn).toBeVisible()
  })

  test('should display mock audit log entries', async ({ page }) => {
    for (const log of MOCK_AUDIT_LOGS) {
      await auditPage.expectLogEntry(
        log.id,
        log.action,
        log.resourceType,
        log.userEmail
      )
    }
  })

  test('should open log details modal with comprehensive information', async ({ page }) => {
    const log = MOCK_AUDIT_LOGS[0]
    
    await auditPage.viewLogDetails(log.id)
    
    await auditPage.expectLogDetailsModal(log.id, {
      action: log.action,
      resource: log.resourceType,
      user: log.userEmail,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      changes: log.details
    })
    
    // Close modal
    await auditPage.closeLogDetails()
  })

  test('should filter logs by action type', async ({ page }) => {
    await auditPage.expectActionTypes()
    
    // Filter by specific action
    await auditPage.filterByAction('endpoint.created')
    
    const createdLogs = MOCK_AUDIT_LOGS.filter(log => log.action === 'endpoint.created')
    await auditPage.expectFilterResults({
      action: 'endpoint.created'
    }, createdLogs.length)
  })

  test('should filter logs by resource type', async ({ page }) => {
    await auditPage.expectResourceTypes()
    
    // Filter by endpoint resources
    await auditPage.filterByResource('endpoint')
    
    const endpointLogs = MOCK_AUDIT_LOGS.filter(log => log.resourceType === 'endpoint')
    await auditPage.expectFilterResults({
      resource: 'endpoint'
    }, endpointLogs.length)
  })

  test('should filter logs by user', async ({ page }) => {
    const user = MOCK_AUDIT_LOGS[0].userEmail
    
    await auditPage.filterByUser(user)
    
    const userLogs = MOCK_AUDIT_LOGS.filter(log => log.userEmail === user)
    await auditPage.expectFilterResults({
      user: user
    }, userLogs.length)
  })

  test('should search logs by text content', async ({ page }) => {
    const searchTerm = 'endpoint'
    
    await auditPage.searchLogs(searchTerm)
    
    // Should show logs containing the search term
    await page.waitForTimeout(500)
    const visibleRows = page.getByRole('row').filter({ hasNotText: 'Timestamp' })
    await expect(visibleRows.first()).toContainText(searchTerm)
  })

  test('should filter by date range', async ({ page }) => {
    // Set to last 24 hours
    await auditPage.setDateRange('24h')
    
    // Should filter logs by date
    await page.waitForTimeout(500)
    await auditPage.expectTableVisible()
    
    // Try other date ranges
    await auditPage.setDateRange('7d')
    await auditPage.setDateRange('30d')
  })

  test('should set custom date range', async ({ page }) => {
    const startDate = '2024-01-01'
    const endDate = '2024-01-31'
    
    await auditPage.setCustomDateRange(startDate, endDate)
    
    // Should apply custom filter
    await page.waitForTimeout(500)
    await auditPage.expectTableVisible()
  })

  test('should combine multiple filters', async ({ page }) => {
    await auditPage.expectFilterResults({
      action: 'endpoint.created',
      resource: 'endpoint',
      user: 'admin@example.com',
      dateRange: '7d'
    }, 1) // Should show matching logs
  })

  test('should clear all filters', async ({ page }) => {
    // Apply filters
    await auditPage.filterByAction('endpoint.created')
    await auditPage.searchLogs('test')
    await auditPage.setDateRange('24h')
    
    // Clear all filters
    await auditPage.clearFilters()
    
    // Should show all logs
    await page.waitForTimeout(500)
    await auditPage.expectTableVisible()
  })

  test('should sort logs by timestamp', async ({ page }) => {
    // Sort by timestamp ascending
    await auditPage.sortByColumn('timestamp')
    await auditPage.expectSortedBy('timestamp', 'asc')
    
    // Sort by timestamp descending
    await auditPage.sortByColumn('timestamp')
    await auditPage.expectSortedBy('timestamp', 'desc')
  })

  test('should sort logs by action', async ({ page }) => {
    await auditPage.sortByColumn('action')
    await auditPage.expectSortedBy('action', 'asc')
    
    await auditPage.sortByColumn('action')
    await auditPage.expectSortedBy('action', 'desc')
  })

  test('should sort logs by user', async ({ page }) => {
    await auditPage.sortByColumn('user')
    await auditPage.expectSortedBy('user', 'asc')
    
    await auditPage.sortByColumn('user')
    await auditPage.expectSortedBy('user', 'desc')
  })

  test('should handle pagination for large audit logs', async ({ page }) => {
    // Mock large audit log dataset
    const largeLogs = Array.from({ length: 150 }, (_, i) => ({
      id: `audit-${i + 1}`,
      action: ['endpoint.created', 'endpoint.updated', 'endpoint.deleted', 'user.login'][i % 4],
      resourceType: 'endpoint',
      resourceId: `endpoint-${(i % 10) + 1}`,
      userId: 'admin-1',
      userEmail: 'admin@example.com',
      details: { test: `value-${i}` },
      timestamp: new Date(Date.now() - i * 60000),
      ipAddress: '192.168.1.100',
      userAgent: 'Test Browser'
    }))
    
    await page.route('**/api/audit', async (route) => {
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedLogs = largeLogs.slice(startIndex, endIndex)
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: paginatedLogs,
          total: largeLogs.length,
          page,
          limit,
          hasNext: endIndex < largeLogs.length,
          hasPrev: page > 1
        })
      })
    })
    
    await page.reload()
    
    // Should show pagination controls
    await expect(auditPage.paginationControls).toBeVisible()
    
    // Should show pagination info
    await auditPage.expectPaginationInfo(1, 3, 150) // 150 logs, 50 per page = 3 pages
    
    // Navigate pages
    await auditPage.goToNextPage()
    await auditPage.expectPaginationInfo(2, 3, 150)
    
    await auditPage.goToPage(3)
    await auditPage.expectPaginationInfo(3, 3, 150)
    
    await auditPage.goToPreviousPage()
    await auditPage.expectPaginationInfo(2, 3, 150)
  })

  test('should change items per page', async ({ page }) => {
    // Change to show 25 items per page
    await auditPage.setItemsPerPage(25)
    
    // Should update display
    await page.waitForTimeout(500)
    
    // Change to 100 items per page
    await auditPage.setItemsPerPage(100)
  })

  test('should export audit logs as CSV', async ({ page }) => {
    const download = await auditPage.exportLogs('csv')
    
    expect(download.suggestedFilename()).toMatch(/audit-logs\.csv/)
  })

  test('should export audit logs as JSON', async ({ page }) => {
    const download = await auditPage.exportLogs('json')
    
    expect(download.suggestedFilename()).toMatch(/audit-logs\.json/)
  })

  test('should show export progress', async ({ page }) => {
    // Mock slow export to see progress
    await page.route('**/api/audit/export', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })
    
    // Start export
    await auditPage.exportButton.click()
    
    // Should show progress
    await auditPage.expectExportProgress()
  })

  test('should refresh audit logs data', async ({ page }) => {
    // Mock updated logs
    await page.route('**/api/audit', async (route) => {
      const updatedLogs = [
        ...MOCK_AUDIT_LOGS,
        {
          id: 'audit-new',
          action: 'endpoint.created',
          resourceType: 'endpoint',
          resourceId: 'endpoint-new',
          userId: 'admin-1',
          userEmail: 'admin@example.com',
          details: { name: 'New Endpoint' },
          timestamp: new Date(),
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser'
        }
      ]
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: updatedLogs,
          total: updatedLogs.length,
          page: 1,
          limit: 50,
          hasNext: false,
          hasPrev: false
        })
      })
    })
    
    await auditPage.refreshData()
    
    // Should show new log
    await expect(page.getByText('audit-new')).toBeVisible()
  })

  test('should display empty state when no logs exist', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [],
          total: 0,
          page: 1,
          limit: 50,
          hasNext: false,
          hasPrev: false
        })
      })
    })
    
    await page.reload()
    
    await auditPage.expectEmptyState()
  })

  test('should handle log formatting correctly', async ({ page }) => {
    await auditPage.expectLogFormatting()
    
    // Check timestamp formatting
    const firstLogRow = page.getByRole('row').nth(1)
    const timestamp = firstLogRow.locator('[data-testid="timestamp"]')
    await expect(timestamp).toBeVisible()
    
    // Check action formatting with badges/pills
    const action = firstLogRow.locator('[data-testid="action"]')
    await expect(action).toBeVisible()
    
    // Check user display
    const user = firstLogRow.locator('[data-testid="user"]')
    await expect(user).toBeVisible()
  })

  test('should show detailed change information in modal', async ({ page }) => {
    const logWithChanges = MOCK_AUDIT_LOGS.find(log => log.details && log.details.changes)
    if (!logWithChanges) return
    
    await auditPage.viewLogDetails(logWithChanges.id)
    
    // Should show change details
    await expect(auditPage.logChanges).toBeVisible()
    
    // Should show before/after values
    if (logWithChanges.details.changes) {
      for (const [field, change] of Object.entries(logWithChanges.details.changes)) {
        if (typeof change === 'object' && 'from' in change && 'to' in change) {
          await expect(page.getByText(`${field}: ${change.from} → ${change.to}`)).toBeVisible()
        }
      }
    }
  })

  test('should handle audit log metadata display', async ({ page }) => {
    const log = MOCK_AUDIT_LOGS[0]
    
    await auditPage.viewLogDetails(log.id)
    
    // Should show complete metadata
    await expect(auditPage.logMetadata).toContainText(log.ipAddress)
    await expect(auditPage.logMetadata).toContainText(log.userAgent)
    await expect(auditPage.logMetadata).toContainText(log.timestamp.toLocaleDateString())
    
    // Should show resource information
    await expect(page.getByText(`Resource: ${log.resourceType}`)).toBeVisible()
    await expect(page.getByText(`Resource ID: ${log.resourceId}`)).toBeVisible()
  })
})

test.describe('Audit Logs - Error Handling', () => {
  test('should handle API errors when loading logs', async ({ page }) => {
    // Mock API error
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
        })
      })
    })
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    await auditPage.expectErrorState()
  })

  test('should handle export failures', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    // Mock export error
    await page.route('**/api/audit/export', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Export failed', code: 'EXPORT_ERROR' }
        })
      })
    })
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    await auditPage.exportButton.click()
    
    // Should show error message
    await expect(page.getByText(/export failed|error exporting/i)).toBeVisible()
  })

  test('should handle network timeouts', async ({ page }) => {
    // Mock slow response
    await page.route('**/api/audit', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.continue()
    })
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Should show timeout error
    await expect(page.getByText(/timeout|taking too long/i)).toBeVisible({ timeout: 40000 })
  })

  test('should handle invalid filter combinations', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Apply filters that result in no data
    await auditPage.filterByAction('nonexistent.action')
    await auditPage.setDateRange('1h')
    
    // Should show no results message
    await auditPage.expectNoLogs()
  })
})

test.describe('Audit Logs - Accessibility and Usability', () => {
  test('should support keyboard navigation', async ({ page }) => {
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    await auditPage.expectKeyboardNavigation()
  })

  test('should have proper accessibility features', async ({ page }) => {
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    await auditPage.expectAccessibilityFeatures()
    
    // Check ARIA labels for filters
    await expect(auditPage.searchInput).toHaveAttribute('aria-label', /search/i)
    await expect(auditPage.actionFilter).toHaveAttribute('aria-label', /filter by action/i)
    
    // Check table accessibility
    await expect(auditPage.auditTable).toHaveAttribute('role', 'table')
    await expect(auditPage.tableHeaders.first()).toHaveAttribute('role', 'columnheader')
  })

  test('should handle screen reader announcements', async ({ page }) => {
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Filter changes should be announced
    await auditPage.filterByAction('endpoint.created')
    
    const announcement = page.locator('[aria-live="polite"]')
    await expect(announcement).toContainText(/filtered|results/i)
  })

  test('should support high contrast mode', async ({ page }) => {
    // Enable high contrast
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Should remain visible and usable
    await auditPage.expectToBeVisible()
    await auditPage.expectTableVisible()
  })

  test('should handle reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Animations should be disabled but functionality preserved
    await auditPage.viewLogDetails(MOCK_AUDIT_LOGS[0].id)
    await auditPage.closeLogDetails()
  })
})

test.describe('Audit Logs - Performance', () => {
  test('should handle large audit log datasets efficiently', async ({ page }) => {
    // Mock very large dataset
    const massiveLogs = Array.from({ length: 10000 }, (_, i) => ({
      id: `audit-${i + 1}`,
      action: ['endpoint.created', 'endpoint.updated', 'endpoint.deleted', 'user.login', 'user.logout'][i % 5],
      resourceType: ['endpoint', 'user', 'session'][i % 3],
      resourceId: `resource-${(i % 100) + 1}`,
      userId: 'admin-1',
      userEmail: 'admin@example.com',
      details: { index: i },
      timestamp: new Date(Date.now() - i * 60000),
      ipAddress: '192.168.1.100',
      userAgent: 'Test Browser'
    }))
    
    await page.route('**/api/audit', async (route) => {
      const url = new URL(route.request().url())
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: massiveLogs.slice(0, limit),
          total: massiveLogs.length,
          page: 1,
          limit,
          hasNext: true,
          hasPrev: false
        })
      })
    })
    
    const auditPage = new AuditPage(page)
    const startTime = Date.now()
    await auditPage.goto()
    const endTime = Date.now()
    
    // Should load quickly
    const loadTime = endTime - startTime
    expect(loadTime).toBeLessThan(5000)
    
    // Should remain responsive
    await auditPage.searchLogs('audit-1')
    await auditPage.filterByAction('endpoint.created')
  })

  test('should debounce search input efficiently', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    let searchCallCount = 0
    await page.route('**/api/audit?*search*', async (route) => {
      searchCallCount++
      await route.continue()
    })
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    
    // Type rapidly
    await auditPage.searchInput.type('endpoint', { delay: 50 })
    
    // Wait for debounce
    await page.waitForTimeout(500)
    
    // Should not make a request for every keystroke
    expect(searchCallCount).toBeLessThan(8) // Should be debounced
  })
})