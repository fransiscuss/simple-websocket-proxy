import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login.page'
import { ApiMocks } from './fixtures/api-mocks'
import { TEST_ADMIN_CREDENTIALS, INVALID_CREDENTIALS, ROUTE_PATHS } from './fixtures/test-data'

test.describe('Authentication - Unauthenticated Access', () => {
  test('should redirect unauthenticated users to login page', async ({ page }) => {
    // Try to access protected routes directly
    const protectedRoutes = [
      ROUTE_PATHS.DASHBOARD,
      ROUTE_PATHS.ENDPOINTS,
      ROUTE_PATHS.TRAFFIC,
      ROUTE_PATHS.AUDIT
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      
      // Should redirect to login page
      await page.waitForURL(ROUTE_PATHS.LOGIN)
      
      // Check that login page is displayed
      const loginPage = new LoginPage(page)
      await loginPage.expectToBeVisible()
    }
  })

  test('should allow access to login page without authentication', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.expectToBeVisible()
  })

  test('should show proper login form elements', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Check all form elements are present
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
    await expect(loginPage.heading).toBeVisible()
    
    // Check security notice
    await loginPage.expectSecurityNotice()
  })

  test('should handle password visibility toggle', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Password should be hidden by default
    await loginPage.expectPasswordHidden()
    
    // Toggle visibility
    await loginPage.togglePasswordVisibility()
    await loginPage.expectPasswordVisible()
    
    // Toggle back
    await loginPage.togglePasswordVisibility()
    await loginPage.expectPasswordHidden()
  })
})

test.describe('Authentication - Login Flow', () => {
  let apiMocks: ApiMocks

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page)
    await apiMocks.setupAuthMocks()
  })

  test('should successfully login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Perform login
    await loginPage.login(TEST_ADMIN_CREDENTIALS.email, TEST_ADMIN_CREDENTIALS.password)
    
    // Should redirect to dashboard
    await loginPage.expectRedirectToDashboard()
    
    // Check that we're actually on the dashboard
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Try login with invalid credentials
    await loginPage.login('invalid@example.com', 'wrongpassword')
    
    // Should show error message
    await loginPage.expectErrorMessage('Invalid credentials')
    
    // Should remain on login page
    await expect(page).toHaveURL(ROUTE_PATHS.LOGIN)
  })

  test('should validate form fields with proper error messages', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Test each invalid credential scenario
    for (const invalidCred of INVALID_CREDENTIALS) {
      await loginPage.clearForm()
      await loginPage.login(invalidCred.email, invalidCred.password)
      
      // Check for validation error
      if (invalidCred.expectedError.includes('email')) {
        await expect(page.getByText(invalidCred.expectedError)).toBeVisible()
      } else {
        await expect(page.getByText(invalidCred.expectedError)).toBeVisible()
      }
    }
  })

  test('should show loading state during login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Fill form
    await loginPage.emailInput.fill(TEST_ADMIN_CREDENTIALS.email)
    await loginPage.passwordInput.fill(TEST_ADMIN_CREDENTIALS.password)
    
    // Click submit and immediately check loading state
    await loginPage.submitButton.click()
    await loginPage.expectLoadingState()
    
    // Form should be disabled during login
    await loginPage.expectFormDisabledDuringLogin()
  })

  test('should clear error messages when user starts typing', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Trigger validation error
    await loginPage.login('invalid@example.com', 'wrongpassword')
    await loginPage.expectErrorMessage('Invalid credentials')
    
    // Start typing in email field
    await loginPage.emailInput.fill('a')
    
    // Error should be cleared
    await expect(loginPage.errorAlert).not.toBeVisible()
  })

  test('should handle keyboard navigation', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Tab through form elements
    await page.keyboard.press('Tab')
    await expect(loginPage.emailInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(loginPage.passwordInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(loginPage.passwordToggle).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(loginPage.submitButton).toBeFocused()
    
    // Test form submission with Enter key
    await loginPage.emailInput.focus()
    await loginPage.emailInput.fill(TEST_ADMIN_CREDENTIALS.email)
    await loginPage.passwordInput.fill(TEST_ADMIN_CREDENTIALS.password)
    
    await page.keyboard.press('Enter')
    await loginPage.expectRedirectToDashboard()
  })

  test('should redirect authenticated users away from login page', async ({ page }) => {
    // First login
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_ADMIN_CREDENTIALS.email, TEST_ADMIN_CREDENTIALS.password)
    await loginPage.expectRedirectToDashboard()
    
    // Try to visit login page again
    await loginPage.goto()
    
    // Should redirect back to dashboard
    await page.waitForURL(ROUTE_PATHS.DASHBOARD)
  })
})

test.describe('Authentication - Accessibility', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Check form has proper labeling
    await expect(loginPage.emailInput).toHaveAttribute('type', 'email')
    await expect(loginPage.emailInput).toHaveAttribute('autocomplete', 'email')
    await expect(loginPage.passwordInput).toHaveAttribute('autocomplete', 'current-password')
    
    // Check for proper ARIA attributes
    const form = page.locator('form')
    await expect(form).toBeVisible()
    
    // Check error announcements
    await loginPage.login('', '')
    const errorMessages = page.getByRole('alert')
    await expect(errorMessages.first()).toBeVisible()
  })

  test('should support screen reader navigation', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Check heading hierarchy
    const mainHeading = page.getByRole('heading', { level: 1 })
    await expect(mainHeading).toBeVisible()
    
    // Check form structure
    const emailLabel = page.getByText('Email Address')
    const passwordLabel = page.getByText('Password')
    
    await expect(emailLabel).toBeVisible()
    await expect(passwordLabel).toBeVisible()
    
    // Check button descriptions
    await expect(loginPage.submitButton).toHaveAccessibleName(/sign in/i)
    await expect(loginPage.passwordToggle).toHaveAccessibleName(/toggle password visibility/i)
  })
})