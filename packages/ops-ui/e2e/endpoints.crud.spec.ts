import { test, expect } from '@playwright/test'
import { EndpointsPage } from './pages/endpoints.page'
import { EndpointFormPage } from './pages/endpoint-form.page'
import { DashboardPage } from './pages/dashboard.page'
import { ApiMocks } from './fixtures/api-mocks'
import { VALID_ENDPOINT_DATA, MOCK_ENDPOINTS } from './fixtures/test-data'

test.describe('Endpoints CRUD Operations', () => {
  let endpointsPage: EndpointsPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
  })

  test('should display endpoints list', async ({ page }) => {
    await endpointsPage.expectToBeVisible()
    await endpointsPage.expectTableVisible()
    
    // Should show mock endpoints
    for (const endpoint of MOCK_ENDPOINTS) {
      await endpointsPage.expectEndpointInTable(
        endpoint.name, 
        endpoint.targetUrl, 
        endpoint.enabled ? 'Online' : 'Disabled'
      )
    }
  })

  test('should show statistics cards', async ({ page }) => {
    await endpointsPage.expectStatsCards()
  })

  test('should create new endpoint successfully', async ({ page }) => {
    // Click create button
    await endpointsPage.clickCreateEndpoint()
    
    // Fill form
    const formPage = new EndpointFormPage(page)
    await formPage.expectCreateForm()
    
    await formPage.fillBasicInfo({
      name: VALID_ENDPOINT_DATA.name,
      targetUrl: VALID_ENDPOINT_DATA.targetUrl,
      enabled: VALID_ENDPOINT_DATA.enabled
    })
    
    await formPage.fillLimits(VALID_ENDPOINT_DATA.limits)
    await formPage.fillSampling(VALID_ENDPOINT_DATA.sampling)
    
    // Submit form
    await formPage.submitForm()
    
    // Should redirect to endpoints list
    await formPage.expectRedirectToEndpoints()
    
    // Should show success message
    await endpointsPage.expectSuccessToast('Endpoint created successfully')
    
    // Should see new endpoint in list
    await endpointsPage.expectEndpointInTable(
      VALID_ENDPOINT_DATA.name,
      VALID_ENDPOINT_DATA.targetUrl,
      'Online'
    )
  })

  test('should test connection before creating endpoint', async ({ page }) => {
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    await formPage.fillBasicInfo({
      name: 'Test Endpoint',
      targetUrl: 'wss://echo.websocket.org'
    })
    
    // Test connection
    await formPage.testConnection()
    await formPage.expectTestConnectionSuccess()
  })

  test('should view endpoint details', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS[0]
    
    // Click on endpoint name to view details
    await endpointsPage.viewEndpointDetails(endpoint.name)
    
    // Should navigate to detail page
    await page.waitForURL(`/endpoints/${endpoint.id}`)
    
    // Should show endpoint details
    await expect(page.getByRole('heading', { name: endpoint.name })).toBeVisible()
    await expect(page.getByText(endpoint.targetUrl)).toBeVisible()
  })

  test('should edit endpoint successfully', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS[0]
    
    // Click edit action
    await endpointsPage.editEndpoint(endpoint.name)
    
    // Should navigate to edit form
    const formPage = new EndpointFormPage(page)
    await formPage.expectEditForm(endpoint.name)
    
    // Update endpoint
    const updatedName = 'Updated Test Endpoint'
    await formPage.fillBasicInfo({
      name: updatedName,
      targetUrl: endpoint.targetUrl
    })
    
    // Submit changes
    await formPage.submitForm()
    
    // Should redirect to endpoints list
    await formPage.expectRedirectToEndpoints()
    
    // Should show success message
    await endpointsPage.expectSuccessToast('Endpoint updated successfully')
    
    // Should see updated endpoint in list
    await endpointsPage.expectEndpointInTable(
      updatedName,
      endpoint.targetUrl,
      endpoint.enabled ? 'Online' : 'Disabled'
    )
  })

  test('should enable/disable endpoint', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS.find(e => !e.enabled) // Find disabled endpoint
    if (!endpoint) return
    
    // Enable endpoint
    await endpointsPage.enableEndpoint(endpoint.name)
    
    // Should show success message
    await endpointsPage.expectSuccessToast('Endpoint enabled successfully')
    
    // Should update status in table
    await endpointsPage.expectEndpointStatus(endpoint.name, 'Online')
    
    // Disable endpoint
    await endpointsPage.disableEndpoint(endpoint.name)
    
    // Should show success message
    await endpointsPage.expectSuccessToast('Endpoint disabled successfully')
    
    // Should update status in table
    await endpointsPage.expectEndpointStatus(endpoint.name, 'Disabled')
  })

  test('should clone endpoint', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS[0]
    
    // Clone endpoint
    await endpointsPage.cloneEndpoint(endpoint.name)
    
    // Should show success message
    await endpointsPage.expectSuccessToast('Endpoint cloned successfully')
    
    // Should see cloned endpoint in list
    await endpointsPage.expectEndpointInTable(
      `${endpoint.name} (Copy)`,
      endpoint.targetUrl,
      endpoint.enabled ? 'Online' : 'Disabled'
    )
  })

  test('should delete endpoint with confirmation', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS[0]
    
    // Delete endpoint
    await endpointsPage.deleteEndpoint(endpoint.name)
    
    // Should show success message
    await endpointsPage.expectSuccessToast('Endpoint deleted successfully')
    
    // Should no longer see endpoint in list
    const tableRows = page.getByRole('row').filter({ hasText: endpoint.name })
    await expect(tableRows).not.toBeVisible()
  })

  test('should search endpoints', async ({ page }) => {
    const searchTerm = MOCK_ENDPOINTS[0].name.split(' ')[0] // Use first word
    
    // Search for endpoint
    await endpointsPage.searchEndpoints(searchTerm)
    
    // Should show filtered results
    const expectedCount = MOCK_ENDPOINTS.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.targetUrl.toLowerCase().includes(searchTerm.toLowerCase())
    ).length
    
    await endpointsPage.expectSearchResults(searchTerm, expectedCount)
  })

  test('should clear search', async ({ page }) => {
    // Perform search
    await endpointsPage.searchEndpoints('test')
    
    // Clear search
    await endpointsPage.clearSearch()
    
    // Should show all endpoints again
    await endpointsPage.expectTableVisible()
    for (const endpoint of MOCK_ENDPOINTS) {
      await endpointsPage.expectEndpointInTable(
        endpoint.name,
        endpoint.targetUrl,
        endpoint.enabled ? 'Online' : 'Disabled'
      )
    }
  })

  test('should sort endpoints by columns', async ({ page }) => {
    // Sort by name
    await endpointsPage.sortByColumn('Name')
    await endpointsPage.expectSortedBy('Name', 'asc')
    
    // Sort by name descending
    await endpointsPage.sortByColumn('Name')
    await endpointsPage.expectSortedBy('Name', 'desc')
    
    // Sort by created date
    await endpointsPage.sortByColumn('Created')
    await endpointsPage.expectSortedBy('Created', 'asc')
  })

  test('should handle pagination', async ({ page }) => {
    // Mock large dataset for pagination
    await page.route('**/api/endpoints', async (route) => {
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '10')
      
      // Generate 25 mock endpoints for pagination test
      const allEndpoints = Array.from({ length: 25 }, (_, i) => ({
        ...MOCK_ENDPOINTS[0],
        id: `endpoint-${i + 1}`,
        name: `Test Endpoint ${i + 1}`,
        targetUrl: `wss://test${i + 1}.example.com`
      }))
      
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedEndpoints = allEndpoints.slice(startIndex, endIndex)
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          endpoints: paginatedEndpoints,
          total: allEndpoints.length,
          page,
          limit,
          hasNext: endIndex < allEndpoints.length,
          hasPrev: page > 1
        })
      })
    })
    
    // Reload page to get paginated data
    await page.reload()
    
    // Should show pagination controls
    await expect(endpointsPage.paginationControls).toBeVisible()
    
    // Should show pagination info
    await endpointsPage.expectPaginationInfo(1, 3) // 25 items, 10 per page = 3 pages
    
    // Navigate to next page
    await endpointsPage.goToNextPage()
    await endpointsPage.expectPaginationInfo(2, 3)
    
    // Navigate to specific page
    await endpointsPage.goToPage(3)
    await endpointsPage.expectPaginationInfo(3, 3)
    
    // Navigate back
    await endpointsPage.goToPreviousPage()
    await endpointsPage.expectPaginationInfo(2, 3)
  })

  test('should handle empty endpoints list', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/endpoints', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          endpoints: [],
          total: 0,
          page: 1,
          limit: 10,
          hasNext: false,
          hasPrev: false
        })
      })
    })
    
    await page.reload()
    
    // Should show empty state
    await endpointsPage.expectNoEndpoints()
    
    // Should still show create button
    await expect(endpointsPage.createButton).toBeVisible()
  })
})

