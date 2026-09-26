import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Button, ErrorState, Loading } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import type { Colors } from '../../src/theme'

// Port of web-app/src/pages/buyer/PointsPage.tsx (/points): balance banner,
// "how it works" and "redeem" cards, then the link to the full history.
export default function PointsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const account = useQuery({ queryKey: ['buyer', 'points'], queryFn: buyerApi.points })

  if (account.isLoading) return <Loading label={t('points.loading')} />
  if (account.isError) return <ErrorState message={account.error instanceof Error ? account.error.message : t('points.loadFailed')} retry={() => void account.refetch()} />
  const points = account.data ?? { available_points: 0, reserved_points: 0, lifetime_points: 0, level: 'BRONZE' }

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.h1}>{t('points.myPoints')}</Text>
    <View style={styles.payBig}>
      <Text style={styles.small}>{t('points.currentBalance')}</Text>
      <Text style={styles.amount}>{points.available_points.toLocaleString()} pts</Text>
      <Text style={styles.payNote}>{t('points.summary', { lifetime: points.lifetime_points.toLocaleString(), reserved: points.reserved_points.toLocaleString(), level: points.level })}</Text>
      {points.available_points === 0 ? <Text style={styles.small}>{t('points.earnByPurchase')}</Text> : null}
    </View>

    <View style={styles.card}>
      <Text style={styles.h2}>{t('points.howItWorks')}</Text>
      {(['points.howEarn', 'points.howRedeem', 'points.howDelivery', 'points.howLevels'] as const).map((key) => (
        <View key={key} style={styles.bulletRow}><Text style={styles.small}>•</Text><Text style={[styles.small, styles.flex1]}>{t(key)}</Text></View>
      ))}
    </View>
    <View style={styles.card}>
      <Text style={styles.h2}>{t('points.redeem')}</Text>
      <Text style={styles.small}>{t('points.redeemNote')}</Text>
      <Button title={t('points.startShopping')} onPress={() => router.push('/(buyer)')} style={{ marginTop: 12 }} />
    </View>

    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{t('points.history')}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/points/history')}><Text style={styles.sectionLink}>{t('points.fullHistory')} →</Text></Pressable>
    </View>
  </ScrollView>
}

// web: .pay-big, .pay-note, .card, .section-head, .section-link
const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48, gap: 16 },
  flex1: { flex: 1 },
  h1: { fontSize: 28, fontWeight: '700', color: c.ink, marginBottom: -4 },
  h2: { fontSize: 17.6, fontWeight: '700', color: c.ink, marginBottom: 8 },
  small: { color: c.muted, fontSize: 14, lineHeight: 20 },
  payBig: { alignItems: 'center', padding: 24, borderRadius: 16, backgroundColor: c.goldSoft, borderWidth: 1, borderStyle: 'dashed', borderColor: c.goldDark, gap: 4 },
  amount: { fontSize: 40, fontWeight: '900', color: c.green },
  payNote: { fontSize: 12, color: c.muted, textAlign: 'center' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: c.ink },
  sectionLink: { fontSize: 14, fontWeight: '600', color: c.green },
})
