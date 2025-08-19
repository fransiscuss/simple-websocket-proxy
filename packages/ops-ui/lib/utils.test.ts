import { describe, it, expect } from 'vitest'
import { cn, formatBytes, formatNumber, formatPercentage, formatDuration, getStatusColor } from './utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
    expect(cn('px-2 py-1', 'px-3')).toBe('py-1 px-3')
  })

  it('handles conditional classes', () => {
    expect(cn('px-2', false && 'py-1', 'text-red')).toBe('px-2 text-red')
    expect(cn('px-2', true && 'py-1', 'text-red')).toBe('px-2 py-1 text-red')
  })
})

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1234567)).toBe('1.18 MB')
  })

  it('handles custom decimal places', () => {
    expect(formatBytes(1234567, 3)).toBe('1.177 MB')
    expect(formatBytes(1234567, 0)).toBe('1 MB')
  })

  it('handles negative decimals', () => {
    expect(formatBytes(1234567, -1)).toBe('1 MB')
  })
})

describe('formatNumber', () => {
  it('formats numbers with locale-specific formatting', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
  })
})

describe('formatPercentage', () => {
  it('calculates percentages correctly', () => {
    expect(formatPercentage(25, 100)).toBe('25.0%')
    expect(formatPercentage(33, 100)).toBe('33.0%')
    expect(formatPercentage(1, 3)).toBe('33.3%')
  })

  it('handles zero total', () => {
    expect(formatPercentage(10, 0)).toBe('0%')
  })

  it('handles zero value', () => {
    expect(formatPercentage(0, 100)).toBe('0.0%')
  })
})

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(59)).toBe('59s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m 0s')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(3599)).toBe('59m 59s')
  })

  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3600)).toBe('1h 0m 0s')
    expect(formatDuration(3661)).toBe('1h 1m 1s')
    expect(formatDuration(7890)).toBe('2h 11m 30s')
  })
})

describe('getStatusColor', () => {
  it('returns success color for positive statuses', () => {
    expect(getStatusColor('active')).toBe('text-status-success')
    expect(getStatusColor('connected')).toBe('text-status-success')
    expect(getStatusColor('healthy')).toBe('text-status-success')
    expect(getStatusColor('online')).toBe('text-status-success')
  })

  it('returns warning color for warning statuses', () => {
    expect(getStatusColor('warning')).toBe('text-status-warning')
    expect(getStatusColor('degraded')).toBe('text-status-warning')
  })

  it('returns error color for negative statuses', () => {
    expect(getStatusColor('error')).toBe('text-status-error')
    expect(getStatusColor('failed')).toBe('text-status-error')
    expect(getStatusColor('disconnected')).toBe('text-status-error')
    expect(getStatusColor('offline')).toBe('text-status-error')
  })

  it('returns info color for info statuses', () => {
    expect(getStatusColor('info')).toBe('text-status-info')
    expect(getStatusColor('pending')).toBe('text-status-info')
  })

  it('returns default color for unknown statuses', () => {
    expect(getStatusColor('unknown')).toBe('text-muted-foreground')
    expect(getStatusColor('random')).toBe('text-muted-foreground')
  })

  it('handles case insensitivity', () => {
    expect(getStatusColor('ACTIVE')).toBe('text-status-success')
    expect(getStatusColor('Active')).toBe('text-status-success')
    expect(getStatusColor('ERROR')).toBe('text-status-error')
  })
})