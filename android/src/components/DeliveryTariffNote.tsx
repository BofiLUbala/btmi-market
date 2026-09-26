import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { get } from '../api/client'
import { formatMoney } from '../lib/money'
import { useColors } from '../store/theme'
import { radius } from '../theme'

type DeliveryTariff = {
  default_fee: number
  currency: string
  free_delivery_threshold: number | null
  zones: { city_id: string; city_name: string; fee: number }[]
}

/** The TBK delivery tariff Finance sets in the Control Center, read-only for
 *  sellers: TBK collects it, so it is outside their revenue and commission. */
export function DeliveryTariffNote() {
  const c = useColors()
  const [tariff, setTariff] = useState<DeliveryTariff | null>(null)
  useEffect(() => {
    let cancelled = false
    get<DeliveryTariff>('/config/delivery-fees').then((t) => { if (!cancelled) setTariff(t) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])
  if (!tariff) return null
  const extras = [
    ...tariff.zones.map((z) => `${z.city_name} ${formatMoney(z.fee, tariff.currency)}`),
    tariff.free_delivery_threshold != null ? `offerte dès ${formatMoney(tariff.free_delivery_threshold, tariff.currency)} d’achat` : ''
  ].filter(Boolean)
  return (
    <View accessibilityRole="text" style={[styles.box, { backgroundColor: c.infoSoft, borderColor: c.info }]}>
      <Text style={[styles.title, { color: c.info }]}>Livraison TBK : {formatMoney(tariff.default_fee, tariff.currency)} par commande</Text>
      {extras.length ? <Text style={[styles.text, { color: c.info }]}>{extras.join(' · ')}</Text> : null}
      <Text style={[styles.text, { color: c.info }]}>Tarif fixé par TBK et payé par l’acheteur. Il n’entre ni dans votre revenu ni dans l’assiette de commission.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.sm, padding: 10, gap: 4, marginVertical: 6 },
  title: { fontWeight: '700', fontSize: 14 },
  text: { fontSize: 13, lineHeight: 18 }
})
