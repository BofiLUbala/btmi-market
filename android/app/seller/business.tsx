import { useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Field, Loading } from '../../src/components/ui'
import { StructuredAddressFields, type StructuredAddressValue } from '../../src/components/StructuredAddressFields'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, type Colors } from '../../src/theme'

// Port of web-app/src/pages/seller/business/SellerBusinessPage.tsx: the same
// editable fields (name, business type, category, phone, WhatsApp, email, the
// structured province → city → commune address, currency), the lifecycle
// footprint with its per-shop rows, and the archive danger zone. Saving
// refreshes the business list in the header, and archiving re-lists businesses
// from the API before picking the next one, exactly as web does.
const BUSINESS_TYPES = ['RETAIL', 'WHOLESALE', 'MANUFACTURING', 'SERVICES', 'OTHER'] as const
type Form = StructuredAddressValue & { name: string; business_type: string; category: string; phone: string; whatsapp: string; email: string; default_currency: string }
const emptyForm: Form = { name: '', business_type: 'RETAIL', category: '', phone: '', whatsapp: '', email: '', province: '', city: '', commune: '', province_id: '', city_id: '', commune_id: '', street: '', building_number: '', landmark: '', default_currency: 'USD' }

export default function SellerBusinessScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const setActiveBusiness = useAuth((s) => s.setActiveBusiness)
  const setActiveShop = useAuth((s) => s.setActiveShop)

  const [form, setForm] = useState<Form>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeBusiness) return
    setForm({
      name: activeBusiness.name, business_type: activeBusiness.business_type ?? 'RETAIL', category: activeBusiness.category ?? '',
      phone: activeBusiness.phone ?? '', whatsapp: activeBusiness.whatsapp ?? '', email: activeBusiness.email ?? '',
      province_id: '', city_id: '', commune_id: '',
      province: activeBusiness.province ?? '', city: activeBusiness.city ?? '', commune: activeBusiness.commune ?? '',
      street: activeBusiness.street ?? '', building_number: activeBusiness.building_number ?? '', landmark: activeBusiness.landmark ?? '',
      default_currency: activeBusiness.default_currency ?? 'USD',
    })
    setError(''); setShowArchive(false); setConfirmName('')
  }, [activeBusiness?.id])

  const summary = useQuery({ queryKey: ['seller', 'lifecycle', activeBusiness?.id], queryFn: () => sellerApi.businessLifecycleSummary(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const set = <K extends keyof Form>(key: K, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function save() {
    if (!activeBusiness) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const updated = await sellerApi.updateBusiness(activeBusiness.id, form)
      // web: replace it in the seller's list and keep it active (the header pill reads both)
      useAuth.setState((state) => ({ sellerBusinesses: state.sellerBusinesses.map((item) => item.id === updated.id ? updated : item), activeBusiness: updated }))
      setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : t('seller.business.updateFailed')) }
    finally { setBusy(false) }
  }

  async function archive() {
    if (!activeBusiness || confirmName !== activeBusiness.name) return
    setBusy(true); setError('')
    try {
      await sellerApi.archiveBusiness(activeBusiness.id, confirmName)
      const remaining = (await sellerApi.businesses()).filter((b) => b.id !== activeBusiness.id)
      useAuth.setState({ sellerBusinesses: remaining })
      setActiveShop(null)
      const next = remaining[0] ?? null
      setActiveBusiness(next)
      await queryClient.invalidateQueries({ queryKey: ['seller'] })
      router.replace(next ? '/seller' : '/seller/onboarding')
    } catch (e) { setError(e instanceof Error ? e.message : t('seller.business.archiveFailed')) }
    finally { setBusy(false) }
  }

  if (!activeBusiness) return <View style={styles.page}><View style={styles.card}>
    <Text style={styles.h2}>{t('seller.business.noActiveBusiness')}</Text>
    <Text style={styles.muted}>{t('seller.business.noActiveBusinessHint')}</Text>
    <Button title={t('seller.onboarding.createBusiness')} onPress={() => router.push('/seller/onboarding')} />
  </View></View>

  const s = summary.data
  const blocked = (s?.active_orders ?? 0) > 0 || (s?.unresolved_payments ?? 0) > 0

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View>
      <Text style={styles.eyebrow}>{t('seller.business.currentEyebrow')}</Text>
      <Text style={styles.h1}>{activeBusiness.name}</Text>
      <Text style={styles.muted}>{t('seller.business.headerSubtitle')}</Text>
    </View>
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
    {saved ? <View style={styles.successBox}><Text style={styles.successText}>{t('seller.business.saved')}</Text></View> : null}

    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.flex1}><Text style={styles.eyebrow}>{t('seller.business.infoEyebrow')}</Text><Text style={styles.h2}>{t('seller.business.details')}</Text></View>
        <Text style={[styles.badge, { backgroundColor: colors.successSoft, color: colors.success }]}>{activeBusiness.status}</Text>
      </View>
      <Field label={t('seller.business.name')} value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" />
      <Text style={styles.label}>{t('seller.onboarding.businessType')}</Text>
      <View style={styles.chips}>
        {BUSINESS_TYPES.map((type) => <Chip key={type} label={t(`seller.businessType.${type}`)} selected={form.business_type === type} onPress={() => set('business_type', type)} styles={styles} />)}
      </View>
      <Field label={t('seller.onboarding.category')} value={form.category} onChangeText={(v) => set('category', v)} />
      <Field label={t('common.phone')} value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
      <Field label="WhatsApp" value={form.whatsapp} onChangeText={(v) => set('whatsapp', v)} keyboardType="phone-pad" />
      <Field label={t('common.email')} value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
      <StructuredAddressFields
        value={{ province: form.province, city: form.city, commune: form.commune, province_id: form.province_id, city_id: form.city_id, commune_id: form.commune_id, street: form.street, building_number: form.building_number, landmark: form.landmark }}
        onChange={(address) => setForm((current) => ({ ...current, ...address }))}
      />
      <Text style={styles.label}>{t('seller.business.currency')}</Text>
      <View style={styles.chips}>
        <Chip label="USD" selected={form.default_currency === 'USD'} onPress={() => set('default_currency', 'USD')} styles={styles} />
        <Chip label="CDF (héritage)" selected={form.default_currency === 'CDF'} onPress={() => set('default_currency', 'CDF')} styles={styles} />
      </View>
      <Button title={t('common.saveChanges')} loading={busy} onPress={() => void save()} />
    </View>

    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.flex1}><Text style={styles.eyebrow}>{t('seller.business.summaryEyebrow')}</Text><Text style={styles.h2}>{t('seller.business.activeFootprint')}</Text></View>
        <Pressable accessibilityRole="link" onPress={() => router.push('/seller/employees')}><Text style={styles.link}>{t('seller.business.viewEmployees')}</Text></Pressable>
      </View>
      {summary.isLoading ? <Loading label={t('seller.business.loadingImpact')} /> : s ? <>
        <View style={styles.impactGrid}>
          {[
            [t('seller.shops'), s.shops], [t('seller.products'), s.products], [t('seller.employees'), s.employees],
            [t('seller.business.inventoryUnits'), s.inventory_units], [t('seller.business.activeOrders'), s.active_orders], [t('seller.business.historicalOrders'), s.historical_orders],
          ].map(([label, value]) => <View key={String(label)} style={styles.impactCell}><Text style={styles.impactLabel}>{label}</Text><Text style={styles.impactValue}>{value}</Text></View>)}
        </View>
        {s.shop_summaries.map((shop) => <Pressable key={shop.id} accessibilityRole="link" onPress={() => router.push('/seller/shops')} style={styles.shopRow}>
          <View style={styles.flex1}><Text style={styles.bold}>{shop.name}</Text><Text style={styles.small}>{shop.status}</Text></View>
          <Text style={styles.small}>{t(shop.product_count === 1 ? 'seller.business.shopProductCount' : 'seller.business.shopProductCountPlural', { count: shop.product_count })}</Text>
        </Pressable>)}
      </> : null}
    </View>

    <View style={[styles.card, styles.dangerCard]}>
      <Text style={styles.eyebrow}>{t('seller.business.dangerZone')}</Text>
      <Text style={styles.h2}>{t('seller.business.archiveTitle')}</Text>
      <Text style={styles.muted}>{t('seller.business.archiveDescription')}</Text>
      {!showArchive ? <DangerButton title={t('seller.business.deleteArchive')} onPress={() => setShowArchive(true)} styles={styles} /> : <View style={{ gap: 10 }}>
        <Text style={styles.h3}>{t('seller.business.archiveConfirm', { name: activeBusiness.name })}</Text>
        {s ? <Text style={styles.muted}>{t('seller.business.archiveAffects', { shops: s.shops, products: s.products, employees: s.employees, inventory: s.inventory_units })}</Text> : null}
        {blocked ? <View style={styles.errorBox}><Text style={styles.errorText}>{t('seller.business.archiveBlocked', { active: s?.active_orders ?? 0, payments: s?.unresolved_payments ?? 0 })}</Text></View> : <Text style={styles.small}>{t('seller.business.archiveHistoryNote')}</Text>}
        <Field label={t('seller.business.typeNameToConfirm', { name: activeBusiness.name })} value={confirmName} onChangeText={setConfirmName} autoCapitalize="none" autoCorrect={false} />
        <View style={styles.rowEnd}>
          <Button dense variant="outline" title={t('common.cancel')} onPress={() => { setShowArchive(false); setConfirmName('') }} />
          <DangerButton title={t('seller.business.archiveTitle')} disabled={busy || confirmName !== activeBusiness.name || blocked} onPress={() => void archive()} styles={styles} />
        </View>
      </View>}
    </View>
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>

