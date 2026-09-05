import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

type Step = 'business' | 'shop'

export default function SellerOnboardingScreen() {
  const user = useAuth((state) => state.user)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()

  // A seller returning to onboarding (e.g. from the "finish setup" prompt on
  // the hub) already has a business — skip straight to the shop step instead
  // of asking them to create a second one.
  const businesses = useQuery({ queryKey: ['seller', 'businesses'], queryFn: sellerApi.businesses, enabled: Boolean(user) })
  const existingBusiness = businesses.data?.[0]

  const [step, setStep] = useState<Step>('business')
  const [businessId, setBusinessId] = useState<string>()
  const [justCreatedBusiness, setJustCreatedBusiness] = useState(false)

  useEffect(() => {
    if (existingBusiness && !businessId) {
      setBusinessId(existingBusiness.id)
      setStep('shop')
    }
  }, [existingBusiness, businessId])

  const [businessForm, setBusinessForm] = useState({ name: '', category: '', phone: user?.phone || '', email: user?.email || '', city: '', country: 'CD' })
  const [shopForm, setShopForm] = useState({ name: '', city: '', address: '', phone: user?.phone || '' })
  const [shopType, setShopType] = useState<'PHYSICAL' | 'ONLINE'>('PHYSICAL')
  const [error, setError] = useState('')

  const setBusinessField = (key: keyof typeof businessForm, value: string) => setBusinessForm((current) => ({ ...current, [key]: value }))
  const setShopField = (key: keyof typeof shopForm, value: string) => setShopForm((current) => ({ ...current, [key]: value }))

  const createBusiness = useMutation({
    mutationFn: () =>
      sellerApi.createBusiness({
        name: businessForm.name.trim(),
        business_type: 'RETAIL',
        category: businessForm.category.trim(),
        phone: businessForm.phone.trim(),
        email: businessForm.email.trim().toLowerCase(),
        country: businessForm.country.trim(),
        city: businessForm.city.trim(),
        default_currency: 'CDF',
      }),
    onMutate: () => setError(''),
    onSuccess: async (business) => {
      await queryClient.invalidateQueries({ queryKey: ['seller', 'businesses'] })
      setBusinessId(business.id)
      setJustCreatedBusiness(true)
      setStep('shop')
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : t('seller.onboardingFailed')),
  })

  const createShop = useMutation({
    mutationFn: () => {
      if (!businessId) throw new Error('NO_BUSINESS')
      return sellerApi.createShop(businessId, {
        name: shopForm.name.trim(),
        type: shopType,
        city: shopForm.city.trim(),
        address: shopForm.address.trim(),
        phone: shopForm.phone.trim(),
      })
    },
    onMutate: () => setError(''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seller', 'businesses'] })
      await queryClient.invalidateQueries({ queryKey: ['seller', 'shops'] })
      router.replace('/seller')
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : t('seller.createShopFailed')),
  })

  const businessValid = Object.values(businessForm).every((value) => value.trim())
  const shopValid = Object.values(shopForm).every((value) => value.trim())

  if (businesses.isLoading) return <Loading label={t('seller.loadingOnboarding')} />

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.stepper}>
        <Text style={[styles.stepLabel, step === 'business' ? styles.stepActive : styles.stepDone]}>{t('seller.onboarding.stepBusiness')}</Text>
        <Text style={styles.stepDivider}>—</Text>
        <Text style={[styles.stepLabel, step === 'shop' && styles.stepActive]}>{t('seller.onboarding.stepShop')}</Text>
      </View>

      {step === 'business' ? (
        <>
          <SectionTitle title={t('seller.onboardingTitle')} />
          <Text style={styles.muted}>{t('seller.onboardingBody')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Card>
            <Field label={t('seller.businessName')} value={businessForm.name} onChangeText={(value) => setBusinessField('name', value)} autoCapitalize="words" />
            <Field label={t('seller.businessCategory')} value={businessForm.category} onChangeText={(value) => setBusinessField('category', value)} autoCapitalize="words" />
            <Field label={t('auth.phone')} value={businessForm.phone} onChangeText={(value) => setBusinessField('phone', value)} keyboardType="phone-pad" />
            <Field label={t('auth.email')} value={businessForm.email} onChangeText={(value) => setBusinessField('email', value)} keyboardType="email-address" autoCapitalize="none" />
            <Field label={t('seller.city')} value={businessForm.city} onChangeText={(value) => setBusinessField('city', value)} autoCapitalize="words" />
            <Field label={t('seller.country')} value={businessForm.country} onChangeText={(value) => setBusinessField('country', value)} autoCapitalize="characters" />
            <Button title={t('seller.createAndContinue')} loading={createBusiness.isPending} disabled={!businessValid} onPress={() => createBusiness.mutate()} />
          </Card>
        </>
      ) : (
        <>
          <SectionTitle title={t('seller.createShopTitle')} />
          {justCreatedBusiness && existingBusiness === undefined && (
            <Text style={styles.success}>{t('seller.onboarding.businessCreatedBody', { name: businessForm.name.trim() })}</Text>
          )}
          <Text style={styles.muted}>{t('seller.createShopBody')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Card>
            <Field label={t('seller.shopName')} value={shopForm.name} onChangeText={(value) => setShopField('name', value)} autoCapitalize="words" />
            <Text style={styles.fieldLabel}>{t('seller.shopType')}</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeOption, shopType === 'PHYSICAL' && styles.typeOptionActive]}
                onPress={() => setShopType('PHYSICAL')}
                accessibilityRole="button"
                accessibilityState={{ selected: shopType === 'PHYSICAL' }}
              >
                <Text style={[styles.typeLabel, shopType === 'PHYSICAL' && styles.typeLabelActive]}>{t('seller.shopTypePhysical')}</Text>
              </Pressable>
              <Pressable
                style={[styles.typeOption, shopType === 'ONLINE' && styles.typeOptionActive]}
                onPress={() => setShopType('ONLINE')}
                accessibilityRole="button"
                accessibilityState={{ selected: shopType === 'ONLINE' }}
              >
                <Text style={[styles.typeLabel, shopType === 'ONLINE' && styles.typeLabelActive]}>{t('seller.shopTypeOnline')}</Text>
              </Pressable>
            </View>
            <Field label={t('seller.city')} value={shopForm.city} onChangeText={(value) => setShopField('city', value)} autoCapitalize="words" />
            <Field label={t('seller.address')} value={shopForm.address} onChangeText={(value) => setShopField('address', value)} autoCapitalize="words" />
            <Field label={t('auth.phone')} value={shopForm.phone} onChangeText={(value) => setShopField('phone', value)} keyboardType="phone-pad" />
            <Button title={t('seller.createShopAndContinue')} loading={createShop.isPending} disabled={!shopValid} onPress={() => createShop.mutate()} />
          </Card>
        </>
      )}
    </ScrollView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  muted: { color: colors.muted, lineHeight: 21 },
  success: { color: colors.success, fontWeight: '700', lineHeight: 21 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  stepLabel: { fontWeight: '800', color: colors.muted },
  stepActive: { color: colors.green },
  stepDone: { color: colors.ink },
  stepDivider: { color: colors.border },
  fieldLabel: { color: colors.ink, fontWeight: '700' },
  typeRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  typeOption: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.white },
  typeOptionActive: { backgroundColor: colors.green },
  typeLabel: { fontWeight: '800', color: colors.ink },
  typeLabelActive: { color: colors.white },
})
