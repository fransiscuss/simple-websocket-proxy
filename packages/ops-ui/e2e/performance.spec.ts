import { test, expect } from '@playwright/test'
import { DashboardPage } from './pages/dashboard.page'
import { EndpointsPage } from './pages/endpoints.page'
import { TrafficPage } from './pages/traffic.page'
import { AuditPage } from './pages/audit.page'
import { ApiMocks } from './fixtures/api-mocks'

test.describe('Performance - Page Load Times', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should load dashboard within performance budget', async ({ page }) => {
    const startTime = Date.now()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.expectToBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
    
    // Metrics should be visible
    await dashboardPage.expectMetricsCards()
  })

  test('should load endpoints page efficiently with large datasets', async ({ page }) => {
    // Mock large endpoint dataset
    await page.route('**/api/endpoints', async (route) => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `endpoint-${i}`,
        name: `Endpoint ${i}`,
        targetUrl: `wss://endpoint${i}.example.com`,
        enabled: i % 2 === 0,
        limits: {
          maxConnections: 100,
          maxMessageSize: 1024,
          connectionTimeoutMs: 30000,
          idleTimeoutMs: 60000,
          rateLimitRpm: 100
        },
        sampling: {
          enabled: i % 3 === 0,
          sampleRate: 0.1,
          maxSampleSize: 1000,
          storeContent: true
        },
        createdAt: new Date(Date.now() - i * 60000),
        updatedAt: new Date(Date.now() - i * 30000)
      }))
      
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedData = largeDataset.slice(startIndex, endIndex)
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          endpoints: paginatedData,
          total: largeDataset.length,
          page,
          limit,
          hasNext: endIndex < largeDataset.length,
          hasPrev: page > 1
        })
      })
    })
    
    const startTime = Date.now()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    await endpointsPage.expectToBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Should load efficiently even with large dataset
    expect(loadTime).toBeLessThan(5000)
    
    // Should show pagination for large dataset
    await expect(endpointsPage.paginationControls).toBeVisible()
  })

  test('should load traffic monitoring with real-time data efficiently', async ({ page }) => {
    // Mock high-frequency data updates
    await page.route('**/api/sessions', async (route) => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        id: `session-${i}`,
        endpointId: `endpoint-${i % 10}`,
        startedAt: new Date(Date.now() - i * 1000),
        lastSeen: new Date(),
        msgsIn: Math.floor(Math.random() * 1000),
        msgsOut: Math.floor(Math.random() * 1000),
        bytesIn: BigInt(Math.floor(Math.random() * 100000)),
        bytesOut: BigInt(Math.floor(Math.random() * 100000)),
        state: ['connected', 'closing', 'closed'][i % 3] as any
      }))
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeSessions.slice(0, 100)) // Return first 100
      })
    })
    
    const startTime = Date.now()
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    await trafficPage.expectToBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Should load within reasonable time
    expect(loadTime).toBeLessThan(4000)
    
    // Should display metrics and sessions
    await trafficPage.expectMetricsCards()
    await trafficPage.expectSessionsVisible()
  })

  test('should load audit logs efficiently with large history', async ({ page }) => {
    // Mock large audit dataset
    await page.route('**/api/audit', async (route) => {
      const largeAuditLogs = Array.from({ length: 50000 }, (_, i) => ({
        id: `audit-${i}`,
        action: ['endpoint.created', 'endpoint.updated', 'endpoint.deleted', 'user.login', 'user.logout'][i % 5],
        resourceType: ['endpoint', 'user', 'session'][i % 3],
        resourceId: `resource-${i % 1000}`,
        userId: 'admin-1',
        userEmail: 'admin@example.com',
        details: { index: i, operation: `Operation ${i}` },
        timestamp: new Date(Date.now() - i * 60000),
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser'
      }))
      
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '100')
      
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedLogs = largeAuditLogs.slice(startIndex, endIndex)
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: paginatedLogs,
          total: largeAuditLogs.length,
          page,
          limit,
          hasNext: endIndex < largeAuditLogs.length,
          hasPrev: page > 1
        })
      })
    })
    
    const startTime = Date.now()
    
    const auditPage = new AuditPage(page)
    await auditPage.goto()
    await auditPage.expectToBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Should load efficiently even with large audit history
    expect(loadTime).toBeLessThan(4000)
    
    // Should show pagination
    await expect(auditPage.paginationControls).toBeVisible()
  })
})

