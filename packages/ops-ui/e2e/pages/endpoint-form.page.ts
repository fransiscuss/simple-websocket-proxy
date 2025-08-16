import { Page, Locator, expect } from '@playwright/test'
import { ROUTE_PATHS } from '../fixtures/test-data'

export class EndpointFormPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly backButton: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly testConnectionButton: Locator

  // Basic fields
  readonly nameInput: Locator
  readonly targetUrlInput: Locator
  readonly enabledSwitch: Locator

  // Limits section
  readonly limitsSection: Locator
  readonly maxConnectionsInput: Locator
  readonly maxMessageSizeInput: Locator
  readonly connectionTimeoutInput: Locator
  readonly idleTimeoutInput: Locator
  readonly rateLimitInput: Locator

  // Sampling section
  readonly samplingSection: Locator
  readonly samplingEnabledSwitch: Locator
  readonly sampleRateInput: Locator
  readonly maxSampleSizeInput: Locator
  readonly storeContentSwitch: Locator

  // Form validation
  readonly formErrors: Locator
  readonly successMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.getByRole('heading', { level: 1 })
    this.backButton = page.getByRole('button', { name: /back/i })
    this.saveButton = page.getByRole('button', { name: /save|create/i })
    this.cancelButton = page.getByRole('button', { name: /cancel/i })
    this.testConnectionButton = page.getByRole('button', { name: /test connection/i })

    // Basic fields
    this.nameInput = page.getByLabel(/name/i)
    this.targetUrlInput = page.getByLabel(/target url/i)
    this.enabledSwitch = page.getByRole('switch', { name: /enabled/i })

    // Limits
    this.limitsSection = page.locator('[data-testid="limits-section"]')
    this.maxConnectionsInput = page.getByLabel(/max connections/i)
    this.maxMessageSizeInput = page.getByLabel(/max message size/i)
    this.connectionTimeoutInput = page.getByLabel(/connection timeout/i)
    this.idleTimeoutInput = page.getByLabel(/idle timeout/i)
    this.rateLimitInput = page.getByLabel(/rate limit/i)

    // Sampling
    this.samplingSection = page.locator('[data-testid="sampling-section"]')
    this.samplingEnabledSwitch = page.getByRole('switch', { name: /sampling enabled/i })
    this.sampleRateInput = page.getByLabel(/sample rate/i)
    this.maxSampleSizeInput = page.getByLabel(/max sample size/i)
    this.storeContentSwitch = page.getByRole('switch', { name: /store content/i })

    // Validation
    this.formErrors = page.locator('[data-testid="form-error"]')
    this.successMessage = page.locator('[data-testid="success-message"]')
  }

  async gotoCreate() {
    await this.page.goto(ROUTE_PATHS.ENDPOINTS_NEW)
  }

  async gotoEdit(endpointId: string) {
    await this.page.goto(`/endpoints/${endpointId}/edit`)
  }

  async expectCreateForm() {
    await expect(this.pageTitle).toHaveText(/create endpoint/i)
    await expect(this.nameInput).toBeVisible()
    await expect(this.targetUrlInput).toBeVisible()
    await expect(this.saveButton).toHaveText(/create/i)
  }

  async expectEditForm(endpointName: string) {
    await expect(this.pageTitle).toHaveText(/edit endpoint/i)
    await expect(this.nameInput).toHaveValue(endpointName)
    await expect(this.saveButton).toHaveText(/save/i)
  }

  async fillBasicInfo(data: {
    name: string
    targetUrl: string
    enabled?: boolean
  }) {
    await this.nameInput.fill(data.name)
    await this.targetUrlInput.fill(data.targetUrl)
    
    if (data.enabled !== undefined) {
      const isCurrentlyEnabled = await this.enabledSwitch.isChecked()
      if (isCurrentlyEnabled !== data.enabled) {
        await this.enabledSwitch.click()
      }
    }
  }

  async fillLimits(limits: {
    maxConnections?: number
    maxMessageSize?: number
    connectionTimeoutMs?: number
    idleTimeoutMs?: number
    rateLimitRpm?: number
  }) {
    if (limits.maxConnections !== undefined) {
      await this.maxConnectionsInput.fill(limits.maxConnections.toString())
    }
    if (limits.maxMessageSize !== undefined) {
      await this.maxMessageSizeInput.fill(limits.maxMessageSize.toString())
    }
    if (limits.connectionTimeoutMs !== undefined) {
      await this.connectionTimeoutInput.fill(limits.connectionTimeoutMs.toString())
    }
    if (limits.idleTimeoutMs !== undefined) {
      await this.idleTimeoutInput.fill(limits.idleTimeoutMs.toString())
    }
    if (limits.rateLimitRpm !== undefined) {
      await this.rateLimitInput.fill(limits.rateLimitRpm.toString())
    }
  }

  async fillSampling(sampling: {
    enabled?: boolean
    sampleRate?: number
    maxSampleSize?: number
    storeContent?: boolean
  }) {
    if (sampling.enabled !== undefined) {
      const isCurrentlyEnabled = await this.samplingEnabledSwitch.isChecked()
      if (isCurrentlyEnabled !== sampling.enabled) {
        await this.samplingEnabledSwitch.click()
      }
    }

    if (sampling.sampleRate !== undefined) {
      await this.sampleRateInput.fill(sampling.sampleRate.toString())
    }
    if (sampling.maxSampleSize !== undefined) {
      await this.maxSampleSizeInput.fill(sampling.maxSampleSize.toString())
    }
    if (sampling.storeContent !== undefined) {
      const isCurrentlyEnabled = await this.storeContentSwitch.isChecked()
      if (isCurrentlyEnabled !== sampling.storeContent) {
        await this.storeContentSwitch.click()
      }
    }
  }

  async submitForm() {
    await this.saveButton.click()
  }

  async cancelForm() {
    await this.cancelButton.click()
  }

  async testConnection() {
    await this.testConnectionButton.click()
  }

  async expectValidationError(field: string, message: string) {
    const fieldError = this.page.locator(`[data-testid="${field}-error"]`)
    await expect(fieldError).toContainText(message)
  }

  async expectFormError(message: string) {
    await expect(this.formErrors).toContainText(message)
  }

  async expectSuccess(message: string) {
    await expect(this.successMessage).toContainText(message)
  }

  async expectTestConnectionSuccess() {
    const successMessage = this.page.getByText(/connection successful/i)
    await expect(successMessage).toBeVisible()
  }

  async expectTestConnectionError(errorMessage: string) {
    const errorElement = this.page.getByText(errorMessage)
    await expect(errorElement).toBeVisible()
  }

  async expectFormDisabled() {
    await expect(this.nameInput).toBeDisabled()
    await expect(this.targetUrlInput).toBeDisabled()
    await expect(this.saveButton).toBeDisabled()
  }

  async expectFormEnabled() {
    await expect(this.nameInput).toBeEnabled()
    await expect(this.targetUrlInput).toBeEnabled()
    await expect(this.saveButton).toBeEnabled()
  }

  async expectSubmittingState() {
    await expect(this.saveButton).toBeDisabled()
    await expect(this.saveButton).toContainText(/saving|creating/i)
  }

  async expectRedirectToEndpoints() {
    await this.page.waitForURL(ROUTE_PATHS.ENDPOINTS)
  }

  async expectRedirectToEndpointDetails(endpointId: string) {
    await this.page.waitForURL(`/endpoints/${endpointId}`)
  }

  async expectFormValues(data: {
    name?: string
    targetUrl?: string
    enabled?: boolean
    limits?: {
      maxConnections?: number
      maxMessageSize?: number
      connectionTimeoutMs?: number
      idleTimeoutMs?: number
      rateLimitRpm?: number
    }
    sampling?: {
      enabled?: boolean
      sampleRate?: number
      maxSampleSize?: number
      storeContent?: boolean
    }
  }) {
    if (data.name !== undefined) {
      await expect(this.nameInput).toHaveValue(data.name)
    }
    if (data.targetUrl !== undefined) {
      await expect(this.targetUrlInput).toHaveValue(data.targetUrl)
    }
    if (data.enabled !== undefined) {
      if (data.enabled) {
        await expect(this.enabledSwitch).toBeChecked()
      } else {
        await expect(this.enabledSwitch).not.toBeChecked()
      }
    }

    if (data.limits) {
      if (data.limits.maxConnections !== undefined) {
        await expect(this.maxConnectionsInput).toHaveValue(data.limits.maxConnections.toString())
      }
      if (data.limits.maxMessageSize !== undefined) {
        await expect(this.maxMessageSizeInput).toHaveValue(data.limits.maxMessageSize.toString())
      }
    }

    if (data.sampling) {
      if (data.sampling.enabled !== undefined) {
        if (data.sampling.enabled) {
          await expect(this.samplingEnabledSwitch).toBeChecked()
        } else {
          await expect(this.samplingEnabledSwitch).not.toBeChecked()
        }
      }
    }
  }

  async expectSamplingFieldsConditionallyVisible() {
    // When sampling is disabled, rate and size fields should be disabled/hidden
    const samplingEnabled = await this.samplingEnabledSwitch.isChecked()
    
    if (samplingEnabled) {
      await expect(this.sampleRateInput).toBeEnabled()
      await expect(this.maxSampleSizeInput).toBeEnabled()
      await expect(this.storeContentSwitch).toBeEnabled()
    } else {
      await expect(this.sampleRateInput).toBeDisabled()
      await expect(this.maxSampleSizeInput).toBeDisabled()
      await expect(this.storeContentSwitch).toBeDisabled()
    }
  }

  async expectFormSections() {
    await expect(this.limitsSection).toBeVisible()
    await expect(this.samplingSection).toBeVisible()
    
    // Check section headers
    await expect(this.page.getByText('Connection Limits')).toBeVisible()
    await expect(this.page.getByText('Traffic Sampling')).toBeVisible()
  }
}