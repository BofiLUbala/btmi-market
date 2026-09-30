import { useMemo } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { Button } from './ui'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import { useCourierTracking } from '../lib/courierTracking'

/**
 * Tells the courier whether their position is being shared for this mission.
 * Informational only: nothing here gates a delivery step.
 */
export function CourierTrackingBanner({ orderId }: { orderId: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { state, orderId: tracked } = useCourierTracking()

  if (state === 'ended') {
    return <Text style={styles.muted}>{t('courierGps.ended')}</Text>
  }
  if (tracked !== orderId) return null
  if (state === 'active') return <View style={[styles.box, styles.ok]}><Text style={styles.okText}>🟢 {t('courierGps.active')}</Text></View>
  if (state === 'pending') return <View style={[styles.box, styles.warn]}><Text style={styles.warnText}>⏳ {t('courierGps.pending')}</Text></View>
  if (state === 'denied') {
    return (
      <View style={[styles.box, styles.warn]}>
        <Text style={styles.warnText}>{t('courierGps.denied')}</Text>
        <Button variant="outline" title={t('courierGps.openSettings')} onPress={() => void Linking.openSettings()} />
      </View>
    )
  }
  return null
}

const makeStyles = (c: Colors) => StyleSheet.create({
  box: { borderRadius: radius.sm, padding: spacing.sm, gap: spacing.xs, borderWidth: 1 },
  ok: { borderColor: c.success, backgroundColor: c.successSoft },
  okText: { color: c.success, fontWeight: '800' },
  warn: { borderColor: c.warning, backgroundColor: c.warningSoft },
  warnText: { color: c.ink, fontWeight: '700' },
  muted: { color: c.muted },
})
