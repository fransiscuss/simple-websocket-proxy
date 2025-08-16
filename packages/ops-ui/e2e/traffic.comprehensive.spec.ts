import { test, expect } from '@playwright/test'
import { TrafficPage } from './pages/traffic.page'
import { ApiMocks } from './fixtures/api-mocks'
import { MOCK_TRAFFIC_DATA, MOCK_ENDPOINTS } from './fixtures/test-data'

test.describe('Traffic Monitoring - Comprehensive Functionality', () => {
  let trafficPage: TrafficPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    trafficPage = new TrafficPage(page)
    await trafficPage.goto()
  })

  test('should display all traffic metrics and overview cards', async ({ page }) => {
    await trafficPage.expectMetricsCards()
    
    // Check specific metrics from mock data
    await trafficPage.expectMetricValue('total-connections-card', /\d+/)
    await trafficPage.expectMetricValue('active-connections-card', /\d+/)
    await trafficPage.expectMetricValue('messages-per-second-card', /\d+\.?\d*/)
    await trafficPage.expectMetricValue('bytes-per-second-card', /\d+/)
    await trafficPage.expectMetricValue('error-rate-card', /\d+\.?\d*%/)
  })

  test('should display live session grid with session tiles', async ({ page }) => {
    await trafficPage.expectSessionsVisible()
    
    // Should show sessions from mock data
    for (const session of MOCK_TRAFFIC_DATA.sessions) {
      await trafficPage.expectSessionTile(session.id, session.state)
    }
    
    // Should show correct session count
    await trafficPage.expectSessionCount(MOCK_TRAFFIC_DATA.sessions.length)
  })

  test('should open session details modal with comprehensive information', async ({ page }) => {
    const session = MOCK_TRAFFIC_DATA.sessions[0]
    
    await trafficPage.viewSessionDetails(session.id)
    
    await trafficPage.expectSessionDetails(session.id, {
      status: session.state,
      messagesIn: session.msgsIn,
      messagesOut: session.msgsOut
    })
    
    // Check additional details
    await expect(page.getByText(`Bytes In: ${session.bytesIn}`)).toBeVisible()
    await expect(page.getByText(`Bytes Out: ${session.bytesOut}`)).toBeVisible()
    await expect(page.getByText(`Started: ${session.startedAt.toLocaleString()}`)).toBeVisible()
  })

  test('should filter sessions by status', async ({ page }) => {
    // Filter by connected status
    await trafficPage.filterByStatus('connected')
    
    const connectedSessions = MOCK_TRAFFIC_DATA.sessions.filter(s => s.state === 'connected')
    await trafficPage.expectSessionCount(connectedSessions.length)
    
    // Filter by closing status
    await trafficPage.filterByStatus('closing')
    
    const closingSessions = MOCK_TRAFFIC_DATA.sessions.filter(s => s.state === 'closing')
    await trafficPage.expectSessionCount(closingSessions.length)
    
    // Reset filter
    await trafficPage.filterByStatus('all')
    await trafficPage.expectSessionCount(MOCK_TRAFFIC_DATA.sessions.length)
  })

  test('should filter sessions by endpoint', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS[0]
    
    await trafficPage.filterByEndpoint(endpoint.name)
    
    const endpointSessions = MOCK_TRAFFIC_DATA.sessions.filter(s => s.endpointId === endpoint.id)
    await trafficPage.expectSessionCount(endpointSessions.length)
  })

  test('should search sessions by session ID', async ({ page }) => {
    const searchTerm = MOCK_TRAFFIC_DATA.sessions[0].id.substring(0, 8)
    
    await trafficPage.searchSessions(searchTerm)
    
    const matchingSessions = MOCK_TRAFFIC_DATA.sessions.filter(s => 
      s.id.includes(searchTerm)
    )
    await trafficPage.expectSessionCount(matchingSessions.length)
  })

  test('should combine multiple filters correctly', async ({ page }) => {
    const endpoint = MOCK_ENDPOINTS[0]
    
    await trafficPage.expectFilterResults({
      status: 'connected',
      endpoint: endpoint.name
    }, 1) // Should show only connected sessions for this endpoint
  })

  test('should clear all filters and show all sessions', async ({ page }) => {
    // Apply some filters
    await trafficPage.filterByStatus('connected')
    await trafficPage.searchSessions('test')
    
    // Clear filters
    await trafficPage.clearFilters()
    
    // Should show all sessions again
    await trafficPage.expectSessionCount(MOCK_TRAFFIC_DATA.sessions.length)
  })

  test('should refresh data and update metrics', async ({ page }) => {
    // Mock updated metrics
    await page.route('**/api/traffic/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalConnections: 200,
          activeConnections: 75,
          messagesPerSecond: 25.0,
          bytesPerSecond: 5120,
          errorRate: 0.01
        })
      })
    })
    
    await trafficPage.refreshData()
    
    // Should show updated values
    await trafficPage.expectMetricValue('active-connections-card', '75')
    await trafficPage.expectMetricValue('messages-per-second-card', '25.0')
  })

  test('should toggle auto-refresh functionality', async ({ page }) => {
    // Should be enabled by default
    await trafficPage.expectAutoRefreshEnabled()
    
    // Disable auto-refresh
    await trafficPage.toggleAutoRefresh()
    await trafficPage.expectAutoRefreshDisabled()
    
    // Enable auto-refresh
    await trafficPage.toggleAutoRefresh()
    await trafficPage.expectAutoRefreshEnabled()
  })

  test('should display traffic charts with data visualization', async ({ page }) => {
    await trafficPage.expectCharts()
    
    // Charts should have data points
    await trafficPage.expectChartData()
    
    // Should be able to interact with charts
    await trafficPage.hoverOverChart()
  })

  test('should show traffic flow visualization', async ({ page }) => {
    await trafficPage.expectFlowVisualization()
    
    // Should show endpoint connections
    for (const endpoint of MOCK_ENDPOINTS) {
      await expect(page.getByText(endpoint.name)).toBeVisible()
    }
  })

  test('should handle time range selection for charts', async ({ page }) => {
    await trafficPage.expectTimeFilters()
    
    // Change time range
    await trafficPage.setTimeRange('1h')
    await page.waitForTimeout(500)
    
    // Charts should update
    await trafficPage.expectCharts()
    
    // Try different ranges
    await trafficPage.setTimeRange('24h')
    await trafficPage.setTimeRange('7d')
  })

  test('should export traffic data', async ({ page }) => {
    // Mock successful export
    await page.route('**/api/traffic/export', async (route) => {
      const csvData = [
        'Session ID,Endpoint,Status,Messages In,Messages Out,Bytes In,Bytes Out,Started At',
        ...MOCK_TRAFFIC_DATA.sessions.map(s => 
          `${s.id},${s.endpointId},${s.state},${s.msgsIn},${s.msgsOut},${s.bytesIn},${s.bytesOut},${s.startedAt.toISOString()}`
        )
      ].join('\n')
      
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename="traffic-data.csv"'
        },
        body: csvData
      })
    })
    
    await trafficPage.exportData()
    
    // Should trigger download (handled by browser)
  })

  test('should kill active sessions', async ({ page }) => {
    const session = MOCK_TRAFFIC_DATA.sessions.find(s => s.state === 'connected')
    if (!session) return
    
    // Mock kill session endpoint
    await page.route(`**/api/sessions/${session.id}/kill`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await trafficPage.killSession(session.id)
    
    // Should show success message
    await trafficPage.expectSuccessToast('Session terminated successfully')
  })

  test('should handle real-time session updates via WebSocket', async ({ page }) => {
    // Mock WebSocket with session updates
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Simulate session updates
            setTimeout(() => {
              const sessionUpdate = {
                type: 'sessionUpdated',
                data: {
                  id: 'session-1',
                  msgsIn: 30,
                  msgsOut: 25,
                  bytesIn: 6144n,
                  bytesOut: 5120n,
                  lastSeen: new Date().toISOString()
                }
              }
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(sessionUpdate) 
                }))
              }
            }, 500)
            
            setTimeout(() => {
              const newSession = {
                type: 'sessionStarted',
                data: {
                  id: 'session-new',
                  endpointId: 'endpoint-1',
                  startedAt: new Date().toISOString(),
                  state: 'connected'
                }
              }
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(newSession) 
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
    
    // Should show WebSocket connection
    await trafficPage.expectWebSocketConnection()
    
    // Should receive real-time updates
    await expect(page.getByText('session-new')).toBeVisible({ timeout: 2000 })
  })

  test('should show empty state when no sessions exist', async ({ page }) => {
    // Mock empty sessions response
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })
    
    await page.reload()
    
    await trafficPage.expectEmptyState()
    await expect(page.getByText(/no active sessions/i)).toBeVisible()
  })

  test('should handle session pagination for large datasets', async ({ page }) => {
    // Mock large session dataset
    const largeSessions = Array.from({ length: 50 }, (_, i) => ({
      id: `session-${i + 1}`,
      endpointId: 'endpoint-1',
      startedAt: new Date(Date.now() - i * 60000),
      lastSeen: new Date(),
      msgsIn: Math.floor(Math.random() * 100),
      msgsOut: Math.floor(Math.random() * 100),
      bytesIn: BigInt(Math.floor(Math.random() * 10000)),
      bytesOut: BigInt(Math.floor(Math.random() * 10000)),
      state: i % 3 === 0 ? 'closing' : 'connected'
    }))
    
    await page.route('**/api/sessions', async (route) => {
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedSessions = largeSessions.slice(startIndex, endIndex)
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: paginatedSessions,
          total: largeSessions.length,
          page,
          limit,
          hasNext: endIndex < largeSessions.length,
          hasPrev: page > 1
        })
      })
    })
    
    await page.reload()
    
    // Should show pagination controls
    const paginationControls = page.locator('[data-testid="pagination"]')
    await expect(paginationControls).toBeVisible()
    
    // Should show first 20 sessions
    await trafficPage.expectSessionCount(20)
  })
})

