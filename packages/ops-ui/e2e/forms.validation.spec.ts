import { test, expect } from '@playwright/test'
import { EndpointFormPage } from './pages/endpoint-form.page'
import { EndpointsPage } from './pages/endpoints.page'
import { ApiMocks } from './fixtures/api-mocks'
import { INVALID_ENDPOINT_DATA, VALID_ENDPOINT_DATA } from './fixtures/test-data'

test.describe('Endpoint Form - Comprehensive Validation', () => {
  let formPage: EndpointFormPage
  let endpointsPage: EndpointsPage
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    formPage = new EndpointFormPage(page)
    endpointsPage = new EndpointsPage(page)
    
    // Navigate to create form
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    await formPage.expectCreateForm()
  })

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await formPage.submitForm()
    
    // Should show validation errors
    await formPage.expectValidationError('name', 'Name is required')
    await formPage.expectValidationError('targetUrl', 'Target URL is required')
  })

  test('should validate endpoint name constraints', async ({ page }) => {
    // Test empty name
    await formPage.fillBasicInfo({ name: '', targetUrl: 'wss://test.example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Name is required')
    
    // Test name too short
    await formPage.fillBasicInfo({ name: 'ab', targetUrl: 'wss://test.example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Name must be at least 3 characters')
    
    // Test name too long
    const longName = 'a'.repeat(101)
    await formPage.fillBasicInfo({ name: longName, targetUrl: 'wss://test.example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Name must be less than 100 characters')
    
    // Test invalid characters
    await formPage.fillBasicInfo({ name: 'Test<>Name', targetUrl: 'wss://test.example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Name contains invalid characters')
    
    // Test duplicate name
    await page.route('**/api/endpoints', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                name: ['Endpoint name already exists']
              }
            }
          })
        })
      }
    })
    
    await formPage.fillBasicInfo({ name: 'Existing Endpoint', targetUrl: 'wss://test.example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Endpoint name already exists')
  })

  test('should validate target URL constraints', async ({ page }) => {
    // Test empty URL
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: '' })
    await formPage.submitForm()
    await formPage.expectValidationError('targetUrl', 'Target URL is required')
    
    // Test invalid URL format
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'not-a-url' })
    await formPage.submitForm()
    await formPage.expectValidationError('targetUrl', 'Please enter a valid URL')
    
    // Test wrong protocol
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'http://example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('targetUrl', 'URL must use ws:// or wss:// protocol')
    
    // Test missing host
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://' })
    await formPage.submitForm()
    await formPage.expectValidationError('targetUrl', 'URL must include a valid hostname')
    
    // Test URL too long
    const longUrl = 'wss://' + 'a'.repeat(2000) + '.example.com'
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: longUrl })
    await formPage.submitForm()
    await formPage.expectValidationError('targetUrl', 'URL is too long')
    
    // Test invalid characters in URL
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://test<>.example.com' })
    await formPage.submitForm()
    await formPage.expectValidationError('targetUrl', 'URL contains invalid characters')
  })

  test('should validate connection limits', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://test.example.com' })
    
    // Test negative max connections
    await formPage.fillLimits({ maxConnections: -1 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxConnections', 'Must be a positive number')
    
    // Test zero max connections
    await formPage.fillLimits({ maxConnections: 0 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxConnections', 'Must be at least 1')
    
    // Test max connections too high
    await formPage.fillLimits({ maxConnections: 100000 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxConnections', 'Cannot exceed 10,000 connections')
    
    // Test negative message size
    await formPage.fillLimits({ maxMessageSize: -1 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxMessageSize', 'Must be a positive number')
    
    // Test message size too large
    await formPage.fillLimits({ maxMessageSize: 100000000 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxMessageSize', 'Cannot exceed 64MB')
    
    // Test negative timeout
    await formPage.fillLimits({ connectionTimeoutMs: -1 })
    await formPage.submitForm()
    await formPage.expectValidationError('connectionTimeoutMs', 'Must be a positive number')
    
    // Test timeout too short
    await formPage.fillLimits({ connectionTimeoutMs: 100 })
    await formPage.submitForm()
    await formPage.expectValidationError('connectionTimeoutMs', 'Must be at least 1000ms')
    
    // Test timeout too long
    await formPage.fillLimits({ connectionTimeoutMs: 3600000 })
    await formPage.submitForm()
    await formPage.expectValidationError('connectionTimeoutMs', 'Cannot exceed 300 seconds')
  })

  test('should validate sampling configuration', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://test.example.com' })
    
    // Enable sampling first
    await formPage.fillSampling({ enabled: true })
    
    // Test invalid sample rate
    await formPage.fillSampling({ sampleRate: -0.1 })
    await formPage.submitForm()
    await formPage.expectValidationError('sampleRate', 'Must be between 0 and 1')
    
    await formPage.fillSampling({ sampleRate: 1.5 })
    await formPage.submitForm()
    await formPage.expectValidationError('sampleRate', 'Must be between 0 and 1')
    
    // Test invalid sample size
    await formPage.fillSampling({ maxSampleSize: -1 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxSampleSize', 'Must be a positive number')
    
    await formPage.fillSampling({ maxSampleSize: 0 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxSampleSize', 'Must be at least 1')
    
    await formPage.fillSampling({ maxSampleSize: 100000 })
    await formPage.submitForm()
    await formPage.expectValidationError('maxSampleSize', 'Cannot exceed 10,000 samples')
  })

  test('should validate form interdependencies', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://test.example.com' })
    
    // Test idle timeout vs connection timeout
    await formPage.fillLimits({
      connectionTimeoutMs: 30000,
      idleTimeoutMs: 15000 // Less than connection timeout
    })
    await formPage.submitForm()
    await formPage.expectValidationError('idleTimeoutMs', 'Idle timeout must be greater than connection timeout')
    
    // Test sampling rate with store content disabled but rate > 0
    await formPage.fillSampling({
      enabled: true,
      sampleRate: 0.5,
      storeContent: false
    })
    await formPage.submitForm()
    await formPage.expectFormError('Cannot sample without storing content')
  })

  test('should test connection validation', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://echo.websocket.org' })
    
    // Mock successful connection test
    await page.route('**/api/endpoints/test-connection', async (route) => {
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
    
    await formPage.testConnection()
    await formPage.expectTestConnectionSuccess()
  })

  test('should handle connection test failures', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://invalid.example.com' })
    
    // Mock connection test failure
    await page.route('**/api/endpoints/test-connection', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Connection refused',
            code: 'CONNECTION_REFUSED'
          }
        })
      })
    })
    
    await formPage.testConnection()
    await formPage.expectTestConnectionError('Connection refused')
  })

  test('should handle connection test timeout', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test Endpoint', targetUrl: 'wss://slow.example.com' })
    
    // Mock slow connection test
    await page.route('**/api/endpoints/test-connection', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Connection timeout',
            code: 'TIMEOUT'
          }
        })
      })
    })
    
    await formPage.testConnection()
    await formPage.expectTestConnectionError('Connection timeout')
  })

  test('should validate all invalid scenarios from test data', async ({ page }) => {
    for (const invalidData of INVALID_ENDPOINT_DATA) {
      // Clear form first
      await formPage.nameInput.clear()
      await formPage.targetUrlInput.clear()
      
      // Fill with invalid data
      await formPage.fillBasicInfo({
        name: invalidData.name,
        targetUrl: invalidData.targetUrl
      })
      
      if (invalidData.limits) {
        await formPage.fillLimits(invalidData.limits)
      }
      
      if (invalidData.sampling) {
        await formPage.fillSampling(invalidData.sampling)
      }
      
      await formPage.submitForm()
      
      // Check for expected errors
      for (const expectedError of invalidData.expectedErrors) {
        await expect(page.getByText(expectedError)).toBeVisible()
      }
    }
  })

  test('should prevent double submission', async ({ page }) => {
    await formPage.fillBasicInfo(VALID_ENDPOINT_DATA)
    
    // Mock slow API response
    await page.route('**/api/endpoints', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 2000))
        await route.continue()
      }
    })
    
    // Submit form
    await formPage.submitForm()
    
    // Should show submitting state
    await formPage.expectSubmittingState()
    
    // Form should be disabled during submission
    await formPage.expectFormDisabled()
    
    // Try to submit again (button should be disabled)
    await expect(formPage.saveButton).toBeDisabled()
  })

  test('should clear validation errors when user starts typing', async ({ page }) => {
    // Trigger validation error
    await formPage.submitForm()
    await formPage.expectValidationError('name', 'Name is required')
    
    // Start typing in name field
    await formPage.nameInput.fill('T')
    
    // Error should be cleared
    const nameError = page.locator('[data-testid="name-error"]')
    await expect(nameError).not.toBeVisible()
  })

  test('should handle network errors during form submission', async ({ page }) => {
    await formPage.fillBasicInfo(VALID_ENDPOINT_DATA)
    
    // Mock network error
    await page.route('**/api/endpoints', async (route) => {
      if (route.request().method() === 'POST') {
        await route.abort('internetdisconnected')
      }
    })
    
    await formPage.submitForm()
    
    // Should show network error
    await formPage.expectFormError('Network error. Please check your connection.')
  })

  test('should handle server validation errors', async ({ page }) => {
    await formPage.fillBasicInfo(VALID_ENDPOINT_DATA)
    
    // Mock server validation error
    await page.route('**/api/endpoints', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                targetUrl: ['URL is not reachable'],
                limits: ['Rate limit too high for your plan']
              }
            }
          })
        })
      }
    })
    
    await formPage.submitForm()
    
    // Should show server validation errors
    await formPage.expectValidationError('targetUrl', 'URL is not reachable')
    await formPage.expectFormError('Rate limit too high for your plan')
  })

  test('should save form state when navigating away and back', async ({ page }) => {
    const formData = {
      name: 'Test Endpoint',
      targetUrl: 'wss://test.example.com',
      enabled: true
    }
    
    await formPage.fillBasicInfo(formData)
    await formPage.fillLimits({ maxConnections: 50 })
    
    // Navigate away
    await page.goto('/dashboard')
    
    // Navigate back
    await endpointsPage.goto()
    await endpointsPage.clickCreateEndpoint()
    
    // Form should remember values (if implemented)
    // Note: This depends on whether the app implements form state persistence
    // await formPage.expectFormValues(formData)
  })

  test('should handle conditional field visibility', async ({ page }) => {
    await formPage.fillBasicInfo({ name: 'Test', targetUrl: 'wss://test.example.com' })
    
    // Test sampling fields conditional visibility
    await formPage.expectSamplingFieldsConditionallyVisible()
    
    // Disable sampling
    await formPage.fillSampling({ enabled: false })
    await formPage.expectSamplingFieldsConditionallyVisible()
    
    // Enable sampling
    await formPage.fillSampling({ enabled: true })
    await formPage.expectSamplingFieldsConditionallyVisible()
  })
})

