'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon,
  Activity,
  Clock
} from 'lucide-react'
import { SessionInfo, TrafficStats } from '@/lib/types/traffic'

interface TrafficChartsProps {
  sessions: Map<string, SessionInfo>
  isConnected: boolean
}

interface TimeSeriesData {
  timestamp: string
  time: string
  connections: number
  messagesIn: number
  messagesOut: number
  bytesIn: number
  bytesOut: number
  latency: number
}

interface EndpointData {
  endpoint: string
  connections: number
  messages: number
  bytes: number
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function TrafficCharts({ sessions, isConnected }: TrafficChartsProps) {
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [endpointData, setEndpointData] = useState<EndpointData[]>([])
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line')
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h')

  const sessionArray = Array.from(sessions.values())

  // Update time series data
  useEffect(() => {
    if (!isConnected) return

    const now = new Date()
    const timestamp = now.toISOString()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const totalMessagesIn = sessionArray.reduce((sum, s) => sum + s.metrics.messagesIn, 0)
    const totalMessagesOut = sessionArray.reduce((sum, s) => sum + s.metrics.messagesOut, 0)
    const totalBytesIn = sessionArray.reduce((sum, s) => sum + s.metrics.bytesIn, 0)
    const totalBytesOut = sessionArray.reduce((sum, s) => sum + s.metrics.bytesOut, 0)
    const avgLatency = sessionArray.length > 0 
      ? sessionArray.reduce((sum, s) => sum + s.metrics.latencyMs, 0) / sessionArray.length 
      : 0

    const newDataPoint: TimeSeriesData = {
      timestamp,
      time,
      connections: sessionArray.length,
      messagesIn: totalMessagesIn,
      messagesOut: totalMessagesOut,
      bytesIn: totalBytesIn,
      bytesOut: totalBytesOut,
      latency: avgLatency
    }

    setTimeSeriesData(prev => {
      const updated = [...prev, newDataPoint]
      // Keep last 100 data points
      return updated.slice(-100)
    })
  }, [sessionArray, isConnected])

  // Update endpoint data
  useEffect(() => {
    const endpointMap = new Map<string, { connections: number, messages: number, bytes: number }>()

    sessionArray.forEach(session => {
      const endpoint = session.targetEndpoint
      const existing = endpointMap.get(endpoint) || { connections: 0, messages: 0, bytes: 0 }
      
      endpointMap.set(endpoint, {
        connections: existing.connections + 1,
        messages: existing.messages + session.metrics.messagesIn + session.metrics.messagesOut,
        bytes: existing.bytes + session.metrics.bytesIn + session.metrics.bytesOut
      })
    })

    const endpointArray = Array.from(endpointMap.entries()).map(([endpoint, data]) => ({
      endpoint,
      ...data
    })).sort((a, b) => b.connections - a.connections)

    setEndpointData(endpointArray)
  }, [sessionArray])

  const renderChart = () => {
    if (timeSeriesData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <div className="text-center">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <p>No data available</p>
            <p className="text-sm">Connect to start collecting metrics</p>
          </div>
        </div>
      )
    }

    const commonProps = {
      data: timeSeriesData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis 
              dataKey="time" 
              className="text-slate-600 dark:text-slate-400"
              tick={{ fontSize: 12 }}
            />
            <YAxis className="text-slate-600 dark:text-slate-400" tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="connections"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              name="Connections"
            />
            <Area
              type="monotone"
              dataKey="messagesIn"
              stackId="2"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.6}
              name="Messages In"
            />
            <Area
              type="monotone"
              dataKey="messagesOut"
              stackId="3"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.6}
              name="Messages Out"
            />
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis 
              dataKey="time" 
              className="text-slate-600 dark:text-slate-400"
              tick={{ fontSize: 12 }}
            />
            <YAxis className="text-slate-600 dark:text-slate-400" tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="connections" fill="#3b82f6" name="Connections" />
            <Bar dataKey="messagesIn" fill="#10b981" name="Messages In" />
            <Bar dataKey="messagesOut" fill="#f59e0b" name="Messages Out" />
          </BarChart>
        )

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis 
              dataKey="time" 
              className="text-slate-600 dark:text-slate-400"
              tick={{ fontSize: 12 }}
            />
            <YAxis className="text-slate-600 dark:text-slate-400" tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="connections"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Connections"
            />
            <Line
              type="monotone"
              dataKey="messagesIn"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Messages In"
            />
            <Line
              type="monotone"
              dataKey="messagesOut"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Messages Out"
            />
          </LineChart>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Traffic Metrics Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Traffic Metrics
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <Button
                size="sm"
                variant={chartType === 'line' ? 'default' : 'outline'}
                onClick={() => setChartType('line')}
                className="px-2 py-1"
              >
                Line
              </Button>
              <Button
                size="sm"
                variant={chartType === 'area' ? 'default' : 'outline'}
                onClick={() => setChartType('area')}
                className="px-2 py-1"
              >
                Area
              </Button>
              <Button
                size="sm"
                variant={chartType === 'bar' ? 'default' : 'outline'}
                onClick={() => setChartType('bar')}
                className="px-2 py-1"
              >
                Bar
              </Button>
            </div>
          </div>
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Chart */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Latency Trends
            </h3>
          </div>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {timeSeriesData.length > 0 ? (
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis 
                    dataKey="time" 
                    className="text-slate-600 dark:text-slate-400"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-slate-600 dark:text-slate-400" 
                    tick={{ fontSize: 12 }}
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Latency']}
                  />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Avg Latency (ms)"
                  />
                </LineChart>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="text-center">
                    <Clock className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm">No latency data</p>
                  </div>
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Endpoint Distribution */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Endpoint Distribution
            </h3>
          </div>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {endpointData.length > 0 ? (
                <PieChart>
                  <Pie
                    data={endpointData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="connections"
                  >
                    {endpointData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value} connections`,
                      props.payload.endpoint
                    ]}
                  />
                </PieChart>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="text-center">
                    <PieChartIcon className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm">No endpoint data</p>
                  </div>
                </div>
              )}
            </ResponsiveContainer>
          </div>

          {/* Endpoint Legend */}
          {endpointData.length > 0 && (
            <div className="mt-4 space-y-2">
              {endpointData.slice(0, 5).map((endpoint, index) => (
                <div key={endpoint.endpoint} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-32">
                      {endpoint.endpoint}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {endpoint.connections}
                  </Badge>
                </div>
              ))}
              {endpointData.length > 5 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  +{endpointData.length - 5} more endpoints
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Data Transfer Chart */}
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Data Transfer
          </h3>
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            {timeSeriesData.length > 0 ? (
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis 
                  dataKey="time" 
                  className="text-slate-600 dark:text-slate-400"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-slate-600 dark:text-slate-400" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatBytes}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [
                    formatBytes(value), 
                    name === 'bytesIn' ? 'Bytes In' : 'Bytes Out'
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="bytesIn"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Bytes In"
                />
                <Area
                  type="monotone"
                  dataKey="bytesOut"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.6}
                  name="Bytes Out"
                />
              </AreaChart>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <BarChart3 className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">No transfer data</p>
                </div>
              </div>
            )}
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}