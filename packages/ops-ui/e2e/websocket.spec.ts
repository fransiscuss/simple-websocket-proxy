import { test, expect } from '@playwright/test'
import { TrafficPage } from './pages/traffic.page'
import { DashboardPage } from './pages/dashboard.page'
import { ApiMocks } from './fixtures/api-mocks'

test.describe('WebSocket Live Functionality', () => {
  let trafficPage: TrafficPage
  let dashboardPage: DashboardPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    trafficPage = new TrafficPage(page)
    dashboardPage = new DashboardPage(page)
  })

  test('should establish WebSocket connection for live traffic monitoring', async ({ page }) => {
    await trafficPage.goto()
    
    // Mock WebSocket connection
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.url = url
          this.readyState = WebSocket.CONNECTING
          setTimeout(() => {
            this.readyState = WebSocket.OPEN
            if (this.onopen) this.onopen(new Event('open'))
          }, 100)
        }
        
        send(data: string) {
          // Mock sending data
        }
        
        close() {
          this.readyState = WebSocket.CLOSED
          if (this.onclose) this.onclose(new CloseEvent('close'))
        }
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should show connected status
    await trafficPage.expectWebSocketConnection()
    
    // Should display real-time metrics
    await trafficPage.expectMetricsCards()
  })

  test('should handle WebSocket connection failures gracefully', async ({ page }) => {
    await trafficPage.goto()
    
    // Mock WebSocket failure
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED
            if (this.onerror) this.onerror(new Event('error'))
            if (this.onclose) this.onclose(new CloseEvent('close'))
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should show disconnected status
    await trafficPage.expectWebSocketDisconnected()
    
    // Should show fallback state
    await expect(page.getByText(/connection lost|disconnected/i)).toBeVisible()
  })

  test('should auto-reconnect on WebSocket disconnection', async ({ page }) => {
    await trafficPage.goto()
    
    let connectionAttempts = 0
    await page.addInitScript(() => {
      let attempts = 0
      class MockWebSocket {
        constructor(url: string) {
          attempts++
          window.connectionAttempts = attempts
          
          if (attempts === 1) {
            // First connection succeeds then disconnects
            setTimeout(() => {
              this.readyState = WebSocket.OPEN
              if (this.onopen) this.onopen(new Event('open'))
            }, 100)
            
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED
              if (this.onclose) this.onclose(new CloseEvent('close'))
            }, 2000)
          } else {
            // Reconnection succeeds
            setTimeout(() => {
              this.readyState = WebSocket.OPEN
              if (this.onopen) this.onopen(new Event('open'))
            }, 100)
          }
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Initial connection
    await trafficPage.expectWebSocketConnection()
    
    // Should attempt reconnection after disconnection
    await page.waitForTimeout(3000)
    
    const attempts = await page.evaluate(() => window.connectionAttempts)
    expect(attempts).toBeGreaterThan(1)
  })

  test('should receive and display real-time session updates', async ({ page }) => {
    await trafficPage.goto()
    
    // Mock WebSocket with real-time data
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Simulate real-time session updates
            setTimeout(() => {
              const sessionUpdate = {
                type: 'sessionStarted',
                data: {
                  id: 'session-realtime-1',
                  endpointId: 'endpoint-1',
                  startedAt: new Date().toISOString(),
                  state: 'connected'
                }
              }
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(sessionUpdate) 
                }))
              }
            }, 500)
            
            setTimeout(() => {
              const metricsUpdate = {
                type: 'metricsUpdate',
                data: {
                  activeConnections: 47,
                  messagesPerSecond: 15.2,
                  bytesPerSecond: 3072
                }
              }
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { 
                  data: JSON.stringify(metricsUpdate) 
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
    
    // Should show new session
    await expect(page.getByText('session-realtime-1')).toBeVisible({ timeout: 2000 })
    
    // Should update metrics in real-time
    await trafficPage.expectMetricValue('active-connections-card', '47')
  })

  test('should handle message rate limiting and backpressure', async ({ page }) => {
    await trafficPage.goto()
    
    // Mock high-frequency WebSocket messages
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send rapid updates to test throttling
            for (let i = 0; i < 100; i++) {
              setTimeout(() => {
                const update = {
                  type: 'metricsUpdate',
                  data: {
                    activeConnections: 40 + i,
                    timestamp: Date.now()
                  }
                }
                if (this.onmessage) {
                  this.onmessage(new MessageEvent('message', { 
                    data: JSON.stringify(update) 
                  }))
                }
              }, i * 10) // 10ms intervals = 100 msgs/sec
            }
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // UI should remain responsive despite high message rate
    await trafficPage.expectToBeVisible()
    await trafficPage.refreshData()
    
    // Should throttle updates to maintain performance
    await page.waitForTimeout(2000)
    await trafficPage.expectMetricsCards()
  })

  test('should send control commands via WebSocket', async ({ page }) => {
    await trafficPage.goto()
    
    let sentMessages: string[] = []
    await page.addInitScript(() => {
      const messages: string[] = []
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
          }, 100)
        }
        
        send(data: string) {
          messages.push(data)
          window.sentWebSocketMessages = messages
        }
        
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // View session details to enable kill button
    await trafficPage.viewSessionDetails('session-1')
    
    // Kill a session
    await trafficPage.killSession('session-1')
    
    // Should send kill command via WebSocket
    sentMessages = await page.evaluate(() => window.sentWebSocketMessages || [])
    expect(sentMessages.some(msg => 
      msg.includes('session.kill') && msg.includes('session-1')
    )).toBe(true)
  })
})

