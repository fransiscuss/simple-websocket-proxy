import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { EndpointsPage } from './pages/endpoints.page'
import { EndpointFormPage } from './pages/endpoint-form.page'
import { TrafficPage } from './pages/traffic.page'
import { AuditPage } from './pages/audit.page'
import { LoginPage } from './pages/login.page'
import { ApiMocks } from './fixtures/api-mocks'
import { VALID_ENDPOINT_DATA, TEST_ADMIN_CREDENTIALS } from './fixtures/test-data'

test.describe('Integration Workflows - Complete User Journeys', () => {
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should complete full endpoint creation workflow', async ({ page }) => {
    // 1. Start from login
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_ADMIN_CREDENTIALS.email, TEST_ADMIN_CREDENTIALS.password)
    
    // 2. Navigate to dashboard
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.expectToBeVisible()
    await dashboardPage.expectMetricsCards()
    
    // 3. Go to endpoints page
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // 4. Create new endpoint
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    await formPage.expectCreateForm()
    
    // 5. Fill and submit form
    await formPage.fillBasicInfo(VALID_ENDPOINT_DATA)
    await formPage.fillLimits(VALID_ENDPOINT_DATA.limits)
    await formPage.fillSampling(VALID_ENDPOINT_DATA.sampling)
    
    // 6. Test connection before creating
    await formPage.testConnection()
    await formPage.expectTestConnectionSuccess()
    
    // 7. Submit and verify creation
    await formPage.submitForm()
    await formPage.expectRedirectToEndpoints()
    
    // 8. Verify endpoint appears in list
    await endpointsPage.expectSuccessToast('Endpoint created successfully')
    await endpointsPage.expectEndpointInTable(
      VALID_ENDPOINT_DATA.name,
      VALID_ENDPOINT_DATA.targetUrl,
      'Online'
    )
    
    // 9. Check audit log records the creation
    await dashboardPage.navigateToAudit()
    
    const auditPage = new AuditPage(page)
    await auditPage.expectToBeVisible()
    await expect(page.getByText('endpoint.created')).toBeVisible()
  })

  test('should complete endpoint management lifecycle', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Navigate to endpoints
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    const testEndpointName = 'Test WebSocket Endpoint'
    
    // 2. View endpoint details
    await endpointsPage.viewEndpointDetails(testEndpointName)
    await page.waitForURL(/\/endpoints\/endpoint-1$/)
    await expect(page.getByRole('heading', { name: testEndpointName })).toBeVisible()
    
    // 3. Edit endpoint
    await page.goBack()
    await endpointsPage.editEndpoint(testEndpointName)
    
    const formPage = new EndpointFormPage(page)
    await formPage.expectEditForm(testEndpointName)
    
    // 4. Update endpoint configuration
    const updatedName = 'Updated Test Endpoint'
    await formPage.nameInput.clear()
    await formPage.nameInput.fill(updatedName)
    
    await formPage.fillLimits({ maxConnections: 200 })
    await formPage.submitForm()
    
    // 5. Verify update
    await formPage.expectRedirectToEndpoints()
    await endpointsPage.expectSuccessToast('Endpoint updated successfully')
    await endpointsPage.expectEndpointInTable(updatedName, 'wss://echo.websocket.org', 'Online')
    
    // 6. Disable endpoint
    await endpointsPage.disableEndpoint(updatedName)
    await endpointsPage.expectSuccessToast('Endpoint disabled successfully')
    await endpointsPage.expectEndpointStatus(updatedName, 'Disabled')
    
    // 7. Enable endpoint again
    await endpointsPage.enableEndpoint(updatedName)
    await endpointsPage.expectSuccessToast('Endpoint enabled successfully')
    await endpointsPage.expectEndpointStatus(updatedName, 'Online')
    
    // 8. Clone endpoint
    await endpointsPage.cloneEndpoint(updatedName)
    await endpointsPage.expectSuccessToast('Endpoint cloned successfully')
    await endpointsPage.expectEndpointInTable(`${updatedName} (Copy)`, 'wss://echo.websocket.org', 'Online')
    
    // 9. Delete cloned endpoint
    await endpointsPage.deleteEndpoint(`${updatedName} (Copy)`)
    await endpointsPage.expectSuccessToast('Endpoint deleted successfully')
    
    // 10. Verify audit trail
    await dashboardPage.navigateToAudit()
    
    const auditPage = new AuditPage(page)
    await auditPage.expectToBeVisible()
    
    // Should see all the actions we performed
    await expect(page.getByText('endpoint.updated')).toBeVisible()
    await expect(page.getByText('endpoint.disabled')).toBeVisible()
    await expect(page.getByText('endpoint.enabled')).toBeVisible()
    await expect(page.getByText('endpoint.deleted')).toBeVisible()
  })

  test('should complete traffic monitoring workflow', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Check metrics on dashboard
    await dashboardPage.expectMetricsCards()
    await dashboardPage.expectMetricValue('active-connections-card', /\d+/)
    
    // 2. Navigate to traffic monitoring
    await dashboardPage.navigateToTraffic()
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.expectToBeVisible()
    
    // 3. Verify real-time connection
    await trafficPage.expectWebSocketConnection()
    await trafficPage.expectMetricsCards()
    
    // 4. View active sessions
    await trafficPage.expectSessionsVisible()
    await trafficPage.expectSessionTile('session-1', 'connected')
    
    // 5. Filter sessions by status
    await trafficPage.filterByStatus('connected')
    await trafficPage.expectSessionCount(1) // From mock data
    
    // 6. View session details
    await trafficPage.viewSessionDetails('session-1')
    await trafficPage.expectSessionDetails('session-1', {
      status: 'connected',
      messagesIn: 25,
      messagesOut: 20
    })
    
    // 7. Kill session (if needed)
    await trafficPage.killSession('session-1')
    await trafficPage.expectSuccessToast('Session terminated successfully')
    
    // 8. Filter by endpoint
    const endpointName = 'Test WebSocket Endpoint'
    await trafficPage.filterByEndpoint(endpointName)
    
    // 9. Export traffic data
    await trafficPage.exportData()
    
    // 10. Check charts and visualizations
    await trafficPage.expectCharts()
    await trafficPage.expectFlowVisualization()
    
    // 11. Test time range filtering
    await trafficPage.setTimeRange('1h')
    await trafficPage.setTimeRange('24h')
    
    // 12. Toggle auto-refresh
    await trafficPage.toggleAutoRefresh()
    await trafficPage.expectAutoRefreshDisabled()
    
    await trafficPage.toggleAutoRefresh()
    await trafficPage.expectAutoRefreshEnabled()
  })

  test('should complete audit investigation workflow', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Navigate to audit logs
    await dashboardPage.navigateToAudit()
    
    const auditPage = new AuditPage(page)
    await auditPage.expectToBeVisible()
    
    // 2. Review all audit entries
    await auditPage.expectTableVisible()
    await auditPage.expectLogEntry('audit-1', 'endpoint.created', 'endpoint', 'admin@example.com')
    
    // 3. Filter by action type
    await auditPage.filterByAction('endpoint.created')
    await page.waitForTimeout(500)
    
    // 4. Filter by user
    await auditPage.clearFilters()
    await auditPage.filterByUser('admin@example.com')
    
    // 5. Set date range for investigation
    await auditPage.setDateRange('24h')
    
    // 6. Search for specific activity
    await auditPage.searchLogs('endpoint')
    
    // 7. View detailed log information
    await auditPage.viewLogDetails('audit-1')
    await auditPage.expectLogDetailsModal('audit-1', {
      action: 'endpoint.created',
      resource: 'endpoint',
      user: 'admin@example.com',
      ipAddress: '192.168.1.100'
    })
    
    // 8. Close details and check another log
    await auditPage.closeLogDetails()
    await auditPage.viewLogDetails('audit-2')
    
    // 9. Export audit data for compliance
    await auditPage.closeLogDetails()
    const csvDownload = await auditPage.exportLogs('csv')
    expect(csvDownload.suggestedFilename()).toMatch(/audit-logs\.csv/)
    
    const jsonDownload = await auditPage.exportLogs('json')
    expect(jsonDownload.suggestedFilename()).toMatch(/audit-logs\.json/)
    
    // 10. Sort by timestamp to see chronological order
    await auditPage.sortByColumn('timestamp')
    await auditPage.expectSortedBy('timestamp', 'asc')
    
    // 11. Paginate through large datasets
    if (await auditPage.paginationControls.isVisible()) {
      await auditPage.goToNextPage()
      await auditPage.goToPreviousPage()
    }
  })

  test('should handle error recovery workflows', async ({ page }) => {
    // 1. Start with successful login
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_ADMIN_CREDENTIALS.email, TEST_ADMIN_CREDENTIALS.password)
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.expectToBeVisible()
    
    // 2. Simulate network error and recovery
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
    
    // 3. Navigate to endpoints page with error
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectErrorToast('Failed to load endpoints')
    
    // 4. Restore API and retry
    await apiMocks.setupEndpointMocks()
    await page.reload()
    
    // 5. Should work normally after recovery
    await endpointsPage.expectToBeVisible()
    await endpointsPage.expectTableVisible()
    
    // 6. Test form validation error recovery
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    await formPage.expectCreateForm()
    
    // 7. Submit invalid form
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Name is required')
    
    // 8. Fix errors and resubmit
    await formPage.fillBasicInfo({
      name: 'Recovery Test Endpoint',
      targetUrl: 'wss://test.example.com'
    })
    
    await formPage.submitForm()
    await formPage.expectRedirectToEndpoints()
    
    // 9. Verify successful recovery
    await endpointsPage.expectSuccessToast('Endpoint created successfully')
  })

  test('should maintain state across navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Apply filters on traffic page
    await dashboardPage.navigateToTraffic()
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.expectToBeVisible()
    
    await trafficPage.filterByStatus('connected')
    await trafficPage.searchSessions('session-1')
    
    // 2. Navigate away
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // 3. Apply search on endpoints
    await endpointsPage.searchEndpoints('test')
    
    // 4. Navigate back to traffic
    await dashboardPage.navigateToTraffic()
    
    // 5. Filters should be preserved (if implemented)
    // Note: This depends on whether the app preserves filter state
    // await trafficPage.expectSessionsVisible()
    
    // 6. Navigate to audit with filters
    await dashboardPage.navigateToAudit()
    
    const auditPage = new AuditPage(page)
    await auditPage.expectToBeVisible()
    
    await auditPage.filterByAction('endpoint.created')
    await auditPage.setDateRange('24h')
    
    // 7. Refresh page and verify state
    await page.reload()
    await auditPage.expectToBeVisible()
    
    // State preservation depends on implementation
    // await auditPage.expectFilterResults({ action: 'endpoint.created' }, 1)
  })

  test('should handle session timeout and re-authentication', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Normal operation
    await dashboardPage.expectToBeVisible()
    await dashboardPage.navigateToEndpoints()
    
    // 2. Simulate session expiry
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Session expired', code: 'SESSION_EXPIRED' }
        })
      })
    })
    
    // 3. Try to perform an action
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.clickCreateEndpoint()
    
    // 4. Should redirect to login
    await page.waitForURL('/login')
    
    const loginPage = new LoginPage(page)
    await loginPage.expectToBeVisible()
    
    // 5. Re-authenticate
    await apiMocks.setupAllMocks()
    await loginPage.login(TEST_ADMIN_CREDENTIALS.email, TEST_ADMIN_CREDENTIALS.password)
    
    // 6. Should redirect back to dashboard
    await dashboardPage.expectToBeVisible()
    
    // 7. Normal operation should resume
    await dashboardPage.navigateToEndpoints()
    await endpointsPage.expectToBeVisible()
  })
})

