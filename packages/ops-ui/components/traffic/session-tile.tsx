'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeftRight, 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  Database,
  Zap,
  X,
  Eye,
  User,
  Globe
} from 'lucide-react'
import { SessionInfo } from '@/lib/types/traffic'

interface SessionTileProps {
  session: SessionInfo
  onViewDetails: (sessionId: string) => void
  onKillSession: (sessionId: string) => void
}

interface PacketFlowProps {
  messagesIn: number
  messagesOut: number
  isActive: boolean
}

function PacketFlowIndicator({ messagesIn, messagesOut, isActive }: PacketFlowProps) {
  return (
    <div className="flex items-center justify-center space-x-2 my-2">
      {/* Inbound flow */}
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${
          isActive && messagesIn > 0 
            ? 'bg-blue-500 animate-pulse' 
            : 'bg-slate-300 dark:bg-slate-600'
        }`} />
        <ArrowLeft className={`w-3 h-3 ${
          isActive && messagesIn > 0 
            ? 'text-blue-500' 
            : 'text-slate-400'
        }`} />
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {messagesIn}
        </span>
      </div>

      {/* Central connection indicator */}
      <div className="flex items-center space-x-1">
        <ArrowLeftRight className={`w-4 h-4 ${
          isActive 
            ? 'text-green-500 animate-pulse' 
            : 'text-slate-400'
        }`} />
      </div>

      {/* Outbound flow */}
      <div className="flex items-center space-x-1">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {messagesOut}
        </span>
        <ArrowRight className={`w-3 h-3 ${
          isActive && messagesOut > 0 
            ? 'text-orange-500' 
            : 'text-slate-400'
        }`} />
        <div className={`w-2 h-2 rounded-full ${
          isActive && messagesOut > 0 
            ? 'bg-orange-500 animate-pulse' 
            : 'bg-slate-300 dark:bg-slate-600'
        }`} />
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDuration(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

function getStatusColor(status: SessionInfo['status']) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
    case 'closing':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
    case 'closed':
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800'
    case 'error':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800'
  }
}

export function SessionTile({ session, onViewDetails, onKillSession }: SessionTileProps) {
  const [isActive, setIsActive] = useState(false)
  const [lastActivityTime, setLastActivityTime] = useState<string>(session.metrics.lastActivityAt)

  // Track activity changes to show real-time indicators
  useEffect(() => {
    if (session.metrics.lastActivityAt !== lastActivityTime) {
      setIsActive(true)
      setLastActivityTime(session.metrics.lastActivityAt)
      
      // Reset activity indicator after animation
      const timeout = setTimeout(() => setIsActive(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [session.metrics.lastActivityAt, lastActivityTime])

  const totalMessages = session.metrics.messagesIn + session.metrics.messagesOut
  const totalBytes = session.metrics.bytesIn + session.metrics.bytesOut

  return (
    <Card className={`p-4 transition-all duration-200 hover:shadow-md ${
      isActive ? 'ring-2 ring-primary/20 bg-primary/5' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <Badge className={getStatusColor(session.status)}>
              {session.status}
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {session.id.slice(0, 8)}...
            </span>
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {session.targetEndpoint}
          </p>
        </div>
        <div className="flex space-x-1 ml-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onViewDetails(session.id)}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
            onClick={() => onKillSession(session.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Client Info */}
      <div className="flex items-center space-x-2 mb-2 text-xs text-slate-600 dark:text-slate-400">
        <User className="h-3 w-3" />
        <span className="truncate">{session.clientIp}</span>
        <Globe className="h-3 w-3 ml-2" />
        <span className="truncate">{session.clientEndpoint}</span>
      </div>

      {/* Packet Flow Indicator */}
      <PacketFlowIndicator 
        messagesIn={session.metrics.messagesIn}
        messagesOut={session.metrics.messagesOut}
        isActive={isActive}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center space-x-1">
          <Zap className="h-3 w-3 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">
            {totalMessages} msgs
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <Database className="h-3 w-3 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">
            {formatBytes(totalBytes)}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">
            {session.metrics.latencyMs.toFixed(0)}ms
          </span>
        </div>
        <div className="text-slate-600 dark:text-slate-400">
          {formatDuration(session.startedAt)}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Started: {new Date(session.startedAt).toLocaleTimeString()}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Last: {new Date(session.metrics.lastActivityAt).toLocaleTimeString()}
          </span>
        </div>
        
        {/* Activity bar */}
        <div className="mt-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              isActive 
                ? 'bg-gradient-to-r from-blue-500 to-orange-500 animate-pulse' 
                : 'bg-primary/50'
            }`}
            style={{ 
              width: `${Math.min(100, (totalMessages / 1000) * 100)}%` 
            }}
          />
        </div>
      </div>

      {/* Tags */}
      {session.tags && session.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
              {tag}
            </Badge>
          ))}
          {session.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              +{session.tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </Card>
  )
}