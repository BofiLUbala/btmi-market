import { Fragment, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import type { CashSession } from '../../src/types'

export default function SellerCashScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const [tab, setTab] = useState<'summary' | 'sessions'>('summary')
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmounts, setClosingAmounts] = useState<Record<string, string>>({})
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [error, setError] = useState('')

  const payments = useQuery({ queryKey: ['seller', 'cashPayments', expandedSession], queryFn: () => sellerApi.cashSessionPayments(expandedSession!), enabled: Boolean(expandedSession) })

  const summary = useQuery({ queryKey: ['seller', 'cashSummary', activeBusiness?.id], queryFn: () => sellerApi.businessCashSummary(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const sessions = useQuery({ queryKey: ['seller', 'cashSessions', activeBusiness?.id], queryFn: () => sellerApi.businessCashSessions(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['seller', 'cashSummary'] }); void queryClient.invalidateQueries({ queryKey: ['seller', 'cashSessions'] }) }

  const open = useMutation({
    mutationFn: () => {
      const amount = parseFloat(openingAmount)
      if (isNaN(amount) || amount < 0) throw new Error(t('seller.cash.invalidOpeningAmount'))
      return sellerApi.openCashSession(activeShop!, amount)
    },
    onMutate: () => setError(''),
    onSuccess: () => { setOpeningAmount(''); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('seller.cash.openFailed')),
  })

  const close = useMutation({
    mutationFn: (session: CashSession) => {
      const amount = parseFloat(closingAmounts[session.id])
      if (isNaN(amount) || amount < 0) throw new Error(t('seller.cash.invalidClosingAmount'))
      return sellerApi.closeCashSession(session.id, amount)
    },
    onMutate: () => setError(''),
    onSuccess: (_r, session) => { setClosingAmounts((prev) => ({ ...prev, [session.id]: '' })); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('seller.cash.closeFailed')),
  })

  const reconcile = useMutation({
    mutationFn: (session: CashSession) => sellerApi.reconcileCashSession(session.id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.cash.reconcileFailed')),
  })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (summary.isLoading || sessions.isLoading) return <Loading label={t('seller.cash.loading')} />
  if (summary.isError) return <ErrorState message={t('seller.cash.loadFailed')} retry={() => void summary.refetch()} />

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.cash.title')} />
    <View style={styles.tabs}>
      <Button dense variant={tab === 'summary' ? 'primary' : 'outline'} title={t('seller.cash.summaryTab')} onPress={() => setTab('summary')} />
      <Button dense variant={tab === 'sessions' ? 'primary' : 'outline'} title={t('seller.cash.sessionsTab')} onPress={() => setTab('sessions')} />
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {tab === 'summary' && summary.data && <>
      <Card><Text style={styles.cardTitle}>{t('seller.cash.totalCashSales')}</Text><Text style={styles.metric}>{summary.data.total_cash_sales.toLocaleString()} FC</Text></Card>
      {summary.data.shop_breakdown.map((shop) => <Card key={shop.shop_id}>
        <Text style={styles.cardTitle}>{shop.shop_name}</Text>
        <Text style={styles.metric}>{shop.total_cash_sales.toLocaleString()} FC</Text>
        <Text style={styles.muted}>{t('seller.cash.sessionsOpenClosed', { open: shop.open_sessions, closed: shop.closed_sessions })}</Text>
      </Card>)}
      {activeShop && <Card>
        <Text style={styles.cardTitle}>{t('seller.cash.openSessionTitle')}</Text>
        <Field label={t('seller.cash.openingFloatPlaceholder')} value={openingAmount} onChangeText={setOpeningAmount} keyboardType="numeric" />
        <Button title={t('seller.cash.openSession')} loading={open.isPending} onPress={() => open.mutate()} />
      </Card>}
    </>}

    {tab === 'sessions' && (!sessions.data?.length ? <Card><Text style={styles.muted}>{t('seller.cash.noSessionsYet')}</Text></Card> : sessions.data.map((session) => <Card key={session.id}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{session.shop_name || session.shop_id.slice(0, 8)}</Text>
        <Text style={styles.badge}>{t(`seller.cash.status.${session.status}` as any)}</Text>
      </View>
      <Text style={styles.muted}>{[session.employee_first_name, session.employee_last_name].filter(Boolean).join(' ') || '—'}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.muted}>{t('seller.cash.openingColumn')}: {session.opening_amount.toLocaleString()}</Text>
        <Text style={styles.muted}>{t('seller.cash.cashSales')}: {session.cash_sales_total.toLocaleString()}</Text>
        <Text style={styles.muted}>{t('seller.cash.expected')}: {session.expected_amount.toLocaleString()}</Text>
      </View>
      {session.declared_closing_amount != null && <Text style={styles.muted}>{t('seller.cash.declared')}: {session.declared_closing_amount.toLocaleString()} · {t('seller.cash.difference')}: {session.difference?.toLocaleString() ?? '—'}</Text>}
      <Text style={styles.date}>{t('seller.cash.opened')}: {new Date(session.opened_at).toLocaleDateString()}</Text>
      {session.status === 'OPEN' && <View style={styles.row}>
        <View style={styles.flex1}><Field label={t('seller.cash.counted')} value={closingAmounts[session.id] ?? ''} onChangeText={(v) => setClosingAmounts((prev) => ({ ...prev, [session.id]: v }))} keyboardType="numeric" /></View>
        <Button dense loading={close.isPending && close.variables?.id === session.id} title={t('seller.cash.closeSession')} onPress={() => close.mutate(session)} />
      </View>}
      {session.status === 'CLOSED' && <Button variant="outline" dense loading={reconcile.isPending && reconcile.variables?.id === session.id} title={t('seller.cash.reconcile')} onPress={() => reconcile.mutate(session)} />}
      <Button variant="outline" dense title={expandedSession === session.id ? t('seller.hideDetails') : t('seller.cash.viewPayments')} onPress={() => setExpandedSession(expandedSession === session.id ? null : session.id)} />
      {expandedSession === session.id && <Fragment>
        {payments.isLoading ? <Loading label={t('common.loading')} /> : !payments.data?.length ? <Text style={styles.muted}>{t('seller.cash.noPayments')}</Text> : payments.data.map((p) => (
          <Text key={p.id} style={styles.muted}>{p.amount.toLocaleString()} FC · {p.payment_method} · {new Date(p.created_at).toLocaleString()}</Text>
        ))}
      </Fragment>}
    </Card>))}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '900', color: colors.ink },
  metric: { fontSize: 22, fontWeight: '900', color: colors.green },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex1: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  badge: { color: colors.green, fontWeight: '900', fontSize: 12 },
  date: { color: colors.muted, fontSize: 12 },
})