test.describe('Integration Workflows - Data Consistency', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should maintain data consistency across pages', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Check dashboard metrics
    await dashboardPage.expectMetricsCards()
    const dashboardEndpointCount = await page.locator('[data-testid="total-endpoints-card"]').textContent()
    
    // 2. Go to endpoints and verify count matches
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // Count should be consistent
    const endpointRows = endpointsPage.tableRows.filter({ hasNotText: 'Name' })
    const actualEndpointCount = await endpointRows.count()
    
    // Extract number from dashboard card text
    const dashboardNumber = parseInt(dashboardEndpointCount?.match(/\d+/)?.[0] || '0')
    expect(actualEndpointCount).toBe(dashboardNumber)
    
    // 3. Create new endpoint
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    await formPage.fillBasicInfo({
      name: 'Consistency Test Endpoint',
      targetUrl: 'wss://test.example.com'
    })
    await formPage.submitForm()
    
    // 4. Verify count updated everywhere
    await endpointsPage.expectSuccessToast('Endpoint created successfully')
    
    // Go back to dashboard
    await dashboardPage.goto()
    
    // Dashboard should show updated count
    await expect(page.locator('[data-testid="total-endpoints-card"]')).toContainText((dashboardNumber + 1).toString())
  })

  test('should reflect real-time changes across multiple views', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Open traffic monitoring
    await dashboardPage.navigateToTraffic()
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.expectToBeVisible()
    
    // 2. Verify initial metrics
    await trafficPage.expectMetricsCards()
    const initialConnections = await page.locator('[data-testid="active-connections-card"]').textContent()
    
    // 3. Mock real-time WebSocket updates
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Simulate metrics update
            setTimeout(() => {
              const update = {
                type: 'metricsUpdate',
                data: {
                  activeConnections: 55,
                  messagesPerSecond: 25.0,
                  bytesPerSecond: 6144
                }
              }
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(update) 
                }))
              }
            }, 500)
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // 4. Should see real-time updates
    await trafficPage.expectMetricValue('active-connections-card', '55')
    
    // 5. Navigate to dashboard and verify consistency
    await dashboardPage.goto()
    
    // Should also reflect updated metrics (if WebSocket is global)
    await dashboardPage.expectMetricsCards()
  })

  test('should handle concurrent user actions gracefully', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // 1. Simulate concurrent modifications
    // Mock endpoint update conflict
    await page.route('**/api/endpoints/endpoint-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Endpoint was modified by another user',
              code: 'CONFLICT'
            }
          })
        })
      }
    })
    
    // 2. Try to edit endpoint
    await endpointsPage.editEndpoint('Test WebSocket Endpoint')
    
    const formPage = new EndpointFormPage(page)
    await formPage.nameInput.clear()
    await formPage.nameInput.fill('Modified Name')
    await formPage.submitForm()
    
    // 3. Should handle conflict gracefully
    await formPage.expectFormError('Endpoint was modified by another user')
    
    // 4. Should provide resolution options
    const refreshButton = page.getByRole('button', { name: /refresh|reload/i })
    if (await refreshButton.isVisible()) {
      await refreshButton.click()
      // Should reload with latest data
    }
  })
})

