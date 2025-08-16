"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Edit, Power, PowerOff, Trash2, Copy, ExternalLink, Activity, Users, MessageCircle, Clock } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { DeleteEndpointDialog } from "@/components/endpoints/delete-endpoint-dialog"
import { endpointApi } from "@/lib/api/endpoints"
import type { Endpoint, EndpointStatsResponse } from "@/lib/types/endpoint"

export default function EndpointDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [endpoint, setEndpoint] = React.useState<Endpoint | null>(null)
  const [stats, setStats] = React.useState<EndpointStatsResponse | null>(null)
  const [sessions, setSessions] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const endpointId = params.id as string

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Load endpoint details and stats in parallel
      const [endpointResponse, statsResponse, sessionsResponse] = await Promise.allSettled([
        endpointApi.get(endpointId),
        endpointApi.getStats(endpointId),
        endpointApi.getSessions(endpointId, 1, 10),
      ])

      if (endpointResponse.status === 'fulfilled') {
        setEndpoint(endpointResponse.value.endpoint)
      } else {
        throw new Error('Failed to load endpoint')
      }

      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value)
      }

      if (sessionsResponse.status === 'fulfilled') {
        setSessions(sessionsResponse.value.sessions)
      }
    } catch (error) {
      console.error("Failed to load endpoint data:", error)
      setError("Failed to load endpoint")
      toast({
        title: "Error",
        description: "Failed to load endpoint details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [endpointId, toast])

  React.useEffect(() => {
    if (endpointId) {
      loadData()
    }
  }, [endpointId, loadData])

  // Auto-refresh stats every 30 seconds
  React.useEffect(() => {
    if (!endpoint?.enabled) return

    const interval = setInterval(async () => {
      try {
        const [statsResponse, sessionsResponse] = await Promise.allSettled([
          endpointApi.getStats(endpointId),
          endpointApi.getSessions(endpointId, 1, 10),
        ])

        if (statsResponse.status === 'fulfilled') {
          setStats(statsResponse.value)
        }

        if (sessionsResponse.status === 'fulfilled') {
          setSessions(sessionsResponse.value.sessions)
        }
      } catch (error) {
        console.error("Failed to refresh stats:", error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [endpointId, endpoint?.enabled])

  const handleAction = async (action: 'enable' | 'disable' | 'clone') => {
    if (!endpoint) return

    try {
      switch (action) {
        case 'enable':
        case 'disable':
          await endpointApi.setEnabled(endpoint.id, action === 'enable')
          toast({
            title: "Success",
            description: `Endpoint ${action === 'enable' ? 'enabled' : 'disabled'} successfully.`,
          })
          loadData() // Refresh data
          break
        case 'clone':
          const newName = `${endpoint.name} (Copy)`
          await endpointApi.clone(endpoint.id, newName)
          toast({
            title: "Success",
            description: "Endpoint cloned successfully.",
          })
          router.push("/endpoints")
          break
      }
    } catch (error) {
      console.error(`Failed to ${action} endpoint:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} endpoint. Please try again.`,
        variant: "destructive",
      })
    }
  }

  const handleDeleteSuccess = () => {
    router.push("/endpoints")
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !endpoint) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-destructive">Error</h1>
          <p className="text-muted-foreground">
            {error || "Endpoint not found"}
          </p>
        </div>
      </div>
    )
  }

  const formatBytes = (bytes: number | bigint) => {
    const b = typeof bytes === 'bigint' ? Number(bytes) : bytes
    if (b === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold tracking-tight">{endpoint.name}</h1>
            <Badge 
              variant={endpoint.enabled ? 'default' : 'outline'}
              className={endpoint.enabled ? 'bg-green-100 text-green-800' : ''}
            >
              {endpoint.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center mt-1">
            <ExternalLink className="mr-1 h-4 w-4" />
            {endpoint.targetUrl}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/endpoints/${endpoint.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction(endpoint.enabled ? 'disable' : 'enable')}
          >
            {endpoint.enabled ? (
              <>
                <PowerOff className="mr-2 h-4 w-4" />
                Disable
              </>
            ) : (
              <>
                <Power className="mr-2 h-4 w-4" />
                Enable
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => handleAction('clone')}>
            <Copy className="mr-2 h-4 w-4" />
            Clone
          </Button>
          <DeleteEndpointDialog 
            endpoint={endpoint} 
            onSuccess={handleDeleteSuccess}
          >
            <Button 
              variant="outline" 
              className="text-red-600 hover:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DeleteEndpointDialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeConnections || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total: {stats?.totalConnections || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.messagesIn || 0) + (stats?.messagesOut || 0)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              In: {(stats?.messagesIn || 0).toLocaleString()} / Out: {(stats?.messagesOut || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Transfer</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(Number(stats?.bytesIn || 0) + Number(stats?.bytesOut || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              In: {formatBytes(stats?.bytesIn || 0)} / Out: {formatBytes(stats?.bytesOut || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgConnectionDuration ? formatDuration(stats.avgConnectionDuration) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Error rate: {((stats?.errorRate || 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Tabs */}
      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Connection Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Max Connections:</span>
                  <span>{endpoint.limits.maxConnections || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Message Size:</span>
                  <span>{endpoint.limits.maxMessageSize ? formatBytes(endpoint.limits.maxMessageSize) : 'Unlimited'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connection Timeout:</span>
                  <span>{endpoint.limits.connectionTimeoutMs ? formatDuration(endpoint.limits.connectionTimeoutMs) : 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Idle Timeout:</span>
                  <span>{endpoint.limits.idleTimeoutMs ? formatDuration(endpoint.limits.idleTimeoutMs) : 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit:</span>
                  <span>{endpoint.limits.rateLimitRpm ? `${endpoint.limits.rateLimitRpm}/min` : 'Unlimited'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sampling Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Sampling Enabled:</span>
                  <Badge variant={endpoint.sampling.enabled ? 'default' : 'outline'}>
                    {endpoint.sampling.enabled ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {endpoint.sampling.enabled && (
                  <>
                    <div className="flex justify-between">
                      <span>Sample Rate:</span>
                      <span>{((endpoint.sampling.sampleRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Sample Size:</span>
                      <span>{endpoint.sampling.maxSampleSize ? formatBytes(endpoint.sampling.maxSampleSize) : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Store Content:</span>
                      <Badge variant={endpoint.sampling.storeContent ? 'default' : 'outline'}>
                        {endpoint.sampling.storeContent ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{new Date(endpoint.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span>{new Date(endpoint.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Endpoint ID:</span>
                <span className="font-mono text-sm">{endpoint.id}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Currently active WebSocket connections for this endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session ID</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Messages In</TableHead>
                      <TableHead>Messages Out</TableHead>
                      <TableHead>Data Transfer</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-sm">
                          {session.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {new Date(session.startedAt).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          {formatDuration(Date.now() - new Date(session.startedAt).getTime())}
                        </TableCell>
                        <TableCell>{session.msgsIn}</TableCell>
                        <TableCell>{session.msgsOut}</TableCell>
                        <TableCell>
                          {formatBytes(Number(session.bytesIn) + Number(session.bytesOut))}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={session.state === 'connected' ? 'default' : 'outline'}
                            className={session.state === 'connected' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {session.state}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active sessions found.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Recent connection events and traffic samples.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Activity feed coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}