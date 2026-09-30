import { useState } from 'react'
import { useT } from '@/store/i18n'
import { Button } from '@/components/ui/Button'

export interface DeliveryPoint {
  latitude: number
  longitude: number
  accuracy?: number | null
}

/** A point this imprecise would put the destination marker on the wrong street. */
export const MAX_DELIVERY_POINT_ACCURACY_M = 200

/**
 * Optional exact delivery point for the courier's map. The text address is
 * always enough; the browser is asked for the position only when the buyer
 * clicks "Utiliser ma position", never silently.
 */
export function DeliveryPointPicker({ value, onChange }: { value: DeliveryPoint | null; onChange: (p: DeliveryPoint | null) => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function locate() {
    if (!('geolocation' in navigator)) {
      setMessage(t('deliveryPoint.unsupported'))
      return
    }
    setBusy(true)
    setMessage('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        if (pos.coords.accuracy > MAX_DELIVERY_POINT_ACCURACY_M) {
          setMessage(t('deliveryPoint.imprecise', { meters: Math.round(pos.coords.accuracy) }))
          return
        }
        onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy })
      },
      (err) => {
        setBusy(false)
        setMessage(err.code === err.PERMISSION_DENIED ? t('deliveryPoint.denied') : t('deliveryPoint.failed'))
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }

  return (
    <div className="card" style={{ padding: 12, margin: '8px 0 12px' }} data-testid="delivery-point-picker">
      <div className="small bold">{t('deliveryPoint.title')}</div>
      <p className="small muted mt-0">{t('deliveryPoint.hint')}</p>
      {value ? (
        <div className="row-between small" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span>📍 {value.accuracy != null ? t('deliveryPoint.addedWithAccuracy', { meters: Math.round(value.accuracy) }) : t('deliveryPoint.added')}</span>
          <button type="button" className="delivery-custom-link" onClick={() => onChange(null)}>{t('deliveryPoint.remove')}</button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={locate} loading={busy}>
          📍 {busy ? t('deliveryPoint.locating') : t('deliveryPoint.useMyLocation')}
        </Button>
      )}
      {message && <p className="small" style={{ color: 'var(--color-muted)', marginBottom: 0 }}>{message}</p>}
    </div>
  )
}