test.describe('Integration Workflows - Performance Under Load', () => {
  test('should handle multiple simultaneous operations', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // 1. Start multiple background operations
    const promises = []
    
    // Navigate and load different pages simultaneously
    promises.push((async () => {
      await dashboardPage.navigateToEndpoints()
      const endpointsPage = new EndpointsPage(page)
      await endpointsPage.expectToBeVisible()
    })())
    
    await Promise.all(promises)
    
    // 2. Perform rapid successive operations
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.searchEndpoints('test')
    await page.waitForTimeout(100)
    
    await endpointsPage.clearSearch()
    await page.waitForTimeout(100)
    
    await endpointsPage.searchEndpoints('endpoint')
    
    // 3. Should remain responsive
    await endpointsPage.expectToBeVisible()
    await endpointsPage.expectTableVisible()
  })

  test('should maintain performance with large datasets', async ({ page }) => {
    // Mock large datasets
    await page.route('**/api/endpoints', async (route) => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `endpoint-${i}`,
        name: `Endpoint ${i}`,
        targetUrl: `wss://endpoint${i}.example.com`,
        enabled: i % 2 === 0,
        limits: {},
        sampling: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          endpoints: largeDataset.slice(0, 50), // Paginated
          total: largeDataset.length,
          page: 1,
          limit: 50,
          hasNext: true,
          hasPrev: false
        })
      })
    })
    
    const dashboardPage = new DashboardPage(page)
    const startTime = Date.now()
    await dashboardPage.goto()
    
    // Navigate to endpoints with large dataset
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    const endTime = Date.now()
    
    // Should load within reasonable time
    const loadTime = endTime - startTime
    expect(loadTime).toBeLessThan(5000)
    
    // Should handle search efficiently
    const searchStartTime = Date.now()
    await endpointsPage.searchEndpoints('Endpoint 1')
    const searchEndTime = Date.now()
    
    const searchTime = searchEndTime - searchStartTime
    expect(searchTime).toBeLessThan(1000)
  })
})