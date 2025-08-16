'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Wifi, 
  TrendingUp, 
  Clock, 
  Users,
  Database,
  Zap,
  AlertTriangle
} from 'lucide-react'
import { SessionInfo, TrafficOverviewData, WebSocketConnectionState } from '@/lib/types/traffic'

interface TrafficOverviewProps {
  sessions: Map<string, SessionInfo>
  connectionState: WebSocketConnectionState
}

interface MetricCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'increase' | 'decrease' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  animated?: boolean
}

function MetricCard({ title, value, change, changeType, icon: Icon, animated }: MetricCardProps) {
  return (
    <Card className="p-6 relative overflow-hidden">
      {animated && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent animate-pulse" />
      )}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {change && (
            <p className={`text-sm font-medium mt-1 ${
              changeType === 'increase' 
                ? 'text-green-600 dark:text-green-400'
                : changeType === 'decrease'
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  )
}

function ConnectionStatusBadge({ connectionState }: { connectionState: WebSocketConnectionState }) {
  const getStatusConfig = () => {
    switch (connectionState.status) {
      case 'connected':
        return {
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
          icon: Wifi,
          text: 'Connected'
        }
      case 'connecting':
        return {
          variant: 'secondary' as const,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
          icon: Activity,
          text: 'Connecting...'
        }
      case 'disconnected':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
          icon: AlertTriangle,
          text: 'Disconnected'
        }
      case 'error':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
          icon: AlertTriangle,
          text: 'Error'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.text}
      {connectionState.reconnectAttempts > 0 && (
        <span className="ml-1">({connectionState.reconnectAttempts})</span>
      )}
    </Badge>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function TrafficOverview({ sessions, connectionState }: TrafficOverviewProps) {
  const [overview, setOverview] = useState<TrafficOverviewData>({
    totalConnections: 0,
    activeConnections: 0,
    totalBytesTransferred: 0,
    totalMessages: 0,
    averageLatency: 0,
    uptime: 0,
    errorRate: 0
  })

  const [previousMetrics, setPreviousMetrics] = useState<TrafficOverviewData | null>(null)

  useEffect(() => {
    const sessionArray = Array.from(sessions.values())
    const activeConnections = sessionArray.length
    
    const totalMessages = sessionArray.reduce((sum, session) => 
      sum + session.metrics.messagesIn + session.metrics.messagesOut, 0
    )
    
    const totalBytes = sessionArray.reduce((sum, session) => 
      sum + session.metrics.bytesIn + session.metrics.bytesOut, 0
    )
    
    const averageLatency = sessionArray.length > 0
      ? sessionArray.reduce((sum, session) => sum + session.metrics.latencyMs, 0) / sessionArray.length
      : 0

    const newOverview: TrafficOverviewData = {
      totalConnections: activeConnections, // This would be cumulative in real app
      activeConnections,
      totalBytesTransferred: totalBytes,
      totalMessages,
      averageLatency,
      uptime: Date.now() / 1000, // Simplified uptime
      errorRate: 0 // Would calculate based on error events
    }

    setPreviousMetrics(overview)
    setOverview(newOverview)
  }, [sessions, overview])

  const getChangeIndicator = (current: number, previous: number | undefined): string | undefined => {
    if (previous === undefined || previous === current) return undefined
    const change = current - previous
    const percentage = previous > 0 ? (change / previous) * 100 : 0
    const sign = change > 0 ? '+' : ''
    return `${sign}${percentage.toFixed(1)}%`
  }

  const getChangeType = (current: number, previous: number | undefined): 'increase' | 'decrease' | 'neutral' => {
    if (previous === undefined || previous === current) return 'neutral'
    return current > previous ? 'increase' : 'decrease'
  }

  return (
    <div className="space-y-6">
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Live Traffic Monitoring
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Real-time WebSocket proxy traffic analytics
          </p>
        </div>
        <ConnectionStatusBadge connectionState={connectionState} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Connections"
          value={overview.activeConnections.toString()}
          change={getChangeIndicator(overview.activeConnections, previousMetrics?.activeConnections)}
          changeType={getChangeType(overview.activeConnections, previousMetrics?.activeConnections)}
          icon={Users}
          animated={connectionState.status === 'connected'}
        />
        
        <MetricCard
          title="Messages/sec"
          value={formatNumber(overview.totalMessages)}
          change={getChangeIndicator(overview.totalMessages, previousMetrics?.totalMessages)}
          changeType={getChangeType(overview.totalMessages, previousMetrics?.totalMessages)}
          icon={Zap}
          animated={connectionState.status === 'connected'}
        />
        
        <MetricCard
          title="Data Transfer"
          value={formatBytes(overview.totalBytesTransferred)}
          change={getChangeIndicator(overview.totalBytesTransferred, previousMetrics?.totalBytesTransferred)}
          changeType={getChangeType(overview.totalBytesTransferred, previousMetrics?.totalBytesTransferred)}
          icon={Database}
          animated={connectionState.status === 'connected'}
        />
        
        <MetricCard
          title="Avg Latency"
          value={`${overview.averageLatency.toFixed(1)}ms`}
          change={getChangeIndicator(overview.averageLatency, previousMetrics?.averageLatency)}
          changeType={getChangeType(overview.averageLatency, previousMetrics?.averageLatency) === 'increase' ? 'decrease' : 'increase'} // Lower latency is better
          icon={Clock}
          animated={connectionState.status === 'connected'}
        />
      </div>

      {/* Real-time Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              connectionState.status === 'connected' 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-red-500'
            }`} />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                WebSocket Status
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {connectionState.status.charAt(0).toUpperCase() + connectionState.status.slice(1)}
              </p>
            </div>
          </div>
          {connectionState.lastConnected && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Last connected: {new Date(connectionState.lastConnected).toLocaleString()}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                System Health
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {overview.errorRate < 5 ? 'Healthy' : 'Warning'}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Error rate: {overview.errorRate.toFixed(1)}%
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Update Frequency
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Real-time
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Live telemetry updates
          </p>
        </Card>
      </div>
    </div>
  )
}