function Chip({ label, selected, onPress, styles }: { label: string; selected: boolean; onPress: () => void; styles: S }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text></Pressable>
}

function DangerButton({ title, onPress, disabled, styles }: { title: string; onPress: () => void; disabled?: boolean; styles: S }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.danger, disabled && { opacity: 0.5 }]}><Text style={styles.dangerText}>{title}</Text></Pressable>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  flex1: { flex: 1 },
  eyebrow: { color: c.green, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3 },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h2: { fontSize: 20, fontWeight: '700', color: c.ink },
  h3: { fontSize: 16, fontWeight: '700', color: c.ink },
  bold: { fontWeight: '700', color: c.ink },
  muted: { color: c.muted, fontSize: 15 },
  small: { color: c.muted, fontSize: 13 },
  label: { color: c.ink, fontWeight: '700', fontSize: 14 },
  link: { color: c.green, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 12, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  dangerCard: { borderColor: c.danger },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, alignItems: 'center' },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white },
  chipActive: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: c.onGreen },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  impactCell: { width: '47%', flexGrow: 1, gap: 4, padding: 12, borderRadius: 10, backgroundColor: c.surface2 },
  impactLabel: { color: c.muted, fontSize: 12 },
  impactValue: { color: c.green, fontSize: 18, fontWeight: '700' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
  errorText: { color: c.danger },
  successBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.success },
  successText: { color: c.success, fontWeight: '600' },
  danger: { alignSelf: 'flex-start', backgroundColor: c.danger, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  dangerText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
})
