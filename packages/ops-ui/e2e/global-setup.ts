import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...')
  
  // You can add any global setup logic here
  // For example, seeding test data, starting external services, etc.
  
  console.log('Global setup completed')
}

export default globalSetup