test.describe('Traffic Monitoring - Error Handling', () => {
  test('should handle API errors when loading sessions', async ({ page }) => {
    // Mock API error
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
        })
      })
    })
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    await trafficPage.expectErrorState()
  })

  test('should handle WebSocket connection failures', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock WebSocket failure
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'))
            this.readyState = WebSocket.CLOSED
            if (this.onclose) this.onclose(new CloseEvent('close'))
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    await trafficPage.expectWebSocketDisconnected()
  })

  test('should handle session kill failures', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock kill session failure
    await page.route('**/api/sessions/*/kill', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Insufficient permissions', code: 'FORBIDDEN' }
        })
      })
    })
    
    const session = MOCK_TRAFFIC_DATA.sessions[0]
    await trafficPage.killSession(session.id)
    
    // Should show error message
    await expect(page.getByText(/insufficient permissions|failed to kill/i)).toBeVisible()
  })

  test('should handle metrics loading timeout', async ({ page }) => {
    // Mock slow metrics response
    await page.route('**/api/traffic/metrics', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.continue()
    })
    
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Should show timeout error
    await expect(page.getByText(/timeout|taking too long/i)).toBeVisible({ timeout: 40000 })
  })
})

test.describe('Traffic Monitoring - Performance', () => {
  test('should handle large numbers of sessions efficiently', async ({ page }) => {
    // Mock 1000 sessions
    const massiveSessions = Array.from({ length: 1000 }, (_, i) => ({
      id: `session-${i + 1}`,
      endpointId: `endpoint-${(i % 10) + 1}`,
      startedAt: new Date(Date.now() - i * 1000),
      lastSeen: new Date(),
      msgsIn: Math.floor(Math.random() * 1000),
      msgsOut: Math.floor(Math.random() * 1000),
      bytesIn: BigInt(Math.floor(Math.random() * 100000)),
      bytesOut: BigInt(Math.floor(Math.random() * 100000)),
      state: ['connected', 'closing', 'closed'][i % 3] as any
    }))
    
    await page.route('**/api/sessions', async (route) => {
      const url = new URL(route.request().url())
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: massiveSessions.slice(0, limit),
          total: massiveSessions.length,
          page: 1,
          limit,
          hasNext: true,
          hasPrev: false
        })
      })
    })
    
    const trafficPage = new TrafficPage(page)
    const startTime = Date.now()
    await trafficPage.goto()
    const endTime = Date.now()
    
    // Should load quickly even with large dataset
    const loadTime = endTime - startTime
    expect(loadTime).toBeLessThan(5000)
    
    // Should remain responsive
    await trafficPage.searchSessions('session-1')
    await trafficPage.filterByStatus('connected')
  })

  test('should efficiently handle high-frequency WebSocket updates', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock rapid WebSocket updates
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send 100 rapid updates
            for (let i = 0; i < 100; i++) {
              setTimeout(() => {
                const update = {
                  type: 'sessionUpdated',
                  data: {
                    id: `session-${(i % 10) + 1}`,
                    msgsIn: i,
                    msgsOut: i - 1,
                    timestamp: Date.now()
                  }
                }
                if (this.onmessage) {
                  this.onmessage(new MessageEvent('message', { 
                    data: JSON.stringify(update) 
                  }))
                }
              }, i * 10) // 100 updates/second
            }
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // UI should remain responsive
    await page.waitForTimeout(2000)
    await trafficPage.expectToBeVisible()
    
    // Should be able to interact with UI during updates
    await trafficPage.searchSessions('session')
    await trafficPage.clearFilters()
  })
})