test.describe('Endpoints - Error Handling', () => {
  test('should handle API errors when loading endpoints', async ({ page }) => {
    // Mock API error
    await page.route('**/api/endpoints', async (route) => {
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
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Should show error message
    await endpointsPage.expectErrorToast('Failed to load endpoints')
  })

  test('should handle network errors', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Simulate network error for actions
    await page.route('**/api/endpoints/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.abort('internetdisconnected')
      } else {
        await route.continue()
      }
    })
    
    // Try to delete endpoint
    const endpoint = MOCK_ENDPOINTS[0]
    await endpointsPage.deleteEndpoint(endpoint.name)
    
    // Should show network error
    await endpointsPage.expectErrorToast('Failed to delete endpoint')
  })

  test('should handle timeout errors', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    // Mock slow response
    await page.route('**/api/endpoints', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 35000))
        await route.continue()
      } else {
        await route.continue()
      }
    })
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Try to create endpoint
    await endpointsPage.clickCreateEndpoint()
    
    const formPage = new EndpointFormPage(page)
    await formPage.fillBasicInfo({
      name: 'Test Endpoint',
      targetUrl: 'wss://test.example.com'
    })
    
    await formPage.submitForm()
    
    // Should handle timeout gracefully
    await expect(page.getByText(/timeout|took too long/i)).toBeVisible({ timeout: 40000 })
  })
})

