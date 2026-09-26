import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { ErrorState, Loading } from '../../src/components/ui'
import { formatDateTime } from '../../src/lib/format'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import type { Colors } from '../../src/theme'
import type { PointTransaction } from '../../src/types'

// Port of web-app/src/pages/buyer/PointsHistoryPage.tsx (/points/history):
// level / balance / lifetime card with progress to the next level, then every
// point transaction, credits in green and debits in red.
export default function PointsHistoryScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const history = useQuery({ queryKey: ['buyer', 'points', 'history'], queryFn: buyerApi.pointsHistory })

  if (history.isLoading) return <Loading label={t('points.loadingHistory')} />
  if (history.isError || !history.data) return <ErrorState message={history.error instanceof Error ? history.error.message : t('points.noData')} retry={() => void history.refetch()} />

  const data = history.data
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  const next = data.buyer_next_level
  const progress = next ? Math.min(100, Math.max(0, next.progress_to_next_level_percent)) : 0

  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="link" onPress={() => router.push('/points')}><Text style={styles.sectionLink}>← {t('points.link')}</Text></Pressable>
    <Text style={styles.h1}>{t('points.history')}</Text>

    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View><Text style={styles.small}>{t('points.level')}</Text><Text style={styles.bold}>{data.level_name}</Text></View>
        <View><Text style={styles.small}>{t('points.balance')}</Text><Text style={styles.bold}>{data.account.current_points.toLocaleString()}</Text></View>
        <View><Text style={styles.small}>{t('points.lifetime')}</Text><Text style={styles.bold}>{data.account.lifetime_points.toLocaleString()}</Text></View>
      </View>
      {next ? <View style={{ marginTop: 12 }}>
        <Text style={styles.small}>
          {t('points.nextLevel')} <Text style={styles.strong}>{next.name}</Text> — {t('points.nextLevelInfo', { pct: next.discount_percent })},
          {next.free_delivery ? ` ${t('points.freeDelivery')}` : ` ${t('points.deliveryDiscountOff', { pct: next.delivery_discount_percent })}`}
        </Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.time}>{t('points.progress', { pct: Math.round(next.progress_to_next_level_percent) })}</Text>
      </View> : null}
    </View>

    {transactions.length === 0 ? <View style={styles.empty}>
      <Text style={styles.emptyIcon}>⭐</Text>
      <Text style={styles.emptyTitle}>{t('points.noTransactionsTitle')}</Text>
      <Text style={[styles.small, { textAlign: 'center' }]}>{t('points.noTransactionsDesc')}</Text>
    </View> : <View style={styles.card}>
      {transactions.map((tr) => <TransactionRow key={tr.id} tr={tr} styles={styles} colors={colors} />)}
    </View>}
  </ScrollView>
}

function TransactionRow({ tr, styles, colors }: { tr: PointTransaction; styles: ReturnType<typeof makeStyles>; colors: Colors }) {
  const { t } = useI18n()
  const credit = tr.type === 'CREDIT'
  return <View style={styles.txRow}>
    <View style={styles.flex1}>
      <Text style={styles.txTitle}>{tr.reference_type.replace(/_/g, ' ').toLowerCase()}</Text>
      <Text style={styles.time}>{t('points.balanceChange', { previous: tr.previous_points.toLocaleString(), latest: tr.new_points.toLocaleString() })}</Text>
      <Text style={styles.time}>{formatDateTime(tr.created_at)}</Text>
    </View>
    <Text style={[styles.bold, { color: credit ? colors.success : colors.danger }]}>{credit ? '+' : ''}{tr.points_change.toLocaleString()} pts</Text>
  </View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48, gap: 12 },
  flex1: { flex: 1 },
  h1: { fontSize: 28, fontWeight: '700', color: c.ink, marginBottom: 4 },
  small: { color: c.muted, fontSize: 14 },
  bold: { color: c.ink, fontSize: 16, fontWeight: '700' },
  strong: { fontWeight: '700', color: c.ink },
  time: { color: c.muted, fontSize: 12, marginTop: 2 },
  sectionLink: { fontSize: 14, fontWeight: '600', color: c.green },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  progressTrack: { marginTop: 6, height: 10, borderRadius: 16, backgroundColor: c.surface2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.gold },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, borderStyle: 'dashed' },
  txTitle: { color: c.ink, fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.ink },
})
