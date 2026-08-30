import { useI18n } from '@/store/i18n'

export function Spinner({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { t } = useI18n()
  return <span className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} aria-label={t('common.loading')} />
}

/** `label` stays overridable so callers can name what is loading; when omitted
 *  it falls back to the translated generic message. */
export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="loading-block">
      <Spinner size="lg" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="error-box" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          {t('common.retry')}
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
