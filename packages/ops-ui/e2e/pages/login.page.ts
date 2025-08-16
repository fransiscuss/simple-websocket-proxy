import { Page, Locator, expect } from '@playwright/test'
import { ROUTE_PATHS } from '../fixtures/test-data'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly passwordToggle: Locator
  readonly submitButton: Locator
  readonly errorAlert: Locator
  readonly loadingSpinner: Locator
  readonly forgotPasswordLink: Locator
  readonly securityNotice: Locator
  readonly logo: Locator
  readonly heading: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByRole('textbox', { name: /email/i })
    this.passwordInput = page.getByRole('textbox', { name: /password/i })
    this.passwordToggle = page.getByRole('button', { name: /toggle password visibility/i })
    this.submitButton = page.getByRole('button', { name: /sign in/i })
    this.errorAlert = page.getByRole('alert')
    this.loadingSpinner = page.getByText(/signing in/i)
    this.logo = page.locator('[data-testid="logo"]')
    this.heading = page.getByRole('heading', { name: /operations dashboard/i })
    this.securityNotice = page.getByText(/secure enterprise system/i)
  }

  async goto() {
    await this.page.goto(ROUTE_PATHS.LOGIN)
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async expectToBeVisible() {
    await expect(this.heading).toBeVisible()
    await expect(this.emailInput).toBeVisible()
    await expect(this.passwordInput).toBeVisible()
    await expect(this.submitButton).toBeVisible()
  }

  async expectErrorMessage(message: string) {
    await expect(this.errorAlert).toContainText(message)
  }

  async expectValidationError(field: 'email' | 'password', message: string) {
    const fieldError = this.page.locator(`[data-testid="${field}-error"]`)
    await expect(fieldError).toContainText(message)
  }

  async expectLoadingState() {
    await expect(this.loadingSpinner).toBeVisible()
    await expect(this.submitButton).toBeDisabled()
  }

  async togglePasswordVisibility() {
    await this.passwordToggle.click()
  }

  async expectPasswordVisible() {
    await expect(this.passwordInput).toHaveAttribute('type', 'text')
  }

  async expectPasswordHidden() {
    await expect(this.passwordInput).toHaveAttribute('type', 'password')
  }

  async expectFormDisabledDuringLogin() {
    await expect(this.emailInput).toBeDisabled()
    await expect(this.passwordInput).toBeDisabled()
    await expect(this.submitButton).toBeDisabled()
  }

  async expectSecurityNotice() {
    await expect(this.securityNotice).toBeVisible()
  }

  async expectRedirectToDashboard() {
    await this.page.waitForURL(ROUTE_PATHS.DASHBOARD)
  }

  async clearForm() {
    await this.emailInput.clear()
    await this.passwordInput.clear()
  }

  async expectFormValidation() {
    // Submit empty form to trigger validation
    await this.submitButton.click()
    
    // Check for form validation messages
    await expect(this.page.getByText('Email is required')).toBeVisible()
    await expect(this.page.getByText('Password is required')).toBeVisible()
  }

  async expectEmailValidation() {
    await this.emailInput.fill('invalid-email')
    await this.passwordInput.fill('validpassword123')
    await this.submitButton.click()
    
    await expect(this.page.getByText('Please enter a valid email address')).toBeVisible()
  }

  async expectPasswordLengthValidation() {
    await this.emailInput.fill('test@example.com')
    await this.passwordInput.fill('short')
    await this.submitButton.click()
    
    await expect(this.page.getByText('Password must be at least 8 characters')).toBeVisible()
  }
}