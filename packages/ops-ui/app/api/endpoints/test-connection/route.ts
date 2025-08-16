import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { targetUrl } = await request.json()
    
    if (!targetUrl) {
      return NextResponse.json(
        { message: 'Target URL is required' },
        { status: 400 }
      )
    }

    // Mock connection test
    const isValidUrl = targetUrl.startsWith('ws://') || targetUrl.startsWith('wss://')
    const responseTime = Math.floor(Math.random() * 1000) + 100 // 100-1100ms

    if (!isValidUrl) {
      return NextResponse.json({
        success: false,
        message: 'Invalid WebSocket URL. Must start with ws:// or wss://',
      })
    }

    // Simulate occasional connection failures
    const shouldFail = Math.random() < 0.2 // 20% failure rate for demo

    if (shouldFail) {
      return NextResponse.json({
        success: false,
        message: 'Connection failed: Timeout or connection refused',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      responseTime,
    })
  } catch (error) {
    return NextResponse.json(
      { message: 'Invalid request body' },
      { status: 400 }
    )
  }
}