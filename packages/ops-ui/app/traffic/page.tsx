'use client'

import { useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { TrafficOverview } from '@/components/traffic/traffic-overview'
import { SessionGrid } from '@/components/traffic/session-grid'
import { SessionDetailsModal } from '@/components/traffic/session-details-modal'
import { TrafficFlowVisualization } from '@/components/traffic/traffic-flow-visualization'
import { TrafficCharts } from '@/components/traffic/traffic-charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { 
  RefreshCw, 
  Play, 
  Pause, 
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useTrafficWebSocket } from '@/lib/hooks/use-traffic-websocket'
import { 
  TrafficTelemetryEvent, 
  SessionInfo, 
  WebSocketConnectionState,
  ControlCommand 
} from '@/lib/types/traffic'

export default function TrafficMonitoringPage() {
  const { toast } = useToast()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)

  const handleTelemetryEvent = useCallback((event: TrafficTelemetryEvent) => {
    // Handle specific telemetry events if needed
    switch (event.type) {
      case 'sessionStarted':
        toast({
          title: 'New Session Started',
          description: `Session ${event.data.session.id.slice(0, 8)}... connected to ${event.data.session.targetEndpoint}`,
          duration: 3000,
        })
        break
      
      case 'sessionEnded':
        if (event.data.reason === 'error') {
          toast({
            title: 'Session Error',
            description: `Session ${event.data.sessionId.slice(0, 8)}... ended due to error`,
            variant: 'destructive',
            duration: 5000,
          })
        }
        break
    }
  }, [toast])

  const handleConnectionChange = useCallback((state: WebSocketConnectionState) => {
    switch (state.status) {
      case 'connected':
        toast({
          title: 'WebSocket Connected',
          description: 'Live traffic monitoring is now active',
          duration: 3000,
        })
        break
      
      case 'disconnected':
        if (state.reconnectAttempts > 0) {
          toast({
            title: 'Connection Lost',
            description: `Attempting to reconnect... (${state.reconnectAttempts} attempts)`,
            variant: 'destructive',
            duration: 5000,
          })
        }
        break
      
      case 'error':
        toast({
          title: 'Connection Error',
          description: state.error || 'Failed to connect to WebSocket',
          variant: 'destructive',
          duration: 5000,
        })
        break
    }
  }, [toast])

  const {
    connectionState,
    sessions,
    connect,
    disconnect,
    sendCommand,
    isConnected
  } = useTrafficWebSocket({
    autoConnect: true,
    onEvent: handleTelemetryEvent,
    onConnectionChange: handleConnectionChange
  })

  const handleViewSessionDetails = useCallback(async (sessionId: string) => {
    const session = sessions.get(sessionId)
    if (session) {
      setSelectedSession(session)
      setSelectedSessionId(sessionId)
    }
  }, [sessions])

  const handleKillSession = useCallback(async (sessionId: string) => {
    try {
      await sendCommand({
        type: 'killSession',
        sessionId,
        timestamp: new Date().toISOString()
      })
      
      toast({
        title: 'Session Terminated',
        description: `Session ${sessionId.slice(0, 8)}... has been terminated`,
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to Kill Session',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
        duration: 5000,
      })
    }
  }, [sendCommand, toast])

  const handleKillAllSessions = useCallback(async () => {
    try {
      await sendCommand({
        type: 'killAllSessions',
        timestamp: new Date().toISOString()
      })
      
      toast({
        title: 'All Sessions Terminated',
        description: 'All active sessions have been terminated',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to Kill All Sessions',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
        duration: 5000,
      })
    }
  }, [sendCommand, toast])

  const handleToggleConnection = useCallback(() => {
    if (isConnected) {
      disconnect()
    } else {
      connect()
    }
  }, [isConnected, connect, disconnect])

  const handleCloseSessionDetails = useCallback(() => {
    setSelectedSession(null)
    setSelectedSessionId(null)
  }, [])

  return (
    <DashboardLayout title="Traffic Monitoring">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Live Traffic Monitoring
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Real-time WebSocket proxy traffic analytics and session management
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleConnection}
              className={isConnected ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
            >
              {isConnected ? (
                <>
                  <WifiOff className="w-4 h-4 mr-1" />
                  Disconnect
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-1" />
                  Connect
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              {isAutoRefresh ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Resume
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Connection Status Alert */}
        {!isConnected && (
          <Card className="p-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  WebSocket Disconnected
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  {connectionState.status === 'connecting' 
                    ? 'Attempting to connect to live telemetry...'
                    : connectionState.error || 'Real-time monitoring is not available. Click Connect to retry.'
                  }
                </p>
              </div>
              {connectionState.status !== 'connecting' && (
                <Button size="sm" onClick={connect} className="ml-auto">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Traffic Overview */}
        <TrafficOverview 
          sessions={sessions} 
          connectionState={connectionState}
        />

        {/* Main Content Tabs */}
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="flow">Traffic Flow</TabsTrigger>
            <TabsTrigger value="charts">Analytics</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-6">
            <SessionGrid
              sessions={sessions}
              onViewDetails={handleViewSessionDetails}
              onKillSession={handleKillSession}
              onKillAllSessions={handleKillAllSessions}
            />
          </TabsContent>

          <TabsContent value="flow" className="space-y-6">
            <TrafficFlowVisualization
              sessions={sessions}
              isConnected={isConnected}
            />
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <TrafficCharts
              sessions={sessions}
              isConnected={isConnected}
            />
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">System Performance</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Connection Status:</span>
                    <span className={`text-sm font-medium ${
                      isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {connectionState.status.charAt(0).toUpperCase() + connectionState.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Active Sessions:</span>
                    <span className="text-sm font-medium">{sessions.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Reconnect Attempts:</span>
                    <span className="text-sm font-medium">{connectionState.reconnectAttempts}</span>
                  </div>
                  {connectionState.lastConnected && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Last Connected:</span>
                      <span className="text-sm font-medium">
                        {new Date(connectionState.lastConnected).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Traffic Summary</h3>
                <div className="space-y-4">
                  {Array.from(sessions.values()).length > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Total Messages:</span>
                        <span className="text-sm font-medium">
                          {Array.from(sessions.values()).reduce((sum, s) => 
                            sum + s.metrics.messagesIn + s.metrics.messagesOut, 0
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Total Bytes:</span>
                        <span className="text-sm font-medium">
                          {Array.from(sessions.values()).reduce((sum, s) => 
                            sum + s.metrics.bytesIn + s.metrics.bytesOut, 0
                          ).toLocaleString()} bytes
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Avg Latency:</span>
                        <span className="text-sm font-medium">
                          {sessions.size > 0 
                            ? (Array.from(sessions.values()).reduce((sum, s) => sum + s.metrics.latencyMs, 0) / sessions.size).toFixed(1)
                            : 0
                          }ms
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No active sessions
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Session Details Modal */}
        <SessionDetailsModal
          isOpen={selectedSessionId !== null}
          onClose={handleCloseSessionDetails}
          session={selectedSession}
          onKillSession={handleKillSession}
          sendCommand={sendCommand}
        />
      </div>
    </DashboardLayout>
  )
}