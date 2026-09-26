import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../src/api'
import { Button, ErrorState, Loading } from '../src/components/ui'
import { formatDateTime } from '../src/lib/format'
import { formatMoney } from '../src/lib/money'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import type { Colors } from '../src/theme'
import type { PendingPurchase } from '../src/types'

// Port of web-app/src/pages/buyer/PendingPurchasesPage.tsx (/account/purchases):
// in-store sales a shop employee recorded against this buyer, each confirmed
// with POST /buyer/purchases/:id/confirm exactly as web does.
export default function PendingPurchasesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const pending = useQuery({ queryKey: ['buyer', 'purchases', 'pending'], queryFn: buyerApi.pendingPurchases })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function confirm(p: PendingPurchase) {
    setBusy(p.order_id)
    setError('')
    try {
      await buyerApi.confirmPurchase(p.order_id, p.order_id)
      await queryClient.invalidateQueries({ queryKey: ['buyer', 'purchases', 'pending'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('orders.confirmPurchaseFailed'))
    } finally {
      setBusy(null)
    }
  }

  if (pending.isLoading) return <Loading label={t('orders.loadingPurchases')} />
  if (pending.isError || error) return <ErrorState message={error || (pending.error instanceof Error ? pending.error.message : t('orders.loadPurchasesFailed'))} retry={() => { setError(''); void pending.refetch() }} />

  const items = pending.data ?? []
  if (items.length === 0) return <View style={styles.empty}>
    <Text style={styles.emptyIcon}>🤝</Text>
    <Text style={styles.emptyTitle}>{t('orders.nothingToConfirm')}</Text>
    <Text style={[styles.small, { textAlign: 'center' }]}>{t('orders.nothingToConfirmDesc')}</Text>
  </View>

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.h1}>{t('orders.confirmPurchases')}</Text>
    <Text style={styles.small}>{t('orders.confirmPurchasesDesc')}</Text>
    {items.map((p) => <View key={p.order_id} style={styles.card}>
      <View style={[styles.flex1, { gap: 2 }]}>
        <Text style={styles.bold}>{p.shop_name}</Text>
        <Text style={styles.small}>{p.business_name} · {t('orders.byEmployee', { employee: p.employee_name })}</Text>
        <Text style={styles.small}>{formatDateTime(p.created_at)}</Text>
        <Text style={styles.bold}>{formatMoney(p.amount, p.currency)}</Text>
      </View>
      <Button title={t('common.confirm')} loading={busy === p.order_id} onPress={() => void confirm(p)} />
    </View>)}
  </ScrollView>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48, gap: 16 },
  flex1: { flex: 1 },
  h1: { fontSize: 28, fontWeight: '700', color: c.ink },
  small: { color: c.muted, fontSize: 14 },
  bold: { color: c.ink, fontSize: 16, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.ink },
})
