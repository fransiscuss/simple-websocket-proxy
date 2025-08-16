import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { ApiMocks } from './fixtures/api-mocks'
import { MOCK_ENDPOINTS, MOCK_TRAFFIC_DATA } from './fixtures/test-data'

test.describe('Dashboard - Comprehensive Functionality', () => {
  let dashboardPage: DashboardPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
  })

  test('should display all metric cards with correct data', async ({ page }) => {
    await dashboardPage.expectMetricsCards()
    
    // Check specific metric values
    await dashboardPage.expectMetricValue('total-endpoints-card', '2') // From MOCK_ENDPOINTS
    await dashboardPage.expectMetricValue('active-connections-card', /\d+/)
    await dashboardPage.expectMetricValue('messages-per-second-card', /\d+\.?\d*/)
    await dashboardPage.expectMetricValue('error-rate-card', /\d+\.?\d*%/)
  })

  test('should refresh metrics when refresh button is clicked', async ({ page }) => {
    // Get initial metric values
    const initialConnections = await dashboardPage.activeConnectionsCard.textContent()
    
    // Mock updated metrics
    await page.route('**/api/traffic/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalConnections: 175,
          activeConnections: 55,
          messagesPerSecond: 20.5,
          bytesPerSecond: 4096,
          errorRate: 0.015
        })
      })
    })
    
    // Refresh dashboard
    await dashboardPage.refreshDashboard()
    
    // Should show updated values
    await dashboardPage.expectMetricValue('active-connections-card', '55')
    await dashboardPage.expectMetricValue('messages-per-second-card', '20.5')
  })

  test('should show recent activity summary', async ({ page }) => {
    // Check for recent activity section
    const recentActivity = page.locator('[data-testid="recent-activity"]')
    await expect(recentActivity).toBeVisible()
    
    // Should show recent endpoint changes
    await expect(page.getByText(/recently created|recently updated/i)).toBeVisible()
    
    // Should show recent sessions
    await expect(page.getByText(/active session|new connection/i)).toBeVisible()
  })

  test('should display endpoint status overview', async ({ page }) => {
    const endpointOverview = page.locator('[data-testid="endpoint-overview"]')
    await expect(endpointOverview).toBeVisible()
    
    // Should show enabled/disabled counts
    await expect(page.getByText('1 Enabled')).toBeVisible() // From MOCK_ENDPOINTS
    await expect(page.getByText('1 Disabled')).toBeVisible()
    
    // Should have quick action buttons
    await expect(page.getByRole('link', { name: /view all endpoints/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /create endpoint/i })).toBeVisible()
  })

  test('should show traffic charts and visualizations', async ({ page }) => {
    const trafficChart = page.locator('[data-testid="traffic-chart"]')
    const connectionChart = page.locator('[data-testid="connection-chart"]')
    
    await expect(trafficChart).toBeVisible()
    await expect(connectionChart).toBeVisible()
    
    // Charts should have data
    await expect(page.locator('[data-testid="chart-data-point"]')).toHaveCount({ 
      timeout: 5000 
    }, expect.greaterThan(0))
  })

  test('should handle chart time range selection', async ({ page }) => {
    const timeRangeSelect = page.locator('[data-testid="chart-time-range"]')
    await expect(timeRangeSelect).toBeVisible()
    
    // Change time range
    await timeRangeSelect.click()
    await page.getByRole('option', { name: '24h' }).click()
    
    // Charts should update
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="chart-loading"]')).not.toBeVisible()
  })

  test('should display system health indicators', async ({ page }) => {
    const healthIndicators = page.locator('[data-testid="health-indicators"]')
    await expect(healthIndicators).toBeVisible()
    
    // Should show database status
    await expect(page.getByText(/database.*healthy/i)).toBeVisible()
    
    // Should show WebSocket status
    await expect(page.getByText(/websocket.*connected/i)).toBeVisible()
    
    // Should show overall system status
    await expect(page.getByText(/system.*operational/i)).toBeVisible()
  })

  test('should show alerts and notifications', async ({ page }) => {
    // Mock alert/notification data
    await page.route('**/api/alerts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          alerts: [
            {
              id: 'alert-1',
              type: 'warning',
              message: 'High connection count on endpoint-1',
              timestamp: new Date(Date.now() - 300000).toISOString()
            },
            {
              id: 'alert-2',
              type: 'info',
              message: 'New endpoint created: Test Endpoint',
              timestamp: new Date(Date.now() - 600000).toISOString()
            }
          ]
        })
      })
    })
    
    await page.reload()
    
    const alertsSection = page.locator('[data-testid="alerts-section"]')
    await expect(alertsSection).toBeVisible()
    
    // Should show alerts
    await expect(page.getByText('High connection count')).toBeVisible()
    await expect(page.getByText('New endpoint created')).toBeVisible()
  })

  test('should handle empty/no data states gracefully', async ({ page }) => {
    // Mock empty data responses
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
    
    await page.route('**/api/traffic/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalConnections: 0,
          activeConnections: 0,
          messagesPerSecond: 0,
          bytesPerSecond: 0,
          errorRate: 0
        })
      })
    })
    
    await page.reload()
    
    // Should show zero states
    await dashboardPage.expectMetricValue('total-endpoints-card', '0')
    await dashboardPage.expectMetricValue('active-connections-card', '0')
    
    // Should show empty state messaging
    await expect(page.getByText(/no endpoints configured/i)).toBeVisible()
    await expect(page.getByText(/get started/i)).toBeVisible()
  })

  test('should display quick actions and shortcuts', async ({ page }) => {
    const quickActions = page.locator('[data-testid="quick-actions"]')
    await expect(quickActions).toBeVisible()
    
    // Check for common actions
    await expect(page.getByRole('link', { name: /create new endpoint/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /view all traffic/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /audit logs/i })).toBeVisible()
    
    // Actions should navigate correctly
    await page.getByRole('link', { name: /create new endpoint/i }).click()
    await expect(page).toHaveURL('/endpoints/new')
  })

  test('should show performance metrics trends', async ({ page }) => {
    const trendChart = page.locator('[data-testid="trend-chart"]')
    await expect(trendChart).toBeVisible()
    
    // Should show trend indicators
    await expect(page.locator('[data-testid="trend-up"]')).toBeVisible()
    await expect(page.locator('[data-testid="trend-down"]')).toBeVisible()
    
    // Should show percentage changes
    await expect(page.getByText(/\+\d+%|\-\d+%/)).toBeVisible()
  })

  test('should handle real-time updates correctly', async ({ page }) => {
    // Mock WebSocket for real-time updates
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send periodic updates
            setInterval(() => {
              const update = {
                type: 'dashboardUpdate',
                data: {
                  activeConnections: Math.floor(Math.random() * 100),
                  messagesPerSecond: Math.random() * 50,
                  timestamp: Date.now()
                }
              }
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(update) 
                }))
              }
            }, 1000)
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should show real-time indicator
    await expect(page.locator('[data-testid="live-indicator"]')).toBeVisible()
    
    // Metrics should update
    await page.waitForTimeout(2000)
    await dashboardPage.expectMetricsCards()
  })
})