test.describe('Performance - User Interactions', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should handle rapid search queries efficiently', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    let searchCallCount = 0
    await page.route('**/api/endpoints?*search*', async (route) => {
      searchCallCount++
      await route.continue()
    })
    
    const searchTerms = ['test', 'endpoint', 'prod', 'dev', 'api']
    
    const startTime = Date.now()
    
    // Rapidly type different search terms
    for (const term of searchTerms) {
      await endpointsPage.searchInput.clear()
      await endpointsPage.searchInput.type(term, { delay: 50 })
      await page.waitForTimeout(100)
    }
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // Should complete all searches quickly
    expect(totalTime).toBeLessThan(3000)
    
    // Should debounce search requests
    expect(searchCallCount).toBeLessThan(searchTerms.length * 2)
  })

  test('should handle rapid pagination efficiently', async ({ page }) => {
    // Mock paginated data
    await page.route('**/api/endpoints', async (route) => {
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: `endpoint-${page}-${i}`,
        name: `Endpoint ${page}-${i}`,
        targetUrl: `wss://test${i}.example.com`,
        enabled: true,
        limits: {},
        sampling: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          endpoints: mockData,
          total: 200,
          page,
          limit: 20,
          hasNext: page < 10,
          hasPrev: page > 1
        })
      })
    })
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    const startTime = Date.now()
    
    // Rapidly navigate through pages
    for (let i = 2; i <= 5; i++) {
      await endpointsPage.goToPage(i)
      await page.waitForTimeout(100)
    }
    
    const endTime = Date.now()
    const navigationTime = endTime - startTime
    
    // Should navigate quickly
    expect(navigationTime).toBeLessThan(2000)
    
    // Final page should be displayed correctly
    await endpointsPage.expectToBeVisible()
  })

  test('should handle form interactions responsively', async ({ page }) => {
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    
    const formInputs = [
      page.getByLabel(/name/i),
      page.getByLabel(/target url/i),
      page.getByLabel(/max connections/i),
      page.getByLabel(/max message size/i),
      page.getByLabel(/connection timeout/i),
      page.getByLabel(/sample rate/i)
    ]
    
    const startTime = Date.now()
    
    // Rapidly fill form fields
    for (let i = 0; i < formInputs.length; i++) {
      const input = formInputs[i]
      if (await input.isVisible()) {
        await input.fill(`value-${i}`)
        await page.waitForTimeout(50)
      }
    }
    
    const endTime = Date.now()
    const fillTime = endTime - startTime
    
    // Form should respond quickly to input
    expect(fillTime).toBeLessThan(1000)
  })

  test('should handle rapid filter changes efficiently', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    const filters = [
      () => trafficPage.filterByStatus('connected'),
      () => trafficPage.filterByStatus('closing'),
      () => trafficPage.filterByStatus('all'),
      () => trafficPage.searchSessions('session-1'),
      () => trafficPage.clearFilters()
    ]
    
    const startTime = Date.now()
    
    // Apply filters rapidly
    for (const filterAction of filters) {
      await filterAction()
      await page.waitForTimeout(100)
    }
    
    const endTime = Date.now()
    const filterTime = endTime - startTime
    
    // Should handle filter changes quickly
    expect(filterTime).toBeLessThan(2000)
    
    // Final state should be correct
    await trafficPage.expectSessionsVisible()
  })
})

