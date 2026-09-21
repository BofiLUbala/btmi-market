import { useCallback, useEffect, useState } from 'react'
import type { OrderItemQR } from '@/api/types'
import { QRPanel, type LabelField } from '@/components/qr/QRPanel'
import { orderItemQRErrorKey } from '@/lib/qrErrors'
import { useI18n } from '@/store/i18n'

/**
 * The per-order-item QR of one order line, with its four states: loading,
 * success, empty and error. There is no silent blank area — a line that has no
 * QR says so.
 *
 * Both the seller and the buyer render this component, but each passes its own
 * role-specific fetch and image path: the responses are not interchangeable and
 * neither view is built from the other's data. `fields` are the identity lines
 * that also reach the printed label, so callers pass only what their own role is
 * allowed to see (never buyer contact or address details for a seller).
 */
export function OrderItemQRSection({
  load,
  imagePath,
  instruction,
  fields = [],
  title,
}: {
  load: () => Promise<OrderItemQR>
  imagePath: string
  instruction: string
  fields?: LabelField[]
  title?: string
}) {
  const { t } = useI18n()
  const [qr, setQr] = useState<OrderItemQR | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const fetchQR = useCallback(
    (cancelled?: () => boolean) => {
      setState('loading')
      setMessage('')
      return load()
        .then((value) => {
          if (cancelled?.()) return
          if (!value?.reference) {
            setState('empty')
            return
          }
          setQr(value)
          setState('ready')
        })
        .catch((error: unknown) => {
          if (cancelled?.()) return
          setMessage(t(orderItemQRErrorKey(error)))
          setState('error')
        })
    },
    [load, t]
  )

  useEffect(() => {
    let cancelled = false
    void fetchQR(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [fetchQR])

  if (state === 'loading') {
    return (
      <div className="card small muted" style={{ marginTop: 12 }} aria-busy="true">
        {t('itemQr.loading')}
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="card small muted" style={{ marginTop: 12 }}>
        {t('itemQr.empty')}
      </div>
    )
  }

  if (state === 'error' || !qr) {
    return (
      <div className="card small" style={{ marginTop: 12 }} role="alert">
        <div>{message || t('itemQr.error.generic')}</div>
        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => void fetchQR()}>
          {t('itemQr.retry')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <QRPanel qr={qr} imagePath={imagePath} title={title ?? t('itemQr.title')} fields={fields} />
      <p className="small muted" style={{ marginTop: 6, textAlign: 'center' }}>
        {instruction}
      </p>
    </div>
  )
}