test.describe('WebSocket Dashboard Integration', () => {
  test('should show live metrics on dashboard', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Mock WebSocket connection for dashboard
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send dashboard metrics update
            setTimeout(() => {
              const update = {
                type: 'dashboardMetrics',
                data: {
                  totalEndpoints: 15,
                  activeConnections: 52,
                  messagesPerSecond: 18.7,
                  errorRate: 0.015
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
    
    // Should update dashboard metrics
    await dashboardPage.expectMetricValue('total-endpoints-card', '15')
    await dashboardPage.expectMetricValue('active-connections-card', '52')
  })

  test('should handle WebSocket errors on dashboard', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Mock WebSocket error
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'))
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should show offline indicator or fallback to polling
    await expect(page.getByText(/offline|polling mode/i)).toBeVisible()
  })
})

test.describe('WebSocket Security and Validation', () => {
  test('should validate WebSocket message format', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock invalid WebSocket messages
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          this.readyState = WebSocket.OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'))
            
            // Send invalid messages
            const invalidMessages = [
              'invalid json',
              '{"type": "unknown"}',
              '{"data": "missing type"}',
              null,
              undefined
            ]
            
            invalidMessages.forEach((msg, i) => {
              setTimeout(() => {
                if (this.onmessage) {
                  this.onmessage(new MessageEvent('message', { 
                    data: typeof msg === 'string' ? msg : JSON.stringify(msg)
                  }))
                }
              }, (i + 1) * 100)
            })
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should handle invalid messages gracefully
    await page.waitForTimeout(1000)
    await trafficPage.expectToBeVisible()
    
    // Should not crash or show error messages
    await expect(page.getByText(/websocket error|message error/i)).not.toBeVisible()
  })

  test('should handle WebSocket connection limits', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock connection limit reached
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED
            const closeEvent = new CloseEvent('close', { 
              code: 1013, // Try again later
              reason: 'Connection limit reached'
            })
            if (this.onclose) this.onclose(closeEvent)
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should show appropriate error message
    await expect(page.getByText(/connection limit|try again later/i)).toBeVisible()
  })

  test('should handle authentication errors on WebSocket', async ({ page }) => {
    const trafficPage = new TrafficPage(page)
    await trafficPage.goto()
    
    // Mock authentication error
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED
            const closeEvent = new CloseEvent('close', { 
              code: 1008, // Policy violation (auth error)
              reason: 'Authentication failed'
            })
            if (this.onclose) this.onclose(closeEvent)
          }, 100)
        }
        
        send() {}
        close() {}
      }
      
      window.WebSocket = MockWebSocket as any
    })
    
    // Should redirect to login or show auth error
    await expect(page.getByText(/authentication|please login/i)).toBeVisible()
  })
})