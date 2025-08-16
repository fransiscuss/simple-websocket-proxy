'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  RefreshCw,
  Users,
  X
} from 'lucide-react'
import { SessionInfo } from '@/lib/types/traffic'
import { SessionTile } from './session-tile'

interface SessionGridProps {
  sessions: Map<string, SessionInfo>
  onViewDetails: (sessionId: string) => void
  onKillSession: (sessionId: string) => void
  onKillAllSessions: () => void
}

type SortField = 'startedAt' | 'lastActivity' | 'messages' | 'bytes' | 'latency'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'closing' | 'error'

export function SessionGrid({ 
  sessions, 
  onViewDetails, 
  onKillSession, 
  onKillAllSessions 
}: SessionGridProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('startedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sessionArray = Array.from(sessions.values())

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessionArray

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(session =>
        session.id.toLowerCase().includes(term) ||
        session.clientIp.toLowerCase().includes(term) ||
        session.targetEndpoint.toLowerCase().includes(term) ||
        session.clientEndpoint.toLowerCase().includes(term) ||
        session.tags?.some(tag => tag.toLowerCase().includes(term))
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortField) {
        case 'startedAt':
          aValue = new Date(a.startedAt).getTime()
          bValue = new Date(b.startedAt).getTime()
          break
        case 'lastActivity':
          aValue = new Date(a.metrics.lastActivityAt).getTime()
          bValue = new Date(b.metrics.lastActivityAt).getTime()
          break
        case 'messages':
          aValue = a.metrics.messagesIn + a.metrics.messagesOut
          bValue = b.metrics.messagesIn + b.metrics.messagesOut
          break
        case 'bytes':
          aValue = a.metrics.bytesIn + a.metrics.bytesOut
          bValue = b.metrics.bytesIn + b.metrics.bytesOut
          break
        case 'latency':
          aValue = a.metrics.latencyMs
          bValue = b.metrics.latencyMs
          break
        default:
          return 0
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [sessionArray, searchTerm, statusFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const statusCounts = useMemo(() => {
    return sessionArray.reduce((counts, session) => {
      counts[session.status] = (counts[session.status] || 0) + 1
      return counts
    }, {} as Record<string, number>)
  }, [sessionArray])

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-8 px-2 text-xs"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? 
          <SortAsc className="ml-1 h-3 w-3" /> : 
          <SortDesc className="ml-1 h-3 w-3" />
      )}
    </Button>
  )

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Active Sessions
          </h3>
          <Badge variant="secondary">
            <Users className="w-3 h-3 mr-1" />
            {filteredAndSortedSessions.length} of {sessionArray.length}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onKillAllSessions}
            className="text-red-600 hover:text-red-700"
            disabled={sessionArray.length === 0}
          >
            <X className="w-4 h-4 mr-1" />
            Kill All
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search sessions by ID, IP, endpoint, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <div className="flex space-x-1">
              {['all', 'active', 'closing', 'error'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status as StatusFilter)}
                  className="text-xs"
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== 'all' && statusCounts[status] && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {statusCounts[status]}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-600 dark:text-slate-400 mr-2">Sort by:</span>
          <SortButton field="startedAt">Started</SortButton>
          <SortButton field="lastActivity">Activity</SortButton>
          <SortButton field="messages">Messages</SortButton>
          <SortButton field="bytes">Data</SortButton>
          <SortButton field="latency">Latency</SortButton>
        </div>
      </Card>

      {/* Sessions Grid */}
      {filteredAndSortedSessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedSessions.map((session) => (
            <SessionTile
              key={session.id}
              session={session}
              onViewDetails={onViewDetails}
              onKillSession={onKillSession}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center space-y-3">
            <Users className="h-12 w-12 text-slate-400" />
            <div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                No sessions found
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters or search terms'
                  : 'No active WebSocket sessions at the moment'
                }
              </p>
            </div>
            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                }}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}