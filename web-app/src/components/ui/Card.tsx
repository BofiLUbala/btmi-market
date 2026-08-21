import type { ReactNode, CSSProperties } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

export function Card({ children, className = '', style, onClick }: CardProps) {
  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  )
}

export function CardGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-grid ${className}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-header ${className}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      {children}
    </div>
  )
}