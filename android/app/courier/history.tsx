import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { statusLabel } from '../../src/lib/statusLabels'
import { courierStatusLabel } from '../../src/lib/courier'

/**
 * Courier delivery history, read from GET /courier/history as-is. Only the
 * fields that endpoint returns are shown; nothing is filled in on the client.
 */
export default function CourierHistoryScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, lang } = useI18n()
  const history = useQuery({ queryKey: ['courier', 'history'], queryFn: () => courierApi.history(50) })

  if (history.isLoading) return <Loading label={t('common.loading')} />
  if (history.isError) return <ErrorState message={t('courier.historyFailed')} retry={() => void history.refetch()} />

  const locale = lang === 'en' ? 'en-US' : 'fr-FR'
  const date = (value?: string | null) => value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' }) : '—'
  const items = history.data ?? []

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => void history.refetch()} />}
    >
      <SectionTitle title={t('courier.history')} />
      {items.length === 0 ? <Card><Text style={styles.muted}>{t('courier.historyEmpty')}</Text></Card> : null}
      {items.map((h) => (
        <Card key={`${h.order_id}-${h.final_status}`}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>#{h.order_number}</Text>
            <Text style={styles.status}>
              {h.final_status === 'COURIER_REJECTED' ? courierStatusLabel(t, h.final_status) : statusLabel(t, h.final_status)}
            </Text>
          </View>
          <Text style={styles.muted}>{t('courier.pickupAt')} : {h.shop_name}</Text>
          <Text style={styles.muted}>{t('courier.deliverTo')} : {h.delivery_address || '—'}</Text>
          <Text style={styles.muted}>{t('courier.assignedAt')} : {date(h.assigned_at)}</Text>
          <Text style={styles.muted}>{t('courier.deliveredAt')} : {date(h.delivered_at)}</Text>
          {h.incident_status ? <Text style={styles.error}>{t('courier.incident')} : {h.incident_status}</Text> : null}
        </Card>
      ))}
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { color: c.ink, fontWeight: '900', fontSize: 17 },
  status: { color: c.green, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  muted: { color: c.muted },
  error: { color: c.danger, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
})
