'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Monitor, 
  Server, 
  ArrowRight, 
  ArrowLeft,
  Wifi,
  Globe,
  Activity
} from 'lucide-react'
import { SessionInfo, TrafficStats } from '@/lib/types/traffic'

interface TrafficFlowVisualizationProps {
  sessions: Map<string, SessionInfo>
  isConnected: boolean
}

interface FlowParticle {
  id: string
  direction: 'inbound' | 'outbound'
  size: 'small' | 'medium' | 'large'
  position: number
  speed: number
}

interface TrafficMetrics {
  messagesPerSecond: number
  bytesPerSecond: number
  activeConnections: number
}

function AnimatedParticle({ 
  particle, 
  containerWidth 
}: { 
  particle: FlowParticle
  containerWidth: number 
}) {
  const getParticleSize = (size: string) => {
    switch (size) {
      case 'small': return 'w-1 h-1'
      case 'medium': return 'w-2 h-2'
      case 'large': return 'w-3 h-3'
      default: return 'w-1 h-1'
    }
  }

  const getParticleColor = (direction: string) => {
    return direction === 'inbound' 
      ? 'bg-blue-500 shadow-blue-500/50' 
      : 'bg-orange-500 shadow-orange-500/50'
  }

  return (
    <div
      className={`absolute rounded-full ${getParticleSize(particle.size)} ${getParticleColor(particle.direction)} 
        shadow-lg animate-pulse transition-all duration-100 ease-linear`}
      style={{
        left: `${particle.position}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        boxShadow: '0 0 8px currentColor'
      }}
    />
  )
}

function NetworkNode({ 
  type, 
  label, 
  isActive, 
  connectionCount 
}: { 
  type: 'client' | 'proxy' | 'server'
  label: string
  isActive: boolean
  connectionCount?: number
}) {
  const getIcon = () => {
    switch (type) {
      case 'client': return Monitor
      case 'proxy': return Wifi
      case 'server': return Server
    }
  }

  const Icon = getIcon()

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className={`relative p-4 rounded-lg border-2 transition-all duration-300 ${
        isActive 
          ? 'border-primary bg-primary/10 shadow-lg scale-105' 
          : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'
      }`}>
        <Icon className={`w-8 h-8 ${
          isActive ? 'text-primary' : 'text-slate-400'
        }`} />
        {isActive && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </p>
        {connectionCount !== undefined && (
          <Badge variant="secondary" className="text-xs mt-1">
            {connectionCount} connections
          </Badge>
        )}
      </div>
    </div>
  )
}

function TrafficPipe({ 
  particles, 
  direction, 
  isActive,
  width = 300 
}: { 
  particles: FlowParticle[]
  direction: 'inbound' | 'outbound'
  isActive: boolean
  width?: number
}) {
  return (
    <div className="relative flex items-center">
      {/* Pipe */}
      <div className={`relative h-2 rounded-full transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500' 
          : 'bg-slate-200 dark:bg-slate-700'
      }`} style={{ width: `${width}px` }}>
        
        {/* Flow indicator line */}
        {isActive && (
          <div className={`absolute top-0 h-full w-full rounded-full ${
            direction === 'inbound'
              ? 'bg-gradient-to-r from-blue-500/30 to-transparent'
              : 'bg-gradient-to-l from-orange-500/30 to-transparent'
          } animate-pulse`} />
        )}

        {/* Particles */}
        {isActive && particles.map((particle) => (
          <AnimatedParticle 
            key={particle.id} 
            particle={particle} 
            containerWidth={width}
          />
        ))}
      </div>

      {/* Direction arrow */}
      <div className={`ml-2 ${isActive ? 'text-primary' : 'text-slate-400'}`}>
        {direction === 'inbound' ? (
          <ArrowLeft className="w-4 h-4" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
      </div>
    </div>
  )
}

export function TrafficFlowVisualization({ 
  sessions, 
  isConnected 
}: TrafficFlowVisualizationProps) {
  const [particles, setParticles] = useState<FlowParticle[]>([])
  const [metrics, setMetrics] = useState<TrafficMetrics>({
    messagesPerSecond: 0,
    bytesPerSecond: 0,
    activeConnections: 0
  })

  const sessionArray = Array.from(sessions.values())
  const activeConnections = sessionArray.length
  const isActive = isConnected && activeConnections > 0

  // Calculate metrics
  useEffect(() => {
    const totalMessages = sessionArray.reduce((sum, session) => 
      sum + session.metrics.messagesIn + session.metrics.messagesOut, 0
    )
    
    const totalBytes = sessionArray.reduce((sum, session) => 
      sum + session.metrics.bytesIn + session.metrics.bytesOut, 0
    )

    setMetrics({
      messagesPerSecond: totalMessages, // Simplified - would calculate rate in real app
      bytesPerSecond: totalBytes,
      activeConnections
    })
  }, [sessionArray, activeConnections])

  // Generate particles based on traffic
  useEffect(() => {
    if (!isActive) {
      setParticles([])
      return
    }

    const interval = setInterval(() => {
      setParticles(prevParticles => {
        // Remove particles that have completed their journey
        const activeParticles = prevParticles.filter(p => 
          (p.direction === 'inbound' && p.position > 0) ||
          (p.direction === 'outbound' && p.position < 300)
        )

        // Move existing particles
        const movedParticles = activeParticles.map(p => ({
          ...p,
          position: p.direction === 'inbound' 
            ? Math.max(0, p.position - p.speed)
            : Math.min(300, p.position + p.speed)
        }))

        // Generate new particles based on activity
        const newParticles: FlowParticle[] = []
        
        // Inbound particles
        if (Math.random() < Math.min(0.8, activeConnections * 0.1)) {
          newParticles.push({
            id: `in_${Date.now()}_${Math.random()}`,
            direction: 'inbound',
            size: Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'medium' : 'small',
            position: 300,
            speed: 2 + Math.random() * 3
          })
        }

        // Outbound particles
        if (Math.random() < Math.min(0.8, activeConnections * 0.1)) {
          newParticles.push({
            id: `out_${Date.now()}_${Math.random()}`,
            direction: 'outbound',
            size: Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'medium' : 'small',
            position: 0,
            speed: 2 + Math.random() * 3
          })
        }

        return [...movedParticles, ...newParticles]
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isActive, activeConnections])

  const inboundParticles = particles.filter(p => p.direction === 'inbound')
  const outboundParticles = particles.filter(p => p.direction === 'outbound')

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Live Traffic Flow
          </h3>
          <div className="flex items-center space-x-2">
            <Activity className={`w-4 h-4 ${isActive ? 'text-green-500' : 'text-slate-400'}`} />
            <span className={`text-sm ${isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Flow Visualization */}
        <div className="space-y-8">
          {/* Inbound Flow */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Inbound Traffic
              </h4>
              <Badge variant="outline" className="text-xs">
                {sessionArray.reduce((sum, s) => sum + s.metrics.messagesIn, 0)} messages
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <NetworkNode 
                type="client" 
                label="Clients" 
                isActive={isActive}
                connectionCount={activeConnections}
              />
              <TrafficPipe 
                particles={inboundParticles} 
                direction="inbound" 
                isActive={isActive}
                width={300}
              />
              <NetworkNode 
                type="proxy" 
                label="Proxy" 
                isActive={isActive}
              />
            </div>
          </div>

          {/* Outbound Flow */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Outbound Traffic
              </h4>
              <Badge variant="outline" className="text-xs">
                {sessionArray.reduce((sum, s) => sum + s.metrics.messagesOut, 0)} messages
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <NetworkNode 
                type="proxy" 
                label="Proxy" 
                isActive={isActive}
              />
              <TrafficPipe 
                particles={outboundParticles} 
                direction="outbound" 
                isActive={isActive}
                width={300}
              />
              <NetworkNode 
                type="server" 
                label="Target Servers" 
                isActive={isActive}
              />
            </div>
          </div>
        </div>

        {/* Traffic Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {sessionArray.reduce((sum, s) => sum + s.metrics.messagesIn, 0)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Inbound Messages</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {activeConnections}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Active Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {sessionArray.reduce((sum, s) => sum + s.metrics.messagesOut, 0)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Outbound Messages</p>
          </div>
        </div>

        {/* Status Indicator */}
        {!isConnected && (
          <div className="text-center py-4">
            <div className="inline-flex items-center space-x-2 text-slate-500 dark:text-slate-400">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Connect to WebSocket to view live traffic</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}