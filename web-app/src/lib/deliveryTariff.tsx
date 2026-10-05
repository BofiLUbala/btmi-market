import { useEffect, useState } from 'react'
import { get } from '@/api/client'
import { formatMoney } from '@/lib/format'
import { useOrderEvents } from '@/lib/orderEvents'
import { useT } from '@/store/i18n'

/** The TBK delivery tariff set by Finance in the Control Center. */
export type DeliveryTariff = {
  default_fee: number
  currency: string
  free_delivery_threshold: number | null
  zones: { city_id: string; city_name: string; province_name: string; fee: number }[]
}

export function useDeliveryTariff(): DeliveryTariff | null {
  const [tariff, setTariff] = useState<DeliveryTariff | null>(null)
  const [version, setVersion] = useState(0)
  // Finance edits are pushed live; a slow poll covers signed-out visitors.
  useOrderEvents((event) => { if (event.kind === 'tariff' || event.kind === 'resync') setVersion((v) => v + 1) })
  useEffect(() => {
    const timer = window.setInterval(() => setVersion((v) => v + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    let cancelled = false
    get<DeliveryTariff>('/config/delivery-fees').then((t) => { if (!cancelled) setTariff(t) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [version])
  return tariff
}

/** Read-only tariff for sellers: TBK sets and collects delivery fees, so they
 *  never enter the seller's revenue or the commission base. */
export function DeliveryTariffNote() {
  const tariff = useDeliveryTariff()
  const t = useT()
  if (!tariff) return null
  return (
    <div className="delivery-tariff-note" role="note">
      <strong>{t('libDeliveryTariff.perOrder', { fee: formatMoney(tariff.default_fee, tariff.currency) })}</strong>
      {tariff.zones.length > 0 && (
        <span> · {tariff.zones.map((z) => `${z.city_name} ${formatMoney(z.fee, tariff.currency)}`).join(' · ')}</span>
      )}
      {tariff.free_delivery_threshold != null && (
        <span> · {t('libDeliveryTariff.freeFrom', { amount: formatMoney(tariff.free_delivery_threshold, tariff.currency) })}</span>
      )}
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        {t('libDeliveryTariff.note')}
      </p>
    </div>
  )
}
