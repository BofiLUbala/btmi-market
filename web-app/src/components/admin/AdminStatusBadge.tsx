import React from 'react'

export interface AdminStatusBadgeProps {
  status?: string
  ok?: boolean
  label?: string
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
  style?: React.CSSProperties
}

interface StatusStyle {
  bg: string
  text: string
  dot: string
}

const STATUS_MAP: Record<string, StatusStyle> = {
  // Green / Healthy / Success
  HEALTHY:        { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  UP_TO_DATE:     { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  OK:             { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  ACTIVE:         { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  IN_STOCK:       { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  PUBLISHED:      { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  RESOLVED:       { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  APPLIED:        { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  PAID:           { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  CONFIRMED:      { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  APPROVED:       { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  DELIVERED:      { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  COMPLETED:      { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },

  // Orange / Amber / Warning / Degraded / Low stock
  DEGRADED:       { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
  WARNING:        { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
  LOW_STOCK:      { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
  PENDING:        { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
  PENDING_REVIEW: { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
  WAITING:        { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
  QUEUED:         { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },

  // Red / Danger / Down / Critical / Out of stock / Suspended
  DOWN:           { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  CRITICAL:       { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  HIGH:           { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  OUT_OF_STOCK:   { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  SUSPENDED:      { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  CANCELLED:      { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  REJECTED:       { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  REFUNDED:       { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
  FAILED:         { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },

  // Blue / Sky / Info / New / Reserved / Escrow
  INFO:           { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },
  NEW:            { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },
  RESERVED:       { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },
  ESCROW:         { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },
  IN_TRANSIT:     { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },

  // Purple / Indigo / Acknowledged / Unknown
  ACKNOWLEDGED:   { bg: '#1e1b4b', text: '#a5b4fc', dot: '#a5b4fc' },
  UNKNOWN:        { bg: '#1e1b4b', text: '#a5b4fc', dot: '#a5b4fc' },

  // Neutral / Gray / Muted / Draft / Archived / Not configured
  DRAFT:          { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
  ARCHIVED:       { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
  NOT_DEPLOYED:   { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
  NOT_CONFIGURED: { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
  IGNORED:        { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
  DISABLED:       { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' }
}

const DEFAULT_STYLE: StatusStyle = { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' }

/**
 * Shared status indicator badge across all 4 Admin Control Center dashboards.
 * Provides unified semantic tokenized colors, status dot, and consistent sizing.
 */
export function AdminStatusBadge({
  status,
  ok,
  label,
  dot = true,
  size = 'md',
  className = '',
  style = {}
}: AdminStatusBadgeProps) {
  // If `ok` boolean is explicitly provided, map to HEALTHY / DOWN
  let resolvedStatus = status ? status.toUpperCase() : ''
  if (typeof ok === 'boolean') {
    resolvedStatus = ok ? 'HEALTHY' : 'DOWN'
  }

  const s = STATUS_MAP[resolvedStatus] ?? DEFAULT_STYLE
  const displayText = label ?? (status ? status.replace(/_/g, ' ') : resolvedStatus)

  const padding = size === 'sm' ? '1px 7px' : '2px 9px'
  const fontSize = size === 'sm' ? 10 : 11
  const dotSize = size === 'sm' ? 5 : 6

  return (
    <span
      className={`admin-status-badge ${className}`}
      style={{
        background: s.bg,
        color: s.text,
        padding,
        borderRadius: 20,
        fontSize,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        ...style
      }}
    >
      {dot && (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: s.dot,
            display: 'inline-block',
            flexShrink: 0
          }}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  )
}

export default AdminStatusBadge
