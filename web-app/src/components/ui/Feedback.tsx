export function Spinner({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return <span className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} aria-label="Loading" />
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="success-box" role="status">
      <span>{message}</span>
    </div>
  )
}

export function EmptyState({
  icon = '🛍️',
  title,
  description,
  action
}: {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p className="muted mt-0">{description}</p>}
      {action}
    </div>
  )
}