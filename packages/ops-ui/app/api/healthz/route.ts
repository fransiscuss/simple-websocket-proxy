import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Add any health checks here (database connectivity, external services, etc.)
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      services: {
        next: 'healthy',
        // Add checks for external dependencies here
        // database: await checkDatabase(),
        // redis: await checkRedis(),
      }
    }

    return NextResponse.json(healthStatus, { status: 200 })
  } catch (error) {
    const errorStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    }

    return NextResponse.json(errorStatus, { status: 503 })
  }
}

// Support HEAD requests for simple health checks
export async function HEAD() {
  try {
    // Minimal health check for HEAD requests
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}