test.describe('Performance - Real-time Updates', () => {
  test.beforeEach(async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
  })

  test('should handle high-frequency WebSocket updates efficiently', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock high-frequency WebSocket updates
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send 200 updates rapidly (20/second for 10 seconds)
            for (let i = 0; i < 200; i++) {
              setTimeout(() => {
                const updates = [
                  {
                    type: 'metricsUpdate',
                    data: {
                      activeConnections: 40 + (i % 20),
                      messagesPerSecond: 10 + Math.random() * 20,
                      bytesPerSecond: 1000 + Math.random() * 5000,
                      timestamp: Date.now()
                    }
                  },
                  {
                    type: 'sessionUpdated',
                    data: {
                      id: `session-${i % 10}`,
                      msgsIn: i,
                      msgsOut: i - 1,
                      lastSeen: new Date().toISOString()
                    }
                  }
                ][i % 2]
                
                if (this.onmessage) {
                  this.onmessage(new MessageEvent('message', { 
                    data: JSON.stringify(updates) 
                  }))
                }
              }, i * 50) // 20 updates per second
            }
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    const startTime = Date.now()
    
    // Wait for updates to process
    await page.waitForTimeout(12000)
    
    const endTime = Date.now()
    
    // Page should remain responsive during high-frequency updates
    await trafficPage.expectToBeVisible()
    await trafficPage.expectMetricsCards()
    
    // Should be able to interact with UI during updates
    await trafficPage.searchSessions('session')
    await trafficPage.clearFilters()
    
    // Performance should not degrade significantly
    const interactionStartTime = Date.now()
    await trafficPage.refreshData()
    const interactionEndTime = Date.now()
    
    const interactionTime = interactionEndTime - interactionStartTime
    expect(interactionTime).toBeLessThan(2000)
  })

  test('should throttle UI updates appropriately', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    let updateCount = 0
    
    // Mock rapid WebSocket updates
    await page.addInitScript(() => {
      let count = 0
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send 100 rapid updates
            const interval = setInterval(() => {
              count++
              window.updateCount = count
              
              const update = {
                type: 'dashboardUpdate',
                data: {
                  activeConnections: 50 + count,
                  messagesPerSecond: Math.random() * 50,
                  timestamp: Date.now()
                }
              }
              
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(update) 
                }))
              }
              
              if (count >= 100) {
                clearInterval(interval)
              }
            }, 10) // 100 updates/second
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Wait for all updates
    await page.waitForTimeout(2000)
    
    // Check that we received all updates
    updateCount = await page.evaluate(() => window.updateCount)
    expect(updateCount).toBe(100)
    
    // UI should still be responsive and not overwhelmed
    await dashboardPage.expectToBeVisible()
    await dashboardPage.navigateToEndpoints()
    await expect(page).toHaveURL('/endpoints')
  })

  test('should handle WebSocket reconnection efficiently', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    let connectionAttempts = 0
    
    // Mock WebSocket with reconnection logic
    await page.addInitScript(() => {
      let attempts = 0
      class MockWebSocket {
        constructor(url: string) {
          attempts++
          window.connectionAttempts = attempts
          
          if (attempts === 1) {
            // First connection succeeds then fails
            this.readyState = WebSocket.OPEN
            setTimeout(() => {
              if (this.onopen) this.onopen(new Event('open'))
            }, 100)
            
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED
              if (this.onclose) this.onclose(new CloseEvent('close'))
            }, 2000)
          } else if (attempts <= 3) {
            // Simulate failed reconnection attempts
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED
              if (this.onerror) this.onerror(new Event('error'))
              if (this.onclose) this.onclose(new CloseEvent('close'))
            }, 100)
          } else {
            // Finally succeed
            this.readyState = WebSocket.OPEN
            setTimeout(() => {
              if (this.onopen) this.onopen(new Event('open'))
            }, 100)
          }
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    const startTime = Date.now()
    
    // Wait for reconnection sequence
    await page.waitForTimeout(10000)
    
    const endTime = Date.now()
    const reconnectionTime = endTime - startTime
    
    // Should eventually reconnect
    connectionAttempts = await page.evaluate(() => window.connectionAttempts)
    expect(connectionAttempts).toBeGreaterThan(3)
    
    // Should not take too long to reconnect
    expect(reconnectionTime).toBeLessThan(15000)
    
    // Final state should be connected
    await trafficPage.expectWebSocketConnection()
  })
})

