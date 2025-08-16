import { test as setup, expect } from '@playwright/test'
import { LoginPage } from './pages/login.page'
import { ApiMocks } from './fixtures/api-mocks'
import { TEST_ADMIN_CREDENTIALS } from './fixtures/test-data'

const authFile = 'e2e/.auth/admin.json'

setup('authenticate as admin', async ({ page }) => {
  // Setup API mocks
  const apiMocks = new ApiMocks(page)
  await apiMocks.setupAuthMocks()

  const loginPage = new LoginPage(page)
  
  // Navigate to login page
  await loginPage.goto()
  
  // Perform login
  await loginPage.login(TEST_ADMIN_CREDENTIALS.email, TEST_ADMIN_CREDENTIALS.password)
  
  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard')
  
  // Verify we're logged in by checking for user menu or dashboard content
  await expect(page.getByRole('button', { name: /user menu/i }).or(
    page.getByText('Operations Dashboard')
  )).toBeVisible()

  // Save authentication state
  await page.context().storageState({ path: authFile })
})