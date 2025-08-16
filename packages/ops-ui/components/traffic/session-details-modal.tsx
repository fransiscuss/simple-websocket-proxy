'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  X, 
  Copy, 
  RefreshCw, 
  Clock, 
  Database, 
  Zap, 
  User, 
  Globe,
  ArrowRight,
  ArrowLeft,
  Eye,
  Download
} from 'lucide-react'
import { SessionInfo, MessageSample, ControlCommand } from '@/lib/types/traffic'

interface SessionDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  session: SessionInfo | null
  onKillSession: (sessionId: string) => void
  sendCommand: (command: ControlCommand) => Promise<any>
}

interface MessageListProps {
  messages: MessageSample[]
  isLoading: boolean
}

function MessageList({ messages, isLoading }: MessageListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-600 dark:text-slate-400">Loading messages...</span>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 dark:text-slate-400">
        No messages captured yet
      </div>
    )
  }

  const formatMessagePreview = (message: MessageSample) => {
    if (message.type === 'binary') {
      return `[Binary data: ${message.size} bytes]`
    }
    return message.preview || '[No preview available]'
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {messages.map((message) => (
        <Card key={message.id} className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Badge 
                  variant={message.direction === 'inbound' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {message.direction === 'inbound' ? (
                    <><ArrowLeft className="w-3 h-3 mr-1" /> Inbound</>
                  ) : (
                    <><ArrowRight className="w-3 h-3 mr-1" /> Outbound</>
                  )}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {message.type}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {message.size} bytes
                </span>
              </div>
              <div className="text-sm text-slate-900 dark:text-slate-100 font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded border">
                {formatMessagePreview(message)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 ml-2"
              onClick={() => navigator.clipboard.writeText(message.preview || '')}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      ))}
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
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

export function SessionDetailsModal({ 
  isOpen, 
  onClose, 
  session, 
  onKillSession,
  sendCommand 
}: SessionDetailsModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<MessageSample[]>([])
  const [isKilling, setIsKilling] = useState(false)

  useEffect(() => {
    if (isOpen && session) {
      loadSessionDetails()
    }
  }, [isOpen, session])

  const loadSessionDetails = async () => {
    if (!session) return

    setIsLoading(true)
    try {
      const response = await sendCommand({
        type: 'getSessionDetails',
        sessionId: session.id,
        timestamp: new Date().toISOString()
      })
      
      if (response && response.recentMessages) {
        setMessages(response.recentMessages)
      }
    } catch (error) {
      console.error('Failed to load session details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKillSession = async () => {
    if (!session) return

    setIsKilling(true)
    try {
      onKillSession(session.id)
      onClose()
    } catch (error) {
      console.error('Failed to kill session:', error)
    } finally {
      setIsKilling(false)
    }
  }

  const handleRefresh = () => {
    loadSessionDetails()
  }

  if (!session) return null

  const totalMessages = session.metrics.messagesIn + session.metrics.messagesOut
  const totalBytes = session.metrics.bytesIn + session.metrics.bytesOut

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center space-x-2">
                <span>Session Details</span>
                <Badge className={`${
                  session.status === 'active' 
                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                    : session.status === 'error'
                    ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                }`}>
                  {session.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="font-mono text-sm">
                {session.id}
              </DialogDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleKillSession}
                disabled={isKilling}
              >
                <X className="w-4 h-4 mr-1" />
                {isKilling ? 'Killing...' : 'Kill Session'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Connection Info */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-3">Connection Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium">Client:</span>
                    </div>
                    <div className="ml-6 space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        IP: {session.clientIp}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Endpoint: {session.clientEndpoint}
                      </p>
                      {session.userAgent && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {session.userAgent}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium">Target:</span>
                    </div>
                    <div className="ml-6">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {session.targetEndpoint}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Session Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <Zap className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {totalMessages}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Messages</p>
                </Card>
                <Card className="p-4 text-center">
                  <Database className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatBytes(totalBytes)}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Data</p>
                </Card>
                <Card className="p-4 text-center">
                  <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {session.metrics.latencyMs.toFixed(0)}ms
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Latency</p>
                </Card>
                <Card className="p-4 text-center">
                  <Eye className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatDuration(session.startedAt)}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Duration</p>
                </Card>
              </div>

              {/* Tags */}
              {session.tags && session.tags.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {session.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent Messages</h3>
                <Button size="sm" variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <MessageList messages={messages} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <h3 className="text-lg font-semibold">Detailed Metrics</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <ArrowLeft className="w-4 h-4 mr-1 text-blue-500" />
                    Inbound Traffic
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Messages:</span>
                      <span className="text-sm font-medium">{session.metrics.messagesIn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Bytes:</span>
                      <span className="text-sm font-medium">{formatBytes(session.metrics.bytesIn)}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <ArrowRight className="w-4 h-4 mr-1 text-orange-500" />
                    Outbound Traffic
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Messages:</span>
                      <span className="text-sm font-medium">{session.metrics.messagesOut}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Bytes:</span>
                      <span className="text-sm font-medium">{formatBytes(session.metrics.bytesOut)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-4">
                <h4 className="font-medium mb-3">Timeline</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Started:</span>
                    <span className="text-sm font-medium">{new Date(session.startedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Last Activity:</span>
                    <span className="text-sm font-medium">{new Date(session.metrics.lastActivityAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Duration:</span>
                    <span className="text-sm font-medium">{formatDuration(session.startedAt)}</span>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}