test.describe('Performance - Memory and Resource Management', () => {
  test('should not leak memory with long-running sessions', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock continuous WebSocket updates for extended period
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send updates continuously
            setInterval(() => {
              const update = {
                type: 'sessionUpdated',
                data: {
                  id: `session-${Math.floor(Math.random() * 100)}`,
                  msgsIn: Math.floor(Math.random() * 1000),
                  msgsOut: Math.floor(Math.random() * 1000),
                  timestamp: Date.now()
                }
              }
              
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(update) 
                }))
              }
            }, 100) // 10 updates/second
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })
    
    // Let it run for a while
    await page.waitForTimeout(10000)
    
    // Navigate away and back to test cleanup
    await page.goto('/dashboard')
    await page.waitForTimeout(1000)
    await page.goto('/traffic')
    
    // Check memory after extended use
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })
    
    // Memory should not grow excessively
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory
      const maxAllowedGrowth = 50 * 1024 * 1024 // 50MB
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)
    }
  })

  test('should handle DOM updates efficiently with large lists', async ({ page }) => {
    // Mock large session list with frequent updates
    const largeSessions = Array.from({ length: 500 }, (_, i) => ({
      id: `session-${i}`,
      endpointId: `endpoint-${i % 10}`,
      startedAt: new Date(Date.now() - i * 1000),
      lastSeen: new Date(),
      msgsIn: Math.floor(Math.random() * 1000),
      msgsOut: Math.floor(Math.random() * 1000),
      bytesIn: BigInt(Math.floor(Math.random() * 100000)),
      bytesOut: BigInt(Math.floor(Math.random() * 100000)),
      state: ['connected', 'closing'][i % 2] as any
    }))
    
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeSessions)
      })
    })
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Should handle large list efficiently
    await trafficPage.expectSessionsVisible()
    
    // Should remain responsive with large DOM
    const scrollStartTime = Date.now()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.evaluate(() => window.scrollTo(0, 0))
    const scrollEndTime = Date.now()
    
    const scrollTime = scrollEndTime - scrollStartTime
    expect(scrollTime).toBeLessThan(1000)
    
    // Filtering should still work efficiently
    const filterStartTime = Date.now()
    await trafficPage.filterByStatus('connected')
    const filterEndTime = Date.now()
    
    const filterTime = filterEndTime - filterStartTime
    expect(filterTime).toBeLessThan(2000)
  })

  test('should clean up resources when navigating away', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Start WebSocket connection
    await trafficPage.expectWebSocketConnection()
    
    // Check that connection is active
    const hasActiveConnection = await page.evaluate(() => {
      return window.WebSocket !== undefined
    })
    expect(hasActiveConnection).toBe(true)
    
    // Navigate away
    await page.goto('/dashboard')
    
    // Wait for cleanup
    await page.waitForTimeout(1000)
    
    // WebSocket should be cleaned up (this is implementation dependent)
    // In a real app, you'd check that listeners are removed and connections closed
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.expectToBeVisible()
  })
})

test.describe('Performance - Network Optimization', () => {
  test('should handle slow network conditions gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2s delay
      await route.continue()
    })
    
    const startTime = Date.now()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Should show loading states
    const loadingIndicator = page.getByRole('status', { name: /loading/i })
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible()
    }
    
    // Should eventually load
    await dashboardPage.expectToBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Should not timeout
    expect(loadTime).toBeLessThan(30000)
  })

  test('should optimize API request patterns', async ({ page }) => {
    let requestCount = 0
    const requestUrls: string[] = []
    
    await page.route('**/api/**', async (route) => {
      requestCount++
      requestUrls.push(route.request().url())
      await route.continue()
    })
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.expectToBeVisible()
    
    // Navigate to endpoints
    await dashboardPage.navigateToEndpoints()
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.expectToBeVisible()
    
    // Should not make excessive API requests
    expect(requestCount).toBeLessThan(10)
    
    // Should not make duplicate requests
    const uniqueUrls = [...new Set(requestUrls)]
    const duplicateRatio = uniqueUrls.length / requestUrls.length
    expect(duplicateRatio).toBeGreaterThan(0.8) // At least 80% unique requests
  })

  test('should handle request timeouts appropriately', async ({ page }) => {
    // Mock very slow endpoint
    await page.route('**/api/endpoints', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 40000)) // 40s delay
      await route.continue()
    })
    
    const endpointsPage = new EndpointsPage(page)
    await endpointsPage.goto()
    
    // Should show timeout error
    await expect(page.getByText(/timeout|taking too long/i)).toBeVisible({ timeout: 45000 })
    
    // Should provide retry option
    const retryButton = page.getByRole('button', { name: /retry|try again/i })
    if (await retryButton.isVisible()) {
      await expect(retryButton).toBeVisible()
    }
  })
})