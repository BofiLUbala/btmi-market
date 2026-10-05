import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { get } from '../api/client'
import { formatMoney } from '../lib/money'
import { useOrderEvents } from '../lib/orderEvents'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
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
  const { t } = useI18n()
  const [tariff, setTariff] = useState<DeliveryTariff | null>(null)
  const [version, setVersion] = useState(0)
  // Finance edits are pushed live.
  useOrderEvents((event) => { if (event.kind === 'tariff' || event.kind === 'resync') setVersion((v) => v + 1) })
  useEffect(() => {
    let cancelled = false
    get<DeliveryTariff>('/config/delivery-fees').then((data) => { if (!cancelled) setTariff(data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [version])
  if (!tariff) return null
  const extras = [
    ...tariff.zones.map((z) => `${z.city_name} ${formatMoney(z.fee, tariff.currency)}`),
    tariff.free_delivery_threshold != null ? t('deliveryTariffNote.freeFrom', { amount: formatMoney(tariff.free_delivery_threshold, tariff.currency) }) : ''
  ].filter(Boolean)
  return (
    <View accessibilityRole="text" style={[styles.box, { backgroundColor: c.infoSoft, borderColor: c.info }]}>
      <Text style={[styles.title, { color: c.info }]}>{t('deliveryTariffNote.title', { amount: formatMoney(tariff.default_fee, tariff.currency) })}</Text>
      {extras.length ? <Text style={[styles.text, { color: c.info }]}>{extras.join(' · ')}</Text> : null}
      <Text style={[styles.text, { color: c.info }]}>{t('deliveryTariffNote.body')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.sm, padding: 10, gap: 4, marginVertical: 6 },
  title: { fontWeight: '700', fontSize: 14 },
  text: { fontSize: 13, lineHeight: 18 }
})
