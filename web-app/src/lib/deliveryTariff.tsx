import { useEffect, useState } from 'react'
import { get } from '@/api/client'
import { formatMoney } from '@/lib/format'

/** The TBK delivery tariff set by Finance in the Control Center. */
export type DeliveryTariff = {
  default_fee: number
  currency: string
  free_delivery_threshold: number | null
  zones: { city_id: string; city_name: string; province_name: string; fee: number }[]
}

export function useDeliveryTariff(): DeliveryTariff | null {
  const [tariff, setTariff] = useState<DeliveryTariff | null>(null)
  useEffect(() => {
    let cancelled = false
    get<DeliveryTariff>('/config/delivery-fees').then((t) => { if (!cancelled) setTariff(t) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])
  return tariff
}

/** Read-only tariff for sellers: TBK sets and collects delivery fees, so they
 *  never enter the seller's revenue or the commission base. */
export function DeliveryTariffNote() {
  const tariff = useDeliveryTariff()
  if (!tariff) return null
  return (
    <div className="delivery-tariff-note" role="note">
      <strong>Livraison TBK : {formatMoney(tariff.default_fee, tariff.currency)} par commande</strong>
      {tariff.zones.length > 0 && (
        <span> · {tariff.zones.map((z) => `${z.city_name} ${formatMoney(z.fee, tariff.currency)}`).join(' · ')}</span>
      )}
      {tariff.free_delivery_threshold != null && (
        <span> · offerte dès {formatMoney(tariff.free_delivery_threshold, tariff.currency)} d’achat</span>
      )}
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        Tarif fixé par TBK et payé par l’acheteur. Il revient à TBK : il n’entre ni dans votre revenu ni dans l’assiette de commission.
      </p>
    </div>
  )
}
