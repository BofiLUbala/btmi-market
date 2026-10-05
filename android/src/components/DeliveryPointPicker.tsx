import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import * as Location from 'expo-location'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button } from './ui'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

export interface DeliveryPoint { latitude: number; longitude: number; accuracy?: number | null }

/** A point this imprecise would put the destination on the wrong street. */
const MAX_ACCURACY_M = 200

/**
 * Optional exact delivery point for the courier's map. The written address is
 * always enough. The phone is asked for the position (foreground, once) only
 * when the buyer taps "Utiliser ma position"; never in the background.
 */
export function DeliveryPointPicker({ value, onChange }: { value: DeliveryPoint | null; onChange: (p: DeliveryPoint | null) => void }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function locate() {
    setBusy(true)
    setMessage('')
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) { setMessage(t('deliveryPoint.denied')); return }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const accuracy = pos.coords.accuracy ?? null
      if (accuracy != null && accuracy > MAX_ACCURACY_M) {
        setMessage(t('deliveryPoint.imprecise', { meters: Math.round(accuracy) }))
        return
      }
      onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy })
    } catch {
      setMessage(t('deliveryPoint.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.tile}><Ionicons name="navigate" size={17} color={colors.green} /></View>
        <View style={styles.headText}>
          <Text style={styles.title}>{t('deliveryPoint.title')}</Text>
          <Text style={styles.muted}>{t('deliveryPoint.hint')}</Text>
        </View>
      </View>
      {value ? (
        <View style={styles.row}>
          <Text style={styles.ok}>📍 {value.accuracy != null ? t('deliveryPoint.addedWithAccuracy', { meters: Math.round(value.accuracy) }) : t('deliveryPoint.added')}</Text>
          <Button variant="outline" dense title={t('deliveryPoint.remove')} onPress={() => onChange(null)} />
        </View>
      ) : (
        <Button variant="outline" dense title={`📍 ${busy ? t('deliveryPoint.locating') : t('deliveryPoint.useMyLocation')}`} loading={busy} onPress={() => void locate()} />
      )}
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  box: { borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: c.white, padding: 12, gap: spacing.sm, marginVertical: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tile: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 2 },
  title: { color: c.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: c.muted, fontSize: 12.5, lineHeight: 17 },
  ok: { color: c.ink, flex: 1, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 10, borderRadius: radius.sm, backgroundColor: c.successSoft },
})