test.describe('Endpoint Form - Edit Mode Validation', () => {
  test('should load existing endpoint data for editing', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const formPage = new EndpointFormPage(page)
    await formPage.gotoEdit('endpoint-1')
    
    // Should load existing data
    await formPage.expectEditForm('Test WebSocket Endpoint')
    
    // Should show existing values
    await formPage.expectFormValues({
      name: 'Test WebSocket Endpoint',
      targetUrl: 'wss://echo.websocket.org',
      enabled: true
    })
  })

  test('should validate edit form with existing constraints', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    // Mock name conflict with different endpoint
    await page.route('**/api/endpoints/endpoint-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                name: ['Name conflicts with another endpoint']
              }
            }
          })
        })
      }
    })
    
    const formPage = new EndpointFormPage(page)
    await formPage.gotoEdit('endpoint-1')
    
    // Change name to conflict
    await formPage.nameInput.clear()
    await formPage.nameInput.fill('Production API Gateway')
    
    await formPage.submitForm()
    
    // Should show conflict error
    await formPage.expectValidationError('name', 'Name conflicts with another endpoint')
  })
})

test.describe('Endpoint Form - Accessibility', () => {
  test('should support keyboard navigation', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const formPage = new EndpointFormPage(page)
    await formPage.gotoCreate()
    
    // Test tab navigation through form fields
    await page.keyboard.press('Tab') // Focus on name
    await expect(formPage.nameInput).toBeFocused()
    
    await page.keyboard.press('Tab') // Focus on URL
    await expect(formPage.targetUrlInput).toBeFocused()
    
    await page.keyboard.press('Tab') // Focus on enabled switch
    await expect(formPage.enabledSwitch).toBeFocused()
    
    // Test form submission with Enter key
    await formPage.nameInput.focus()
    await formPage.nameInput.fill('Test Endpoint')
    await formPage.targetUrlInput.fill('wss://test.example.com')
    
    await page.keyboard.press('Enter')
    // Should submit form or focus next field
  })

  test('should have proper ARIA labels and descriptions', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const formPage = new EndpointFormPage(page)
    await formPage.gotoCreate()
    
    // Check form accessibility
    await expect(formPage.nameInput).toHaveAttribute('aria-label', /name/i)
    await expect(formPage.targetUrlInput).toHaveAttribute('aria-label', /target url/i)
    
    // Check required field indicators
    await expect(formPage.nameInput).toHaveAttribute('aria-required', 'true')
    await expect(formPage.targetUrlInput).toHaveAttribute('aria-required', 'true')
    
    // Check error announcements
    await formPage.submitForm()
    const errorMessages = page.getByRole('alert')
    await expect(errorMessages.first()).toBeVisible()
  })

  test('should support screen reader announcements', async ({ page }) => {
    const apiMocks = new ApiMocks(page)
    await apiMocks.setupAllMocks()
    
    const formPage = new EndpointFormPage(page)
    await formPage.gotoCreate()
    
    // Check live regions for dynamic content
    const liveRegion = page.locator('[aria-live="polite"]')
    
    // Test connection should announce result
    await formPage.fillBasicInfo({ name: 'Test', targetUrl: 'wss://echo.websocket.org' })
    await formPage.testConnection()
    
    await expect(liveRegion).toContainText(/connection|test/i)
  })
})