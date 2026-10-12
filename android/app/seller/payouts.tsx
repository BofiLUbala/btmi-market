import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { formatMoney } from '../../src/lib/money'
import { dateLocale } from '../../src/lib/format'
import type { SellerPayout } from '../../src/types'

// The four networks a buyer can pay with. A seller's share always goes out on
// the network the buyer used, so a number is required for each one.
const NETWORKS: Array<{ code: string; label: string }> = [
  { code: 'MPESA', label: 'M-Pesa (Vodacom)' },
  { code: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { code: 'ORANGE_MONEY', label: 'Orange Money' },
  { code: 'AFRIMONEY', label: 'Afrimoney (Africell)' },
]

const STATUS_KEYS: Record<string, TranslationKey> = {
  PENDING: 'sellerPayouts.statusPending',
  BLOCKED_NO_ACCOUNT: 'sellerPayouts.statusBlocked',
  SENT: 'sellerPayouts.statusSent',
  PAID: 'sellerPayouts.statusPaid',
  FAILED: 'sellerPayouts.statusFailed',
  CANCELLED: 'sellerPayouts.statusCancelled',
  APPLIED: 'sellerPayouts.statusApplied',
}

export default function SellerPayoutsScreen() {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const business = useAuth((s) => s.activeBusiness)
  const businessId = business?.id ?? ''

  const accountsQ = useQuery({ queryKey: ['seller', 'payoutAccounts', businessId], queryFn: () => sellerApi.payoutAccounts(businessId), enabled: Boolean(businessId) })
  const payoutsQ = useQuery({ queryKey: ['seller', 'payouts', businessId], queryFn: () => sellerApi.payouts(businessId), enabled: Boolean(businessId), refetchInterval: 30_000 })

  const [numbers, setNumbers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!accountsQ.data) return
    const next: Record<string, string> = {}
    for (const a of accountsQ.data) next[a.provider] = a.phone
    setNumbers(next)
  }, [accountsQ.data])

  const missing = NETWORKS.filter((n) => !(numbers[n.code] ?? '').trim())
  const configured = (accountsQ.data?.length ?? 0) >= NETWORKS.length

  const save = async () => {
    setMessage(null)
    if (missing.length) { setMessage({ ok: false, text: t('sellerPayouts.allRequired') }); return }
    setSaving(true)
    try {
      await sellerApi.savePayoutAccounts(businessId, numbers)
      await queryClient.invalidateQueries({ queryKey: ['seller', 'payoutAccounts', businessId] })
      await queryClient.invalidateQueries({ queryKey: ['seller', 'payouts', businessId] })
      setMessage({ ok: true, text: t('sellerPayouts.saved') })
    } catch (err) {
      const detail = err instanceof ApiError ? `${err.message} ${err.code}` : ''
      const network = NETWORKS.find((n) => detail.includes(n.code))
      setMessage({ ok: false, text: network ? t('sellerPayouts.invalidNumber', { network: network.label }) : t('sellerPayouts.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  if (!businessId) return <ErrorState message={t('sellerPayouts.noBusiness')} />
  if (accountsQ.isLoading) return <Loading />
  if (accountsQ.isError) return <ErrorState message={t('sellerPayouts.loadFailed')} retry={() => void accountsQ.refetch()} />

  const payouts: SellerPayout[] = payoutsQ.data ?? []
  const networkLabel = (code: string) => NETWORKS.find((n) => n.code === code)?.label ?? code

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.h2}>{t('sellerPayouts.title')}</Text>
        <Text style={styles.subtitle}>{t('sellerPayouts.subtitle')}</Text>
      </View>

      {!configured ? (
        <View style={styles.warning} accessibilityRole="alert">
          <Text style={styles.warningText}>{t('sellerPayouts.mustConfigure')}</Text>
        </View>
      ) : null}

      <Card>
        <Text style={styles.h3}>{t('sellerPayouts.numbersTitle')}</Text>
        <Text style={styles.hint}>{t('sellerPayouts.numbersHint')}</Text>
        {NETWORKS.map((n) => (
          <Field
            key={n.code}
            label={`${n.label} *`}
            value={numbers[n.code] ?? ''}
            onChangeText={(v) => setNumbers((prev) => ({ ...prev, [n.code]: v }))}
            placeholder="243 8XX XXX XXX"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        ))}
        {message ? <Text style={[styles.message, message.ok ? styles.ok : styles.err]}>{message.text}</Text> : null}
        <Button title={t('sellerPayouts.save')} onPress={() => void save()} loading={saving} disabled={saving} />
      </Card>

      <Card>
        <Text style={styles.h3}>{t('sellerPayouts.historyTitle')}</Text>
        <Text style={styles.hint}>{t('sellerPayouts.historyHint')}</Text>
        {payouts.length === 0 ? <Text style={styles.empty}>{t('sellerPayouts.none')}</Text> : payouts.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>
                {p.kind === 'CLAWBACK' ? t('sellerPayouts.clawback') : t('sellerPayouts.payout')} · {p.order_number || p.order_id.slice(0, 8)}
              </Text>
              <Text style={styles.rowMeta}>{networkLabel(p.provider)}{p.phone ? ` · ${p.phone}` : ''} · {new Date(p.created_at).toLocaleString(dateLocale(lang))}</Text>
              {p.deducted_amount > 0 ? <Text style={styles.rowMeta}>{t('sellerPayouts.deducted', { amount: formatMoney(p.deducted_amount, p.currency) })}</Text> : null}
            </View>
            <View style={styles.rowSide}>
              <Text style={[styles.amount, p.kind === 'CLAWBACK' && styles.negative]}>
                {p.kind === 'CLAWBACK' ? '−' : ''}{formatMoney(p.amount, p.currency)}
              </Text>
              <Text style={styles.status}>{STATUS_KEYS[p.status] ? t(STATUS_KEYS[p.status]) : p.status}</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { gap: 4 },
  h2: { color: c.ink, fontSize: 22, fontWeight: '800' },
  h3: { color: c.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: c.muted },
  hint: { color: c.muted, fontSize: 13, marginBottom: spacing.sm },
  warning: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: spacing.md },
  warningText: { color: '#92400E', fontWeight: '700' },
  message: { fontWeight: '700', marginVertical: spacing.sm },
  ok: { color: c.success },
  err: { color: c.danger },
  empty: { color: c.muted, textAlign: 'center', paddingVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  rowMain: { flex: 1, gap: 2 },
  rowSide: { alignItems: 'flex-end', gap: 2 },
  rowTitle: { color: c.ink, fontWeight: '700' },
  rowMeta: { color: c.muted, fontSize: 12 },
  amount: { color: c.ink, fontWeight: '800' },
  negative: { color: c.danger },
  status: { color: c.muted, fontSize: 12 },
})
