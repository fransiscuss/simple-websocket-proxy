import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...')
  
  // Clean up any global resources created during testing
  try {
    // Clean up authentication files
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const authDir = path.join(__dirname, '.auth')
    try {
      await fs.rm(authDir, { recursive: true, force: true })
      console.log('Cleaned up authentication files')
    } catch (error) {
      console.log('No auth files to clean up')
    }
    
    // Clean up any temporary test data
    const tempDir = path.join(__dirname, 'temp')
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log('Cleaned up temporary files')
    } catch (error) {
      console.log('No temp files to clean up')
    }
    
  } catch (error) {
    console.warn('Error during cleanup:', error)
  }
  
  console.log('Global teardown completed')
}

export default globalTeardown