test.describe('Endpoints - Performance', () => {
  test('should handle large lists efficiently', async ({ page }) => {
    // Mock large dataset
    await page.route('**/api/endpoints', async (route) => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        ...MOCK_ENDPOINTS[0],
        id: `endpoint-${i + 1}`,
        name: `Endpoint ${i + 1}`,
        targetUrl: `wss://endpoint${i + 1}.example.com`
      }))
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          endpoints: largeDataset.slice(0, 10), // Return first page
          total: largeDataset.length,
          page: 1,
          limit: 10,
          hasNext: true,
          hasPrev: false
        })
      })
    })
    
    const endpointsPage = new EndpointsPage(page)
    const startTime = Date.now()
    await endpointsPage.goto()
    const endTime = Date.now()
    
    // Should load quickly even with large dataset
    const loadTime = endTime - startTime
    expect(loadTime).toBeLessThan(5000)
    
    // Should show pagination for large dataset
    await expect(endpointsPage.paginationControls).toBeVisible()
  })

  test('should debounce search queries', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    let searchCallCount = 0
    await page.route('**/api/endpoints?*search*', async (route) => {
      searchCallCount++
      await route.continue()
    })
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Type quickly in search
    await endpointsPage.searchInput.type('test', { delay: 50 })
    
    // Wait for debounce
    await page.waitForTimeout(500)
    
    // Should not make a request for every keystroke
    expect(searchCallCount).toBeLessThan(4) // Should be debounced
  })
})