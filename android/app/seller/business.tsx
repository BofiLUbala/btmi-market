import { useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function SellerBusinessScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const setActiveBusiness = useAuth((s) => s.setActiveBusiness)
  const sellerBusinesses = useAuth((s) => s.sellerBusinesses)
  const setActiveShop = useAuth((s) => s.setActiveShop)

  const [form, setForm] = useState({ name: '', category: '', phone: '', whatsapp: '', email: '', city: '', country: '', default_currency: '' })
  const [saved, setSaved] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeBusiness) return
    setForm({
      name: activeBusiness.name, category: activeBusiness.category ?? '', phone: activeBusiness.phone ?? '',
      whatsapp: activeBusiness.whatsapp ?? '', email: activeBusiness.email ?? '', city: activeBusiness.city ?? '',
      country: activeBusiness.country ?? '', default_currency: activeBusiness.default_currency ?? 'CDF',
    })
  }, [activeBusiness?.id])

  const summary = useQuery({ queryKey: ['seller', 'lifecycle', activeBusiness?.id], queryFn: () => sellerApi.businessLifecycleSummary(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  const save = useMutation({
    mutationFn: () => sellerApi.updateBusiness(activeBusiness!.id, form),
    onMutate: () => { setError(''); setSaved(false) },
    onSuccess: (updated) => { setActiveBusiness(updated); setSaved(true) },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.business.updateFailed')),
  })

  const archive = useMutation({
    mutationFn: () => sellerApi.archiveBusiness(activeBusiness!.id, confirmName),
    onMutate: () => setError(''),
    onSuccess: async () => {
      const remaining = sellerBusinesses.filter((b) => b.id !== activeBusiness!.id)
      await queryClient.invalidateQueries({ queryKey: ['seller'] })
      setActiveShop(null)
      setActiveBusiness(remaining[0] ?? null)
      router.replace(remaining.length ? '/seller' : '/seller/onboarding')
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.business.archiveFailed')),
  })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.title}>{t('seller.business.noActiveBusiness')}</Text><Text style={styles.muted}>{t('seller.business.noActiveBusinessHint')}</Text><Button title={t('seller.startOnboarding')} onPress={() => router.push('/seller/onboarding')} /></View>

  const s = summary.data
  const blocked = (s?.active_orders ?? 0) > 0 || (s?.unresolved_payments ?? 0) > 0

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={activeBusiness.name} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {saved ? <Text style={styles.success}>{t('seller.business.saved')}</Text> : null}

    <Card>
      <Text style={styles.cardTitle}>{t('seller.business.details')}</Text>
      <Field label={t('seller.businessName')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <Field label={t('seller.businessCategory')} value={form.category} onChangeText={(v) => setForm((f) => ({ ...f, category: v }))} autoCapitalize="words" />
      <Field label={t('auth.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
      <Field label="WhatsApp" value={form.whatsapp} onChangeText={(v) => setForm((f) => ({ ...f, whatsapp: v }))} keyboardType="phone-pad" />
      <Field label={t('auth.email')} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t('seller.city')} value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} autoCapitalize="words" />
      <Field label={t('seller.country')} value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} autoCapitalize="characters" />
      <Field label={t('seller.business.currency')} value={form.default_currency} onChangeText={(v) => setForm((f) => ({ ...f, default_currency: v }))} autoCapitalize="characters" />
      <Button title={t('common.saveChanges')} loading={save.isPending} onPress={() => save.mutate()} />
    </Card>

    <SectionTitle title={t('seller.business.footprint')} />
    {summary.isLoading ? <Loading label={t('common.loading')} /> : s ? <Card>
      <View style={styles.grid}><Stat label={t('seller.shops')} value={s.shops} styles={styles} /><Stat label={t('seller.products')} value={s.products} styles={styles} /></View>
      <View style={styles.grid}><Stat label={t('seller.employees')} value={s.employees} styles={styles} /><Stat label={t('seller.business.inventoryUnits')} value={s.inventory_units} styles={styles} /></View>
      <View style={styles.grid}><Stat label={t('seller.business.activeOrders')} value={s.active_orders} styles={styles} /><Stat label={t('seller.business.historicalOrders')} value={s.historical_orders} styles={styles} /></View>
    </Card> : null}

    <Card>
      <Text style={styles.cardTitle}>{t('seller.business.dangerZone')}</Text>
      <Text style={styles.muted}>{t('seller.business.archiveDescription')}</Text>
      {!showArchive ? <Button variant="outline" title={t('seller.business.archiveTitle')} onPress={() => setShowArchive(true)} /> : <>
        <Text style={styles.warnTitle}>{t('seller.business.archiveConfirm', { name: activeBusiness.name })}</Text>
        {s ? <Text style={styles.muted}>{t('seller.business.archiveAffects', { shops: s.shops, products: s.products, employees: s.employees, inventory: s.inventory_units })}</Text> : null}
        {blocked ? <Text style={styles.error}>{t('seller.business.archiveBlocked', { active: s?.active_orders ?? 0, payments: s?.unresolved_payments ?? 0 })}</Text> : null}
        <Field label={t('seller.business.typeNameToConfirm', { name: activeBusiness.name })} value={confirmName} onChangeText={setConfirmName} autoCapitalize="none" />
        <Button variant="outline" title={t('common.cancel')} onPress={() => { setShowArchive(false); setConfirmName('') }} />
        <Button title={t('seller.business.archiveTitle')} loading={archive.isPending} disabled={confirmName !== activeBusiness.name || blocked} onPress={() => archive.mutate()} />
      </>}
    </Card>
  </ScrollView>
}

function Stat({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof makeStyles> }) {
  return <Card><Text style={styles.metric}>{value}</Text><Text style={styles.muted}>{label}</Text></Card>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  success: { color: colors.success, fontWeight: '700' },
  warnTitle: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  grid: { flexDirection: 'row', gap: spacing.sm },
  metric: { fontSize: 22, fontWeight: '900', color: colors.green },
})
