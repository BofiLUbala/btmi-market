import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { Button, Field } from '../../src/components/ui'
import { StructuredAddressFields, type StructuredAddressValue } from '../../src/components/StructuredAddressFields'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, type Colors } from '../../src/theme'
import { canOnboardSeller, canSell } from '../../src/types'

// Port of web-app/src/pages/seller/auth/SellerOnboardingPage.tsx: two steps
// (business, then shop) with the same fields and the same payloads — business
// type, category, phone (also sent as WhatsApp), email, the structured
// province → city → commune address, country DRC and USD; then the shop with
// its type, structured address, phone and optional delivery configuration.
// A seller who already has an active business lands on "welcome back".
const BUSINESS_TYPES = ['RETAIL', 'WHOLESALE', 'MANUFACTURING', 'SERVICES', 'OTHER'] as const
const emptyAddress: StructuredAddressValue = { province: '', city: '', commune: '', province_id: '', city_id: '', commune_id: '', street: '', building_number: '', landmark: '' }

export default function SellerOnboardingScreen() {
  const user = useAuth((s) => s.user)
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const setActiveBusiness = useAuth((s) => s.setActiveBusiness)
  const setActiveShop = useAuth((s) => s.setActiveShop)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState<'business' | 'shop'>(activeBusiness ? 'shop' : 'business')
  const [businessCreated, setBusinessCreated] = useState(false)
  const [wantsShopForm, setWantsShopForm] = useState(false)
  const [businessForm, setBusinessForm] = useState({ name: '', description: '', registration_number: '', tax_id: '', business_type: 'RETAIL', category: 'general', phone: '', email: '', default_currency: 'USD', ...emptyAddress })
  const [shopForm, setShopForm] = useState({ name: '', type: 'PHYSICAL' as 'PHYSICAL' | 'ONLINE', phone: '', address: '', supports_shop_delivery: false, supports_partner_delivery: false, partner_delivery_provider: '', delivery_city: '', delivery_address: '', ...emptyAddress })
  const [showDelivery, setShowDelivery] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.email || user?.phone) setBusinessForm((f) => ({ ...f, email: f.email || user.email || '', phone: f.phone || user.phone || '' }))
  }, [user])
  useEffect(() => { if (activeBusiness) setCurrentStep('shop') }, [activeBusiness?.id])

  async function createBusiness() {
    setError(''); setBusy(true)
    try {
      const created = await sellerApi.createBusiness({
        name: businessForm.name, business_type: businessForm.business_type, category: businessForm.category,
        phone: businessForm.phone, whatsapp: businessForm.phone, email: businessForm.email,
        country: 'DRC', province: businessForm.province, commune: businessForm.commune, street: businessForm.street, building_number: businessForm.building_number, landmark: businessForm.landmark,
        city: businessForm.city, default_currency: businessForm.default_currency,
      })
      const business = { ...created, status: created.status || 'ACTIVE' }
      useAuth.setState((state) => ({ sellerBusinesses: [...state.sellerBusinesses.filter((b) => b.id !== business.id), business] }))
      setActiveBusiness(business)
      setBusinessCreated(true)
      setCurrentStep('shop')
      await queryClient.invalidateQueries({ queryKey: ['seller'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.onboarding.createBusinessFailed'))
    } finally { setBusy(false) }
  }

  async function createShop() {
    if (!activeBusiness) { setError(t('seller.onboarding.noActiveBusiness')); return }
    setError(''); setBusy(true)
    try {
      const newShop = await sellerApi.createShop(activeBusiness.id, { ...shopForm, address: [shopForm.building_number, shopForm.street, shopForm.commune, shopForm.city, shopForm.province].filter(Boolean).join(', ') })
      setActiveShop(newShop.id)
      await queryClient.invalidateQueries({ queryKey: ['seller'] })
      router.replace('/seller')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.onboarding.createShopFailed'))
    } finally { setBusy(false) }
  }

  if (!user || (!canSell(user) && !canOnboardSeller(user))) return <View style={styles.page}><View style={styles.card}>
    <Text style={styles.h1}>{t('seller.onboarding.accessDenied')}</Text>
    <Text style={styles.muted}>{t('seller.onboarding.notSeller')}</Text>
    <Button title={t('auth.signInAsSeller')} onPress={() => router.push('/auth/login')} />
  </View></View>

  if (activeBusiness && !businessCreated && !wantsShopForm) return <View style={styles.page}><View style={styles.card}>
    <Text style={styles.h1}>{t('seller.onboarding.welcomeBack')}</Text>
    <Text style={styles.muted}>{t('seller.onboarding.yourBusiness')} <Text style={styles.bold}>{activeBusiness.name}</Text> {t('seller.onboarding.businessReadySuffix')}</Text>
    <Text style={styles.small}>{t('seller.onboarding.createFirstShopHint')}</Text>
    <Button title={t('seller.onboarding.createFirstShop')} onPress={() => { setWantsShopForm(true); setCurrentStep('shop') }} />
  </View></View>

  const businessDone = Boolean(activeBusiness)
  const steps = [
    { id: 'business', label: t('seller.onboarding.stepCreateBusiness'), completed: businessDone, current: currentStep === 'business' },
    { id: 'shop', label: t('seller.onboarding.stepCreateShop'), completed: false, current: currentStep === 'shop' },
  ]

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.card}>
      <View style={styles.progress}>
        {steps.map((step, i) => <View key={step.id} style={styles.progressStep}>
          <View style={[styles.stepCircle, step.completed ? styles.stepDone : step.current ? styles.stepCurrent : null]}><Text style={[styles.stepCircleText, (step.completed || step.current) && { color: colors.onGreen }]}>{step.completed ? '✓' : i + 1}</Text></View>
          <Text style={[styles.text, step.current && styles.bold]}>{step.label}</Text>
        </View>)}
      </View>

      {currentStep === 'business' ? <View style={styles.form}>
        <Text style={styles.h1}>{t('seller.onboarding.createBusinessTitle')}</Text>
        <Text style={styles.small}>{t('seller.onboarding.businessSubtitle')}</Text>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Field label={t('seller.onboarding.businessName')} value={businessForm.name} onChangeText={(v) => setBusinessForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
        <Text style={styles.label}>{t('seller.onboarding.businessType')}</Text>
        <View style={styles.chips}>{BUSINESS_TYPES.map((type) => <Chip key={type} label={t(`seller.businessType.${type}`)} selected={businessForm.business_type === type} onPress={() => setBusinessForm((f) => ({ ...f, business_type: type }))} styles={styles} />)}</View>
        <Field label={t('seller.onboarding.category')} value={businessForm.category} onChangeText={(v) => setBusinessForm((f) => ({ ...f, category: v }))} placeholder={t('seller.onboarding.categoryPlaceholder')} />
        <Field label={t('seller.onboarding.businessPhone')} value={businessForm.phone} onChangeText={(v) => setBusinessForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder={t('auth.phonePlaceholder')} />
        <Field label={t('seller.onboarding.businessEmail')} value={businessForm.email} onChangeText={(v) => setBusinessForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <StructuredAddressFields value={{ province: businessForm.province, city: businessForm.city, commune: businessForm.commune, province_id: businessForm.province_id, city_id: businessForm.city_id, commune_id: businessForm.commune_id, street: businessForm.street, building_number: businessForm.building_number, landmark: businessForm.landmark }} onChange={(address) => setBusinessForm((f) => ({ ...f, ...address }))} />
        <Text style={styles.label}>{t('seller.onboarding.defaultCurrency')}</Text>
        <View style={styles.chips}><Chip label="USD" selected onPress={() => setBusinessForm((f) => ({ ...f, default_currency: 'USD' }))} styles={styles} /></View>
        <Field label={t('seller.onboarding.descriptionOptional')} value={businessForm.description} onChangeText={(v) => setBusinessForm((f) => ({ ...f, description: v }))} multiline />
        <Field label={t('seller.onboarding.registrationNumberOptional')} value={businessForm.registration_number} onChangeText={(v) => setBusinessForm((f) => ({ ...f, registration_number: v }))} />
        <Field label={t('seller.onboarding.taxIdOptional')} value={businessForm.tax_id} onChangeText={(v) => setBusinessForm((f) => ({ ...f, tax_id: v }))} />
        <Button title={t('seller.onboarding.createBusiness')} loading={busy} disabled={!businessForm.name.trim() || !businessForm.category.trim() || !businessForm.phone.trim() || !businessForm.email.trim()} onPress={() => void createBusiness()} />
      </View> : !activeBusiness ? <View style={styles.form}>
        <Text style={styles.h1}>{t('seller.onboarding.createBusinessFirst')}</Text>
        <Text style={styles.muted}>{t('seller.onboarding.createBusinessFirstHint')}</Text>
        <Button title={t('seller.onboarding.backToBusiness')} onPress={() => setCurrentStep('business')} />
      </View> : <View style={styles.form}>
        <Text style={styles.h1}>{t('seller.onboarding.createShopTitle')}</Text>
        <Text style={styles.small}>{t('seller.onboarding.businessLabel')} <Text style={styles.bold}>{activeBusiness.name}</Text></Text>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Field label={t('seller.onboarding.shopName')} value={shopForm.name} onChangeText={(v) => setShopForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
        <Text style={styles.label}>{t('seller.onboarding.shopType')}</Text>
        <View style={styles.chips}>
          <Chip label={t('seller.shopType.PHYSICAL')} selected={shopForm.type === 'PHYSICAL'} onPress={() => setShopForm((f) => ({ ...f, type: 'PHYSICAL' }))} styles={styles} />
          <Chip label={t('seller.shopType.ONLINE')} selected={shopForm.type === 'ONLINE'} onPress={() => setShopForm((f) => ({ ...f, type: 'ONLINE' }))} styles={styles} />
        </View>
        <StructuredAddressFields value={{ province: shopForm.province, city: shopForm.city, commune: shopForm.commune, province_id: shopForm.province_id, city_id: shopForm.city_id, commune_id: shopForm.commune_id, street: shopForm.street, building_number: shopForm.building_number, landmark: shopForm.landmark }} onChange={(address) => setShopForm((f) => ({ ...f, ...address }))} />
        <Field label={t('common.phone')} value={shopForm.phone} onChangeText={(v) => setShopForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder={t('auth.phonePlaceholder')} />

        {/* web: <details> "Delivery configuration" */}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDelivery }} onPress={() => setShowDelivery((v) => !v)}><Text style={styles.small}>{showDelivery ? '▾' : '▸'} {t('seller.onboarding.deliveryConfiguration')}</Text></Pressable>
        {showDelivery ? <View style={{ gap: 12 }}>
          <CheckRow label={t('seller.onboarding.shopProvidesDelivery')} checked={shopForm.supports_shop_delivery} onToggle={() => setShopForm((f) => ({ ...f, supports_shop_delivery: !f.supports_shop_delivery }))} styles={styles} />
          <CheckRow label={t('seller.onboarding.partnerDeliveryAvailable')} checked={shopForm.supports_partner_delivery} onToggle={() => setShopForm((f) => ({ ...f, supports_partner_delivery: !f.supports_partner_delivery }))} styles={styles} />
          {shopForm.supports_partner_delivery ? <>
            <Field label={t('seller.onboarding.partnerProvider')} value={shopForm.partner_delivery_provider} onChangeText={(v) => setShopForm((f) => ({ ...f, partner_delivery_provider: v }))} />
            <Field label={t('seller.onboarding.deliveryCity')} value={shopForm.delivery_city} onChangeText={(v) => setShopForm((f) => ({ ...f, delivery_city: v }))} autoCapitalize="words" />
            <Field label={t('seller.onboarding.deliveryAddress')} value={shopForm.delivery_address} onChangeText={(v) => setShopForm((f) => ({ ...f, delivery_address: v }))} multiline />
          </> : null}
        </View> : null}

        <Button title={t('seller.onboarding.createShopGo')} loading={busy} disabled={!shopForm.name.trim() || !shopForm.phone.trim()} onPress={() => void createShop()} />
      </View>}
    </View>
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>

function Chip({ label, selected, onPress, styles }: { label: string; selected: boolean; onPress: () => void; styles: S }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>
}

function CheckRow({ label, checked, onToggle, styles }: { label: string; checked: boolean; onToggle: () => void; styles: S }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.checkRow}>
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
    <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
  </Pressable>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: 16, paddingBottom: 32, gap: 16 },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 20, gap: 12, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  form: { gap: 12 },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  text: { color: c.ink, fontSize: 14 },
  bold: { color: c.ink, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 15, lineHeight: 21 },
  small: { color: c.muted, fontSize: 13 },
  label: { color: c.ink, fontWeight: '700', fontSize: 14 },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
  errorText: { color: c.danger },
  progress: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 8 },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  stepCurrent: { backgroundColor: c.green, borderColor: c.green },
  stepDone: { backgroundColor: c.success, borderColor: c.success },
  stepCircleText: { fontWeight: '800', color: c.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white },
  chipOn: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: c.onGreen },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: c.borderControl, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: c.green, borderColor: c.green },
  checkMark: { color: c.onGreen, fontWeight: '900', fontSize: 13 },
})
