import { Page, Route } from '@playwright/test'
import { MOCK_ENDPOINTS, MOCK_TRAFFIC_DATA, MOCK_AUDIT_LOGS, API_ENDPOINTS } from './test-data'

/**
 * Mock API responses for testing without a real backend
 */
export class ApiMocks {
  constructor(private page: Page) {}

  async setupAuthMocks() {
    // Mock successful login
    await this.page.route(`**/api/auth/login`, async (route: Route) => {
      const request = route.request()
      const postData = request.postData()
      
      if (postData) {
        const { email, password } = JSON.parse(postData)
        
        if (email === 'admin@example.com' && password === 'admin123') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              token: 'mock-jwt-token',
              user: {
                id: 'admin-1',
                email: 'admin@example.com',
                name: 'Admin User',
                role: 'admin',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
              },
              expiresIn: 3600
            })
          })
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
              }
            })
          })
        }
      }
    })

    // Mock logout
    await this.page.route(`**/api/auth/logout`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Mock token refresh
    await this.page.route(`**/api/auth/refresh`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'new-mock-jwt-token',
          expiresIn: 3600
        })
      })
    })
  }

  async setupEndpointMocks() {
    // Mock GET /api/endpoints
    await this.page.route(`**/api/endpoints`, async (route: Route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url())
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = parseInt(url.searchParams.get('limit') || '10')
        const search = url.searchParams.get('search')
        
        let filteredEndpoints = [...MOCK_ENDPOINTS]
        
        if (search) {
          filteredEndpoints = filteredEndpoints.filter(endpoint =>
            endpoint.name.toLowerCase().includes(search.toLowerCase()) ||
            endpoint.targetUrl.toLowerCase().includes(search.toLowerCase())
          )
        }
        
        const total = filteredEndpoints.length
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedEndpoints = filteredEndpoints.slice(startIndex, endIndex)
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            endpoints: paginatedEndpoints,
            total,
            page,
            limit,
            hasNext: endIndex < total,
            hasPrev: page > 1
          })
        })
      }
    })

    // Mock POST /api/endpoints
    await this.page.route(`**/api/endpoints`, async (route: Route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postData()
        
        if (postData) {
          const endpointData = JSON.parse(postData)
          const newEndpoint = {
            id: `endpoint-${Date.now()}`,
            ...endpointData,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              endpoint: newEndpoint
            })
          })
        }
      }
    })

    // Mock GET /api/endpoints/:id
    await this.page.route(`**/api/endpoints/*`, async (route: Route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()
        const endpointId = url.split('/').pop()?.split('?')[0]
        const endpoint = MOCK_ENDPOINTS.find(e => e.id === endpointId)
        
        if (endpoint) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ endpoint })
          })
        } else {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { message: 'Endpoint not found', code: 'NOT_FOUND' }
            })
          })
        }
      }
    })

    // Mock PATCH /api/endpoints/:id
    await this.page.route(`**/api/endpoints/*`, async (route: Route) => {
      if (route.request().method() === 'PATCH') {
        const url = route.request().url()
        const endpointId = url.split('/').pop()
        const endpoint = MOCK_ENDPOINTS.find(e => e.id === endpointId)
        
        if (endpoint) {
          const postData = route.request().postData()
          if (postData) {
            const updates = JSON.parse(postData)
            const updatedEndpoint = {
              ...endpoint,
              ...updates,
              updatedAt: new Date()
            }
            
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                endpoint: updatedEndpoint
              })
            })
          }
        } else {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { message: 'Endpoint not found', code: 'NOT_FOUND' }
            })
          })
        }
      }
    })

    // Mock DELETE /api/endpoints/:id
    await this.page.route(`**/api/endpoints/*`, async (route: Route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      }
    })

    // Mock endpoint test connection
    await this.page.route(`**/api/endpoints/test-connection`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          connectionTime: 150,
          status: 'connected'
        })
      })
    })
  }

  async setupTrafficMocks() {
    // Mock GET /api/sessions
    await this.page.route(`**/api/sessions`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRAFFIC_DATA.sessions)
      })
    })

    // Mock traffic metrics
    await this.page.route(`**/api/traffic/metrics`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRAFFIC_DATA.metrics)
      })
    })
  }

  async setupAuditMocks() {
    // Mock GET /api/audit
    await this.page.route(`**/api/audit`, async (route: Route) => {
      const url = new URL(route.request().url())
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      const total = MOCK_AUDIT_LOGS.length
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedLogs = MOCK_AUDIT_LOGS.slice(startIndex, endIndex)
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: paginatedLogs,
          total,
          page,
          limit,
          hasNext: endIndex < total,
          hasPrev: page > 1
        })
      })
    })

    // Mock audit export
    await this.page.route(`**/api/audit/export`, async (route: Route) => {
      const csvContent = [
        'Timestamp,Action,Resource Type,Resource ID,User,IP Address',
        ...MOCK_AUDIT_LOGS.map(log => 
          `${log.timestamp.toISOString()},${log.action},${log.resourceType},${log.resourceId},${log.userEmail},${log.ipAddress}`
        )
      ].join('\n')
      
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename="audit-logs.csv"'
        },
        body: csvContent
      })
    })
  }

  async setupHealthMocks() {
    await this.page.route(`**/api/healthz`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          checks: {
            database: 'healthy',
            redis: 'healthy'
          }
        })
      })
    })
  }

  async setupAllMocks() {
    await this.setupAuthMocks()
    await this.setupEndpointMocks()
    await this.setupTrafficMocks()
    await this.setupAuditMocks()
    await this.setupHealthMocks()
  }

  async setupErrorScenarios() {
    // Mock server errors
    await this.page.route(`**/api/endpoints/error-test`, async (route: Route) => {
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

    // Mock validation errors
    await this.page.route(`**/api/endpoints/validation-error`, async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: {
              name: ['Name is required'],
              targetUrl: ['Invalid URL format']
            }
          }
        })
      })
    })

    // Mock network timeout
    await this.page.route(`**/api/endpoints/timeout-test`, async (route: Route) => {
      // Simulate timeout by delaying response
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Request timeout',
            code: 'TIMEOUT'
          }
        })
      })
    })
  }
}