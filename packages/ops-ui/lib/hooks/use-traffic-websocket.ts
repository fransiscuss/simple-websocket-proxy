'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { 
  TrafficTelemetryEvent, 
  SessionInfo, 
  WebSocketConnectionState, 
  ControlCommand,
  SessionDetailsResponse 
} from '@/lib/types/traffic'

interface UseTrafficWebSocketOptions {
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onEvent?: (event: TrafficTelemetryEvent) => void
  onConnectionChange?: (state: WebSocketConnectionState) => void
}

interface UseTrafficWebSocketReturn {
  connectionState: WebSocketConnectionState
  sessions: Map<string, SessionInfo>
  connect: () => void
  disconnect: () => void
  sendCommand: (command: ControlCommand) => Promise<any>
  isConnected: boolean
}

export function useTrafficWebSocket(options: UseTrafficWebSocketOptions = {}): UseTrafficWebSocketReturn {
  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onEvent,
    onConnectionChange
  } = options

  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0
  })

  const [sessions, setSessions] = useState<Map<string, SessionInfo>>(new Map())

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const commandCallbacksRef = useRef<Map<string, (response: any) => void>>(new Map())
  const reconnectAttemptsRef = useRef(0)

  const updateConnectionState = useCallback((newState: Partial<WebSocketConnectionState>) => {
    setConnectionState(prev => {
      const updated = { ...prev, ...newState }
      onConnectionChange?.(updated)
      return updated
    })
  }, [onConnectionChange])

  const handleEvent = useCallback((event: TrafficTelemetryEvent) => {
    onEvent?.(event)
    
    // Update sessions based on event type
    setSessions(prev => {
      const newSessions = new Map(prev)
      
      switch (event.type) {
        case 'sessionStarted':
          newSessions.set(event.data.session.id, event.data.session)
          break
          
        case 'sessionUpdated':
          const existingSession = newSessions.get(event.data.sessionId)
          if (existingSession) {
            newSessions.set(event.data.sessionId, {
              ...existingSession,
              metrics: { ...existingSession.metrics, ...event.data.metrics }
            })
          }
          break
          
        case 'sessionEnded':
          newSessions.delete(event.data.sessionId)
          break
      }
      
      return newSessions
    })
  }, [onEvent])

  const handleMessage = useCallback((messageEvent: MessageEvent) => {
    try {
      const data = JSON.parse(messageEvent.data)
      
      // Handle command responses
      if (data.type === 'commandResponse' && data.commandId) {
        const callback = commandCallbacksRef.current.get(data.commandId)
        if (callback) {
          callback(data.response)
          commandCallbacksRef.current.delete(data.commandId)
        }
        return
      }
      
      // Handle telemetry events
      if (data.type && data.timestamp) {
        handleEvent(data as TrafficTelemetryEvent)
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }, [handleEvent])

  const handleOpen = useCallback(() => {
    reconnectAttemptsRef.current = 0
    updateConnectionState({
      status: 'connected',
      lastConnected: new Date().toISOString(),
      reconnectAttempts: 0,
      error: undefined
    })
  }, [updateConnectionState])

  const handleClose = useCallback(() => {
    updateConnectionState({ status: 'disconnected' })
    
    // Auto-reconnect if not manually disconnected
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current++
      updateConnectionState({ reconnectAttempts: reconnectAttemptsRef.current })
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect()
        }
      }, reconnectInterval)
    }
  }, [maxReconnectAttempts, reconnectInterval, updateConnectionState])

  const handleError = useCallback((error: Event) => {
    updateConnectionState({ 
      status: 'error',
      error: 'WebSocket connection error'
    })
  }, [updateConnectionState])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    updateConnectionState({ status: 'connecting' })

    try {
      // Use relative path, will work with dev and production
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ops`
      
      wsRef.current = new WebSocket(wsUrl)
      wsRef.current.onopen = handleOpen
      wsRef.current.onmessage = handleMessage
      wsRef.current.onclose = handleClose
      wsRef.current.onerror = handleError
    } catch (error) {
      updateConnectionState({ 
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to create WebSocket connection'
      })
    }
  }, [handleOpen, handleMessage, handleClose, handleError, updateConnectionState])

  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = maxReconnectAttempts // Prevent auto-reconnect
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    updateConnectionState({ status: 'disconnected' })
  }, [maxReconnectAttempts, updateConnectionState])

  const sendCommand = useCallback(async (command: ControlCommand): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'))
        return
      }

      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const commandWithId = { ...command, commandId }
      
      // Set up response callback
      commandCallbacksRef.current.set(commandId, resolve)
      
      // Send command
      wsRef.current.send(JSON.stringify(commandWithId))
      
      // Set timeout for command response
      setTimeout(() => {
        if (commandCallbacksRef.current.has(commandId)) {
          commandCallbacksRef.current.delete(commandId)
          reject(new Error('Command timeout'))
        }
      }, 10000) // 10 second timeout
    })
  }, [])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect]) // Only depend on autoConnect to avoid reconnection loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    connectionState,
    sessions,
    connect,
    disconnect,
    sendCommand,
    isConnected: connectionState.status === 'connected'
  }
}