test.describe('Dashboard - Error Handling', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
        })
      })
    })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Should show error state
    await expect(page.getByText(/error loading|failed to load/i)).toBeVisible()
    
    // Should show retry option
    await expect(page.getByRole('button', { name: /retry|refresh/i })).toBeVisible()
  })

  test('should handle network timeouts', async ({ page }) => {
    // Mock slow response
    await page.route('**/api/traffic/metrics', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.continue()
    })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Should show timeout error
    await expect(page.getByText(/timeout|taking too long/i)).toBeVisible({ timeout: 40000 })
  })

  test('should handle partial data loading failures', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAuthMocks()
    await apiMocks.setupEndpointMocks()
    
    // Mock traffic metrics failure only
    await page.route('**/api/traffic/metrics', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' }
        })
      })
    })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Endpoints should still load
    await dashboardPage.expectToBeVisible()
    
    // Traffic metrics should show error state
    await expect(page.getByText(/metrics unavailable/i)).toBeVisible()
  })
})

test.describe('Dashboard - Performance', () => {
  test('should load quickly with large datasets', async ({ page }) => {
    // Mock large endpoint dataset
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
          endpoints: largeDataset.slice(0, 10),
          total: largeDataset.length,
          page: 1,
          limit: 10,
          hasNext: true,
          hasPrev: false
        })
      })
    })
    
    const dashboardPage = new DashboardPage(page)
    const startTime = Date.now()
    await dashboardPage.goto()
    const endTime = Date.now()
    
    // Should load quickly
    const loadTime = endTime - startTime
    expect(loadTime).toBeLessThan(3000)
    
    // Should show correct total count
    await dashboardPage.expectMetricValue('total-endpoints-card', '1000')
  })

  test('should handle frequent real-time updates efficiently', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Mock high-frequency updates
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send 100 updates rapidly
            for (let i = 0; i < 100; i++) {
              setTimeout(() => {
                const update = {
                  type: 'metricsUpdate',
                  data: {
                    activeConnections: 40 + i,
                    messagesPerSecond: 10 + Math.random() * 20,
                    timestamp: Date.now()
                  }
                }
                if (this.onmessage) {
                  this.onmessage(new MessageEvent('message', { 
                    data: JSON.stringify(update) 
                  }))
                }
              }, i * 50) // 20 updates/second
            }
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Dashboard should remain responsive
    await page.waitForTimeout(6000)
    await dashboardPage.expectToBeVisible()
    await dashboardPage.refreshDashboard()
    
    // Performance should not degrade
    const refreshStartTime = Date.now()
    await dashboardPage.refreshDashboard()
    const refreshEndTime = Date.now()
    
    expect(refreshEndTime - refreshStartTime).toBeLessThan(1000)
  })
})